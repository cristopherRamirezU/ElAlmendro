'use client';

import { useMemo, useState } from 'react';
import { DiaDetalle, MARGEN_PRESENCIA, SesionDetalle, TrabajadorDia } from '@/lib/calendario';
import { duracion, hora, iniciales } from '@/lib/formato';
import { desfase, zonaActual } from '@/lib/zona';
import {
  PREFERENCIAS_CALENDARIO_DEFECTO,
  PreferenciasCalendario,
} from '@/lib/preferencias-calendario';
import Insignia from '@/components/ui/Insignia';

/** Estados de una sesión de trabajo, con su lectura y su color. */
const ESTADO_SESION: Record<string, { texto: string; clase: string }> = {
  ACTIVA: { texto: 'En curso', clase: 'text-[var(--tf-acento-azul)] bg-sky-500/12 border-sky-500/30' },
  PAUSADA: { texto: 'En pausa', clase: 'text-[var(--tf-acento-azul)] bg-sky-500/12 border-sky-500/30' },
  CERRADA: { texto: 'Cerrada', clase: 'text-[var(--tf-texto-tenue)] bg-[var(--tf-hover)] border-[var(--tf-borde)]' },
  AUTOCERRADA: {
    texto: 'Autocerrada',
    clase: 'text-[var(--tf-acento-ambar)] bg-amber-500/12 border-amber-500/30',
  },
};

function tieneActividad(w: TrabajadorDia): boolean {
  return w.sesiones.length > 0 || !!w.jornada;
}

/**
 * Detalle de un día con despliegue progresivo: alertas colapsables, acordeón
 * por trabajador, tarjetas de sesión compactas ampliables y ocultamiento por
 * defecto de quienes no tienen registro.
 */
export default function PanelDia({
  dia,
  cargando,
  foco,
  onFoco,
  prefs = PREFERENCIAS_CALENDARIO_DEFECTO,
}: {
  dia: DiaDetalle | null;
  cargando: boolean;
  foco: string | null;
  onFoco: (id: string | null) => void;
  prefs?: PreferenciasCalendario;
}) {
  if (cargando && !dia) {
    return <p className="text-sm text-[var(--tf-texto-tenue)]">Cargando el detalle…</p>;
  }
  if (!dia) {
    return <p className="text-sm text-[var(--tf-texto-tenue)]">No hay información para este día.</p>;
  }

  return <Contenido dia={dia} foco={foco} onFoco={onFoco} prefs={prefs} />;
}

