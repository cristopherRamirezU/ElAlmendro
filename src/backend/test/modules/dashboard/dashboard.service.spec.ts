import { DashboardService } from '../../../src/modules/dashboard/dashboard.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

const ADMIN: UsuarioActual = {
  id: 'admin-1',
  email: 'admin@org1.cl',
  nombreCompleto: 'Admin',
  rol: 'ADMINISTRADOR',
  permisos: [],
  organizacionId: 'org-1',
  zonaHoraria: 'America/Santiago',
};

const SUPER_ADMIN: UsuarioActual = {
  ...ADMIN,
  id: 'sa-1',
  rol: 'SUPER_ADMIN',
  organizacionId: null,
};

describe('DashboardService', () => {
  let servicio: DashboardService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(DashboardService));
  });

  it('acota resumen al alcance de la organizacion del administrador', async () => {
    prisma.sesionTrabajo.findMany.mockResolvedValue([] as never);
    prisma.jornada.count.mockResolvedValue(2);
    (prisma.actividad.groupBy as jest.Mock).mockResolvedValue([
      { estado: 'EN_PROGRESO', _count: { _all: 3 } },
      { estado: 'COMPLETADA', _count: { _all: 5 } },
    ]);
    prisma.$queryRaw.mockResolvedValue([{ segundos: 7200 }] as never);

    const res = await servicio.resumen(ADMIN);

    expect(prisma.jornada.count).toHaveBeenCalledWith({
      where: { terminoEn: null, organizacionId: 'org-1' },
    });
    expect(res).toEqual({
      trabajandoAhora: [],
      jornadasAbiertas: 2,
      actividadesPorEstado: [
        { estado: 'EN_PROGRESO', total: 3 },
        { estado: 'COMPLETADA', total: 5 },
      ],
      segundosHoy: 7200,
      segundosSemana: 7200,
    });
  });

  it('permite resumen global para SUPER_ADMIN sin filtro de organizacion', async () => {
    prisma.sesionTrabajo.findMany.mockResolvedValue([] as never);
    prisma.jornada.count.mockResolvedValue(10);
    (prisma.actividad.groupBy as jest.Mock).mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([{ segundos: 0 }] as never);

    await servicio.resumen(SUPER_ADMIN);

    expect(prisma.jornada.count).toHaveBeenCalledWith({
      where: { terminoEn: null },
    });
  });

  it('calcula progresoPersonal agrupando estados de tareas del trabajador', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ segundos: 3600 }] as never)
      .mockResolvedValueOnce([{ segundos: 14400 }] as never)
      .mockResolvedValueOnce([{ dias: 4 }] as never)
      .mockResolvedValueOnce([{ total: 5 }] as never);
    (prisma.actividad.groupBy as jest.Mock).mockResolvedValue([
      { estado: 'PENDIENTE', _count: { _all: 2 } },
      { estado: 'EN_PROGRESO', _count: { _all: 1 } },
      { estado: 'COMPLETADA', _count: { _all: 4 } },
    ]);

    const res = await servicio.progresoPersonal('u-1', 'America/Santiago');

    expect(res).toEqual({
      segundosSemana: 3600,
      segundosMes: 14400,
      diasLaborados: 4,
      totalJornadas: 5,
      tareasPendientes: 2,
      tareasEnProgreso: 1,
      tareasCompletadas: 4,
    });
  });
});
