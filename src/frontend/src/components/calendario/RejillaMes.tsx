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
  soloAlertas = false,
}: {
  mes: DateTime;
  dias: DiaResumen[];
  seleccionado: string | null;
  onDia: (fecha: string) => void;
  prefs?: PreferenciasCalendario;
  soloAlertas?: boolean;
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
          <div key={d} className="pb-1 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--tf-texto-suave)]">
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
                className="min-h-20 rounded-xl border border-transparent p-2 text-xs text-[var(--tf-texto-suave)] opacity-35"
              >
                {celda.numero}
              </div>
            );
          }

          const alertas = dato?.alertas.total ?? 0;
          const atenuadoPorAlerta = soloAlertas && alertas === 0;
          const proporcion =
            dato && dato.segundosPresencia > 0
              ? Math.min(1, dato.segundosImputados / dato.segundosPresencia)
              : 0;

          const claseSuperficie = esLimpio
            ? activo
              ? `border border-[var(--tf-borde)] border-l-[3px] ${bordeLimpio(horas)} bg-[var(--tf-superficie-2)] text-[var(--tf-texto)] hover:border-sky-400/50`
              : 'border border-[var(--tf-borde)] bg-[var(--tf-hover)] text-[var(--tf-texto-suave)] opacity-65'
            : `${escala.clase} ${
                activo
                  ? 'border border-transparent hover:ring-2 hover:ring-sky-400/50'
                  : 'border border-dashed border-[var(--tf-borde)]'
              }`;

          return (
            <button
              key={celda.fecha}
              type="button"
              onClick={() => activo && onDia(celda.fecha)}
              disabled={!activo}
              aria-label={etiqueta(celda.fecha, dato)}
              className={`min-h-20 rounded-xl p-2.5 text-left transition ${claseSuperficie} ${
                activo ? 'cursor-pointer' : 'cursor-default'
              } ${atenuadoPorAlerta ? 'opacity-25' : ''} ${seleccionado === celda.fecha ? 'ring-2 ring-sky-400' : ''}`}
            >
              <span className="flex items-center gap-1">
                <span
                  className={`font-mono text-xs font-semibold ${
                    celda.hoy ? 'rounded-md bg-orange-500 px-1.5 py-0.5 text-white' : ''
                  }`}
                >
                  {celda.numero}
                </span>
                {prefs.mostrarAlertas && alertas > 0 && (
                  <span
                    className={`ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      esLimpio
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-amber-400 text-amber-950'
                    }`}
                    title={`${alertas} punto(s) por revisar`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {alertas}
                  </span>
                )}
              </span>

              {activo && dato ? (
                <>
                  {prefs.mostrarHoras && (
                    <span className="tf-display mt-2 block font-mono text-sm font-bold leading-tight">
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
                      className={`mt-2 block h-1 w-full overflow-hidden rounded-full ${
                        esLimpio ? 'bg-[var(--tf-borde)]' : 'bg-black/15'
                      }`}
                    >
                      <span
                        className={`tf-bar-grow block h-full rounded-full ${
                          esLimpio ? 'bg-emerald-400/85' : 'bg-current opacity-70'
                        }`}
                        style={{ width: `${proporcion * 100}%` }}
                      />
                    </span>
                  )}
                </>
              ) : (
                !esLimpio && (
                  <span className="mt-1 block text-[10px] leading-tight text-[var(--tf-texto-suave)]">
                    sin registro
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--tf-borde)] pt-3 text-[11px] text-[var(--tf-texto-tenue)]">
        <span className="font-medium text-[var(--tf-texto)]">Horas por persona:</span>
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
