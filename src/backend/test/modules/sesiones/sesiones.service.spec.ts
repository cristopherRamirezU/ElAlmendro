import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SesionesService } from '../../../src/modules/sesiones/sesiones.service';
import { ActividadesService } from '../../../src/modules/actividades/actividades.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';

const USUARIO = 'usuario-1';
const OTRO = 'usuario-2';
const SESION = 'sesion-1';

const sesionViva = (extra: Record<string, unknown> = {}) => ({
  id: SESION,
  usuarioId: USUARIO,
  actividadId: 'actividad-1',
  estado: 'ACTIVA',
  ...extra,
});

describe('SesionesService', () => {
  let servicio: SesionesService;
  let prisma: PrismaMock;
  let actividades: { exigirEvidencia: jest.Mock };

  beforeEach(async () => {
    // Al cerrar una sesion se delega en ActividadesService la comprobacion
    // de que la tarea tenga evidencia adjunta.
    actividades = { exigirEvidencia: jest.fn().mockResolvedValue(undefined) };
    ({ servicio, prisma } = await montarServicio(SesionesService, [
      { provide: ActividadesService, useValue: actividades },
    ]));
  });

  describe('iniciar', () => {
    /** Deja el camino feliz preparado; cada test rompe solo el eslabon que prueba. */
    const prepararCaminoFeliz = () => {
      prisma.jornada.findFirst.mockResolvedValue({ id: 'jornada-1' } as never);
      prisma.sesionTrabajo.findFirst
        .mockResolvedValueOnce(null as never) // no hay sesion viva
        .mockResolvedValueOnce({
          ...sesionViva(),
          tramos: [],
          actividad: {},
        } as never); // la que devuelve activa() al final
      prisma.actividad.findFirst.mockResolvedValue({
        id: 'actividad-1',
        responsableId: USUARIO,
        estado: 'PENDIENTE',
        proyecto: { organizacionId: 'org-1' },
      } as never);
      prisma.sesionTrabajo.create.mockResolvedValue({ id: SESION } as never);
    };

    it('exige marcar entrada antes de cronometrar', async () => {
      prisma.jornada.findFirst.mockResolvedValue(null as never);

      await expect(
        servicio.iniciar(USUARIO, { actividadId: 'actividad-1' }),
      ).rejects.toThrow(/marcar tu entrada/i);
    });

    it('rechaza una segunda sesion si ya hay una viva', async () => {
      prisma.jornada.findFirst.mockResolvedValue({ id: 'jornada-1' } as never);
      prisma.sesionTrabajo.findFirst.mockResolvedValue(sesionViva() as never);

      await expect(
        servicio.iniciar(USUARIO, { actividadId: 'actividad-1' }),
      ).rejects.toThrow(/ya tienes una sesion abierta/i);
    });

    it('rechaza una actividad inexistente o eliminada', async () => {
      prisma.jornada.findFirst.mockResolvedValue({ id: 'jornada-1' } as never);
      prisma.sesionTrabajo.findFirst.mockResolvedValue(null as never);
      prisma.actividad.findFirst.mockResolvedValue(null as never);

      await expect(
        servicio.iniciar(USUARIO, { actividadId: 'fantasma' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza cronometrar una actividad de otro responsable', async () => {
      prisma.jornada.findFirst.mockResolvedValue({ id: 'jornada-1' } as never);
      prisma.sesionTrabajo.findFirst.mockResolvedValue(null as never);
      prisma.actividad.findFirst.mockResolvedValue({
        id: 'actividad-1',
        responsableId: OTRO,
        estado: 'PENDIENTE',
      } as never);

      await expect(
        servicio.iniciar(USUARIO, { actividadId: 'actividad-1' }),
      ).rejects.toThrow(/no esta asignada a ti/i);
    });

    it('crea sesion, un unico tramo y auditoria en la misma transaccion', async () => {
      prepararCaminoFeliz();

      await servicio.iniciar(USUARIO, { actividadId: 'actividad-1' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.sesionTrabajo.create).toHaveBeenCalledTimes(1);
      expect(prisma.tramoSesion.create).toHaveBeenCalledTimes(1);
      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ accion: 'SESION_INICIADA' }),
        }),
      );
    });

    it('mueve la actividad PENDIENTE a EN_PROGRESO', async () => {
      prepararCaminoFeliz();

      await servicio.iniciar(USUARIO, { actividadId: 'actividad-1' });

      expect(prisma.actividad.update).toHaveBeenCalledWith({
        where: { id: 'actividad-1' },
        data: { estado: 'EN_PROGRESO' },
      });
    });

    it('no toca el estado de una actividad BLOQUEADA', async () => {
      prepararCaminoFeliz();
      prisma.actividad.findFirst.mockResolvedValue({
        id: 'actividad-1',
        responsableId: USUARIO,
        estado: 'BLOQUEADA',
        proyecto: { organizacionId: 'org-1' },
      } as never);

      await servicio.iniciar(USUARIO, { actividadId: 'actividad-1' });

      expect(prisma.actividad.update).not.toHaveBeenCalled();
    });
  });

  describe('pausar', () => {
    it('rechaza una sesion inexistente', async () => {
      prisma.sesionTrabajo.findUnique.mockResolvedValue(null as never);

      await expect(servicio.pausar(USUARIO, SESION)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza pausar la sesion de otro trabajador', async () => {
      prisma.sesionTrabajo.findUnique.mockResolvedValue(
        sesionViva({ usuarioId: OTRO }) as never,
      );

      await expect(servicio.pausar(USUARIO, SESION)).rejects.toThrow(
        /no es tuya/i,
      );
    });

    it('rechaza pausar una sesion ya cerrada', async () => {
      prisma.sesionTrabajo.findUnique.mockResolvedValue(
        sesionViva({ estado: 'CERRADA' }) as never,
      );

      await expect(servicio.pausar(USUARIO, SESION)).rejects.toThrow(
        /ya esta cerrada/i,
      );
    });

    it('rechaza pausar una sesion que ya esta en pausa', async () => {
      prisma.sesionTrabajo.findUnique.mockResolvedValue(
        sesionViva({ estado: 'PAUSADA' }) as never,
      );

      await expect(servicio.pausar(USUARIO, SESION)).rejects.toThrow(
        /ya esta en pausa/i,
      );
    });

    it('cierra el tramo vigente y deja la sesion en PAUSADA', async () => {
      prisma.sesionTrabajo.findUnique.mockResolvedValue(sesionViva() as never);
      prisma.tramoSesion.findFirst.mockResolvedValue({ id: 'tramo-1' } as never);
      prisma.sesionTrabajo.findFirst.mockResolvedValue(null as never);

      await servicio.pausar(USUARIO, SESION);

      expect(prisma.tramoSesion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tramo-1' },
          data: { terminoEn: expect.any(Date) },
        }),
      );
      expect(prisma.sesionTrabajo.update).toHaveBeenCalledWith({
        where: { id: SESION },
        data: { estado: 'PAUSADA' },
      });
    });
  });

  describe('reanudar', () => {
    it('abre un tramo nuevo en vez de reabrir el cerrado', async () => {
      prisma.sesionTrabajo.findUnique.mockResolvedValue(
        sesionViva({ estado: 'PAUSADA' }) as never,
      );
      prisma.sesionTrabajo.findFirst.mockResolvedValue(null as never);

      await servicio.reanudar(USUARIO, SESION);

      expect(prisma.tramoSesion.create).toHaveBeenCalledWith({
        data: { sesionId: SESION, usuarioId: USUARIO },
      });
      expect(prisma.tramoSesion.update).not.toHaveBeenCalled();
    });

    it('rechaza reanudar una sesion que ya corre', async () => {
      prisma.sesionTrabajo.findUnique.mockResolvedValue(sesionViva() as never);

      await expect(servicio.reanudar(USUARIO, SESION)).rejects.toThrow(
        /ya esta corriendo/i,
      );
    });
  });

  describe('cerrar', () => {
    beforeEach(() => {
      prisma.sesionTrabajo.findUnique.mockResolvedValue(sesionViva() as never);
      prisma.tramoSesion.findFirst.mockResolvedValue(null as never);
    });

    it('exige nota cuando el trabajo queda INCONCLUSA', async () => {
      await expect(
        servicio.cerrar(USUARIO, SESION, { desenlace: 'INCONCLUSA' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no acepta una nota de solo espacios', async () => {
      await expect(
        servicio.cerrar(USUARIO, SESION, {
          desenlace: 'INCONCLUSA',
          notaCierre: '   ',
        }),
      ).rejects.toThrow(/explica por que/i);
    });

    it('cerrar como COMPLETADA deja la actividad COMPLETADA', async () => {
      await servicio.cerrar(USUARIO, SESION, { desenlace: 'COMPLETADA' });

      expect(prisma.actividad.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'actividad-1' },
          data: expect.objectContaining({
            estado: 'COMPLETADA',
            // Se sella la fecha de termino al completar.
            completadaEn: expect.any(Date),
          }),
        }),
      );
    });

    it('cerrar como INCONCLUSA con nota deja la actividad INCONCLUSA', async () => {
      await servicio.cerrar(USUARIO, SESION, {
        desenlace: 'INCONCLUSA',
        notaCierre: '  falta el repuesto  ',
      });

      expect(prisma.actividad.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'actividad-1' },
          data: expect.objectContaining({
            estado: 'INCONCLUSA',
            completadaEn: null,
          }),
        }),
      );
      // La nota se guarda recortada.
      expect(prisma.sesionTrabajo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notaCierre: 'falta el repuesto' }),
        }),
      );
    });
  });

  describe('segundos acumulados', () => {
    const EN = (hhmm: string) => new Date('2026-09-22T' + hhmm + ':00.000Z');

    afterEach(() => jest.useRealTimers());

    it('LA PAUSA NO CUENTA: suma los tramos, no el lapso inicio-termino', async () => {
      // Inicia 10:00, pausa 10:10, reanuda 10:40, y "ahora" son las 10:50.
      // Lapso ingenuo (termino - inicio) = 50 min = 3000 s.
      // Tiempo realmente trabajado = 10 min + 10 min = 1200 s.
      jest.useFakeTimers().setSystemTime(EN('10:50'));

      prisma.sesionTrabajo.findFirst.mockResolvedValue({
        ...sesionViva(),
        tramos: [
          { inicioEn: EN('10:00'), terminoEn: EN('10:10') },
          { inicioEn: EN('10:40'), terminoEn: null },
        ],
      } as never);

      const sesion = await servicio.activa(USUARIO);

      expect(sesion?.segundosAcumulados).toBe(1200);
    });

    it('una sesion sin tramos acumula cero', async () => {
      prisma.sesionTrabajo.findFirst.mockResolvedValue({
        ...sesionViva(),
        tramos: [],
      } as never);

      expect((await servicio.activa(USUARIO))?.segundosAcumulados).toBe(0);
    });

    it('devuelve null cuando no hay sesion viva', async () => {
      prisma.sesionTrabajo.findFirst.mockResolvedValue(null as never);

      expect(await servicio.activa(USUARIO)).toBeNull();
    });
  });
});
