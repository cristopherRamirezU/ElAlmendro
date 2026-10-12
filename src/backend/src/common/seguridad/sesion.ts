import type { CookieOptions, Response } from 'express';
import type { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';

/**
 * Sesion del navegador: un JWT firmado (HS256) dentro de una cookie httpOnly.
 *
 * - El token solo lleva el id del usuario (`sub`) y su version de sesion
 *   (`ver`). Rol, permisos y organizacion se leen de la base en cada peticion
 *   (ver cargarUsuarioVigente), asi que el token no revela ni congela nada.
 * - `ver` es Usuario.versionSesion: subirla invalida de golpe todos los
 *   tokens emitidos antes (cerrar sesion en todos lados, cambio o reseteo de
 *   contrasena).
 * - Vence tras `duracionSesion()` sin uso, pero el guard lo renueva mientras
 *   la persona siga trabajando: nadie pierde la sesion a mitad de la jornada
 *   y una cookie robada o abandonada deja de servir sola.
 */

/** Cookie de antes de esta version: se borra al entrar o salir. */
export const COOKIE_LEGADO = 'tf_acceso';

/** Cada cuanto se reemplaza, como maximo, el token de alguien que sigue usando la app. */
export const RENOVAR_TRAS_MS = 60 * 60 * 1000;

const TTL_DEFECTO = '30d';

export interface CargaSesion {
  sub: string;
  ver: number;
  iat?: number;
  exp?: number;
}

export function esProduccion(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * En produccion la cookie lleva el prefijo `__Host-`: el navegador solo la
 * acepta con Secure, path=/ y sin Domain, de modo que ni un subdominio ni una
 * conexion sin HTTPS pueden plantar o pisar la sesion. En desarrollo (http)
 * ese prefijo no se puede usar.
 */
export function nombreCookieSesion(): string {
  return esProduccion() ? '__Host-tf_sesion' : 'tf_sesion';
}

export function secretoJwt(): string {
  const secreto = process.env.JWT_ACCESO_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!secreto) throw new Error('Falta JWT_ACCESS_SECRET en el .env: la API no puede firmar sesiones.');
  return secreto;
}

/**
 * Tiempo maximo sin usar la app antes de tener que volver a entrar, segun
 * JWT_ACCESO_TTL / JWT_ACCESS_TTL ("12h", "7d", ...). Ya no existen sesiones
 * sin vencimiento: "indefinido" (el valor historico) o cualquier valor que no
 * se entienda quedan en 30 dias, que con la renovacion automatica equivale en
 * la practica a "hasta cerrar sesion" para quien usa la app a diario.
 */
export function duracionSesion(): string {
  const ttl = (process.env.JWT_ACCESO_TTL ?? process.env.JWT_ACCESS_TTL ?? '').trim();
  return /^\d+\s*[smhd]$/i.test(ttl) && !/^0+\s*[smhd]$/i.test(ttl) ? ttl.replace(/\s+/g, '') : TTL_DEFECTO;
}

/** "15m" -> 900000, "8h" -> 28800000, "7d" -> ... */
export function milisegundos(ttl: string): number {
  const m = /^(\d+)\s*([smhd])$/i.exec(ttl.trim());
  if (!m) return 30 * 86_400_000;
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2].toLowerCase() as 's'];
  return Number(m[1]) * factor;
}

/**
 * Antiguedad a partir de la cual el guard emite un token nuevo: una hora, o
 * la mitad de la duracion si esta es corta (con "15m" se renueva a los 7,5
 * minutos; si se esperara una hora, el token venceria antes).
 */
export function renovarTrasMs(): number {
  return Math.min(RENOVAR_TRAS_MS, milisegundos(duracionSesion()) / 2);
}

export function firmarSesion(
  jwt: JwtService,
  usuario: { id: string; versionSesion: number },
): Promise<string> {
  return jwt.signAsync(
    { sub: usuario.id, ver: usuario.versionSesion },
    {
      secret: secretoJwt(),
      algorithm: 'HS256',
      expiresIn: duracionSesion() as SignOptions['expiresIn'],
    },
  );
}

/** Carga del token si la firma es valida, no vencio y trae version; si no, null. */
export async function leerSesion(jwt: JwtService, token: string): Promise<CargaSesion | null> {
  try {
    const carga = await jwt.verifyAsync<CargaSesion>(token, {
      secret: secretoJwt(),
      algorithms: ['HS256'],
    });
    // Los tokens de antes de esta version no traen `ver` (ni vencimiento):
    // se rechazan, y cada persona vuelve a entrar una sola vez.
    if (typeof carga?.sub !== 'string' || !Number.isInteger(carga?.ver)) return null;
    return carga;
  } catch {
    return null;
  }
}

function opcionesCookie(): CookieOptions {
  return {
    httpOnly: true,
    // strict: el navegador no la envia en peticiones que nacen en otro
    // sitio (CSRF). La app no la necesita al llegar desde un enlace externo:
    // la pagina carga y luego llama a la API desde el mismo sitio.
    sameSite: 'strict',
    secure: esProduccion(),
    path: '/',
  };
}

export function emitirCookieSesion(res: Response, token: string): void {
  res.cookie(nombreCookieSesion(), token, {
    ...opcionesCookie(),
    maxAge: milisegundos(duracionSesion()),
  });
}

export function borrarCookieSesion(res: Response): void {
  res.clearCookie(nombreCookieSesion(), opcionesCookie());
  res.clearCookie(COOKIE_LEGADO, { path: '/' });
}

/** Valor de una cookie desde la cabecera cruda (el handshake del socket no pasa por cookie-parser). */
export function leerCookie(cabecera: string | undefined, nombre: string): string | null {
  if (!cabecera) return null;
  for (const par of cabecera.split(';')) {
    const [clave, ...resto] = par.trim().split('=');
    if (clave === nombre) {
      try {
        return decodeURIComponent(resto.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}
