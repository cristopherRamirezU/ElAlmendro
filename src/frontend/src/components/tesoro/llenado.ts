import { NodoActividad } from '@/lib/tipos';

/**
 * Cuanto oro tiene la bolsa, de 0 a 1: sus monedas marcadas, o llena si ya se
 * guardo en el cofre. Es la unica fuente del porcentaje: el nodo del mapa, el
 * panel de la tarea, la ventana de la bolsa, la rejilla y el Gantt la usan
 * todos, para que muestren siempre la misma cifra. Sin monedas marcadas la
 * bolsa esta vacia (0%): antes se estimaba un 8% o un 45% segun el estado, y
 * por eso una tarea recien abierta aparecia con 8% y no cuadraba con el mapa.
 */
export function llenadoDeBolsa(a: Pick<NodoActividad, 'estado' | 'monedas' | 'monedasListas'>) {
  if (a.estado === 'COMPLETADA') return 1;
  return a.monedas > 0 ? a.monedasListas / a.monedas : 0;
}

/** El llenado como porcentaje entero, redondeado igual en todas las vistas. */
export function porcentajeLlenado(llenado: number) {
  return Math.round(Math.min(Math.max(llenado, 0), 1) * 100);
}
