import {
  guardarUsuarioCache,
  invalidarCacheOrganizacion,
  invalidarCacheUsuario,
  limpiarCacheUsuarios,
  obtenerUsuarioCache,
} from '../../../src/common/seguridad/cache-usuario';
import { cargarUsuarioVigente } from '../../../src/common/jwt-auth.guard';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';
import { crearPrismaMock } from '../../utilidades/prisma-mock';

const usuarioEjemplo = (overrides: Partial<UsuarioActual> = {}): UsuarioActual => ({
  id: 'u-1',
  email: 'u1@org1.cl',
  rol: 'TRABAJADOR',
  nombreCompleto: 'Usuario 1',
  permisos: ['actividades:ver_propias'],
  organizacionId: 'org-1',
  zonaHoraria: 'America/Santiago',
  ...overrides,
});

describe('cache-usuario', () => {
  beforeEach(() => {
    limpiarCacheUsuarios();
  });

  it('devuelve hit mientras no expire y no cambie versionSesion', () => {
    const u = usuarioEjemplo();
    guardarUsuarioCache('u-1', 2, u, 1000, 10_000);

    expect(obtenerUsuarioCache('u-1', 2, 5000)).toEqual(u);
    expect(obtenerUsuarioCache('u-1', 2, 10_999)).toEqual(u);
  });

  it('invalida y retorna null cuando vence el TTL', () => {
    const u = usuarioEjemplo();
    guardarUsuarioCache('u-1', 1, u, 1000, 5000);

    expect(obtenerUsuarioCache('u-1', 1, 6000)).toBeNull();
    expect(obtenerUsuarioCache('u-1', 1, 2000)).toBeNull();
  });

  it('rechaza y evicta cuando cambia versionSesion', () => {
    const u = usuarioEjemplo();
    guardarUsuarioCache('u-1', 1, u, 1000, 10_000);

    expect(obtenerUsuarioCache('u-1', 2, 2000)).toBeNull();
    expect(obtenerUsuarioCache('u-1', 1, 2000)).toBeNull();
  });

  it('invalidarCacheUsuario elimina solo al usuario indicado', () => {
    guardarUsuarioCache('u-1', 0, usuarioEjemplo({ id: 'u-1' }), 1000);
    guardarUsuarioCache('u-2', 0, usuarioEjemplo({ id: 'u-2' }), 1000);

    invalidarCacheUsuario('u-1');

    expect(obtenerUsuarioCache('u-1', 0, 2000)).toBeNull();
    expect(obtenerUsuarioCache('u-2', 0, 2000)?.id).toBe('u-2');
  });

  it('invalidarCacheOrganizacion elimina solo usuarios de esa empresa', () => {
    guardarUsuarioCache('u-1', 0, usuarioEjemplo({ id: 'u-1', organizacionId: 'org-1' }), 1000);
    guardarUsuarioCache('u-2', 0, usuarioEjemplo({ id: 'u-2', organizacionId: 'org-1' }), 1000);
    guardarUsuarioCache('u-3', 0, usuarioEjemplo({ id: 'u-3', organizacionId: 'org-2' }), 1000);

    invalidarCacheOrganizacion('org-1');

    expect(obtenerUsuarioCache('u-1', 0, 2000)).toBeNull();
    expect(obtenerUsuarioCache('u-2', 0, 2000)).toBeNull();
    expect(obtenerUsuarioCache('u-3', 0, 2000)?.id).toBe('u-3');
  });

  it('respeta el tope de 2000 entradas evictando las mas antiguas', () => {
    for (let i = 0; i < 2005; i++) {
      guardarUsuarioCache(`u-${i}`, 0, usuarioEjemplo({ id: `u-${i}` }), 1000, 60_000);
    }

    expect(obtenerUsuarioCache('u-0', 0, 2000)).toBeNull();
    expect(obtenerUsuarioCache('u-4', 0, 2000)).toBeNull();
    expect(obtenerUsuarioCache('u-5', 0, 2000)?.id).toBe('u-5');
    expect(obtenerUsuarioCache('u-2004', 0, 2000)?.id).toBe('u-2004');
  });

  it('cargarUsuarioVigente reutiliza cache y reconsulta al invalidar', async () => {
    const prisma = crearPrismaMock();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'u1@org1.cl',
      rol: 'TRABAJADOR',
      nombreCompleto: 'Usuario 1',
      activo: true,
      fondoMapa: null,
      zonaHoraria: 'America/Santiago',
      fotoPerfil: null,
      permisosExtra: [],
      versionSesion: 0,
      organizacionId: 'org-1',
      organizacion: {
        nombre: 'Org 1',
        slug: 'org-1',
        activo: true,
        colorPrimario: null,
        temaFondo: null,
      },
    } as never);

    const a = await cargarUsuarioVigente(prisma, 'u-1', 0, { forzarCache: true });
    const b = await cargarUsuarioVigente(prisma, 'u-1', 0, { forzarCache: true });
    expect(a).toEqual(b);
    expect(prisma.usuario.findUnique).toHaveBeenCalledTimes(1);

    invalidarCacheUsuario('u-1');
    await cargarUsuarioVigente(prisma, 'u-1', 0, { forzarCache: true });
    expect(prisma.usuario.findUnique).toHaveBeenCalledTimes(2);
  });
});
