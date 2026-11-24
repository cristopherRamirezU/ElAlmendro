'use client';

import { hora } from '@/lib/formato';

/**
 * Interruptor para marcar entrada y salida de la jornada. Encendido, la pista
 * se pone verde, la perilla salta a la derecha con un pequeno rebote y un
 * pulso de luz avisa el cambio; apagado vuelve a gris.
 *
 * `pendiente` es lo que se acaba de pedir y el servidor aun no confirma: el
 * interruptor ya se ve en esa posicion, y si falla vuelve solo a la real.
 */
export default function InterruptorJornada({
  encendido,
  pendiente,
  desde,
  variante = 'cabecera',
  compactarHora = false,
  onAlternar,
}: {
  encendido: boolean;
  pendiente: boolean | null;
  /** Hora de entrada de la jornada abierta (ISO). */
  desde?: string | null;
  /** En barra lateral se organiza verticalmente para caber sin cortarse en w-60. */
  variante?: 'cabecera' | 'sidebar';
  /** Muestra la hora solo en pantallas muy anchas (2xl+) y en el tooltip. */
  compactarHora?: boolean;
  onAlternar: () => void;
}) {
  const visible = pendiente ?? encendido;

  if (variante === 'sidebar') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-label={visible ? 'Jornada abierta: marcar salida' : 'Jornada cerrada: marcar entrada'}
        title={
          visible
            ? desde
              ? `En jornada desde ${hora(desde)} · Apaga para marcar la salida`
              : 'Apaga para marcar la salida'
            : 'Enciende para marcar la entrada'
        }
        onClick={onAlternar}
        disabled={pendiente !== null}
        className="tf-interruptor flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left disabled:cursor-wait"
        data-encendido={visible}
      >
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
            {visible && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                visible ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </span>
          {visible && desde && pendiente === null && (
            <span className="whitespace-nowrap font-mono text-[12px] font-semibold tabular-nums tracking-tight text-[var(--tf-texto-tenue)]">
              {hora(desde)}
            </span>
          )}
        </span>
        <span aria-hidden className="tf-interruptor-pista">
          <span className="tf-interruptor-rotulo tf-interruptor-on">ON</span>
          <span className="tf-interruptor-rotulo tf-interruptor-off">OFF</span>
          <span className="tf-interruptor-perilla">
            <span
              className={`h-2 w-2 rounded-full transition-colors ${
                visible ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </span>
        </span>
      </button>
    );
  }

  const tituloCabecera = visible
    ? desde
      ? `En jornada desde ${hora(desde)} · Apaga para marcar la salida`
      : 'Apaga para marcar la salida'
    : 'Enciende para marcar la entrada';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label={visible ? 'Jornada abierta: marcar salida' : 'Jornada cerrada: marcar entrada'}
      title={tituloCabecera}
      onClick={onAlternar}
      disabled={pendiente !== null}
      className={`tf-interruptor flex items-center rounded-full text-left disabled:cursor-wait ${
        compactarHora ? 'gap-2 py-0.5 pl-2.5 pr-1' : 'gap-2.5 py-1 pl-3 pr-1.5'
      }`}
      data-encendido={visible}
    >
      <span className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
          {visible && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
              visible ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
        </span>
        {visible && desde && pendiente === null && (
          <span className="hidden whitespace-nowrap font-mono text-[12px] font-semibold tabular-nums tracking-tight text-[var(--tf-texto-tenue)] sm:inline">
            {hora(desde)}
          </span>
        )}
      </span>
      <span aria-hidden className="tf-interruptor-pista">
        <span className="tf-interruptor-rotulo tf-interruptor-on">ON</span>
        <span className="tf-interruptor-rotulo tf-interruptor-off">OFF</span>
        <span className="tf-interruptor-perilla">
          <span
            className={`h-2 w-2 rounded-full transition-colors ${
              visible ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
        </span>
      </span>
    </button>
  );
}
