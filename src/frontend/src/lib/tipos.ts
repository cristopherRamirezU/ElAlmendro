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
  posicionNodo: { x: number; y: number } | null;
  responsableId?: string;
  responsable: { id?: string; nombreCompleto: string };
  /** Monedas (microtareas) de la bolsa y cuantas estan marcadas. */
  monedas: number;
  monedasListas: number;
}

export interface Derivacion {
  id: string;
  motivo: string;
  ocurridoEn: string;
  actividad: { titulo: string };
  deUsuario: { nombreCompleto: string };
  aUsuario: { nombreCompleto: string };
}
