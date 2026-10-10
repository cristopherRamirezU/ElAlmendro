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
  onAlternar,
}: {
  encendido: boolean;
  pendiente: boolean | null;
  /** Hora de entrada de la jornada abierta (ISO). */
  desde?: string | null;
  onAlternar: () => void;
}) {
  const visible = pendiente ?? encendido;
  const texto = visible
    ? desde && pendiente === null
      ? `En jornada · desde ${hora(desde)}`
      : 'En jornada'
    : 'Fuera de jornada';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label={visible ? 'Jornada abierta: marcar salida' : 'Jornada cerrada: marcar entrada'}
      title={visible ? 'Apaga para marcar la salida' : 'Enciende para marcar la entrada'}
      onClick={onAlternar}
      disabled={pendiente !== null}
      className="tf-interruptor flex items-center gap-2.5 rounded-full py-1 pl-3 pr-1 text-xs font-medium disabled:cursor-wait"
      data-encendido={visible}
    >
      <span className={visible ? 'text-emerald-300' : 'text-[var(--tf-texto-tenue)]'}>{texto}</span>
      <span aria-hidden className="tf-interruptor-pista">
        <span className="tf-interruptor-rotulo tf-interruptor-on">ON</span>
        <span className="tf-interruptor-rotulo tf-interruptor-off">OFF</span>
        <span className="tf-interruptor-perilla" />
      </span>
    </button>
  );
}
