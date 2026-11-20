'use client';

import { barra, horaDelDia, TrabajadorDia } from '@/lib/calendario';
import { duracion, hora, iniciales } from '@/lib/formato';

export interface Ventana {
  desde: number;
  hasta: number;
}

/**
 * Color de la barra segun como termino la sesion. El estado no se comunica solo
 * por color: la tarjeta de la sesion repite el desenlace en texto y la barra
 * lleva su descripcion completa en el atributo `title`.
 */
const COLOR: Record<string, string> = {
  CERRADA: 'bg-emerald-500',
  AUTOCERRADA: 'bg-amber-500',
  ACTIVA: 'bg-sky-500',
  PAUSADA: 'bg-sky-300',
};

/** Eje horario compartido por el panel del dia y la vista semanal. */
export function EjeHoras({ ventana }: { ventana: Ventana }) {
  const ancho = ventana.hasta - ventana.desde;
  const marcas = Array.from({ length: ancho + 1 }, (_, i) => ventana.desde + i);

  return (
    <div className="relative h-4 select-none">
      {marcas.map((h) => (
        <span
          key={h}
          className="absolute -translate-x-1/2 text-[10px] tabular-nums text-slate-400"
          style={{ left: `${((h - ventana.desde) / ancho) * 100}%` }}
        >
          {String(h % 24).padStart(2, '0')}
        </span>
      ))}
    </div>
  );
}

/**
 * Carriles de un dia: una fila por trabajador, con la jornada de fondo y las
 * barras de cada tramo encima.
 *
 * Se dibujan los tramos y no las sesiones porque la duracion real es la suma de
 * los tramos: pintar de inicio a termino mostraria como trabajadas las pausas
 * que el trabajador si marco.
 */
export default function LineaTiempo({
  fecha,
  trabajadores,
  ventana,
  mostrarNombres = true,
}: {
  fecha: string;
  trabajadores: TrabajadorDia[];
  ventana: Ventana;
  mostrarNombres?: boolean;
}) {
  const ancho = ventana.hasta - ventana.desde;
  const lineas = Array.from({ length: Math.max(0, ancho - 1) }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-1">
      {trabajadores.map((w) => {
        // Las horas de cada trabajador van en SU zona: es en la que la API
        // agrupo su dia.
        const zona = w.zonaHoraria;
        const jornada = w.jornada
          ? barra(
              horaDelDia(w.jornada.inicioEn, fecha, zona),
              w.jornada.terminoEn ? horaDelDia(w.jornada.terminoEn, fecha, zona) : 24,
              ventana,
            )
          : null;

        return (
          <div key={w.id} className="flex items-center gap-2">
            {mostrarNombres && (
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-500/15 text-[9px] font-bold text-sky-300"
                title={w.nombre}
              >
                {iniciales(w.nombre)}
              </span>
            )}

            <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded bg-white/5">
              {lineas.map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-white/10"
                  style={{ left: `${(i / ancho) * 100}%` }}
                />
              ))}

              {jornada && (
                <span
                  className="absolute inset-y-1 rounded bg-white/15"
                  style={jornada}
                  title={`Jornada: ${hora(w.jornada!.inicioEn, zona)}${
                    w.jornada!.terminoEn ? ` – ${hora(w.jornada!.terminoEn, zona)}` : ' – sin cerrar'
                  }`}
                />
              )}

              {w.sesiones.flatMap((s) =>
                s.tramos.map((t, i) => {
                  const pos = barra(
                    horaDelDia(t.inicioEn, fecha, zona),
                    t.terminoEn ? horaDelDia(t.terminoEn, fecha, zona) : 24,
                    ventana,
                  );
                  if (!pos) return null;

                  return (
                    <span
                      key={`${s.id}-${i}`}
                      className={`absolute inset-y-1.5 rounded-sm ${
                        COLOR[s.estado] ?? 'bg-slate-400'
                      } ${s.desenlace === 'INCONCLUSA' ? 'ring-1 ring-inset ring-orange-700' : ''}`}
                      style={pos}
                      title={`${s.actividad} · ${hora(t.inicioEn, zona)}${
                        t.terminoEn ? ` – ${hora(t.terminoEn, zona)}` : ' – en curso'
                      } · ${duracion(s.segundos)}`}
                    />
                  );
                }),
              )}

              {!w.jornada && w.sesiones.length === 0 && (
                <span className="absolute inset-0 grid place-items-center text-[10px] text-slate-600">
                  sin registro
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
