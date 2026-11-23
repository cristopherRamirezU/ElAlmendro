import { zonaActual } from './zona';

/**
 * Toda marca llega desde la API en UTC. La conversion a la zona local ocurre
 * aqui y solo aqui: es la unica capa que puede hacerlo. La zona es la que
 * cada persona eligio en "Mi cuenta" (zonaActual).
 */

/** Segundos a HH:MM:SS, formato del cronometro. */
export function cronometro(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Segundos a una lectura breve: "45 s", "12 min", "2 h 15 min". */
export function duracion(segundos: number): string {
  if (segundos <= 0) return 'sin registro';
  if (segundos < 60) return `${segundos} s`;

  const totalMin = Math.floor(segundos / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Hora en la zona de quien mira, o en otra (p. ej. la del trabajador). */
export function hora(iso: string, zona: string = zonaActual()): string {
  return new Date(iso).toLocaleTimeString('es-CL', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ESTADOS: Record<string, { texto: string; clase: string; punto: string }> = {
  PENDIENTE:   { texto: 'Por hacer',   clase: 'text-[var(--tf-acento-azul)] bg-sky-500/12 border-sky-500/30',       punto: 'bg-sky-500' },
  EN_PROGRESO: { texto: 'En progreso', clase: 'text-[var(--tf-acento-ambar)] bg-amber-500/12 border-amber-500/30', punto: 'bg-amber-500' },
  BLOQUEADA:   { texto: 'Bloqueada',   clase: 'text-[var(--tf-acento-rojo)] bg-rose-500/12 border-rose-500/30',    punto: 'bg-rose-500' },
  INCONCLUSA:  { texto: 'Inconclusa',  clase: 'text-[var(--tf-acento-naranja)] bg-orange-500/12 border-orange-500/30', punto: 'bg-orange-500' },
  COMPLETADA:  { texto: 'Completada',  clase: 'text-[var(--tf-acento-verde)] bg-emerald-500/12 border-emerald-500/30', punto: 'bg-emerald-500' },
  CANCELADA:   { texto: 'Cancelada',   clase: 'text-[var(--tf-texto-tenue)] bg-[var(--tf-hover)] border-[var(--tf-borde)]', punto: 'bg-slate-500' },
};

export const PRIORIDADES: Record<string, string> = {
  BAJA: 'text-[var(--tf-texto-tenue)] bg-[var(--tf-hover)]',
  MEDIA: 'text-[var(--tf-acento-azul)] bg-sky-500/12',
  ALTA: 'text-[var(--tf-acento-naranja)] bg-orange-500/12',
  CRITICA: 'text-[var(--tf-acento-rojo)] bg-rose-500/12',
};

/** Iniciales para el avatar. */
export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** "jueves 4 de septiembre de 2026", para el encabezado del detalle de un dia. */
export function fechaLarga(clave: string): string {
  // Una fecha de calendario (sin hora): se lee a mediodia UTC para que ningun
  // desfase la mueva de dia.
  return new Date(`${clave}T12:00:00Z`).toLocaleDateString('es-CL', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "6,5 h" — lectura compacta para las celdas del calendario. */
export function horasBreves(segundos: number): string {
  return `${(segundos / 3600).toFixed(1).replace('.', ',')} h`;
}

/** "Hoy", "Ayer" o "lunes 14 de septiembre": separador de dias del chat. */
export function diaRelativo(iso: string): string {
  const zona = zonaActual();
  const opciones: Intl.DateTimeFormatOptions = { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' };
  const clave = new Date(iso).toLocaleDateString('es-CL', opciones);
  const hoy = new Date();
  if (clave === hoy.toLocaleDateString('es-CL', opciones)) return 'Hoy';
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
  if (clave === ayer.toLocaleDateString('es-CL', opciones)) return 'Ayer';
  return new Date(iso).toLocaleDateString('es-CL', {
    timeZone: zona,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
