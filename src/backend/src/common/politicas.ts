/**
 * Version vigente de los terminos de uso y la politica de privacidad.
 *
 * Al cambiar los textos de forma relevante, subir esta version (y la fecha
 * "vigencia" de lib/sitio.ts en el frontend): todos los usuarios deberan
 * aceptarlos de nuevo al entrar. El frontend la recibe de /auth/yo.
 */
export const VERSION_POLITICAS = '2026-11-20';

/** La persona aun no acepto la version vigente. */
export function politicasPendientes(versionAceptada: string | null | undefined): boolean {
  return versionAceptada !== VERSION_POLITICAS;
}
