'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FONDOS_MAPA,
  FONDOS_MAPA_CLAROS,
  FONDOS_MAPA_OSCUROS,
  FondoMapa,
} from '@/lib/fondosMapa';

/**
 * Boton de la barra del mapa que despliega los fondos disponibles, agrupados en
 * estilos claros y oscuros. La eleccion es personal de cada usuario.
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

  function renderGrupo(titulo: string, lista: readonly (typeof FONDOS_MAPA)[number][]) {
    return (
      <div>
        <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-texto-suave)]">
          {titulo}
        </p>
        {lista.map((f) => {
          const elegido = f.codigo === valor;
          return (
            <button
              key={f.codigo}
              type="button"
              role="option"
              aria-selected={elegido}
              onClick={() => {
                onCambiar(f.codigo);
                setAbierto(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                elegido
                  ? 'bg-[var(--tf-hover)] font-semibold text-[var(--tf-texto)]'
                  : 'text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
              }`}
            >
              <span
                aria-hidden
                className="h-7 w-11 shrink-0 rounded-md ring-1 ring-[var(--tf-borde-fuerte)]"
                style={{ background: f.muestra }}
              />
              <span className="flex-1">{f.nombre}</span>
              {elegido && (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--color-primario, #0ea5e9)' }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4.5 4.5L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        title="Elegir el fondo de tu mapa"
        className="flex items-center gap-1.5 rounded-lg border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] px-2.5 py-1 text-xs font-medium text-[var(--tf-texto)] transition hover:border-[var(--tf-borde-fuerte)]"
      >
        <span
          aria-hidden
          className="h-3.5 w-3.5 rounded-[4px] ring-1 ring-[var(--tf-borde-fuerte)]"
          style={{ background: actual.muestra }}
        />
        Fondo
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={`h-3 w-3 transition-transform ${abierto ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <div
          role="listbox"
          aria-label="Fondo del mapa"
          className="absolute right-0 top-full z-40 mt-2 max-h-[min(26rem,65vh)] w-60 overflow-y-auto rounded-2xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] p-1.5 shadow-2xl backdrop-blur"
        >
          {renderGrupo('Estilos claros', FONDOS_MAPA_CLAROS)}
          <div className="my-1 border-t border-[var(--tf-borde)]" />
          {renderGrupo('Estilos oscuros', FONDOS_MAPA_OSCUROS)}
        </div>
      )}
    </div>
  );
}
