'use client';

import { useEffect } from 'react';
import { CalendarDays, X } from 'lucide-react';

/**
 * Panel lateral deslizante.
 *
 * Se prefiere a un dialogo centrado porque el calendario tiene que seguir a la
 * vista mientras se inspecciona un dia: la comparacion con los dias vecinos es
 * la mitad de la lectura. Cierra con Escape o con clic en el fondo.
 */
export default function Drawer({
  abierto,
  titulo,
  subtitulo,
  onCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!abierto) return;
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={onCerrar}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative z-10 flex h-full w-full max-w-[500px] flex-col border-l border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] text-[var(--tf-texto)] shadow-2xl"
      >
        <header
          style={{
            background:
              'linear-gradient(135deg, rgba(var(--tf-primario-rgb, 56, 189, 248), 0.12), transparent 68%)',
          }}
          className="flex items-center gap-3 border-b border-[var(--tf-borde)] px-5 py-4"
        >
          <span
            style={{
              backgroundColor: 'rgba(var(--tf-primario-rgb, 56, 189, 248), 0.15)',
              color: 'var(--color-primario, #38bdf8)',
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--tf-borde)]"
          >
            <CalendarDays size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="tf-display truncate text-base font-bold tracking-tight text-[var(--tf-texto)] first-letter:uppercase">
              {titulo}
            </h2>
            {subtitulo && <p className="text-xs text-[var(--tf-texto-tenue)]">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar el detalle"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] transition hover:border-[var(--tf-borde-fuerte)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
