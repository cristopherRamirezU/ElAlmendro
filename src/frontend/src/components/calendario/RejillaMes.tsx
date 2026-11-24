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
import {
  PREFERENCIAS_CALENDARIO_DEFECTO,
  PreferenciasCalendario,
} from '@/lib/preferencias-calendario';

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

const BANDAS_LIMPIAS: { hasta: number; borde: string; punto: string; etiqueta: string }[] = [
  { hasta: 2, borde: 'border-l-emerald-300', punto: 'bg-emerald-300', etiqueta: 'hasta 2 h' },
  { hasta: 4, borde: 'border-l-emerald-400', punto: 'bg-emerald-400', etiqueta: '2 a 4 h' },
  { hasta: 6, borde: 'border-l-emerald-500', punto: 'bg-emerald-500', etiqueta: '4 a 6 h' },
  { hasta: 8, borde: 'border-l-teal-400', punto: 'bg-teal-400', etiqueta: '6 a 8 h' },
  { hasta: Infinity, borde: 'border-l-cyan-400', punto: 'bg-cyan-400', etiqueta: 'más de 8 h' },
];

function bordeLimpio(segundosPorPersona: number): string {
  if (segundosPorPersona <= 0) return 'border-l-transparent';
  const horas = segundosPorPersona / 3600;
  return (BANDAS_LIMPIAS.find((b) => horas <= b.hasta) ?? BANDAS_LIMPIAS[BANDAS_LIMPIAS.length - 1])
    .borde;
}

/**
 * Rejilla mensual: cuánto se trabajó cada día.
 *
 * Admite un modo limpio (tarjetas oscuras sutiles con borde indicador de carga)
 * o mapa de calor clásico, mostrando únicamente las capas elegidas por el usuario.
 */
export default function RejillaMes({
  mes,
  dias,
  seleccionado,
  onDia,
  prefs = PREFERENCIAS_CALENDARIO_DEFECTO,
}: {
  mes: DateTime;
  dias: DiaResumen[];
  seleccionado: string | null;
  onDia: (fecha: string) => void;
  prefs?: PreferenciasCalendario;
}) {
  const porFecha = new Map(dias.map((d) => [d.fecha, d]));
  const esLimpio = prefs.estiloCelda === 'limpio';
  const cabeceras = prefs.mostrarFinesDeSemana ? DIAS : DIAS.slice(0, 5);
  const celdas = prefs.mostrarFinesDeSemana
    ? celdasDelMes(mes)
    : celdasDelMes(mes).filter((c) => !c.finDeSemana);
  const columnas = prefs.mostrarFinesDeSemana ? 'grid-cols-7' : 'grid-cols-5';

  return (
    <div>
      <div className={`mb-1 grid gap-1.5 ${columnas}`}>
        {cabeceras.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-medium text-slate-400">
            {d}
          </div>
        ))}
      </div>

      <div className={`grid gap-1.5 ${columnas}`}>
        {celdas.map((celda) => {
          const dato = porFecha.get(celda.fecha);
          const horas = dato ? porPersona(dato) : 0;
          const escala = dato && horas > 0 ? tramoEscala(horas) : SIN_REGISTRO;
          const activo = celda.delMes && !!dato && dato.conRegistro > 0;

          if (!celda.delMes) {
            return (
              <div
                key={celda.fecha}
                aria-hidden
                className="min-h-20 rounded-lg border border-transparent p-2 text-xs text-slate-700"
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

          const claseSuperficie = esLimpio
            ? activo
              ? `border border-white/10 border-l-[3px] ${bordeLimpio(horas)} bg-slate-800/75 text-slate-100 hover:border-sky-400/50 hover:bg-slate-800`
              : 'border border-white/5 bg-white/[0.02] text-slate-600'
            : `${escala.clase} ${
                activo
                  ? 'border border-transparent hover:ring-2 hover:ring-sky-400/50'
                  : 'border border-dashed border-white/10'
              }`;

          return (
            <button
              key={celda.fecha}
              type="button"
              onClick={() => activo && onDia(celda.fecha)}
              disabled={!activo}
              aria-label={etiqueta(celda.fecha, dato)}
              className={`min-h-20 rounded-lg p-2 text-left transition ${claseSuperficie} ${
                activo ? 'cursor-pointer' : 'cursor-default'
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
                {prefs.mostrarAlertas && alertas > 0 && (
                  <span
                    className={`ml-auto rounded px-1 text-[10px] font-bold ${
                      esLimpio
                        ? 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
                        : 'bg-amber-400 text-amber-950'
                    }`}
                    title={`${alertas} punto(s) por revisar`}
                  >
                    ▲{alertas}
                  </span>
                )}
              </span>

              {activo && dato ? (
                <>
                  {prefs.mostrarHoras && (
                    <span className="mt-1.5 block font-mono text-[13px] font-semibold leading-tight">
                      {horasBreves(dato.segundosImputados)}
                    </span>
                  )}
                  {prefs.mostrarPersonasSesiones && (
                    <span className="mt-0.5 block text-[10px] leading-tight opacity-75">
                      {dato.conRegistro} pers · {dato.sesiones} ses
                    </span>
                  )}
                  {prefs.mostrarBarraAvance && proporcion > 0 && (
                    <span
                      className={`mt-1.5 block h-1 w-full overflow-hidden rounded-full ${
                        esLimpio ? 'bg-white/10' : 'bg-black/15'
                      }`}
                    >
                      <span
                        className={`block h-full rounded-full ${
                          esLimpio ? 'bg-emerald-400/80' : 'bg-current opacity-70'
                        }`}
                        style={{ width: `${proporcion * 100}%` }}
                      />
                    </span>
                  )}
                </>
              ) : (
                !esLimpio && (
                  <span className="mt-1 block text-[10px] leading-tight text-slate-600">
                    sin registro
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-[11px] text-slate-400">
        <span className="font-medium text-slate-300">Horas por persona:</span>
        {esLimpio ? (
          BANDAS_LIMPIAS.map((b) => (
            <span key={b.etiqueta} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${b.punto}`} />
              {b.etiqueta}
            </span>
          ))
        ) : (
          <>
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
          </>
        )}
        {prefs.mostrarAlertas && (
          <span className="flex items-center gap-1.5">
            <span
              className={`rounded px-1 text-[10px] font-bold ${
                esLimpio
                  ? 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
                  : 'bg-amber-400 text-amber-950'
              }`}
            >
              ▲
            </span>
            por revisar
          </span>
        )}
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
