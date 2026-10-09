'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Aviso al cerrar sesion con la jornada abierta: ofrece marcar la salida ahi
 * mismo para que la jornada quede registrada, o salir igual. Si el servidor
 * no deja marcar la salida (por ejemplo, con un cronometro corriendo), el
 * motivo se muestra aqui y la persona decide.
 */
export default function ConfirmarSalida({
  onMarcarYSalir,
  onSalirSinMarcar,
  onCancelar,
}: {
  /** Marca la salida y cierra sesion; si falla, debe lanzar el error con su mensaje. */
  onMarcarYSalir: () => Promise<void>;
  onSalirSinMarcar: () => void;
  onCancelar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  // El padre pasa funciones nuevas en cada render: se leen desde refs para no
  // re-ejecutar los efectos (y robar el foco) cada vez que el Marco se pinta.
  const cancelar = useRef(onCancelar);
  cancelar.current = onCancelar;
  const ocupado = useRef(enviando);
  ocupado.current = enviando;

  // Al abrir, el foco va al boton principal; al cerrar, vuelve a donde estaba
  // (el boton "Cerrar sesion").
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    principal.current?.focus();
    return () => previo?.focus();
  }, []);

  // Mientras se envia los botones se deshabilitan y el foco se pierde: si el
  // servidor rechaza la salida, el foco vuelve al boton principal.
  useEffect(() => {
    if (error) principal.current?.focus();
  }, [error]);

  // Escape cancela y Tab no sale del dialogo mientras este abierto.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!ocupado.current) cancelar.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogo.current) return;
      const botones = Array.from(dialogo.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      if (botones.length === 0) {
        e.preventDefault();
        return;
      }
      const primero = botones[0];
      const ultimo = botones[botones.length - 1];
      const dentro = dialogo.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === primero || !dentro)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) {
        e.preventDefault();
        primero.focus();
      }
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  async function marcarYSalir() {
    setError(null);
    setEnviando(true);
    try {
      await onMarcarYSalir();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar la salida.');
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !enviando) onCancelar();
      }}
    >
      <div
        ref={dialogo}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-salida-titulo"
        aria-describedby="confirmar-salida-texto"
        className="w-full max-w-sm rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-6 text-[var(--tf-texto)] shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" d="M12 7v5l3 2" />
            </svg>
          </span>
          <h2 id="confirmar-salida-titulo" className="text-base font-bold">
            Tu jornada sigue abierta
          </h2>
        </div>
        <p id="confirmar-salida-texto" className="mb-5 text-sm leading-relaxed text-[var(--tf-texto-tenue)]">
          Marca tu salida antes de cerrar sesión para que la jornada de hoy quede registrada con su hora de término.
        </p>

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            ref={principal}
            onClick={marcarYSalir}
            disabled={enviando}
            className="rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {enviando ? 'Marcando salida…' : 'Marcar salida y cerrar sesión'}
          </button>
          <button
            onClick={onSalirSinMarcar}
            disabled={enviando}
            className="rounded-xl border border-[var(--tf-borde)] py-2.5 text-sm font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-60"
          >
            Cerrar sesión sin marcar
          </button>
          <button
            onClick={onCancelar}
            disabled={enviando}
            className="py-1.5 text-xs text-[var(--tf-texto-tenue)] transition hover:text-[var(--tf-texto)]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
