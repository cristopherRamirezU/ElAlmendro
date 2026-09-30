import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsuarioActual } from './usuario-actual.decorator';

/**
 * Aislamiento Multi-SaaS: toda consulta sobre datos de una empresa pasa por
 * estas funciones, que fallan cerradas. Un usuario comun sin organizacion no
 * recibe "todo" sino un rechazo; solo SUPER_ADMIN opera sin organizacion, y
 * solo alli donde el endpoint lo permite de forma explicita.
 *
 * JwtAuthGuard ya garantiza que todo usuario distinto de SUPER_ADMIN trae su
 * organizacion leida de la base; aqui se vuelve a exigir para que un error en
 * otra capa no abra los datos de todas las empresas.
 */

export function esSuperAdmin(u: UsuarioActual): boolean {
  return u.rol === 'SUPER_ADMIN';
}

/** Organizacion obligatoria: para operar sobre datos propios de una empresa. */
export function exigirOrganizacion(u: UsuarioActual): string {
  if (!u.organizacionId) {
    throw new ForbiddenException(
      'Esta operacion requiere pertenecer a una organizacion.',
    );
  }
  return u.organizacionId;
}

/**
 * Organizacion por la que filtrar una lectura. `null` solo para SUPER_ADMIN,
 * que ve la plataforma completa; cualquier otro rol queda acotado a la suya.
 */
export function organizacionDeAlcance(u: UsuarioActual): string | null {
  return esSuperAdmin(u) ? null : exigirOrganizacion(u);
}

/** Filtro Prisma para modelos con columna `organizacionId`. */
export function filtroOrganizacion(u: UsuarioActual): { organizacionId?: string } {
  const org = organizacionDeAlcance(u);
  return org ? { organizacionId: org } : {};
}

/** Filtro Prisma para actividades, que heredan la organizacion de su proyecto. */
export function filtroActividadOrganizacion(
  u: UsuarioActual,
): { proyecto?: { organizacionId: string } } {
  const org = organizacionDeAlcance(u);
  return org ? { proyecto: { organizacionId: org } } : {};
}

/**
 * Verifica que un recurso ya leido pertenezca a la organizacion del usuario.
 * Responde 404 y no 403: confirmar que el id existe en otra empresa ya seria
 * filtrar informacion.
 */
export function asegurarMismaOrganizacion(
  u: UsuarioActual,
  organizacionRecurso: string | null | undefined,
  mensaje = 'El recurso no existe o no pertenece a tu organizacion.',
): void {
  if (esSuperAdmin(u)) return;
  if (!organizacionRecurso || organizacionRecurso !== exigirOrganizacion(u)) {
    throw new NotFoundException(mensaje);
  }
}

/** Normaliza un RUT chileno: sin puntos ni espacios, guion antes del DV y K mayuscula. */
export function normalizarRut(rut: string): string {
  const limpio = rut.replace(/[.\s-]/g, '').toUpperCase();
  if (limpio.length < 2) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

/** Correo en su forma canonica: la unicidad del sistema se evalua sobre ella. */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/**
 * Violacion de unicidad de Prisma (P2002). Las validaciones previas cubren el
 * caso normal; esto cubre la carrera de dos altas simultaneas con el mismo
 * correo, que la base resuelve por si sola.
 */
export function esViolacionUnica(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}
