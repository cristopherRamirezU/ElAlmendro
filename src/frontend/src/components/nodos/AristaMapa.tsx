'use client';

import { useMemo } from 'react';
import { BaseEdge, Position, type EdgeProps } from '@xyflow/react';
import { type Caja, trazarArista } from '@/lib/rutasAristas';
import type { Punto } from '@/lib/mapaMental';

export interface DatosAristaMapa {
  /** Todas las burbujas visibles, con la posicion que tienen en pantalla. */
  cajas: Caja[];
  /** Punto (0 a 1) de cada borde donde nace y llega la linea; sin el, el centro. */
  fraccionSalida?: number;
  fraccionEntrada?: number;
  [clave: string]: unknown;
}

/** Punto de un borde de la caja, a una fraccion de su largo. */
function puntoEnBorde(c: Caja, lado: Position, fraccion = 0.5): Punto {
  switch (lado) {
    case Position.Top:
      return { x: c.x + c.ancho * fraccion, y: c.y };
    case Position.Bottom:
      return { x: c.x + c.ancho * fraccion, y: c.y + c.alto };
    case Position.Left:
      return { x: c.x, y: c.y + c.alto * fraccion };
    default:
      return { x: c.x + c.ancho, y: c.y + c.alto * fraccion };
  }
}

/**
 * Linea entre una tarea y su padre. Sale y llega por los bordes que el mapa
 * eligio; si la curva fuera a pasar por debajo de otra burbuja, la rodea.
 */
export default function AristaMapa({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  interactionWidth,
}: EdgeProps) {
  const datos = data as DatosAristaMapa | undefined;
  const cajas = datos?.cajas;
  const fraccionSalida = datos?.fraccionSalida;
  const fraccionEntrada = datos?.fraccionEntrada;
  // Los extremos salen de la caja real de cada burbuja (posicion y medida
  // conocidas), no de lo que React Flow midio: si midio a mitad de una
  // animacion, la linea quedaba corta o descentrada.
  const trazo = useMemo(() => {
    const origen = cajas?.find((c) => c.id === source);
    const destino = cajas?.find((c) => c.id === target);
    return trazarArista({
      inicio: origen ? puntoEnBorde(origen, sourcePosition, fraccionSalida) : { x: sourceX, y: sourceY },
      ladoInicio: sourcePosition,
      fin: destino ? puntoEnBorde(destino, targetPosition, fraccionEntrada) : { x: targetX, y: targetY },
      ladoFin: targetPosition,
      origenId: source,
      destinoId: target,
      cajas: cajas ?? [],
    });
  }, [
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, source, target, cajas,
    fraccionSalida, fraccionEntrada,
  ]);
  return <BaseEdge id={id} path={trazo} style={style} interactionWidth={interactionWidth} />;
}
