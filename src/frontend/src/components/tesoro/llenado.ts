import { NodoActividad } from '@/lib/tipos';

/** Cuanto oro tiene la bolsa: sus monedas marcadas, o su estado si no tiene. */
export function llenadoDeBolsa(a: Pick<NodoActividad, 'estado' | 'monedas' | 'monedasListas'>) {
  if (a.estado === 'COMPLETADA') return 1;
  if (a.monedas > 0) return a.monedasListas / a.monedas;
  return a.estado === 'EN_PROGRESO' ? 0.45 : 0.08;
}

/** Oro realmente reunido, sin estimar por estado: lo que muestra el mapa de nodos. */
export function llenadoReal(a: Pick<NodoActividad, 'estado' | 'monedas' | 'monedasListas'>) {
  if (a.estado === 'COMPLETADA') return 1;
  return a.monedas > 0 ? a.monedasListas / a.monedas : 0;
}
