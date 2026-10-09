'use client';

import { useState } from 'react';
import type { NodeProps, Position } from '@xyflow/react';
import { ALTO_NODO, ANCHO_NODO, type Orientacion } from '@/lib/mapaMental';
import { porcentajeLlenado } from '@/components/tesoro/llenado';
import { disposicionNodo } from './orientacion';
import Manillas from './Manillas';

/**
 * Fase de la tarea, con colores tipo semaforo: gris sin empezar, naranjo en
 * progreso, verde completada. Los estados especiales muestran su nombre:
 * inconclusa en naranjo (hubo trabajo), bloqueada en rojo y cancelada en gris.
 * `rgb` tine el degradado, el borde, la sombra y el texto de la fase; `color`,
 * el punto, el porcentaje y la barra.
 */
const FASES: Record<string, { texto: string; rgb: string; color: string }> = {
  PENDIENTE: { texto: 'Sin empezar', rgb: '148,163,184', color: '#64748b' },
  EN_PROGRESO: { texto: 'En progreso', rgb: '245,158,11', color: '#f59e0b' },
  INCONCLUSA: { texto: 'Inconclusa', rgb: '245,158,11', color: '#f59e0b' },
  COMPLETADA: { texto: 'Completada', rgb: '16,185,129', color: '#10b981' },
  BLOQUEADA: { texto: 'Bloqueada', rgb: '244,63,94', color: '#f43f5e' },
  CANCELADA: { texto: 'Cancelada', rgb: '148,163,184', color: '#64748b' },
};

export function faseDeTarea(estado: string) {
  return FASES[estado] ?? FASES.PENDIENTE;
}

export interface DatosNodoTarea {
  titulo: string;
  estado: string;
  color: string;
  /** Avance de la tarea (sus monedas marcadas), de 0 a 1. */
  llenado: number;
  tieneHijos: boolean;
  expandido: boolean;
  orientacion: Orientacion;
  responsableNombre?: string;
  esMiTarea?: boolean;
  /** Modo edicion del mapa: la burbuja se arrastra y no ofrece agregar hijas. */
  editando?: boolean;
  /** Bordes por donde llegan y salen sus lineas (las elige el mapa). */
  ladosEntrada?: Position[];
  ladosSalida?: Position[];
  /** Durante la entrada al mapa: segundos que espera antes de brotar. */
  retrasoEntrada?: number;
  onAlternar: () => void;
  onAgregarHija?: (titulo: string) => void;
  [clave: string]: unknown;
}

/**
 * Burbuja de tarea del mapa mental (horizontal o vertical), de medida fija
 * para que el layout nunca las monte. Fondo, borde, sombra, punto, porcentaje
 * y barra llevan el color de su fase, que ademas va escrita junto al
 * responsable; la profundidad la llevan las aristas y las manillas. El boton
 * circular del borde despliega o repliega sus hijas — parte colapsado.
 */
export default function NodoTarea({ data }: NodeProps) {
  const d = data as DatosNodoTarea;
  const disposicion = disposicionNodo(d.orientacion);
  const fase = faseDeTarea(d.estado);
  const porcentaje = porcentajeLlenado(d.llenado ?? 0);
  const entrando = d.retrasoEntrada !== undefined;
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
      className={`group relative ${d.editando ? 'cursor-grab active:cursor-grabbing' : ''} ${entrando ? 'tf-entra-tarea' : ''}`}
      style={
        {
          width: ANCHO_NODO,
          height: ALTO_NODO,
          ...(entrando ? { '--tf-retraso': `${d.retrasoEntrada}s` } : {}),
        } as React.CSSProperties
      }
    >
      <Manillas
        tipo="entrada"
        principal={disposicion.entrada}
        enUso={d.ladosEntrada}
        className="!h-2.5 !w-2.5 !border-2 !bg-slate-950"
        style={{ borderColor: d.color }}
      />

      <div
        className="tf-tarea relative flex h-full w-full flex-col gap-[7px] overflow-hidden rounded-xl px-3 pt-[9px]"
        style={{ '--c': fase.rgb } as React.CSSProperties}
      >
        <div className="flex min-w-0 items-center gap-2" title={d.titulo}>
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: fase.color }} />
          <span className="truncate text-xs font-bold text-white">{d.titulo}</span>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-1.5 text-[10px]">
          {d.responsableNombre ? (
            <span
              className={`min-w-0 truncate rounded-[5px] border px-[7px] py-0.5 font-bold ${
                d.esMiTarea
                  ? 'border-sky-300/40 bg-sky-400/30 text-sky-200'
                  : 'border-white/10 bg-slate-800/80 text-slate-300'
              }`}
              title={d.responsableNombre}
            >
              {d.esMiTarea ? 'Tú' : d.responsableNombre}
            </span>
          ) : (
            <span />
          )}
          <span className="shrink-0 font-semibold" style={{ color: `rgb(${fase.rgb})` }}>
            {fase.texto}
          </span>
          <span
            className="shrink-0 font-extrabold tabular-nums"
            style={{ color: fase.color }}
            title={`Avance ${porcentaje}%`}
          >
            {porcentaje}%
          </span>
        </div>

        {/* Barra de avance pegada al borde inferior: no ocupa fila propia. */}
        <span className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-white/[.08]">
          <span
            className="block h-full transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${porcentaje}%`, background: fase.color }}
          />
        </span>
      </div>

      <Manillas
        tipo="salida"
        principal={disposicion.salida}
        enUso={d.ladosSalida}
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
            className={`h-3 w-3 transition-transform motion-reduce:transition-none ${d.expandido ? disposicion.claseFlechaExpandida : ''}`}
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
