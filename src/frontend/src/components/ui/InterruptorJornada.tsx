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
  onAlternar,
}: {
  encendido: boolean;
  pendiente: boolean | null;
  /** Hora de entrada de la jornada abierta (ISO). */
  desde?: string | null;
  /** En barra lateral se organiza verticalmente para caber sin cortarse en w-60. */
  variante?: 'cabecera' | 'sidebar';
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
        title={visible ? 'Apaga para marcar la salida' : 'Enciende para marcar la entrada'}
        onClick={onAlternar}
        disabled={pendiente !== null}
        className="tf-interruptor flex w-full flex-col items-stretch gap-2 rounded-2xl px-3 py-2.5 text-left disabled:cursor-wait"
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
          <span className="min-w-0 flex-1 truncate text-[12px] font-bold tracking-tight">
            <span className={visible ? 'text-[var(--tf-acento-verde)]' : 'text-[var(--tf-texto)]'}>
              {visible ? 'En jornada' : 'Fuera de jornada'}
            </span>
            {visible && desde && pendiente === null && (
              <span className="ml-1 font-mono text-[11px] font-semibold text-[var(--tf-texto-tenue)]">
                · {hora(desde)}
              </span>
            )}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-texto-suave)]">
            {visible ? 'Activa' : 'Marcar entrada'}
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
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label={visible ? 'Jornada abierta: marcar salida' : 'Jornada cerrada: marcar entrada'}
      title={visible ? 'Apaga para marcar la salida' : 'Enciende para marcar la entrada'}
      onClick={onAlternar}
      disabled={pendiente !== null}
      className="tf-interruptor flex items-center gap-3 rounded-full py-1.5 pl-3.5 pr-1.5 text-left disabled:cursor-wait"
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
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            className={`text-[13px] font-bold tracking-tight ${
              visible ? 'text-[var(--tf-acento-verde)]' : 'text-[var(--tf-texto)]'
            }`}
          >
            {visible ? 'En jornada' : 'Fuera de jornada'}
          </span>
          {visible && desde && pendiente === null && (
            <span className="hidden font-mono text-[11px] font-semibold text-[var(--tf-texto-tenue)] sm:inline">
              · {hora(desde)}
            </span>
          )}
        </span>
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
