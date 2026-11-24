'use client';

import { useState } from 'react';
import { useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { AlertCircle, CheckCircle2, Circle, Lock, PlayCircle, XCircle } from 'lucide-react';
import { ALTO_NODO, ANCHO_NODO, type Orientacion } from '@/lib/mapaMental';
import { estadoDeActividad } from '@/lib/formato';
import { porcentajeLlenado } from '@/components/tesoro/llenado';
import { disposicionNodo, type Ancla } from './orientacion';
import Manillas from './Manillas';

function IconoEstado({ estado }: { estado: string }) {
  switch (estado) {
    case 'COMPLETADA':
      return <CheckCircle2 size={10} aria-hidden className="shrink-0" />;
    case 'EN_PROGRESO':
      return <PlayCircle size={10} aria-hidden className="shrink-0" />;
    case 'BLOQUEADA':
      return <Lock size={10} aria-hidden className="shrink-0" />;
    case 'INCONCLUSA':
      return <AlertCircle size={10} aria-hidden className="shrink-0" />;
    case 'CANCELADA':
      return <XCircle size={10} aria-hidden className="shrink-0" />;
    default:
      return <Circle size={10} aria-hidden className="shrink-0" />;
  }
}

export interface DatosNodoTarea {
  titulo: string;
  estado: string;
  color: string;
  /** Avance de la tarea (sus objetivos marcados), de 0 a 1. */
  llenado: number;
  tieneHijos: boolean;
  expandido: boolean;
  orientacion: Orientacion;
  responsableNombre?: string;
  esMiTarea?: boolean;
  /** Modo edicion del mapa: la burbuja se arrastra y no ofrece agregar hijas. */
  editando?: boolean;
  /** Puntos de sus bordes donde nacen o llegan sus lineas (los elige el mapa). */
  anclas?: Ancla[];
  /** Se esta arrastrando el extremo de una linea: sus bordes lo reciben. */
  recibiendoExtremo?: boolean;
  /** Durante la entrada al mapa: segundos que espera antes de brotar. */
  retrasoEntrada?: number;
  bloquearOrdenHijas?: boolean;
  bloqueadaPorOrden?: boolean;
  prerequisitoTitulo?: string | null;
  ordenEnRama?: number | null;
  esMapaClaro?: boolean;
  seleccionadoEdicion?: boolean;
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
export default function NodoTarea({ id, data }: NodeProps) {
  const d = data as DatosNodoTarea;
  // Mientras brota en la entrada la burbuja esta corrida y achicada: al
  // terminar, React Flow vuelve a medir sus manillas.
  const actualizarManillas = useUpdateNodeInternals();
  const disposicion = disposicionNodo(d.orientacion);
  const estadoEfectivo = d.bloqueadaPorOrden ? 'BLOQUEADA' : d.estado;
  const fase = estadoDeActividad(estadoEfectivo);
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
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) actualizarManillas(id);
      }}
    >
      <Manillas nodoId={id} anclas={d.anclas} recibiendo={d.recibiendoExtremo} />

      <div
        className={`tf-tarea relative flex h-full w-full items-center gap-2 overflow-hidden rounded-xl pb-[3px] pl-2 pr-3 ${
          d.bloqueadaPorOrden ? 'opacity-80' : ''
        } ${d.seleccionadoEdicion ? 'ring-2 ring-amber-400/85 ring-offset-1 ring-offset-transparent' : ''}`}
        style={{ '--c': fase.rgb } as React.CSSProperties}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
          <div
            className="flex min-w-0 items-center gap-1.5"
            title={
              d.bloqueadaPorOrden
                ? `Bloqueada: termina primero «${d.prerequisitoTitulo || 'la tarea anterior'}»`
                : d.titulo
            }
          >
            {d.ordenEnRama && (
              <span className="tf-nodo-orden shrink-0 rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                #{d.ordenEnRama}
              </span>
            )}
            {(d.bloqueadaPorOrden || d.bloquearOrdenHijas) && (
              <Lock
                size={12}
                aria-hidden
                className={`shrink-0 ${
                  d.bloqueadaPorOrden
                    ? d.esMapaClaro
                      ? 'text-rose-600'
                      : 'text-rose-400'
                    : d.esMapaClaro
                      ? 'text-amber-600'
                      : 'text-amber-400'
                }`}
              />
            )}
            <span className="tf-nodo-titulo truncate text-xs font-bold text-white">{d.titulo}</span>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-1.5 text-[10px]">
            {d.responsableNombre ? (
              <span
                className={`min-w-0 truncate rounded-[5px] border px-[7px] py-0.5 font-bold ${
                  d.esMiTarea
                    ? 'tf-nodo-resp-mio border-sky-300/40 bg-sky-400/30 text-sky-200'
                    : 'tf-nodo-resp border-white/10 bg-slate-800/80 text-slate-300'
                }`}
                title={d.responsableNombre}
              >
                {d.esMiTarea ? 'Tú' : d.responsableNombre}
              </span>
            ) : (
              <span />
            )}
            <span
              className="inline-flex shrink-0 items-center gap-1 font-semibold"
              style={{ color: d.esMapaClaro ? fase.colorClaro : `rgb(${fase.rgb})` }}
            >
              <IconoEstado estado={estadoEfectivo} />
              {fase.texto}
            </span>
            <span
              className="shrink-0 font-extrabold tabular-nums"
              style={{ color: d.esMapaClaro ? fase.colorClaro : fase.color }}
              title={`Avance ${porcentaje}%`}
            >
              {porcentaje}%
            </span>
          </div>
        </div>

        {/* Barra de avance pegada al borde inferior: no ocupa fila propia. */}
        <span className="tf-nodo-barra-base absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-white/[.08]">
          <span
            className="block h-full transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${porcentaje}%`, background: d.esMapaClaro ? fase.colorClaro : fase.color }}
          />
        </span>
      </div>

      {d.tieneHijos && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            d.onAlternar();
          }}
          title={d.expandido ? 'Contraer' : 'Desplegar'}
          className={`tf-nodo-btn absolute ${disposicion.claseBoton} grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-white ring-1 ring-white/25 hover:bg-slate-700`}
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
          className="tf-nodo-input nodrag absolute left-1/2 top-full z-10 mt-2 w-44 -translate-x-1/2 rounded-lg border border-white/20 bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-xl outline-none"
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
            className="tf-nodo-btn absolute -right-1.5 -top-1.5 hidden h-5 w-5 place-items-center rounded-full bg-slate-800 text-[11px] leading-none text-white ring-1 ring-white/20 hover:bg-slate-700 group-hover:grid"
          >
            +
          </button>
        )
      )}
    </div>
  );
}
