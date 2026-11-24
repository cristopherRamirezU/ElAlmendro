import type { UsuarioActual } from '../usuario-actual.decorator';

interface EntradaUsuarioCache {
  usuario: UsuarioActual;
  versionSesion: number;
  expiraEn: number;
}

const MAX_ENTRADAS = 2000;
export const TTL_CACHE_USUARIO_MS = 10_000;

const cacheUsuarios = new Map<string, EntradaUsuarioCache>();

/**
 * En pruebas unitarias de Jest desactivamos el cache por defecto para no
 * acoplar estados entre specs independientes, salvo que el test lo pida.
 */
export function cacheUsuariosActiva(forzar = false): boolean {
  return forzar || !process.env.JEST_WORKER_ID;
}

export function obtenerUsuarioCache(
  usuarioId: string,
  versionToken: number,
  ahora = Date.now(),
): UsuarioActual | null {
  const entrada = cacheUsuarios.get(usuarioId);
  if (!entrada) return null;

  if (entrada.versionSesion !== versionToken || entrada.expiraEn <= ahora) {
    cacheUsuarios.delete(usuarioId);
    return null;
  }

  return entrada.usuario;
}

export function guardarUsuarioCache(
  usuarioId: string,
  versionSesion: number,
  usuario: UsuarioActual,
  ahora = Date.now(),
  ttlMs = TTL_CACHE_USUARIO_MS,
): void {
  if (cacheUsuarios.has(usuarioId)) {
    cacheUsuarios.delete(usuarioId);
  } else if (cacheUsuarios.size >= MAX_ENTRADAS) {
    for (const [k, v] of cacheUsuarios) {
      if (v.expiraEn <= ahora) cacheUsuarios.delete(k);
    }
    while (cacheUsuarios.size >= MAX_ENTRADAS) {
      const masAntiguo = cacheUsuarios.keys().next().value;
      if (masAntiguo === undefined) break;
      cacheUsuarios.delete(masAntiguo);
    }
  }

  cacheUsuarios.set(usuarioId, {
    usuario,
    versionSesion,
    expiraEn: ahora + ttlMs,
  });
}

export function invalidarCacheUsuario(usuarioId: string): void {
  cacheUsuarios.delete(usuarioId);
}

export function invalidarCacheOrganizacion(organizacionId: string): void {
  for (const [k, v] of cacheUsuarios) {
    if (v.usuario.organizacionId === organizacionId) {
      cacheUsuarios.delete(k);
    }
  }
}

export function limpiarCacheUsuarios(): void {
  cacheUsuarios.clear();
}
