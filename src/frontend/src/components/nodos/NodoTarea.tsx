'use client';

import { useState } from 'react';
import { Handle, type NodeProps } from '@xyflow/react';
import { ALTO_NODO, ANCHO_NODO, type Orientacion } from '@/lib/mapaMental';
import { porcentajeLlenado } from '@/components/tesoro/llenado';
import { disposicionNodo, useManillasSegunOrientacion } from './orientacion';

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: '#38bdf8',
  EN_PROGRESO: '#f59e0b',
  BLOQUEADA: '#f43f5e',
  INCONCLUSA: '#f97316',
  COMPLETADA: '#10b981',
  CANCELADA: '#64748b',
};

/** Tramo del saco de oro segun su llenado: color, nombre y si brilla. */
function tramoSaco(llenado: number) {
  const porcentaje = porcentajeLlenado(llenado);
  if (porcentaje === 0) return { porcentaje, etiqueta: 'vacío', color: '#64748b', brillo: 0 };
  if (porcentaje <= 40) return { porcentaje, etiqueta: 'iniciando', color: '#d97706', brillo: 0 };
  if (porcentaje <= 80) return { porcentaje, etiqueta: 'avanzado', color: '#facc15', brillo: 10 };
  return { porcentaje, etiqueta: 'lleno', color: '#10b981', brillo: 16 };
}

export interface DatosNodoTarea {
  titulo: string;
  estado: string;
  color: string;
  /** Oro reunido en el saco de la tarea, de 0 a 1. */
  llenado: number;
  tieneHijos: boolean;
  expandido: boolean;
  orientacion: Orientacion;
  responsableNombre?: string;
  esMiTarea?: boolean;
  /** Modo edicion del mapa: la burbuja se arrastra y no ofrece agregar hijas. */
  editando?: boolean;
  onAlternar: () => void;
  onAgregarHija?: (titulo: string) => void;
  [clave: string]: unknown;
}

/**
 * Burbuja de tarea del mapa mental (horizontal o vertical), de medida fija
 * para que el layout nunca las monte. Fondo, borde, brillo y la franja del
 * pie muestran cuanto oro tiene su saco; el punto interior indica el estado
 * real de la tarea, y la profundidad la llevan las aristas y las manillas. El
 * boton circular del borde despliega o repliega sus hijas, igual que en el
 * mapa mental de referencia — parte siempre colapsado.
 */
export default function NodoTarea({ id, data }: NodeProps) {
  const d = data as DatosNodoTarea;
  const disposicion = disposicionNodo(d.orientacion);
  useManillasSegunOrientacion(id, d.orientacion);
  const tramo = tramoSaco(d.llenado ?? 0);
  const [agregando, setAgregando] = useState(false);
  const [texto, setTexto] = useState('');

  function confirmar() {
    const limpio = texto.trim();
    if (limpio && d.onAgregarHija) d.onAgregarHija(limpio);
    setTexto('');
    setAgregando(false);
  }

  return (
    <div
      className={`group relative ${d.editando ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ width: ANCHO_NODO, height: ALTO_NODO }}
    >
      <Handle
        type="target"
        position={disposicion.entrada}
        className="!h-2.5 !w-2.5 !border-2 !bg-slate-950"
        style={{ borderColor: d.color }}
      />

      <div
        className="relative flex h-full w-full flex-col justify-center gap-1.5 overflow-hidden rounded-xl border px-3 pb-2.5 pt-2 shadow-lg backdrop-blur-sm"
        style={{
          borderColor: `${tramo.color}99`,
          background: `${tramo.color}1f`,
          boxShadow: tramo.brillo ? `0 0 ${tramo.brillo}px ${tramo.color}55` : undefined,
        }}
      >
        <div className="flex min-w-0 items-center gap-2" title={d.titulo}>
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: COLOR_ESTADO[d.estado] ?? '#94a3b8' }}
          />
          <span className="truncate text-xs font-semibold text-white">{d.titulo}</span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          {d.responsableNombre && (
            <span
              className={`inline-flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                d.esMiTarea
                  ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40 font-semibold'
                  : 'bg-slate-800/80 text-slate-300 border border-white/10'
              }`}
            >
              <span>{d.esMiTarea ? '⭐' : '👤'}</span>
              <span className="truncate">{d.esMiTarea ? 'Tú' : d.responsableNombre}</span>
            </span>
          )}
          <span
            className="ml-auto shrink-0 text-[10px] font-semibold tabular-nums"
            style={{ color: tramo.color }}
            title={`Saco ${tramo.etiqueta} · ${tramo.porcentaje}%`}
          >
            💰 {tramo.porcentaje}%
          </span>
        </div>

        {/* Franja de llenado pegada al borde inferior: no ocupa fila propia. */}
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
          <span
            className="block h-full transition-[width] duration-300"
            style={{ width: `${tramo.porcentaje}%`, background: tramo.color }}
          />
        </span>
      </div>

      <Handle
        type="source"
        position={disposicion.salida}
        className="!h-2.5 !w-2.5 !border-2 !bg-slate-950"
        style={{ borderColor: d.color }}
      />

      {d.tieneHijos && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            d.onAlternar();
          }}
          title={d.expandido ? 'Contraer' : 'Desplegar'}
          className={`absolute ${disposicion.claseBoton} grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-white ring-1 ring-white/25 hover:bg-slate-700`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-3 w-3 transition-transform ${d.expandido ? disposicion.claseFlechaExpandida : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={disposicion.trazoFlecha} />
          </svg>
        </button>
      )}

      {agregando ? (
        <input
          autoFocus
          value={texto}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmar();
            if (e.key === 'Escape') {
              setTexto('');
              setAgregando(false);
            }
          }}
          onBlur={confirmar}
          placeholder="Nueva tarea…"
          className="nodrag absolute left-1/2 top-full z-10 mt-2 w-44 -translate-x-1/2 rounded-lg border border-white/20 bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-xl outline-none"
        />
      ) : (
        d.onAgregarHija &&
        !d.editando && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAgregando(true);
            }}
            title="Agregar tarea hija"
            className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 place-items-center rounded-full bg-slate-800 text-[11px] leading-none text-white ring-1 ring-white/20 hover:bg-slate-700 group-hover:grid"
          >
            +
          </button>
        )
      )}
    </div>
  );
}