function Contenido({
  dia,
  foco,
  onFoco,
  prefs,
}: {
  dia: DiaDetalle;
  foco: string | null;
  onFoco: (id: string | null) => void;
  prefs: PreferenciasCalendario;
}) {
  const [alertasAbiertas, setAlertasAbiertas] = useState(false);
  const [trabajadoresAbiertos, setTrabajadoresAbiertos] = useState<Record<string, boolean>>({});
  const [sesionesExpandidas, setSesionesExpandidas] = useState<Record<string, boolean>>({});
  const [verSinRegistroLocal, setVerSinRegistroLocal] = useState(false);

  const visibles = useMemo(
    () => (foco ? dia.trabajadores.filter((w) => w.id === foco) : dia.trabajadores),
    [dia, foco],
  );

  const conActividad = useMemo(() => visibles.filter(tieneActividad), [visibles]);
  const sinActividad = useMemo(() => visibles.filter((w) => !tieneActividad(w)), [visibles]);

  const chipsDisponibles = useMemo(() => {
    if (prefs.mostrarSinRegistroEnDetalle || verSinRegistroLocal) return dia.trabajadores;
    return dia.trabajadores.filter((w) => tieneActividad(w) || w.id === foco);
  }, [dia.trabajadores, foco, prefs.mostrarSinRegistroEnDetalle, verSinRegistroLocal]);

  const alertas = useMemo(() => reunirAlertas(visibles), [visibles]);

  const aperturaPorDefecto = conActividad.length === 1 || !!foco;

  function estaAbierto(id: string): boolean {
    return trabajadoresAbiertos[id] ?? aperturaPorDefecto;
  }

  const todosAbiertos =
    conActividad.length > 0 && conActividad.every((w) => estaAbierto(w.id));

  function alternarTodos() {
    const siguiente = !todosAbiertos;
    const mapa: Record<string, boolean> = {};
    for (const w of conActividad) mapa[w.id] = siguiente;
    setTrabajadoresAbiertos(mapa);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro rápido de equipo o persona con registro. */}
      {chipsDisponibles.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip activo={!foco} onClick={() => onFoco(null)}>
            Todo el equipo
          </Chip>
          {chipsDisponibles.map((w) => (
            <Chip key={w.id} activo={foco === w.id} onClick={() => onFoco(w.id)}>
              {w.nombre}
            </Chip>
          ))}
        </div>
      )}

      {/* Alertas del día en barra colapsable de 1 línea por defecto. */}
      {alertas.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10">
          <button
            type="button"
            onClick={() => setAlertasAbiertas((v) => !v)}
            aria-expanded={alertasAbiertas}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--tf-acento-ambar)] transition hover:bg-amber-500/10"
          >
            <span>▲ {alertas.length} punto(s) por revisar</span>
            <span className="text-[11px] font-normal text-[var(--tf-acento-ambar)] opacity-85">
              {alertasAbiertas ? 'Ocultar ▴' : 'Ver detalle ▾'}
            </span>
          </button>
          {alertasAbiertas && (
            <ul className="flex flex-col gap-1 border-t border-amber-500/20 px-3 py-2.5 text-[11px] text-[var(--tf-texto)]">
              {alertas.map((a, i) => (
                <li key={i}>· {a}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Barra de control cuando hay varias personas con registro. */}
      {conActividad.length > 1 && (
        <div className="flex items-center justify-between text-[11px] text-[var(--tf-texto-tenue)]">
          <span>{conActividad.length} personas con registro</span>
          <button
            type="button"
            onClick={alternarTodos}
            className="font-semibold text-[var(--tf-acento-azul)] transition hover:opacity-80"
          >
            {todosAbiertos ? 'Colapsar todos' : 'Expandir todos'}
          </button>
        </div>
      )}

      {/* Acordeón por trabajador con actividad. */}
      {conActividad.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--tf-borde-fuerte)] p-5 text-center text-xs text-[var(--tf-texto-suave)]">
          Sin actividad registrada para este filtro.
        </p>
      ) : (
        <section className="flex flex-col gap-2.5">
          {conActividad.map((w) => {
            const abierto = estaAbierto(w.id);
            const avisosPersona = reunirAlertas([w]).length;

            return (
              <div
                key={w.id}
                className="overflow-hidden rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setTrabajadoresAbiertos((prev) => ({ ...prev, [w.id]: !abierto }))
                  }
                  aria-expanded={abierto}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-[var(--tf-hover)]"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/15 text-[10px] font-bold text-[var(--tf-acento-azul)]">
                    {iniciales(w.nombre)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--tf-texto)]">
                      {w.nombre}
                    </span>
                    <span className="block font-mono text-[11px] text-[var(--tf-texto-tenue)]">
                      {w.sesiones.length} ses. · {duracion(w.segundosImputados)}
                      {w.jornada && ` · jornada ${duracion(w.segundosPresencia)}`}
                    </span>
                  </span>

                  {w.zonaHoraria !== zonaActual() && (
                    <span
                      className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-[var(--tf-acento-azul)]"
                      title={`Horas en la zona de ${w.nombre}: ${w.zonaHoraria}`}
                    >
                      {desfase(w.zonaHoraria)}
                    </span>
                  )}

                  {avisosPersona > 0 && (
                    <span
                      className="rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--tf-acento-ambar)]"
                      title={`${avisosPersona} punto(s) por revisar`}
                    >
                      ▲{avisosPersona}
                    </span>
                  )}

                  <span className="text-xs text-[var(--tf-texto-tenue)]" aria-hidden>
                    {abierto ? '▴' : '▾'}
                  </span>
                </button>

                {abierto && (
                  <div className="flex flex-col gap-2 border-t border-[var(--tf-borde)] bg-[var(--tf-fondo)]/60 p-3">
                    {w.jornada && !w.jornada.terminoEn && (
                      <p className="rounded-lg bg-amber-500/12 px-2.5 py-1.5 text-[11px] text-[var(--tf-acento-ambar)]">
                        Jornada abierta desde las {hora(w.jornada.inicioEn, w.zonaHoraria)}: nunca
                        se marcó la salida.
                      </p>
                    )}

                    {w.sesiones.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[var(--tf-borde)] p-3 text-center text-xs text-[var(--tf-texto-suave)]">
                        Jornada sin sesiones cronometradas.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {w.sesiones.map((s) => (
                          <Tarjeta
                            key={s.id}
                            sesion={s}
                            zona={w.zonaHoraria}
                            mostrarProyecto={prefs.mostrarProyectoEnSesion}
                            abierta={!!sesionesExpandidas[s.id]}
                            onAlternar={() =>
                              setSesionesExpandidas((e) => ({ ...e, [s.id]: !e[s.id] }))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Personas sin registro: ocultas por defecto salvo preferencia o clic explícito. */}
      {sinActividad.length > 0 && (
        <div className="border-t border-[var(--tf-borde)] pt-3">
          {!prefs.mostrarSinRegistroEnDetalle && (
            <button
              type="button"
              onClick={() => setVerSinRegistroLocal((v) => !v)}
              aria-expanded={verSinRegistroLocal}
              className="w-full rounded-lg border border-[var(--tf-borde)] px-3 py-1.5 text-center text-[11px] font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
            >
              {verSinRegistroLocal
                ? `Ocultar ${sinActividad.length} persona(s) sin registro ▴`
                : `Mostrar ${sinActividad.length} persona(s) sin registro ▾`}
            </button>
          )}

          {(prefs.mostrarSinRegistroEnDetalle || verSinRegistroLocal) && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {sinActividad.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border border-dashed border-[var(--tf-borde)] px-3 py-2 text-xs text-[var(--tf-texto-tenue)]"
                >
                  <span>{w.nombre}</span>
                  <span className="text-[11px] text-[var(--tf-texto-suave)]">Sin registro este día</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Tarjeta({
  sesion,
  zona,
  mostrarProyecto,
  abierta,
  onAlternar,
}: {
  sesion: SesionDetalle;
  /** Zona del trabajador: sus horas se muestran en ella. */
  zona: string;
  mostrarProyecto: boolean;
  abierta: boolean;
  onAlternar: () => void;
}) {
  const estado = ESTADO_SESION[sesion.estado] ?? {
    texto: sesion.estado,
    clase: 'text-[var(--tf-texto-tenue)] bg-[var(--tf-hover)] border-[var(--tf-borde)]',
  };
  const cerradaCompletada = sesion.estado === 'CERRADA' && sesion.desenlace === 'COMPLETADA';

  return (
    <div className="rounded-lg border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)]">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className="flex w-full items-start justify-between gap-2 p-2.5 text-left transition hover:bg-[var(--tf-hover)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {cerradaCompletada && (
              <span className="text-xs font-bold text-[var(--tf-acento-verde)]" title="Completada">
                ✓
              </span>
            )}
            <p className="truncate text-sm font-medium text-[var(--tf-texto)]">{sesion.actividad}</p>
          </div>

          <p className="mt-0.5 font-mono text-[11px] text-[var(--tf-texto-tenue)]">
            {hora(sesion.inicioEn, zona)}
            {sesion.terminoEn ? ` – ${hora(sesion.terminoEn, zona)}` : ' – en curso'}
            {mostrarProyecto && ` · ${sesion.proyecto}`}
          </p>

          {!cerradaCompletada && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {sesion.estado !== 'CERRADA' && (
                <Insignia clase={estado.clase}>{estado.texto}</Insignia>
              )}
              {sesion.desenlace === 'INCONCLUSA' && (
                <Insignia clase="text-[var(--tf-acento-naranja)] bg-orange-500/12 border-orange-500/30">
                  Inconclusa
                </Insignia>
              )}
              {sesion.desenlace === 'COMPLETADA' && (
                <Insignia clase="text-[var(--tf-acento-verde)] bg-emerald-500/12 border-emerald-500/30">
                  Completada
                </Insignia>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-xs font-medium text-[var(--tf-texto)]">
            {duracion(sesion.segundos)}
          </span>
          <span className="text-[10px] text-[var(--tf-texto-suave)]">{abierta ? 'Ocultar ▴' : 'Detalles ▾'}</span>
        </div>
      </button>

      {abierta && (
        <div className="flex flex-col gap-2 border-t border-[var(--tf-borde)] px-2.5 py-2 text-[11px] text-[var(--tf-texto-tenue)]">
          {!mostrarProyecto && (
            <p className="text-[var(--tf-texto-tenue)]">
              Proyecto: <span className="font-medium text-[var(--tf-texto)]">{sesion.proyecto}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <Insignia clase={estado.clase}>{estado.texto}</Insignia>
            {sesion.desenlace === 'COMPLETADA' && (
              <Insignia clase="text-[var(--tf-acento-verde)] bg-emerald-500/12 border-emerald-500/30">
                Completada
              </Insignia>
            )}
            {sesion.desenlace === 'INCONCLUSA' && (
              <Insignia clase="text-[var(--tf-acento-naranja)] bg-orange-500/12 border-orange-500/30">
                Inconclusa
              </Insignia>
            )}
          </div>

          {sesion.tramos.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--tf-texto-suave)]">
                {sesion.tramos.length} tramo(s)
              </p>
              <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-[var(--tf-texto-tenue)]">
                {sesion.tramos.map((t, i) => (
                  <li key={i}>
                    {hora(t.inicioEn, zona)}
                    {t.terminoEn ? ` – ${hora(t.terminoEn, zona)}` : ' – en curso'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sesion.notaCierre && (
            <p className="rounded-lg bg-amber-500/12 px-2 py-1 text-[11px] text-[var(--tf-acento-ambar)]">
              {sesion.notaCierre}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
        activo
          ? 'border-sky-500/40 bg-sky-500/15 text-[var(--tf-acento-azul)]'
          : 'border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
      }`}
    >
      {children}
    </button>
  );
}

/** Las anomalías que el calendario señala, explicadas en texto. */
function reunirAlertas(trabajadores: TrabajadorDia[]): string[] {
  const avisos: string[] = [];

  for (const w of trabajadores) {
    if (w.jornada && !w.jornada.terminoEn) {
      avisos.push(`${w.nombre}: jornada sin cerrar.`);
    }

    const autocerradas = w.sesiones.filter((s) => s.estado === 'AUTOCERRADA');
    if (autocerradas.length > 0) {
      avisos.push(
        `${w.nombre}: ${autocerradas.length} sesión(es) autocerradas por superar el umbral.`,
      );
    }

    const inconclusas = w.sesiones.filter((s) => s.desenlace === 'INCONCLUSA');
    if (inconclusas.length > 0) {
      avisos.push(`${w.nombre}: ${inconclusas.length} sesión(es) declaradas inconclusas.`);
    }

    const sinImputar = w.segundosPresencia - w.segundosImputados;
    if (w.segundosPresencia > 0 && sinImputar > MARGEN_PRESENCIA) {
      avisos.push(
        `${w.nombre}: ${duracion(sinImputar)} de jornada sin imputar a ninguna actividad.`,
      );
    }
    if (w.segundosImputados > 12 * 3600) {
      avisos.push(
        `${w.nombre}: ${duracion(w.segundosImputados)} imputadas en un día (supera el umbral de 12 h).`,
      );
    }
  }

  return avisos;
}
