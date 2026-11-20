'use client';

import { DateTime } from 'luxon';
import { Detalle, ventanaHoraria, zonaActual } from '@/lib/calendario';
import { duracion } from '@/lib/formato';
import LineaTiempo, { EjeHoras } from './LineaTiempo';

/**
 * Vista semanal por horas: a que hora se trabajo y con que pausas.
 *
 * Es la vista que la propuesta al cliente pedia. La rejilla 09:00–17:00 de
 * aquella maqueta se cambio por una ventana que se ajusta a los datos, porque
 * un freelance sin horario trabaja de madrugada o de noche y un eje fijo
 * recortaria justamente esas tandas.
 *
 * Una fila por dia y un carril por trabajador dentro de cada dia, con un eje
 * comun: asi se ve de una sola pasada si alguien movio su horario a lo largo de
 * la semana.
 */
export default function SemanaHoras({
  detalle,
  seleccionado,
  onDia,
}: {
  detalle: Detalle;
  seleccionado: string | null;
  onDia: (fecha: string) => void;
}) {
  const ventana = ventanaHoraria(detalle.dias);

  return (
    <div>
      <div className="flex items-end gap-2 pb-1">
        <div className="w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <EjeHoras ventana={ventana} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {detalle.dias.map((dia) => {
          const d = DateTime.fromISO(dia.fecha, { zone: zonaActual() });
          const conRegistro = dia.resumen.conRegistro > 0;

          return (
            <div
              key={dia.fecha}
              className={`flex items-start gap-2 rounded-lg p-1 transition ${
                seleccionado === dia.fecha ? 'ring-2 ring-sky-400' : ''
              }`}
            >
              <button
                onClick={() => conRegistro && onDia(dia.fecha)}
                disabled={!conRegistro}
                className={`w-24 shrink-0 rounded-lg px-2 py-1 text-left transition ${
                  conRegistro ? 'hover:bg-white/5' : 'cursor-default'
                }`}
              >
                <span className="block text-xs font-semibold text-slate-200 first-letter:uppercase">
                  {d.toFormat('ccc d', { locale: 'es' })}
                </span>
                <span className="block font-mono text-[10px] text-slate-500">
                  {conRegistro ? duracion(dia.resumen.segundosImputados) : 'sin registro'}
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <LineaTiempo
                  fecha={dia.fecha}
                  trabajadores={dia.trabajadores}
                  ventana={ventana}
                  mostrarNombres={detalle.trabajadores.length > 1}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-white/15" /> jornada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-emerald-500" /> sesion cerrada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-emerald-500 ring-1 ring-inset ring-orange-700" />{' '}
          inconclusa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-amber-500" /> autocerrada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-sky-500" /> en curso
        </span>
      </div>
    </div>
  );
}
