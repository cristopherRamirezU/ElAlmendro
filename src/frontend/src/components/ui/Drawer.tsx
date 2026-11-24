'use client';

import { useEffect } from 'react';

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
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onCerrar}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative z-10 flex h-full w-full max-w-[480px] flex-col border-l border-white/10 bg-slate-900 shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-bold text-white first-letter:uppercase">{titulo}</h2>
            {subtitulo && <p className="text-xs text-slate-400">{subtitulo}</p>}
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar el detalle"
            className="ml-auto rounded-lg border border-white/10 px-2 py-0.5 text-slate-400 transition hover:bg-white/5"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
