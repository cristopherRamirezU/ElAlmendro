/** Contratos de las pantallas de seguimiento. */

export interface DiaCalendario {
  dia: string;
  segundos: number;
  sesiones: number;
}

export interface SesionDelDia {
  id: string;
  actividad: string;
  trabajador: string;
  inicioEn: string;
  terminoEn: string | null;
  estado: string;
  desenlace: string | null;
  notaCierre: string | null;
  segundos: number;
}

export interface HorasTrabajador {
  id: string;
  trabajador: string;
  organizacionNombre?: string | null;
  segundos: number;
  sesiones: number;
  actividades: number;
  dias: number;
}

export interface HorasActividad {
  actividad: string;
  organizacionNombre?: string | null;
  estado: string;
  segundos: number;
}

export interface NodoActividad {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  actividadPadreId: string | null;
  /**
   * Donde dejo el nodo quien edito el mapa, relativo a su padre y por
   * orientacion: `{ horizontal?: {x, y}, vertical?: {x, y} }`. Se lee con
   * `posicionGuardada` (lib/mapaMental), que descarta cualquier otro formato.
   */
  posicionNodo: Record<string, unknown> | null;
  /** Lugar entre sus hermanas en el mapa de nodos. */
  orden: number;
  responsableId?: string;
  responsable: { id?: string; nombreCompleto: string };
  /** Monedas (microtareas) de la bolsa y cuantas estan marcadas. */
  monedas: number;
  monedasListas: number;
  /** Fechas de la carta Gantt (ISO, UTC). */
  creadoEn?: string;
  fechaLimite?: string | null;
  /** Cuando se guardo en el cofre; null mientras sigue abierta. */
  completadaEn?: string | null;
  /** Primera vez que se encendio su cronometro. */
  inicioTrabajoEn?: string | null;
}

export interface Derivacion {
  id: string;
  motivo: string;
  ocurridoEn: string;
  actividad: { titulo: string };
  deUsuario: { nombreCompleto: string };
  aUsuario: { nombreCompleto: string };
}
