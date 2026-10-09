'use client';

import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { type Ancla, idBorde, idManilla, LADOS } from './orientacion';

/**
 * Manillas de una burbuja, todas invisibles: el mapa no muestra puntos ni deja
 * crear lineas nuevas arrastrando desde ellas (las relaciones nacen al crear
 * una tarea o subtarea).
 *
 * - Un ancla por cada extremo de linea que toca la burbuja, puesta en el punto
 *   exacto del borde: de ahi React Flow toma donde agarrar la linea.
 * - Una franja por borde que, solo mientras se arrastra el extremo de una
 *   linea (`recibiendo`), recibe el extremo en cualquier punto de ese borde.
 */
export default function Manillas({
  nodoId,
  anclas,
  recibiendo,
}: {
  nodoId: string;
  anclas?: Ancla[];
  recibiendo?: boolean;
}) {
  // Si cambian las anclas (o su posicion), React Flow debe volver a medirlas.
  const actualizar = useUpdateNodeInternals();
  const clave = (anclas ?? []).map((a) => idManilla(a.tipo, a.lado, a.fraccion)).join(',');
  useEffect(() => {
    actualizar(nodoId);
  }, [clave, nodoId, actualizar]);

  return (
    <>
      {LADOS.map((lado) => (
        <Handle
          key={`borde-${lado}`}
          id={idBorde(lado)}
          type="source"
          position={lado}
          isConnectable
          isConnectableStart={false}
          isConnectableEnd
          className="!border-0 !bg-transparent !opacity-0"
          style={{
            ...estiloFranja(lado),
            pointerEvents: recibiendo ? 'auto' : 'none',
            zIndex: 20,
          }}
        />
      ))}
      {(anclas ?? []).map((a) => (
        <Handle
          key={idManilla(a.tipo, a.lado, a.fraccion)}
          id={idManilla(a.tipo, a.lado, a.fraccion)}
          type={a.tipo === 'entrada' ? 'target' : 'source'}
          position={a.lado}
          isConnectable={false}
          className="!h-1 !w-1 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0"
          style={{ ...estiloAncla(a), pointerEvents: 'none' }}
        />
      ))}
    </>
  );
}

/** La franja cubre todo el borde, un poco hacia afuera y hacia adentro. */
function estiloFranja(lado: Position): React.CSSProperties {
  const grosor = 18;
  const horizontal = lado === Position.Top || lado === Position.Bottom;
  return horizontal
    ? { width: '100%', height: grosor, left: 0, transform: 'translate(0, -50%)', borderRadius: 0 }
    : { height: '100%', width: grosor, top: 0, transform: 'translate(-50%, 0)', borderRadius: 0 };
}

/** El ancla va en el punto exacto del borde (fraccion 0 a 1). */
function estiloAncla(a: Ancla): React.CSSProperties {
  const pct = `${a.fraccion * 100}%`;
  return a.lado === Position.Top || a.lado === Position.Bottom ? { left: pct } : { top: pct };
}
