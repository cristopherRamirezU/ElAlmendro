'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

/**
 * Icono discreto de ayuda contextual `(?)` accesible por hover, foco de teclado
 * y clic/tap. Explica el impacto de opciones sensibles en 1–2 líneas sin saturar
 * la interfaz.
 */
export default function TooltipAyuda({
  texto,
  titulo,
  etiqueta = 'Más información',
  tamano = 14,
  className = '',
}: {
  texto: string;
  titulo?: string;
  etiqueta?: string;
  tamano?: number;
  className?: string;
}) {
  const id = useId();
  const botonRef = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; arriba: boolean }>({
    top: 0,
    left: 0,
    arriba: false,
  });

  const reposicionar = useCallback(() => {
    const el = botonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ancho = 264;
    const arriba = rect.bottom + 110 > window.innerHeight && rect.top > 120;
    const left = Math.max(
      12,
      Math.min(rect.left + rect.width / 2 - ancho / 2, window.innerWidth - ancho - 12),
    );
    setCoords({
      top: arriba ? rect.top - 8 : rect.bottom + 8,
      left,
      arriba,
    });
  }, []);

  const abrir = useCallback(() => {
    reposicionar();
    setAbierto(true);
  }, [reposicionar]);

  const cerrar = useCallback(() => setAbierto(false), []);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrar();
      }
    };
    const alScroll = () => reposicionar();
    window.addEventListener('keydown', alTeclear);
    window.addEventListener('scroll', alScroll, true);
    window.addEventListener('resize', alScroll);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('scroll', alScroll, true);
      window.removeEventListener('resize', alScroll);
    };
  }, [abierto, cerrar, reposicionar]);

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        ref={botonRef}
        type="button"
        aria-label={etiqueta}
        aria-describedby={abierto ? id : undefined}
        onMouseEnter={abrir}
        onMouseLeave={cerrar}
        onFocus={abrir}
        onBlur={cerrar}
        onClick={(e) => {
          e.stopPropagation();
          if (abierto) cerrar();
          else abrir();
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--tf-texto-suave)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primario)]"
      >
        <HelpCircle size={tamano} aria-hidden />
      </button>

      {abierto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: 264,
              transform: coords.arriba ? 'translateY(-100%)' : undefined,
              zIndex: 90,
            }}
            className="pointer-events-none rounded-xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] px-3 py-2 text-left text-[11px] leading-relaxed text-[var(--tf-texto)] shadow-2xl backdrop-blur-xl"
          >
            {titulo && (
              <p className="mb-0.5 font-semibold text-[var(--tf-acento-azul)]">{titulo}</p>
            )}
            <p className="text-[var(--tf-texto-tenue)]">{texto}</p>
          </div>,
          document.body,
        )}
    </span>
  );
}
