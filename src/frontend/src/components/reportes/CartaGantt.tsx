'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DateTime } from 'luxon';
import Selector from '@/components/ui/Selector';
import { duracion, estadoDeActividad, ESTADOS, fechaLarga, vencimientoRelativo } from '@/lib/formato';
import { TareaGantt } from '@/lib/tipos';
import { zonaActual } from '@/lib/zona';

const TAMANO_VENTANA = 21;
const PASO_VENTANA = 7;

function claveLocal(iso: string, zona: string): string {
  return DateTime.fromISO(iso, { zone: zona }).toFormat('yyyy-MM-dd');
}

function formatearFechaCorta(iso: string | null, zona: string): string {
  if (!iso) return 'Sin definir';
  return DateTime.fromISO(iso, { zone: zona }).toFormat('dd/MM/yyyy');
}

/**
 * Carta Gantt con visualización diaria real: compara la ventana planificada/activa
 * de cada actividad (creación/inicio hasta límite/cierre) contra los días concretos
 * en que recibió sesiones cronometradas.
 */
export default function CartaGantt({
  tareas,
  desdeIso,
  hastaIso,
}: {
  tareas: TareaGantt[];
  desdeIso: string;
  hastaIso: string;
}) {
  const zona = zonaActual();
  const [filtroProyecto, setFiltroProyecto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODAS');
  const [soloActivas, setSoloActivas] = useState(false);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  const diasTotales = useMemo(() => {
    const inicio = DateTime.fromISO(desdeIso, { zone: zona }).startOf('day');
    const fin = DateTime.fromISO(hastaIso, { zone: zona }).startOf('day');
    if (!inicio.isValid || !fin.isValid) return [];
    const lista: string[] = [];
    for (let d = inicio; d <= fin; d = d.plus({ days: 1 })) {
      lista.push(d.toFormat('yyyy-MM-dd'));
    }
    return lista;
  }, [desdeIso, hastaIso, zona]);

  const requierePaginacion = diasTotales.length > 31;
  const maxInicioVentana = requierePaginacion
    ? Math.max(0, diasTotales.length - TAMANO_VENTANA)
    : 0;
  const [inicioVentana, setInicioVentana] = useState(maxInicioVentana);

  useEffect(() => {
    setInicioVentana(maxInicioVentana);
  }, [maxInicioVentana]);

  const diasVentana = useMemo(() => {
    if (!requierePaginacion) return diasTotales;
    return diasTotales.slice(inicioVentana, inicioVentana + TAMANO_VENTANA);
  }, [diasTotales, inicioVentana, requierePaginacion]);

  const proyectos = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const t of tareas) mapa.set(t.proyectoId, t.proyectoNombre);
    return Array.from(mapa.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [tareas]);

  const filtradas = useMemo(() => {
    return tareas.filter((t) => {
      if (filtroProyecto && t.proyectoId !== filtroProyecto) return false;
      if (filtroEstado === 'EN_PROGRESO' && t.estado !== 'EN_PROGRESO') return false;
      if (filtroEstado === 'COMPLETADA' && t.estado !== 'COMPLETADA') return false;
      if (
        filtroEstado === 'PENDIENTES' &&
        !['PENDIENTE', 'BLOQUEADA', 'INCONCLUSA'].includes(t.estado)
      ) {
        return false;
      }
      if (soloActivas && t.segundosPeriodo <= 0) return false;
      return true;
    });
  }, [tareas, filtroProyecto, filtroEstado, soloActivas]);

  const hoyClave = DateTime.now().setZone(zona).toFormat('yyyy-MM-dd');
  const primeroVentana = diasVentana[0] ?? '';
  const ultimoVentana = diasVentana[diasVentana.length - 1] ?? '';

  if (tareas.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        No hay actividades registradas o planificadas en este período.
      </p>
    );
  }

  const columnas = `250px repeat(${diasVentana.length}, minmax(34px, 1fr))`;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de filtros y ventana temporal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {proyectos.length > 1 && (
            <Selector
              id="gantt-filtro-proyecto"
              name="proyectoId"
              ariaLabel="Filtrar por proyecto"
              forma="pildora"
              buscable={proyectos.length > 6}
              placeholderBusqueda="Buscar proyecto…"
              minAnchoMenu={220}
              valor={filtroProyecto}
              onChange={setFiltroProyecto}
              opciones={[
                { valor: '', etiqueta: `Todos los proyectos (${proyectos.length})` },
                ...proyectos.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
              ]}
            />
          )}

          <Selector
            id="gantt-filtro-estado"
            name="estado"
            ariaLabel="Filtrar por estado"
            forma="pildora"
            minAnchoMenu={200}
            valor={filtroEstado}
            onChange={setFiltroEstado}
            opciones={[
              { valor: 'TODAS', etiqueta: 'Todos los estados' },
              {
                valor: 'EN_PROGRESO',
                etiqueta: ESTADOS.EN_PROGRESO.texto,
                icono: <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${ESTADOS.EN_PROGRESO.celdaGantt}`} />,
              },
              {
                valor: 'COMPLETADA',
                etiqueta: 'Completadas',
                icono: <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${ESTADOS.COMPLETADA.celdaGantt}`} />,
              },
              {
                valor: 'PENDIENTES',
                etiqueta: 'Por hacer / Bloqueadas',
                icono: <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${ESTADOS.PENDIENTE.celdaGantt}`} />,
              },
            ]}
          />

          <label
            htmlFor="gantt-solo-activas"
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)] px-3 py-1.5 text-xs text-[var(--tf-texto)] transition hover:border-[var(--tf-borde-fuerte)]"
          >
            <input
              id="gantt-solo-activas"
              name="soloActivas"
              type="checkbox"
              checked={soloActivas}
              onChange={(e) => setSoloActivas(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[var(--tf-borde-fuerte)] bg-[var(--tf-input)] accent-sky-500"
            />
            <span>Solo con actividad en el período</span>
          </label>
        </div>

        {requierePaginacion && (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setInicioVentana((v) => Math.max(0, v - PASO_VENTANA))}
              disabled={inicioVentana === 0}
              className="rounded-lg border border-[var(--tf-borde)] px-2.5 py-1 text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-35"
            >
              ‹ Anterior
            </button>
            <span className="font-mono text-[11px] text-[var(--tf-texto-tenue)]">
              {primeroVentana.slice(5)} a {ultimoVentana.slice(5)}
            </span>
            <button
              type="button"
              onClick={() =>
                setInicioVentana((v) => Math.min(maxInicioVentana, v + PASO_VENTANA))
              }
              disabled={inicioVentana >= maxInicioVentana}
              className="rounded-lg border border-[var(--tf-borde)] px-2.5 py-1 text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-35"
            >
              Siguiente ›
            </button>
          </div>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--tf-borde-fuerte)] py-10 text-center text-xs text-[var(--tf-texto-suave)]">
          Ninguna actividad coincide con los filtros seleccionados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)]">
          <div className="min-w-max">
            {/* Cabecera diaria */}
            <div
              className="grid border-b border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)]"
              style={{ gridTemplateColumns: columnas }}
            >
              <div className="sticky left-0 z-20 flex items-center border-r border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-texto-tenue)]">
                Tarea ({filtradas.length})
              </div>
              {diasVentana.map((fecha) => {
                const d = DateTime.fromISO(fecha, { zone: zona });
                const esFinde = d.weekday >= 6;
                const esHoy = fecha === hoyClave;
                return (
                  <div
                    key={fecha}
                    className={`border-r border-[var(--tf-borde)] px-1 py-1.5 text-center last:border-r-0 ${
                      esHoy
                        ? 'bg-sky-500/15 text-[var(--tf-acento-azul)]'
                        : esFinde
                          ? 'bg-[var(--tf-hover)] text-[var(--tf-texto-suave)]'
                          : 'text-[var(--tf-texto-tenue)]'
                    }`}
                  >
                    <span className="block font-mono text-[10px] font-semibold leading-tight">
                      {d.day}/{d.month}
                    </span>
                    <span className="block text-[9px] uppercase opacity-75">
                      {d.toFormat('ccccc', { locale: 'es' })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Filas de tareas */}
            {filtradas.map((t) => {
              const abierta = seleccionada === t.id;
              const estado = estadoDeActividad(t.estado);
              const vencimiento = vencimientoRelativo(t.fechaLimite, t.estado === 'COMPLETADA');
              const porDia = new Map(t.diasTrabajados.map((d) => [d.dia, d.segundos]));

              const inicioClave = claveLocal(t.inicioTrabajoEn ?? t.creadoEn, zona);
              const finRaw =
                t.completadaEn ??
                t.fechaLimite ??
                t.ultimoTrabajoEn ??
                (t.estado === 'COMPLETADA' ? t.creadoEn : hoyClave);
              const finClave =
                finRaw.length === 10 ? finRaw : claveLocal(finRaw, zona);

              // Calcular barra continua dentro de la ventana actual.
              const inicioClamped =
                inicioClave < primeroVentana ? primeroVentana : inicioClave;
              const finClamped = finClave > ultimoVentana ? ultimoVentana : finClave;
              const idxInicio = diasVentana.indexOf(inicioClamped);
              const idxFin = diasVentana.indexOf(finClamped);
              const hayBarra =
                diasVentana.length > 0 &&
                finClave >= primeroVentana &&
                inicioClave <= ultimoVentana &&
                idxInicio !== -1 &&
                idxFin !== -1 &&
                idxFin >= idxInicio;

              const leftPct = hayBarra ? (idxInicio / diasVentana.length) * 100 : 0;
              const widthPct = hayBarra
                ? ((idxFin - idxInicio + 1) / diasVentana.length) * 100
                : 0;

              const limiteClave = t.fechaLimite ? claveLocal(t.fechaLimite, zona) : null;

              return (
                <div key={t.id} className="border-b border-[var(--tf-borde)] last:border-b-0">
                  <div className="grid items-stretch" style={{ gridTemplateColumns: columnas }}>
                    {/* Columna fija izquierda */}
                    <button
                      type="button"
                      onClick={() => setSeleccionada((prev) => (prev === t.id ? null : t.id))}
                      aria-expanded={abierta}
                      className={`sticky left-0 z-10 flex flex-col justify-center border-r border-[var(--tf-borde)] px-3 py-2 text-left transition ${
                        abierta ? 'bg-[var(--tf-superficie-2)]' : 'bg-[var(--tf-superficie-solida)] hover:bg-[var(--tf-hover)]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${estado.punto}`} />
                        <span className="truncate text-xs font-medium text-[var(--tf-texto)]" title={t.titulo}>
                          {t.titulo}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-[var(--tf-texto-tenue)]">
                        <span className="truncate">
                          {t.proyectoNombre}
                          {t.responsableNombre ? ` · ${t.responsableNombre}` : ''}
                        </span>
                        {t.segundosPeriodo > 0 && (
                          <span className="shrink-0 font-mono font-semibold text-[var(--tf-acento-azul)]">
                            {duracion(t.segundosPeriodo)}
                          </span>
                        )}
                      </span>
                    </button>

                    {/* Grilla diaria con barra Gantt y marcadores de trabajo */}
                    <div
                      className="relative grid"
                      style={{
                        gridColumn: `span ${diasVentana.length} / span ${diasVentana.length}`,
                        gridTemplateColumns: `repeat(${diasVentana.length}, minmax(34px, 1fr))`,
                      }}
                    >
                      {hayBarra && (
                        <div
                          aria-hidden
                          className={`pointer-events-none absolute top-1/2 z-[1] h-5 -translate-y-1/2 rounded-md border ${estado.barraGantt}`}
                          style={{
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                          }}
                        />
                      )}

                      {diasVentana.map((fecha) => {
                        const segDia = porDia.get(fecha) ?? 0;
                        const d = DateTime.fromISO(fecha, { zone: zona });
                        const esFinde = d.weekday >= 6;
                        const esHoy = fecha === hoyClave;
                        const esLimite = limiteClave === fecha;

                        return (
                          <div
                            key={fecha}
                            title={
                              segDia > 0
                                ? `${t.titulo} · ${fechaLarga(fecha)}: ${duracion(segDia)}`
                                : esLimite
                                  ? `${t.titulo} · Fecha límite (${fechaLarga(fecha)})`
                                  : undefined
                            }
                            className={`relative z-[2] flex h-11 items-center justify-center border-r border-[var(--tf-borde)] last:border-r-0 ${
                              esHoy
                                ? 'bg-sky-500/10'
                                : esFinde
                                  ? 'bg-[var(--tf-hover)]'
                                  : ''
                            }`}
                          >
                            {segDia > 0 && (
                              <span
                                className={`h-3 w-3 rounded-sm shadow-sm ${estado.celdaGantt}`}
                              />
                            )}
                            {esLimite && (
                              <span
                                className="absolute right-1 top-0.5 text-[10px] leading-none text-rose-500"
                                aria-label="Fecha límite"
                              >
                                ◆
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ficha desplegable de la tarea seleccionada */}
                  {abierta && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] px-4 py-2.5 text-xs text-[var(--tf-texto-tenue)]">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                        <span>
                          Estado:{' '}
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${estado.clase}`}>
                            {estado.texto}
                          </span>
                        </span>
                        <span>
                          Responsable:{' '}
                          <strong className="font-medium text-[var(--tf-texto)]">
                            {t.responsableNombre ?? 'Sin asignar'}
                          </strong>
                        </span>
                        <span>
                          Creada:{' '}
                          <span className="font-mono text-[var(--tf-texto)]">
                            {formatearFechaCorta(t.creadoEn, zona)}
                          </span>
                        </span>
                        <span>
                          Inicio real:{' '}
                          <span className="font-mono text-[var(--tf-texto)]">
                            {formatearFechaCorta(t.inicioTrabajoEn, zona)}
                          </span>
                        </span>
                        <span>
                          Límite:{' '}
                          <span className="font-mono text-[var(--tf-texto)]">
                            {formatearFechaCorta(t.fechaLimite, zona)}
                          </span>
                          {vencimiento && (
                            <span
                              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                vencimiento.tono === 'peligro'
                                  ? 'bg-rose-500/15 text-[var(--tf-acento-rojo)]'
                                  : vencimiento.tono === 'alerta'
                                    ? 'bg-amber-500/15 text-[var(--tf-acento-ambar)]'
                                    : vencimiento.tono === 'ok'
                                      ? 'bg-emerald-500/15 text-[var(--tf-acento-verde)]'
                                      : 'bg-[var(--tf-hover)] text-[var(--tf-texto-tenue)]'
                              }`}
                            >
                              {vencimiento.texto}
                            </span>
                          )}
                        </span>
                        {t.completadaEn && (
                          <span>
                            Completada:{' '}
                            <span className="font-mono text-[var(--tf-acento-verde)]">
                              {formatearFechaCorta(t.completadaEn, zona)}
                            </span>
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/nodos?proyectoId=${encodeURIComponent(t.proyectoId)}&nombre=${encodeURIComponent(t.proyectoNombre)}&tarea=${encodeURIComponent(t.id)}`}
                        className="rounded-lg border border-sky-500/35 bg-sky-500/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--tf-acento-azul)] transition hover:bg-sky-500/20"
                      >
                        Abrir en Nodos →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--tf-texto-tenue)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded border border-amber-400/60 bg-amber-500/35" />
          Duración de tarea
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          Día con sesiones registradas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-rose-400">◆</span>
          Fecha límite
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-500/30 ring-1 ring-sky-400/50" />
          Hoy
        </span>
      </div>
    </div>
  );
}
