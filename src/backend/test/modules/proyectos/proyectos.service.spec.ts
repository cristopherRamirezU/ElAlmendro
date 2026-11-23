import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProyectosService } from '../../../src/modules/proyectos/proyectos.service';
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

const TRABAJADOR: UsuarioActual = {
  ...ADMIN,
  id: 'u-1',
  rol: 'TRABAJADOR',
};

describe('ProyectosService', () => {
  let servicio: ProyectosService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(ProyectosService));
  });

  it('respeta la cuota maxProyectos al intentar crear un proyecto nuevo', async () => {
    prisma.organizacion.findUnique.mockResolvedValue({
      id: 'org-1',
      maxProyectos: 5,
      _count: { proyectos: 5 },
    } as never);

    await expect(
      servicio.crear(ADMIN, { nombre: 'Extra' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.proyecto.create).not.toHaveBeenCalled();
  });

  it('crea el proyecto e inscribe al creador como LIDER cuando hay cupo', async () => {
    prisma.organizacion.findUnique.mockResolvedValue({
      id: 'org-1',
      maxProyectos: 5,
      _count: { proyectos: 1 },
    } as never);
    prisma.proyecto.create.mockResolvedValue({
      id: 'proy-1',
      nombre: 'Nuevo Proyecto',
      descripcion: null,
      estado: 'ACTIVO',
      creadoEn: new Date(),
    } as never);

    const res = await servicio.crear(ADMIN, { nombre: 'Nuevo Proyecto' });

    expect(res).toEqual(
      expect.objectContaining({
        id: 'proy-1',
        totalTareas: 0,
        tareasCompletadas: 0,
      }),
    );
  });

  it('impide a un TRABAJADOR modificar un proyecto', async () => {
    await expect(
      servicio.actualizar('proy-1', TRABAJADOR, { nombre: 'Otro' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('al eliminar un proyecto como ADMINISTRADOR cierra sesiones abiertas y marca eliminadoEn', async () => {
    prisma.proyecto.findFirst.mockResolvedValue({
      id: 'proy-1',
      nombre: 'Proyecto A',
      organizacionId: 'org-1',
      actividades: [{ id: 'act-1' }],
    } as never);

    const res = await servicio.eliminar('proy-1', ADMIN);

    expect(res.ok).toBe(true);
    expect(prisma.sesionTrabajo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'AUTOCERRADA', desenlace: 'INCONCLUSA' }),
      }),
    );
    expect(prisma.actividad.updateMany).toHaveBeenCalled();
    expect(prisma.proyecto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proy-1' },
        data: expect.objectContaining({ estado: 'CERRADO' }),
      }),
    );
  });
});
