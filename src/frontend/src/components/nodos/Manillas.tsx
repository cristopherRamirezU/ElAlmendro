'use client';

import type { CSSProperties } from 'react';
import { Handle, type Position } from '@xyflow/react';
import { idManilla, LADOS, type TipoManilla } from './orientacion';

/**
 * Las manillas de un tipo en los cuatro bordes de la burbuja. Solo la del
 * sentido del arbol sirve para unir tareas arrastrando y se ve siempre; las
 * demas aparecen cuando una linea las usa. En modo edicion (`editable`) todas
 * se ven, tenues, y reciben el extremo de una linea que se arrastra para
 * elegir por que borde sale o llega.
 */
export default function Manillas({
  tipo,
  principal,
  enUso,
  editable,
  className,
  style,
}: {
  tipo: TipoManilla;
  principal: Position;
  enUso?: Position[];
  editable?: boolean;
  className: string;
  style?: CSSProperties;
}) {
  return (
    <>
      {LADOS.map((lado) => {
        const esPrincipal = lado === principal;
        const visible = esPrincipal || enUso?.includes(lado);
        return (
          <Handle
            key={lado}
            id={idManilla(tipo, lado)}
            type={tipo === 'entrada' ? 'target' : 'source'}
            position={lado}
            isConnectable={esPrincipal || editable}
            className={`${className} ${visible ? '' : editable ? '!opacity-40' : '!pointer-events-none !opacity-0'}`}
            style={style}
          />
        );
      })}
    </>
  );
}
