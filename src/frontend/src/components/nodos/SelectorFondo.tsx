'use client';

import { useEffect, useRef, useState } from 'react';
import { FONDOS_MAPA, FondoMapa } from '@/lib/fondosMapa';

/**
 * Boton de la barra del mapa que despliega los fondos disponibles. La
 * eleccion es de cada usuario: quien la usa decide como se ve su mapa, sin
 * cambiarlo para el resto del equipo.
 */
export default function SelectorFondo({
  valor,
  onCambiar,
}: {
  valor: FondoMapa;
  onCambiar: (fondo: FondoMapa) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    function alClic(e: MouseEvent) {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    }
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', alClic);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alClic);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  const actual = FONDOS_MAPA.find((f) => f.codigo === valor) ?? FONDOS_MAPA[0];

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        title="Elegir el fondo de tu mapa"
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1 text-xs text-slate-300 transition hover:text-white"
      >
        <span aria-hidden className="h-3.5 w-3.5 rounded-[4px] ring-1 ring-white/20" style={{ background: actual.muestra }} />
        Fondo
        <svg aria-hidden viewBox="0 0 24 24" className={`h-3 w-3 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <ul
          role="listbox"
          aria-label="Fondo del mapa"
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-white/10 bg-slate-950/95 p-1.5 shadow-2xl backdrop-blur"
        >
          {FONDOS_MAPA.map((f) => {
            const elegido = f.codigo === valor;
            return (
              <li key={f.codigo}>
                <button
                  type="button"
                  role="option"
                  aria-selected={elegido}
                  onClick={() => {
                    onCambiar(f.codigo);
                    setAbierto(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                    elegido ? 'bg-sky-500/15 text-sky-100' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span aria-hidden className="h-8 w-12 shrink-0 rounded-md ring-1 ring-white/15" style={{ background: f.muestra }} />
                  <span className="flex-1 font-semibold">{f.nombre}</span>
                  {elegido && (
                    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-sky-300" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4.5 4.5L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
