'use client';

import { Check, Pause, Play, Square } from 'lucide-react';
import { fuenteEscena } from '@/lib/fuentes';

/** Una accion del contador: su texto (para lectores y el aviso al pasar), si esta disponible y que hace. */
export interface AccionContador {
  texto: string;
  titulo: string;
  deshabilitado?: boolean;
  onClick: () => void;
}

/** En que esta el cronometro de la tarea; decide el icono del boton principal. */
export type EstadoContador = 'detenido' | 'corriendo' | 'pausado' | 'ocupado' | 'terminado';

function reloj(segundos: number) {
  const s = Math.max(0, Math.floor(segundos));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Contador de la tarea, en un panel de vidrio: el tiempo grande con su estado
 * y el total trabajado debajo, y dos botones: terminar y el principal
 * (comenzar, pausar o reanudar).
 */
export default function ContadorTarea({
  segundos,
  detalle,
  estado,
  principal,
  terminar,
}: {
  segundos: number;
  /** Linea bajo el tiempo, p. ej. "Corriendo · total 2 h 05 min". */
  detalle: string;
  estado: EstadoContador;
  principal: AccionContador;
  terminar: AccionContador;
}) {
  const IconoPrincipal = estado === 'terminado' ? Check : estado === 'corriendo' ? Pause : Play;
  return (
    <div className={`${fuenteEscena.className} tf-contador flex items-center gap-4 px-5 py-4`}>
      <div className="min-w-0 flex-1">
        <p
          className="text-[40px] font-light leading-none tracking-[-0.02em] text-white tabular-nums"
          role="timer"
          aria-label={`Tiempo de la sesión: ${reloj(segundos)}`}
        >
          {reloj(segundos)}
        </p>
        <p className="mt-2 truncate text-[11px] text-[#a5b2dc]">{detalle}</p>
      </div>
      <button
        type="button"
        onClick={terminar.onClick}
        disabled={terminar.deshabilitado}
        title={terminar.titulo}
        aria-label={terminar.texto}
        className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/[0.08] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Square size={12} fill="currentColor" aria-hidden />
      </button>
      <button
        type="button"
        onClick={principal.onClick}
        disabled={principal.deshabilitado}
        title={principal.titulo}
        aria-label={principal.texto}
        className="tf-boton-vidrio grid h-14 w-14 place-items-center rounded-full text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconoPrincipal size={18} fill={estado === 'terminado' ? 'none' : 'currentColor'} aria-hidden />
      </button>
    </div>
  );
}
