'use client';

import { DateTime } from 'luxon';
import {
  celdasDelMes,
  DiaResumen,
  ESCALA,
  porPersona,
  SIN_REGISTRO,
  tramoEscala,
} from '@/lib/calendario';
import { fechaLarga, horasBreves } from '@/lib/formato';

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/**
 * Rejilla mensual: cuanto se trabajo cada dia.
 *
 * El color codifica horas por persona en escala fija, pero nunca es el unico
 * canal: la celda lleva siempre las horas escritas y las alertas van con un
 * simbolo ademas del color, para que la lectura no dependa de distinguir cuatro
 * tonos de verde.
 */
export default function RejillaMes({
  mes,
  dias,
  seleccionado,
  onDia,
}: {
  mes: DateTime;
  dias: DiaResumen[];
  seleccionado: string | null;
  onDia: (fecha: string) => void;
}) {
  const porFecha = new Map(dias.map((d) => [d.fecha, d]));

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {DIAS.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-medium text-slate-400">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {celdasDelMes(mes).map((celda) => {
          const dato = porFecha.get(celda.fecha);
          const horas = dato ? porPersona(dato) : 0;
          const escala = dato && horas > 0 ? tramoEscala(horas) : SIN_REGISTRO;
          const activo = celda.delMes && !!dato && dato.conRegistro > 0;

          if (!celda.delMes) {
            return (
              <div
                key={celda.fecha}
                aria-hidden
                className="min-h-24 rounded-lg border border-transparent p-1.5 text-xs text-slate-600"
              >
                {celda.numero}
              </div>
            );
          }

          const alertas = dato?.alertas.total ?? 0;
          const proporcion =
            dato && dato.segundosPresencia > 0
              ? Math.min(1, dato.segundosImputados / dato.segundosPresencia)
              : 0;

          return (
            <button
              key={celda.fecha}
              onClick={() => activo && onDia(celda.fecha)}
              disabled={!activo}
              aria-label={etiqueta(celda.fecha, dato)}
              className={`min-h-24 rounded-lg border p-1.5 text-left transition ${escala.clase} ${
                activo
                  ? 'cursor-pointer border-transparent hover:ring-2 hover:ring-sky-400/50'
                  : 'cursor-default border-dashed border-white/10'
              } ${seleccionado === celda.fecha ? 'ring-2 ring-sky-400' : ''}`}
            >
              <span className="flex items-start gap-1">
                <span
                  className={`text-xs font-semibold ${
                    celda.hoy ? 'rounded bg-orange-500 px-1.5 text-white' : ''
                  }`}
                >
                  {celda.numero}
                </span>
                {alertas > 0 && (
                  <span
                    className="ml-auto rounded bg-amber-400 px-1 text-[10px] font-bold text-amber-950"
                    title={`${alertas} punto(s) por revisar`}
                  >
                    ▲{alertas}
                  </span>
                )}
              </span>

              {activo && dato ? (
                <>
                  <span className="mt-1 block font-mono text-[13px] font-semibold leading-tight">
                    {horasBreves(dato.segundosImputados)}
                  </span>
                  <span className="block text-[10px] leading-tight opacity-80">
                    {dato.conRegistro} pers · {dato.sesiones} ses
                  </span>

                  {proporcion > 0 && (
                    <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-black/15">
                      <span
                        className="block h-full rounded-full bg-current opacity-70"
                        style={{ width: `${proporcion * 100}%` }}
                      />
                    </span>
                  )}
                </>
              ) : (
                <span className="mt-1 block text-[10px] leading-tight text-slate-600">
                  sin registro
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-[11px] text-slate-400">
        <span className="font-medium text-slate-300">Horas por persona:</span>
        <span className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded ${SIN_REGISTRO.muestra}`} />
          {SIN_REGISTRO.etiqueta}
        </span>
        {ESCALA.map((e) => (
          <span key={e.etiqueta} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded ${e.muestra}`} />
            {e.etiqueta}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-amber-400 px-1 text-[10px] font-bold text-amber-950">▲</span>
          por revisar
        </span>
      </div>
    </div>
  );
}

/** Lectura completa de la celda para quien navega con lector de pantalla. */
function etiqueta(fecha: string, dato?: DiaResumen): string {
  if (!dato || dato.conRegistro === 0) return `${fechaLarga(fecha)}: sin registro`;
  const partes = [
    `${fechaLarga(fecha)}: ${horasBreves(dato.segundosImputados)} imputadas`,
    `${dato.conRegistro} trabajador(es)`,
    `${dato.sesiones} sesión(es)`,
  ];
  if (dato.alertas.total > 0) partes.push(`${dato.alertas.total} punto(s) por revisar`);
  return partes.join(', ');
}
