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
  const texto = new Date(iso).toLocaleTimeString('es-CL', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return texto
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s*([ap])\.?\s*m\.?/i, (_, letra: string) => ` ${letra.toUpperCase()}M`)
    .trim();
}

export interface DefinicionEstado {
  texto: string;
  clase: string;
  punto: string;
  rgb: string;
  color: string;
  colorClaro: string;
  barraGantt: string;
  celdaGantt: string;
}

export const ESTADOS: Record<string, DefinicionEstado> = {
  PENDIENTE: {
    texto: 'Por hacer',
    clase: 'text-[var(--tf-acento-azul)] bg-sky-500/12 border-sky-500/30',
    punto: 'bg-sky-500',
    rgb: '56,189,248',
    color: '#38bdf8',
    colorClaro: '#0369a1',
    barraGantt: 'bg-sky-500/30 border-sky-400/50',
    celdaGantt: 'bg-sky-400',
  },
  EN_PROGRESO: {
    texto: 'En progreso',
    clase: 'text-[var(--tf-acento-ambar)] bg-amber-500/12 border-amber-500/30',
    punto: 'bg-amber-500',
    rgb: '245,158,11',
    color: '#f59e0b',
    colorClaro: '#b45309',
    barraGantt: 'bg-amber-500/35 border-amber-400/60',
    celdaGantt: 'bg-amber-400',
  },
  BLOQUEADA: {
    texto: 'Bloqueada',
    clase: 'text-[var(--tf-acento-rojo)] bg-rose-500/12 border-rose-500/30',
    punto: 'bg-rose-500',
    rgb: '244,63,94',
    color: '#f43f5e',
    colorClaro: '#be123c',
    barraGantt: 'bg-rose-500/35 border-rose-400/60',
    celdaGantt: 'bg-rose-400',
  },
  INCONCLUSA: {
    texto: 'Inconclusa',
    clase: 'text-[var(--tf-acento-naranja)] bg-orange-500/12 border-orange-500/30',
    punto: 'bg-orange-500',
    rgb: '249,115,22',
    color: '#f97316',
    colorClaro: '#c2410c',
    barraGantt: 'bg-orange-500/35 border-orange-400/60',
    celdaGantt: 'bg-orange-400',
  },
  COMPLETADA: {
    texto: 'Completada',
    clase: 'text-[var(--tf-acento-verde)] bg-emerald-500/12 border-emerald-500/30',
    punto: 'bg-emerald-500',
    rgb: '16,185,129',
    color: '#10b981',
    colorClaro: '#047857',
    barraGantt: 'bg-emerald-500/35 border-emerald-400/60',
    celdaGantt: 'bg-emerald-400',
  },
  CANCELADA: {
    texto: 'Cancelada',
    clase: 'text-[var(--tf-texto-tenue)] bg-[var(--tf-hover)] border-[var(--tf-borde)]',
    punto: 'bg-slate-500',
    rgb: '148,163,184',
    color: '#64748b',
    colorClaro: '#475569',
    barraGantt: 'bg-slate-500/25 border-slate-400/40',
    celdaGantt: 'bg-slate-400',
  },
};

export function estadoDeActividad(estado: string): DefinicionEstado {
  return ESTADOS[estado] ?? ESTADOS.PENDIENTE;
}

export const ROLES_ETIQUETA: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor',
  TRABAJADOR: 'Trabajador',
};

export function etiquetaRol(rol?: string | null): string {
  if (!rol) return 'Equipo';
  return ROLES_ETIQUETA[rol] ?? rol;
}

export const PLANES_ETIQUETA: Record<string, string> = {
  GRATIS: 'Básico',
  PRO: 'Pro',
  EMPRESA: 'Empresa',
};

export function etiquetaPlan(plan?: string | null): string {
  if (!plan) return 'Básico';
  return PLANES_ETIQUETA[plan] ?? plan;
}

export const ENTIDADES_ETIQUETA: Record<string, string> = {
  Actividad: 'Tarea',
  SesionTrabajo: 'Sesión de trabajo',
  Evidencia: 'Evidencia',
  Proyecto: 'Proyecto',
  Usuario: 'Usuario',
  Organizacion: 'Empresa',
};

export function etiquetaEntidad(tipo: string): string {
  return ENTIDADES_ETIQUETA[tipo] ?? tipo;
}

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

const COLORES_AVATAR = ['#0284c7', '#7c3aed', '#059669', '#0ea5e9', '#db2777', '#d97706'];

/** Color determinista para el avatar circular de cada persona. */
export function colorAvatarDe(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COLORES_AVATAR[Math.abs(h) % COLORES_AVATAR.length];
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

/** "14 nov" o "14 nov 2026" en la zona de quien mira. */
export function fechaCorta(iso: string, zona: string = zonaActual()): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    timeZone: zona,
    day: 'numeric',
    month: 'short',
  });
}

/** "Hace un momento", "Hace 5 min", "Hace 2 h", "Ayer" o fecha corta. */
export function tiempoRelativo(iso: string): string {
  const fecha = new Date(iso);
  const ts = fecha.getTime();
  if (Number.isNaN(ts)) return iso;
  const diffSeg = Math.floor((Date.now() - ts) / 1000);
  if (diffSeg < 45) return 'Hace un momento';
  const diffMin = Math.floor(diffSeg / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `Hace ${diffHoras} h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return 'Ayer';
  if (diffDias < 7) return `Hace ${diffDias} días`;
  return fechaCorta(iso);
}

/** Lectura relativa para fechas límite ("Vence hoy", "Vence mañana", "Vencida hace 2 días"). */
export function vencimientoRelativo(
  iso: string | null | undefined,
  completada = false,
): { texto: string; tono: 'alerta' | 'peligro' | 'neutro' | 'ok' } | null {
  if (!iso) return null;
  const zona = zonaActual();
  const formatoClave = (d: Date) =>
    d.toLocaleDateString('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' });
  const claveObjetivo = formatoClave(new Date(iso));
  const claveHoy = formatoClave(new Date());
  const msObjetivo = new Date(`${claveObjetivo}T12:00:00Z`).getTime();
  const msHoy = new Date(`${claveHoy}T12:00:00Z`).getTime();
  if (Number.isNaN(msObjetivo) || Number.isNaN(msHoy)) return null;
  const diffDias = Math.round((msObjetivo - msHoy) / (24 * 60 * 60 * 1000));

  if (completada) {
    return { texto: `Cerrada (límite ${fechaCorta(iso, zona)})`, tono: 'ok' };
  }
  if (diffDias === 0) return { texto: 'Vence hoy', tono: 'alerta' };
  if (diffDias === 1) return { texto: 'Vence mañana', tono: 'alerta' };
  if (diffDias > 1 && diffDias <= 7) return { texto: `Vence en ${diffDias} días`, tono: 'neutro' };
  if (diffDias > 7) return { texto: `Vence el ${fechaCorta(iso, zona)}`, tono: 'neutro' };
  if (diffDias === -1) return { texto: 'Venció ayer', tono: 'peligro' };
  return { texto: `Vencida hace ${Math.abs(diffDias)} días`, tono: 'peligro' };
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
