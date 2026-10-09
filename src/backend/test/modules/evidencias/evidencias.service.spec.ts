import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EvidenciasService } from '../../../src/modules/evidencias/evidencias.service';
import { AlmacenamientoService } from '../../../src/infra/almacenamiento/almacenamiento.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

const TRABAJADORA = {
  id: 'u-1',
  email: 'ana@timeflow.cl',
  nombreCompleto: 'Ana',
  rol: 'TRABAJADOR',
  permisos: [],
  organizacionId: 'org-1',
} as UsuarioActual;
const ADMIN = { ...TRABAJADORA, id: 'admin-1', rol: 'ADMINISTRADOR' } as UsuarioActual;
const SUPERVISOR = { ...TRABAJADORA, id: 'sup-1', rol: 'SUPERVISOR' } as UsuarioActual;

/** Adjunto de una tarea, subido por `subidaPorId`. */
function adjunto({
  subidaPorId = 'u-1',
  estado = 'EN_PROGRESO',
  organizacionId = 'org-1',
}: { subidaPorId?: string; estado?: string; organizacionId?: string } = {}) {
  return {
    id: 'ev-1',
    nombreArchivo: 'informe.pdf',
    subidaPorId,
    eliminadaEn: null as Date | null,
    actividad: { id: 'A', estado, proyecto: { organizacionId } },
    sesion: null,
  };
}

describe('EvidenciasService', () => {
  let servicio: EvidenciasService;
  let prisma: PrismaMock;
  const almacenamiento = { subir: jest.fn(), descargar: jest.fn() };

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(EvidenciasService, [
      { provide: AlmacenamientoService, useValue: almacenamiento },
    ]));
  });

  describe('eliminar', () => {
    it('quien subio el archivo lo quita: queda marcado, nunca se borra', async () => {
      prisma.evidencia.findUnique.mockResolvedValue(adjunto() as never);

      await expect(servicio.eliminar(TRABAJADORA, 'ev-1')).resolves.toEqual({ ok: true });

      // La base prohibe borrar evidencias: es un borrado logico.
      expect(prisma.evidencia.delete).not.toHaveBeenCalled();
      expect(prisma.evidencia.update).toHaveBeenCalledWith({
        where: { id: 'ev-1' },
        data: { eliminadaEn: expect.any(Date), eliminadaPorId: 'u-1' },
      });
      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'EVIDENCIA_ELIMINADA',
          organizacionId: 'org-1',
          entidadId: 'ev-1',
        }),
      });
    });

    it('el administrador elimina archivos de otros', async () => {
      prisma.evidencia.findUnique.mockResolvedValue(adjunto({ subidaPorId: 'otro' }) as never);

      await servicio.eliminar(ADMIN, 'ev-1');

      expect(prisma.evidencia.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eliminadaPorId: 'admin-1' }) }),
      );
    });

    it('nadie mas puede, ni siquiera un supervisor', async () => {
      prisma.evidencia.findUnique.mockResolvedValue(adjunto({ subidaPorId: 'otro' }) as never);

      await expect(servicio.eliminar(SUPERVISOR, 'ev-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.evidencia.update).not.toHaveBeenCalled();
    });

    it('no se eliminan adjuntos de una tarea completada, ni el administrador', async () => {
      prisma.evidencia.findUnique.mockResolvedValue(adjunto({ estado: 'COMPLETADA' }) as never);

      await expect(servicio.eliminar(ADMIN, 'ev-1')).rejects.toThrow(BadRequestException);
      expect(prisma.evidencia.update).not.toHaveBeenCalled();
    });

    it('un archivo de otra organizacion responde como inexistente', async () => {
      prisma.evidencia.findUnique.mockResolvedValue(
        adjunto({ subidaPorId: 'admin-1', organizacionId: 'org-2' }) as never,
      );

      await expect(servicio.eliminar(ADMIN, 'ev-1')).rejects.toThrow(NotFoundException);
      expect(prisma.evidencia.update).not.toHaveBeenCalled();
    });

    it('un adjunto ya quitado responde como inexistente', async () => {
      prisma.evidencia.findUnique.mockResolvedValue({
        ...adjunto(),
        eliminadaEn: new Date(),
      } as never);

      await expect(servicio.eliminar(TRABAJADORA, 'ev-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('obtenerParaDescarga', () => {
    it('un adjunto quitado ya no se descarga', async () => {
      prisma.evidencia.findUnique.mockResolvedValue({
        id: 'ev-1',
        eliminadaEn: new Date(),
        actividad: { proyecto: { organizacionId: 'org-1' } },
        sesion: null,
      } as never);

      await expect(servicio.obtenerParaDescarga(TRABAJADORA, 'ev-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(almacenamiento.descargar).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('no lista los adjuntos quitados', async () => {
      prisma.evidencia.findMany.mockResolvedValue([] as never);

      await servicio.listar(TRABAJADORA, 'A');

      expect(prisma.evidencia.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ eliminadaEn: null }) }),
      );
    });

    it('indica en cada archivo si quien consulta puede eliminarlo', async () => {
      prisma.evidencia.findMany.mockResolvedValue([
        { id: 'propio', subidaPorId: 'u-1', actividad: { estado: 'EN_PROGRESO' } },
        { id: 'ajeno', subidaPorId: 'otro', actividad: { estado: 'EN_PROGRESO' } },
      ] as never);

      const lista = await servicio.listar(TRABAJADORA, 'A');

      expect(lista.map((e) => [e.id, e.puedeEliminar])).toEqual([
        ['propio', true],
        ['ajeno', false],
      ]);
      // No se exponen los datos internos usados para decidirlo.
      expect(lista[0]).not.toHaveProperty('subidaPorId');
    });

    it('en una tarea completada nadie puede eliminar', async () => {
      prisma.evidencia.findMany.mockResolvedValue([
        { id: 'propio', subidaPorId: 'admin-1', actividad: { estado: 'COMPLETADA' } },
      ] as never);

      const lista = await servicio.listar(ADMIN, 'A');

      expect(lista[0].puedeEliminar).toBe(false);
    });
  });
});
