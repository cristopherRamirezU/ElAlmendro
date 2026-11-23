'use client';

import { DateTime } from 'luxon';
import {
  CeldaResumen,
  ESCALA,
  rangoDelMes,
  SIN_REGISTRO,
  TrabajadorRef,
  tramoEscala,
  zonaActual,
  diasEntre,
} from '@/lib/calendario';
import { duracion, fechaLarga, iniciales } from '@/lib/formato';

/**
 * Matriz trabajador x dia: quien trabajo y cuando.
 *
 * Es la vista que responde de un vistazo la pregunta que la rejilla no puede
 * contestar, porque alli las personas ya vienen sumadas. Cada fila es una
 * persona y cada columna un dia del mes, incluidos los fines de semana: el
 * trabajo es freelance y no hay dias no laborables que atenuar.
 */
export default function MatrizTrabajadores({
  mes,
  trabajadores,
  celdas,
  seleccionado,
  onCelda,
}: {
  mes: DateTime;
  trabajadores: TrabajadorRef[];
  celdas: CeldaResumen[];
  seleccionado: string | null;
  onCelda: (fecha: string, trabajadorId: string) => void;
}) {
  const { desde, hasta } = rangoDelMes(mes);
  const dias = diasEntre(desde, hasta);
  const porClave = new Map(celdas.map((c) => [`${c.fecha}|${c.trabajadorId}`, c]));

  if (trabajadores.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--tf-borde-fuerte)] p-10 text-center text-sm text-[var(--tf-texto-suave)]">
        No hay trabajadores activos que mostrar.
      </p>
    );
  }

  const columnas = `10rem repeat(${dias.length}, minmax(1.4rem, 1fr))`;

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[46rem]">
          {/* Cabecera: numero de dia y su inicial de la semana. */}
          <div className="grid gap-0.5" style={{ gridTemplateColumns: columnas }}>
            <div />
            {dias.map((fecha) => {
              const d = DateTime.fromISO(fecha, { zone: zonaActual() });
              return (
                <div key={fecha} className="pb-1 text-center">
                  <span className="block text-[10px] font-medium text-[var(--tf-texto-tenue)]">{d.day}</span>
                  <span className="block text-[9px] uppercase text-[var(--tf-texto-suave)]">
                    {d.toFormat('ccccc', { locale: 'es' })}
                  </span>
                </div>
              );
            })}
          </div>

          {trabajadores.map((w) => {
            const suyas = dias.map((f) => porClave.get(`${f}|${w.id}`));
            const total = suyas.reduce((t, c) => t + (c?.segundosImputados ?? 0), 0);
            const activos = suyas.filter((c) => (c?.segundosImputados ?? 0) > 0).length;

            return (
              <div
                key={w.id}
                className="grid items-center gap-0.5 border-t border-[var(--tf-borde)] py-1"
                style={{ gridTemplateColumns: columnas }}
              >
                <div className="flex min-w-0 items-center gap-2 pr-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/15 text-[10px] font-bold text-[var(--tf-acento-azul)]">
                    {iniciales(w.nombre)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-[var(--tf-texto)]">
                      {w.nombre}
                    </span>
                    <span className="block text-[10px] text-[var(--tf-texto-suave)]">
                      {duracion(total)} · {activos} d
                    </span>
                  </span>
                </div>

                {dias.map((fecha) => {
                  const c = porClave.get(`${fecha}|${w.id}`);
                  const segundos = c?.segundosImputados ?? 0;
                  const escala = segundos > 0 ? tramoEscala(segundos) : SIN_REGISTRO;
                  const alerta =
                    !!c &&
                    (c.jornadasAbiertas > 0 ||
                      c.autocerradas > 0 ||
                      c.inconclusas > 0 ||
                      c.presenciaExcesiva);

                  return (
                    <button
                      key={fecha}
                      onClick={() => segundos > 0 && onCelda(fecha, w.id)}
                      disabled={segundos === 0}
                      aria-label={`${w.nombre}, ${fechaLarga(fecha)}: ${
                        segundos > 0 ? duracion(segundos) : 'sin registro'
                      }${alerta ? ', con puntos por revisar' : ''}`}
                      title={`${w.nombre} · ${fechaLarga(fecha)} · ${
                        segundos > 0 ? duracion(segundos) : 'sin registro'
                      }`}
                      className={`relative aspect-square rounded-sm transition ${escala.clase} ${
                        segundos > 0
                          ? 'cursor-pointer hover:ring-2 hover:ring-sky-400/50'
                          : 'cursor-default border border-dashed border-[var(--tf-borde)]'
                      } ${seleccionado === fecha ? 'ring-2 ring-sky-400' : ''}`}
                    >
                      {alerta && (
                        <span className="absolute right-0 top-0 text-[8px] font-bold leading-none text-amber-500">
                          ▲
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--tf-borde)] pt-3 text-[11px] text-[var(--tf-texto-tenue)]">
        <span className="font-medium text-[var(--tf-texto)]">Horas del trabajador:</span>
        <span className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-sm ${SIN_REGISTRO.muestra}`} />
          {SIN_REGISTRO.etiqueta}
        </span>
        {ESCALA.map((e) => (
          <span key={e.etiqueta} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm ${e.muestra}`} />
            {e.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}
