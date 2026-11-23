import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NodosService } from '../../../src/modules/nodos/nodos.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

const TRABAJADOR: UsuarioActual = {
  id: 'u-1',
  email: 'camila@org1.cl',
  nombreCompleto: 'Camila',
  rol: 'TRABAJADOR',
  permisos: [],
  organizacionId: 'org-1',
  zonaHoraria: 'America/Santiago',
};

const ADMIN: UsuarioActual = {
  ...TRABAJADOR,
  id: 'admin-1',
  rol: 'ADMINISTRADOR',
};

describe('NodosService', () => {
  let servicio: NodosService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(NodosService));
  });

  it('lanza NotFoundException cuando el proyecto no existe o pertenece a otra organizacion', async () => {
    prisma.proyecto.findFirst.mockResolvedValue(null);

    await expect(servicio.arbol(ADMIN, 'proy-ajeno')).rejects.toThrow(NotFoundException);
  });

  it('niega acceso si un trabajador no es miembro ni tiene tareas en el proyecto', async () => {
    prisma.proyecto.findFirst.mockResolvedValue({
      id: 'proy-1',
      propietarioId: 'admin-1',
      miembros: [{ usuarioId: 'otro-u' }],
    } as never);
    prisma.actividad.findFirst.mockResolvedValue(null);

    await expect(servicio.arbol(TRABAJADOR, 'proy-1')).rejects.toThrow(ForbiddenException);
  });

  it('devuelve actividades con conteo de monedas e inicioTrabajoEn', async () => {
    prisma.proyecto.findFirst.mockResolvedValue({
      id: 'proy-1',
      propietarioId: 'admin-1',
      miembros: [],
    } as never);
    const inicio = new Date('2026-11-10T12:00:00Z');
    prisma.actividad.findMany.mockResolvedValue([
      {
        id: 'act-1',
        titulo: 'Diseñar mapa',
        estado: 'EN_PROGRESO',
        prioridad: 'ALTA',
        actividadPadreId: null,
        posicionNodo: null,
        ladosLinea: null,
        orden: 0,
        responsableId: 'u-1',
        responsable: { id: 'u-1', nombreCompleto: 'Camila' },
        creadoEn: inicio,
        fechaLimite: null,
        completadaEn: null,
        subtareas: [{ completada: true }, { completada: false }],
      },
    ] as never);
    prisma.derivacion.findMany.mockResolvedValue([] as never);
    (prisma.sesionTrabajo.groupBy as jest.Mock).mockResolvedValue([
      { actividadId: 'act-1', _min: { inicioEn: inicio } },
    ]);

    const res = await servicio.arbol(ADMIN, 'proy-1');

    expect(res.actividades).toHaveLength(1);
    expect(res.actividades[0]).toEqual(
      expect.objectContaining({
        id: 'act-1',
        inicioTrabajoEn: inicio,
        monedas: 2,
        monedasListas: 1,
        bloqueadaPorOrden: false,
      }),
    );
  });

  it('marca bloqueadaPorOrden, ordenEnRama y prerequisitoTitulo cuando el padre tiene candado', async () => {
    prisma.proyecto.findFirst.mockResolvedValue({
      id: 'proy-1',
      propietarioId: 'admin-1',
      miembros: [],
    } as never);
    const base = new Date('2026-11-10T12:00:00Z');
    prisma.actividad.findMany.mockResolvedValue([
      {
        id: 'padre',
        titulo: 'Fase 1',
        estado: 'PENDIENTE',
        prioridad: 'MEDIA',
        actividadPadreId: null,
        posicionNodo: null,
        ladosLinea: null,
        orden: 0,
        bloquearOrdenHijas: true,
        responsableId: 'u-1',
        responsable: { id: 'u-1', nombreCompleto: 'Camila' },
        creadoEn: base,
        fechaLimite: null,
        completadaEn: null,
        subtareas: [],
      },
      {
        id: 'hija-1',
        titulo: 'Subtarea A',
        estado: 'EN_PROGRESO',
        prioridad: 'MEDIA',
        actividadPadreId: 'padre',
        posicionNodo: null,
        ladosLinea: null,
        orden: 0,
        bloquearOrdenHijas: false,
        responsableId: 'u-1',
        responsable: { id: 'u-1', nombreCompleto: 'Camila' },
        creadoEn: base,
        fechaLimite: null,
        completadaEn: null,
        subtareas: [],
      },
      {
        id: 'hija-2',
        titulo: 'Subtarea B',
        estado: 'PENDIENTE',
        prioridad: 'MEDIA',
        actividadPadreId: 'padre',
        posicionNodo: null,
        ladosLinea: null,
        orden: 1,
        bloquearOrdenHijas: false,
        responsableId: 'u-1',
        responsable: { id: 'u-1', nombreCompleto: 'Camila' },
        creadoEn: base,
        fechaLimite: null,
        completadaEn: null,
        subtareas: [],
      },
    ] as never);
    prisma.derivacion.findMany.mockResolvedValue([] as never);
    (prisma.sesionTrabajo.groupBy as jest.Mock).mockResolvedValue([]);

    const res = await servicio.arbol(ADMIN, 'proy-1');
    const h1 = res.actividades.find((a) => a.id === 'hija-1');
    const h2 = res.actividades.find((a) => a.id === 'hija-2');

    expect(h1).toEqual(
      expect.objectContaining({
        ordenEnRama: 1,
        bloqueadaPorOrden: false,
        prerequisitoTitulo: null,
      }),
    );
    expect(h2).toEqual(
      expect.objectContaining({
        ordenEnRama: 2,
        bloqueadaPorOrden: true,
        prerequisitoTitulo: 'Subtarea A',
      }),
    );
  });
});
