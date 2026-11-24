import { leerCacheSesion } from './cacheSesion';

/** Zona del negocio: la de quien no eligio otra. */
export const ZONA_POR_DEFECTO = 'America/Santiago';

/** El navegador reconoce la zona (un nombre invalido haria fallar Intl). */
export function esZonaValida(zona: string | null | undefined): zona is string {
  if (!zona) return false;
  try {
    new Intl.DateTimeFormat('es-CL', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/**
 * Zona de quien esta usando la app: la que eligio en "Mi cuenta". Toda hora
 * que se le muestra se convierte a ella. Se lee de la cache de sesion, asi
 * esta disponible en cualquier funcion de formato sin pasar por React.
 */
export function zonaActual(): string {
  const zona = leerCacheSesion()?.usuario?.zonaHoraria;
  return esZonaValida(zona) ? zona : ZONA_POR_DEFECTO;
}

/** Zona configurada en este equipo, para ofrecerla con un clic. */
export function zonaDelNavegador(): string | null {
  try {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return esZonaValida(zona) ? zona : null;
  } catch {
    return null;
  }
}

/** Zonas comunes del equipo: van primero en el selector. */
const FRECUENTES = [
  'America/Santiago',
  'America/Punta_Arenas',
  'America/Argentina/Buenos_Aires',
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/Caracas',
  'America/Montevideo',
  'America/Sao_Paulo',
  'America/New_York',
  'Europe/Madrid',
  'Pacific/Easter',
];

/** Todas las zonas IANA que conoce el navegador, frecuentes aparte. */
export function zonasDisponibles(): { frecuentes: string[]; resto: string[] } {
  let todas: string[] = [];
  try {
    todas = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    todas = [];
  }
  const frecuentes = FRECUENTES.filter(esZonaValida);
  const resto = todas.filter((z) => !frecuentes.includes(z));
  return { frecuentes, resto };
}

/** "America/Santiago" -> "Santiago (America) · GMT-3", legible en una lista. */
export function nombreZona(zona: string | null | undefined): string {
  if (!zona) return '';
  const partes = zona.split('/');
  const ciudad = partes[partes.length - 1].replace(/_/g, ' ');
  const region = partes.length > 1 ? partes[0] : '';
  const off = desfase(zona);
  return `${ciudad}${region ? ` (${region})` : ''}${off ? ` · ${off}` : ''}`;
}

/** Desfase actual respecto de UTC, p. ej. "GMT-3" (cambia con el horario de verano). */
export function desfase(zona: string): string {
  try {
    const partes = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    return partes.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}
