import { UnauthorizedException } from '@nestjs/common';
import { cargarUsuarioVigente } from '../../../src/common/jwt-auth.guard';
import { crearPrismaMock, PrismaMock } from '../../utilidades/prisma-mock';

const ORG = 'a0000000-0000-0000-0000-00000000000a';

/** Fila de usuario tal como la devuelve el select del guard. */
const fila = (cambios: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'u1@x.cl',
  rol: 'TRABAJADOR',
  nombreCompleto: 'U1',
  activo: true,
  organizacionId: ORG,
  organizacion: { nombre: 'El Almendro', slug: 'el-almendro', activo: true },
  ...cambios,
});

describe('cargarUsuarioVigente (JwtAuthGuard)', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = crearPrismaMock();
  });

  const cargar = (valor: unknown) => {
    prisma.usuario.findUnique.mockResolvedValue(valor as never);
    return cargarUsuarioVigente(prisma, 'u1');
  };

  it('toma rol y organizacion de la base, no del token', async () => {
    const u = await cargar(fila({ rol: 'SUPERVISOR' }));
    expect(u.rol).toBe('SUPERVISOR');
    expect(u.organizacionId).toBe(ORG);
    expect(u.permisos).toContain('actividades:gestionar');
  });

  it('corta al instante una cuenta desactivada', async () => {
    await expect(cargar(fila({ activo: false }))).rejects.toThrow(UnauthorizedException);
  });

  it('corta al instante a toda la empresa suspendida', async () => {
    await expect(
      cargar(fila({ organizacion: { nombre: 'X', slug: 'x', activo: false } })),
    ).rejects.toThrow(/suspendida/);
  });

  it('rechaza una cuenta comun sin organizacion', async () => {
    await expect(cargar(fila({ organizacionId: null, organizacion: null }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un usuario eliminado', async () => {
    await expect(cargar(null)).rejects.toThrow(UnauthorizedException);
  });

  it('SUPER_ADMIN entra sin organizacion', async () => {
    const u = await cargar(fila({ rol: 'SUPER_ADMIN', organizacionId: null, organizacion: null }));
    expect(u.organizacionId).toBeNull();
  });
});
