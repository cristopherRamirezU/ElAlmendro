import { BadRequestException, ConflictException } from '@nestjs/common';
import { PlanSaaS } from '@prisma/client';
import { OrganizacionesService } from '../../../src/modules/organizaciones/organizaciones.service';
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

describe('OrganizacionesService', () => {
  let servicio: OrganizacionesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(OrganizacionesService));
  });

  it('rechaza crear organizacion si el slug ya existe', async () => {
    prisma.organizacion.findUnique.mockResolvedValueOnce({ id: 'existente' } as never);

    await expect(
      servicio.crear({ nombre: 'Empresa', slug: 'empresa' }),
    ).rejects.toThrow(ConflictException);
  });

  it('exige politica de contrasena fuerte al crear administrador inicial', async () => {
    prisma.organizacion.findUnique.mockResolvedValue(null);
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      servicio.crear({
        nombre: 'Empresa',
        slug: 'empresa',
        adminEmail: 'jefe@empresa.cl',
        adminPassword: '123',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.organizacion.create).not.toHaveBeenCalled();
  });

  it('devuelve cuotas y plan actual en obtenerMia', async () => {
    prisma.organizacion.findUnique.mockResolvedValue({
      id: 'org-1',
      nombre: 'El Almendro',
      rut: null,
      plan: PlanSaaS.PRO,
      maxUsuarios: 25,
      maxProyectos: 15,
      colorPrimario: '#0ea5e9',
      temaFondo: 'oscuro-medianoche',
      _count: { usuarios: 8, proyectos: 3 },
    } as never);

    const res = await servicio.obtenerMia(ADMIN);

    expect(res).toEqual({
      id: 'org-1',
      nombre: 'El Almendro',
      rut: null,
      plan: PlanSaaS.PRO,
      maxUsuarios: 25,
      maxProyectos: 15,
      colorPrimario: '#0ea5e9',
      temaFondo: 'oscuro-medianoche',
      totalUsuarios: 8,
      totalProyectos: 3,
    });
  });

  it('actualiza color y tema propio y registra evento de auditoria', async () => {
    prisma.organizacion.update.mockResolvedValue({
      id: 'org-1',
      nombre: 'El Almendro',
      colorPrimario: '#22c55e',
      temaFondo: 'claro-nube',
    } as never);
    prisma.registroAuditoria.create.mockResolvedValue({} as never);

    const res = await servicio.actualizarColorPropio(ADMIN, {
      colorPrimario: '#22c55e',
      temaFondo: 'claro-nube',
    });

    expect(res.colorPrimario).toBe('#22c55e');
    expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizacionId: 'org-1',
        accion: 'ORGANIZACION_COLOR_ACTUALIZADO',
      }),
    });
  });
});
