/**
 * Contratos compartidos entre la capa de interfaz y la capa de negocio.
 * Un solo lenguaje en todo el sistema (TypeScript) permite que estos tipos
 * sean la unica definicion de los datos que cruzan la frontera HTTP.
 */

// El RBAC vive en el backend (src/common/rbac.ts) y su espejo del frontend
// (src/lib/rbac.ts), sincronizados por test/rbac-sincronizado.spec.ts.
// La copia que habia aqui quedo obsoleta y sin uso, por eso se elimino.

export type EstadoActividad =
  | 'PENDIENTE'
  | 'EN_PROGRESO'
  | 'BLOQUEADA'
  | 'INCONCLUSA'
  | 'COMPLETADA'
  | 'CANCELADA';

export type EstadoSesion = 'ACTIVA' | 'PAUSADA' | 'CERRADA' | 'AUTOCERRADA';

export type EstadoJornada = 'ABIERTA' | 'CERRADA';

/** Instante en formato ISO 8601 en UTC. Nunca hora local. */
export type InstanteUtc = string;

export interface SesionIniciadaDto {
  id: string;
  actividadId: string;
  /** Marca generada por el reloj del servidor. */
  inicioEn: InstanteUtc;
}

/** Eventos de dominio difundidos por socket al panel en vivo (US-09). */
export const EVENTOS = {
  sesionIniciada: 'sesion.iniciada',
  sesionPausada: 'sesion.pausada',
  sesionCerrada: 'sesion.cerrada',
  sesionAutocerrada: 'sesion.autocerrada',
  jornadaAbierta: 'jornada.abierta',
  jornadaCerrada: 'jornada.cerrada',
  actividadDerivada: 'actividad.derivada',
} as const;
