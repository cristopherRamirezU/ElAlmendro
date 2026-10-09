import { Position } from '@xyflow/react';
import type { Orientacion } from '@/lib/mapaMental';

/**
 * Donde van los conectores principales y el boton de desplegar de una
 * burbuja segun el sentido del arbol. En horizontal las hijas cuelgan del
 * borde derecho; en vertical, del borde inferior.
 */
export function disposicionNodo(orientacion: Orientacion) {
  const horizontal = orientacion === 'horizontal';
  return {
    entrada: horizontal ? Position.Left : Position.Top,
    salida: horizontal ? Position.Right : Position.Bottom,
    /** Posicion absoluta del boton circular de desplegar/contraer. */
    claseBoton: horizontal
      ? '-right-3 top-1/2 -translate-y-1/2'
      : '-bottom-3 left-1/2 -translate-x-1/2',
    /** Chevron apuntando hacia donde se abren las hijas; girado al expandir. */
    trazoFlecha: horizontal ? 'm9 6 6 6-6 6' : 'm6 9 6 6 6-6',
    claseFlechaExpandida: horizontal ? 'rotate-90' : 'rotate-180',
  };
}

/**
 * Cada burbuja tiene una manilla de entrada y otra de salida en cada borde;
 * las lineas eligen cual usar segun donde quedo el otro nodo. Antes habia solo
 * las del sentido del arbol y React Flow habia que pedirle volver a medirlas al
 * girarlo; ahora estan siempre todas, asi que sus medidas no cambian.
 */
export const LADOS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export type TipoManilla = 'entrada' | 'salida';

/** Id de la manilla de un borde, el mismo que usan las aristas. */
export function idManilla(tipo: TipoManilla, lado: Position) {
  return `${tipo}-${lado}`;
}
