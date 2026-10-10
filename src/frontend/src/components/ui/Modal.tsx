'use client';

import { useEffect, useId, useRef } from 'react';

const ANCHOS = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

/**
 * Ventana emergente centrada: oscurece el fondo, entra con una animacion
 * corta y se cierra con la X, con Escape o con un clic fuera.
 *
 * Escape no la cierra si se esta escribiendo en un campo (ahi suele cancelar
 * la edicion) o si quien lo recibio primero ya lo atendio
 * (`preventDefault`). Con `bloqueado` —otro dialogo encima— no reacciona.
 */
export default function Modal({
  titulo,
  acciones,
  ancho = 'lg',
  bloqueado = false,
  onCerrar,
  children,
}: {
  titulo: React.ReactNode;
  /** Botones de la cabecera, junto a la X. */
  acciones?: React.ReactNode;
  ancho?: keyof typeof ANCHOS;
  bloqueado?: boolean;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const idTitulo = useId();
  const botonCerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    botonCerrar.current?.focus();
  }, []);

  useEffect(() => {
    if (bloqueado) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const objetivo = e.target as HTMLElement | null;
      if (objetivo?.closest('input, textarea, select, [contenteditable="true"]')) return;
      onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [bloqueado, onCerrar]);

  return (
    <div
      className="tf-modal-fondo fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={`tf-modal-entra flex max-h-[90vh] w-full ${ANCHOS[ancho]} flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
          <h2 id={idTitulo} className="min-w-0 text-lg font-bold leading-snug text-white">
            {titulo}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {acciones}
            <button
              ref={botonCerrar}
              onClick={onCerrar}
              aria-label="Cerrar"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
