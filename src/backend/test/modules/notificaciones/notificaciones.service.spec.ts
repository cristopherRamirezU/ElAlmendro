import { NotificacionesService } from '../../../src/modules/notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../../../src/modules/notificaciones/notificaciones.gateway';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

const USUARIO: UsuarioActual = {
  id: 'u-1',
  email: 'camila@timeflow.cl',
  nombreCompleto: 'Camila Soto',
  rol: 'TRABAJADOR',
  permisos: [],
  organizacionId: 'org-1',
  zonaHoraria: 'America/Santiago',
};

describe('NotificacionesService', () => {
  let servicio: NotificacionesService;
  let prisma: PrismaMock;
  const gateway = { emitirAUsuario: jest.fn() };

  beforeEach(async () => {
    gateway.emitirAUsuario.mockReset();
    ({ servicio, prisma } = await montarServicio(NotificacionesService, [
      { provide: NotificacionesGateway, useValue: gateway },
    ]));
  });

  it('persiste la notificacion y la emite en vivo solo al destinatario', async () => {
    const creada = {
      id: 'n-1',
      tipo: 'TAREA_ASIGNADA',
      titulo: 'Nueva tarea asignada',
      mensaje: 'Te asignaron una tarea.',
      enlace: '/nodos',
      entidadId: 'act-1',
      leidaEn: null,
      creadoEn: new Date(),
    };
    prisma.notificacion.create.mockResolvedValue(creada as never);

    const res = await servicio.crear({
      usuarioId: 'u-1',
      organizacionId: 'org-1',
      tipo: 'TAREA_ASIGNADA',
      titulo: 'Nueva tarea asignada',
      mensaje: 'Te asignaron una tarea.',
      enlace: '/nodos',
      entidadId: 'act-1',
    });

    expect(res).toEqual(creada);
    expect(gateway.emitirAUsuario).toHaveBeenCalledWith('u-1', creada);
  });

  it('no propaga excepciones si falla la persistencia de una notificacion', async () => {
    prisma.notificacion.create.mockRejectedValue(new Error('Error temporal'));

    await expect(
      servicio.crear({
        usuarioId: 'u-1',
        tipo: 'AUDIO_NODO',
        titulo: 'Audio',
        mensaje: 'Nuevo audio',
      }),
    ).resolves.toBeNull();
    expect(gateway.emitirAUsuario).not.toHaveBeenCalled();
  });

  it('lista y marca como leidas unicamente las notificaciones del usuario autenticado', async () => {
    prisma.notificacion.findMany.mockResolvedValue([] as never);
    prisma.notificacion.count.mockResolvedValue(3);

    const listado = await servicio.listar(USUARIO, 20);
    expect(listado).toEqual({ items: [], noLeidas: 3 });
    expect(prisma.notificacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 'u-1' }, take: 20 }),
    );

    prisma.notificacion.updateMany.mockResolvedValue({ count: 1 } as never);
    await servicio.marcarLeida(USUARIO, 'n-1');
    expect(prisma.notificacion.updateMany).toHaveBeenCalledWith({
      where: { id: 'n-1', usuarioId: 'u-1', leidaEn: null },
      data: { leidaEn: expect.any(Date) },
    });

    await servicio.marcarTodasLeidas(USUARIO);
    expect(prisma.notificacion.updateMany).toHaveBeenLastCalledWith({
      where: { usuarioId: 'u-1', leidaEn: null },
      data: { leidaEn: expect.any(Date) },
    });
  });
});
