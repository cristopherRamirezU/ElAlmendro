'use client';

import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  esPersonalizada,
  EstiloCelda,
  PreferenciasCalendario,
} from '@/lib/preferencias-calendario';

const OPCIONES_GRILLA: {
  clave: keyof PreferenciasCalendario;
  etiqueta: string;
}[] = [
  { clave: 'mostrarResumenMes', etiqueta: 'Resumen superior del mes' },
  { clave: 'mostrarHoras', etiqueta: 'Horas trabajadas en el día' },
  { clave: 'mostrarPersonasSesiones', etiqueta: 'Cantidad de personas y sesiones' },
  { clave: 'mostrarBarraAvance', etiqueta: 'Barra de cumplimiento' },
  { clave: 'mostrarAlertas', etiqueta: 'Indicadores de alertas (▲)' },
  { clave: 'mostrarFinesDeSemana', etiqueta: 'Fines de semana (sáb/dom)' },
];

const OPCIONES_DETALLE: {
  clave: keyof PreferenciasCalendario;
  etiqueta: string;
}[] = [
  { clave: 'mostrarSinRegistroEnDetalle', etiqueta: 'Personas sin registro en el día' },
  { clave: 'mostrarProyectoEnSesion', etiqueta: 'Nombre del proyecto en cada sesión' },
];

/**
 * Selector de capas y estilo visual para el calendario.
 *
 * Permite que cada usuario muestre u oculte datos secundarios a su gusto
 * sin recargar el tablero mensual ni el panel lateral.
 */
export default function PersonalizarVista({
  prefs,
  onCambio,
  onRestablecer,
}: {
  prefs: PreferenciasCalendario;
  onCambio: (parcial: Partial<PreferenciasCalendario>) => void;
  onRestablecer: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const personalizada = esPersonalizada(prefs);

  useEffect(() => {
    if (!abierto) return;
    const alClicFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', alClicFuera);
    window.addEventListener('keydown', alTeclado);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      window.removeEventListener('keydown', alTeclado);
    };
  }, [abierto]);

  function cambiarEstilo(estiloCelda: EstiloCelda) {
    onCambio({ estiloCelda });
  }

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition ${
          abierto || personalizada
            ? 'border-sky-500/40 bg-sky-500/15 text-[var(--tf-acento-azul)]'
            : 'border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        <span>Personalizar</span>
        {personalizada && (
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-label="Vista personalizada" />
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Personalizar vista del calendario"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] p-4 text-left text-[var(--tf-texto)] shadow-2xl backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--tf-texto-tenue)]">
              Estilo de grilla
            </h3>
            {personalizada && (
              <button
                type="button"
                onClick={onRestablecer}
                className="text-[11px] font-semibold text-[var(--tf-acento-azul)] transition hover:opacity-80"
              >
                Restablecer vista
              </button>
            )}
          </div>

          <div
            role="radiogroup"
            aria-label="Estilo visual del calendario"
            className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-1"
          >
            {(
              [
                { valor: 'limpio', texto: 'Limpio' },
                { valor: 'calor', texto: 'Mapa de calor' },
              ] as const
            ).map((opcion) => {
              const activo = prefs.estiloCelda === opcion.valor;
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => cambiarEstilo(opcion.valor)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    activo
                      ? 'bg-sky-500/18 text-[var(--tf-acento-azul)] ring-1 ring-sky-500/40'
                      : 'text-[var(--tf-texto-tenue)] hover:text-[var(--tf-texto)]'
                  }`}
                >
                  {opcion.texto}
                </button>
              );
            })}
          </div>

          <div className="mb-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-texto-suave)]">
              Grilla del mes
            </p>
            <div className="flex flex-col gap-1.5">
              {OPCIONES_GRILLA.map((op) => (
                <Interruptor
                  key={op.clave}
                  id={`pref-${op.clave}`}
                  name={op.clave}
                  etiqueta={op.etiqueta}
                  activo={Boolean(prefs[op.clave])}
                  onCambio={(v) => onCambio({ [op.clave]: v })}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--tf-borde)] pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-texto-suave)]">
              Detalle del día
            </p>
            <div className="flex flex-col gap-1.5">
              {OPCIONES_DETALLE.map((op) => (
                <Interruptor
                  key={op.clave}
                  id={`pref-${op.clave}`}
                  name={op.clave}
                  etiqueta={op.etiqueta}
                  activo={Boolean(prefs[op.clave])}
                  onCambio={(v) => onCambio({ [op.clave]: v })}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Interruptor({
  id,
  name,
  etiqueta,
  activo,
  onCambio,
}: {
  id: string;
  name: string;
  etiqueta: string;
  activo: boolean;
  onCambio: (valor: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1.5 py-1 text-xs text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)]"
    >
      <span>{etiqueta}</span>
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={activo}
        onChange={(e) => onCambio(e.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--tf-borde-fuerte)] bg-[var(--tf-input)] accent-sky-500"
      />
    </label>
  );
}
