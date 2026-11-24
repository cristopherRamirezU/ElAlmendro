'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { duracion, ESTADOS, fechaLarga } from '@/lib/formato';
import { TareaGantt } from '@/lib/tipos';
import { zonaActual } from '@/lib/zona';

const TAMANO_VENTANA = 21;
const PASO_VENTANA = 7;

const COLOR_BARRA: Record<string, string> = {
  COMPLETADA: 'bg-emerald-500/35 border-emerald-400/60',
  EN_PROGRESO: 'bg-amber-500/35 border-amber-400/60',
  PENDIENTE: 'bg-sky-500/30 border-sky-400/50',
  BLOQUEADA: 'bg-rose-500/35 border-rose-400/60',
  INCONCLUSA: 'bg-orange-500/35 border-orange-400/60',
  CANCELADA: 'bg-slate-500/25 border-slate-400/40',
};

const COLOR_CELDA: Record<string, string> = {
  COMPLETADA: 'bg-emerald-400',
  EN_PROGRESO: 'bg-amber-400',
  PENDIENTE: 'bg-sky-400',
  BLOQUEADA: 'bg-rose-400',
  INCONCLUSA: 'bg-orange-400',
  CANCELADA: 'bg-slate-400',
};

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
            <select
              id="gantt-filtro-proyecto"
              name="proyectoId"
              aria-label="Filtrar por proyecto"
              value={filtroProyecto}
              onChange={(e) => setFiltroProyecto(e.target.value)}
              className="rounded-xl border border-white/15 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-400"
            >
              <option value="">Todos los proyectos ({proyectos.length})</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          )}

          <select
            id="gantt-filtro-estado"
            name="estado"
            aria-label="Filtrar por estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-xl border border-white/15 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-400"
          >
            <option value="TODAS">Todos los estados</option>
            <option value="EN_PROGRESO">En progreso</option>
            <option value="COMPLETADA">Completadas</option>
            <option value="PENDIENTES">Por hacer / Bloqueadas</option>
          </select>

          <label
            htmlFor="gantt-solo-activas"
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.06]"
          >
            <input
              id="gantt-solo-activas"
              name="soloActivas"
              type="checkbox"
              checked={soloActivas}
              onChange={(e) => setSoloActivas(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-slate-950 accent-sky-400"
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
              className="rounded-lg border border-white/15 px-2.5 py-1 text-slate-300 transition hover:bg-white/5 disabled:opacity-35"
            >
              ‹ Anterior
            </button>
            <span className="font-mono text-[11px] text-slate-400">
              {primeroVentana.slice(5)} a {ultimoVentana.slice(5)}
            </span>
            <button
              type="button"
              onClick={() =>
                setInicioVentana((v) => Math.min(maxInicioVentana, v + PASO_VENTANA))
              }
              disabled={inicioVentana >= maxInicioVentana}
              className="rounded-lg border border-white/15 px-2.5 py-1 text-slate-300 transition hover:bg-white/5 disabled:opacity-35"
            >
              Siguiente ›
            </button>
          </div>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 py-10 text-center text-xs text-slate-500">
          Ninguna actividad coincide con los filtros seleccionados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/50">
          <div className="min-w-max">
            {/* Cabecera diaria */}
            <div
              className="grid border-b border-white/10 bg-slate-900/95"
              style={{ gridTemplateColumns: columnas }}
            >
              <div className="sticky left-0 z-20 flex items-center border-r border-white/10 bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Tarea ({filtradas.length})
              </div>
              {diasVentana.map((fecha) => {
                const d = DateTime.fromISO(fecha, { zone: zona });
                const esFinde = d.weekday >= 6;
                const esHoy = fecha === hoyClave;
                return (
                  <div
                    key={fecha}
                    className={`border-r border-white/5 px-1 py-1.5 text-center last:border-r-0 ${
                      esHoy
                        ? 'bg-sky-500/15 text-sky-300'
                        : esFinde
                          ? 'bg-white/[0.02] text-slate-500'
                          : 'text-slate-400'
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
              const estado = ESTADOS[t.estado] ?? ESTADOS.PENDIENTE;
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
                <div key={t.id} className="border-b border-white/5 last:border-b-0">
                  <div className="grid items-stretch" style={{ gridTemplateColumns: columnas }}>
                    {/* Columna fija izquierda */}
                    <button
                      type="button"
                      onClick={() => setSeleccionada((prev) => (prev === t.id ? null : t.id))}
                      aria-expanded={abierta}
                      className={`sticky left-0 z-10 flex flex-col justify-center border-r border-white/10 px-3 py-2 text-left transition ${
                        abierta ? 'bg-slate-800' : 'bg-slate-900/95 hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${estado.punto}`} />
                        <span className="truncate text-xs font-medium text-white" title={t.titulo}>
                          {t.titulo}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                        <span className="truncate">
                          {t.proyectoNombre}
                          {t.responsableNombre ? ` · ${t.responsableNombre}` : ''}
                        </span>
                        {t.segundosPeriodo > 0 && (
                          <span className="shrink-0 font-mono text-sky-300">
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
                          className={`pointer-events-none absolute top-1/2 z-[1] h-5 -translate-y-1/2 rounded-md border ${
                            COLOR_BARRA[t.estado] ?? COLOR_BARRA.PENDIENTE
                          }`}
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
                            className={`relative z-[2] flex h-11 items-center justify-center border-r border-white/5 last:border-r-0 ${
                              esHoy
                                ? 'bg-sky-500/10'
                                : esFinde
                                  ? 'bg-white/[0.015]'
                                  : ''
                            }`}
                          >
                            {segDia > 0 && (
                              <span
                                className={`h-3 w-3 rounded-sm shadow-sm ${
                                  COLOR_CELDA[t.estado] ?? COLOR_CELDA.PENDIENTE
                                }`}
                              />
                            )}
                            {esLimite && (
                              <span
                                className="absolute right-1 top-0.5 text-[10px] leading-none text-rose-400"
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
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-900/90 px-4 py-2.5 text-xs text-slate-300">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                        <span>
                          Estado:{' '}
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${estado.clase}`}>
                            {estado.texto}
                          </span>
                        </span>
                        <span>
                          Responsable:{' '}
                          <strong className="font-medium text-white">
                            {t.responsableNombre ?? 'Sin asignar'}
                          </strong>
                        </span>
                        <span>
                          Creada:{' '}
                          <span className="font-mono text-slate-200">
                            {formatearFechaCorta(t.creadoEn, zona)}
                          </span>
                        </span>
                        <span>
                          Inicio real:{' '}
                          <span className="font-mono text-slate-200">
                            {formatearFechaCorta(t.inicioTrabajoEn, zona)}
                          </span>
                        </span>
                        <span>
                          Límite:{' '}
                          <span className="font-mono text-slate-200">
                            {formatearFechaCorta(t.fechaLimite, zona)}
                          </span>
                        </span>
                        {t.completadaEn && (
                          <span>
                            Completada:{' '}
                            <span className="font-mono text-emerald-300">
                              {formatearFechaCorta(t.completadaEn, zona)}
                            </span>
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/nodos?proyectoId=${encodeURIComponent(t.proyectoId)}`}
                        className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-300 transition hover:bg-sky-500/20"
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
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
