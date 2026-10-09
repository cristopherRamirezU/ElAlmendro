'use client';

import { useMemo } from 'react';
import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { type Caja, trazarArista } from '@/lib/rutasAristas';

export interface DatosAristaMapa {
  /** Todas las burbujas visibles, con la posicion que tienen en pantalla. */
  cajas: Caja[];
  [clave: string]: unknown;
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
  const cajas = (data as DatosAristaMapa | undefined)?.cajas;
  const trazo = useMemo(
    () =>
      trazarArista({
        inicio: { x: sourceX, y: sourceY },
        ladoInicio: sourcePosition,
        fin: { x: targetX, y: targetY },
        ladoFin: targetPosition,
        origenId: source,
        destinoId: target,
        cajas: cajas ?? [],
      }),
    [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, source, target, cajas],
  );
  return <BaseEdge id={id} path={trazo} style={style} interactionWidth={interactionWidth} />;
}
