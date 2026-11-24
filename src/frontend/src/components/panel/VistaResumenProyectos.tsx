'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, FolderKanban, Plus, Sparkles } from 'lucide-react';
import BuscadorPanel from '@/components/panel/BuscadorPanel';
import type { ProyectoItem } from '@/lib/api';
import { colorConAlfa, colorTextoSobre, useColorPrimario } from '@/lib/color';
import { useTemaFondo } from '@/lib/tema';
import { proyectoCompletado } from './ConstelacionProyectos';

type FiltroResumen = 'todos' | 'proceso' | 'completados';

function porcentajeAvance(p: ProyectoItem): number {
  if (!p.totalTareas) return 0;
  return Math.min(100, Math.round((p.tareasCompletadas / p.totalTareas) * 100));
}

function colorEstado(p: ProyectoItem, colorPrimario: string): string {
  if (proyectoCompletado(p)) return '#10b981';
  const pct = porcentajeAvance(p);
  if (pct >= 60) return '#38bdf8';
  return colorPrimario;
}

/**
 * Vista ejecutiva "Resumen" para el Panel de Proyectos: complementa a la
 * Constelacion con una lectura clara, animaciones expresivas (spotlight al
 * cursor, inclinacion 3D sutil y anillo de progreso SVG) y acceso en 1 clic
 * al mapa de nodos o al detalle del proyecto.
 */
export default function VistaResumenProyectos({
  proyectos,
  esTrabajador,
  onElegir,
  onIrAlMapa,
  onCrear,
  selectorVista,
}: {
  proyectos: ProyectoItem[];
  esTrabajador: boolean;
  onElegir: (id: string) => void;
  onIrAlMapa: (p: ProyectoItem) => void;
  onCrear?: () => void;
  selectorVista?: React.ReactNode;
}) {
  const colorPrimario = useColorPrimario();
  const temaEsClaro = useTemaFondo() === 'claro-nube';
  const colorSobreSuave = (tono: string) =>
    temaEsClaro && colorTextoSobre(tono) === '#0f172a' ? '#0f172a' : tono;
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroResumen>('todos');
  const [focoId, setFocoId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      const done = proyectoCompletado(p);
      if (filtro === 'proceso' && done) return false;
      if (filtro === 'completados' && !done) return false;
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion ?? '').toLowerCase().includes(q)
      );
    });
  }, [proyectos, filtro, busqueda]);

  const protagonista = useMemo(() => {
    if (focoId) {
      const exacto = filtrados.find((p) => p.id === focoId) ?? proyectos.find((p) => p.id === focoId);
      if (exacto) return exacto;
    }
    return (
      filtrados.find((p) => !proyectoCompletado(p)) ??
      filtrados[0] ??
      proyectos[0] ??
      null
    );
  }, [focoId, filtrados, proyectos]);

  const metricas = useMemo(() => {
    const total = proyectos.length;
    const completados = proyectos.filter(proyectoCompletado).length;
    const enCurso = total - completados;
    const tareasTotales = proyectos.reduce((acc, p) => acc + p.totalTareas, 0);
    const tareasHechas = proyectos.reduce(
      (acc, p) => acc + Math.min(p.tareasCompletadas, p.totalTareas),
      0,
    );
    const pctGlobal = tareasTotales > 0 ? Math.round((tareasHechas / tareasTotales) * 100) : 0;
    return { total, completados, enCurso, tareasTotales, tareasHechas, pctGlobal };
  }, [proyectos]);

  function moverSpotlight(e: React.MouseEvent<HTMLElement>, conTilt = false) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
    if (conTilt && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const rx = ((y / r.height) - 0.5) * -4.2;
      const ry = ((x / r.width) - 0.5) * 4.2;
      el.style.transform = `perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`;
    }
  }

  function limpiarSpotlight(e: React.MouseEvent<HTMLElement>) {
    e.currentTarget.style.transform = '';
  }

  return (
    <div className="tf-enter space-y-5">
      {/* Barra superior alineada con Constelacion */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 transition-[padding] duration-200 md:pl-[var(--tf-sangria-izq-barra,0px)]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <BuscadorPanel
            id="resumen-buscar-proyecto"
            valor={busqueda}
            onCambio={setBusqueda}
            proyectos={proyectos}
            onIrAlMapa={onIrAlMapa}
            onElegirProyecto={onElegir}
          />

          <div className="inline-flex h-9 items-center rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-0.5 text-xs">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'proceso', label: 'En proceso' },
                { id: 'completados', label: 'Completados' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={`rounded-full px-3.5 py-1.5 transition ${
                  filtro === f.id
                    ? 'bg-[var(--tf-hover)] font-semibold text-[var(--tf-texto)]'
                    : 'text-[var(--tf-texto-tenue)] hover:text-[var(--tf-texto)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectorVista}
          {onCrear && (
            <button
              type="button"
              onClick={onCrear}
              style={{ backgroundColor: colorPrimario, color: 'var(--tf-texto-primario)' }}
              className="tf-shimmer-cta inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold shadow-sm transition hover:brightness-110"
            >
              <Plus size={14} aria-hidden />
              <span>Nuevo proyecto</span>
            </button>
          )}
        </div>
      </div>

      {proyectos.length === 0 ? (
        <div className="tf-card-pro flex flex-col items-center justify-center gap-3 rounded-2xl p-12 text-center">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl"
            style={{
              backgroundColor: colorConAlfa(colorPrimario, 0.14),
              color: colorSobreSuave(colorPrimario),
            }}
          >
            <FolderKanban size={22} aria-hidden />
          </span>
          <div>
            <p className="tf-display text-base font-bold text-[var(--tf-texto)]">
              Aún no hay proyectos creados
            </p>
            <p className="mt-1 text-xs text-[var(--tf-texto-tenue)]">
              Crea el primero para organizar sus nodos, responsables y seguimiento de horas.
            </p>
          </div>
          {onCrear && (
            <button
              type="button"
              onClick={onCrear}
              style={{ backgroundColor: colorPrimario, color: 'var(--tf-texto-primario)' }}
              className="tf-shimmer-cta mt-1 rounded-xl px-4 py-2 text-xs font-semibold transition hover:brightness-110"
            >
              Crear primer proyecto
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Fila superior asimetrica: Proyecto protagonista + Pulso del portafolio */}
          {protagonista && (
            <div className="grid gap-4 xl:grid-cols-12">
              <div className="tf-glow-ring xl:col-span-7">
                <div
                  onMouseMove={(e) => moverSpotlight(e, false)}
                  className="tf-glow-inner tf-spot flex h-full flex-col justify-between gap-5 p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: colorConAlfa(
                            colorEstado(protagonista, colorPrimario),
                            0.16,
                          ),
                          color: colorSobreSuave(colorEstado(protagonista, colorPrimario)),
                        }}
                      >
                        <Sparkles size={11} aria-hidden />
                        {proyectoCompletado(protagonista) ? 'Proyecto completado' : 'Proyecto en foco'}
                      </span>
                      <h2 className="tf-display mt-2 truncate text-2xl font-bold text-[var(--tf-texto)]">
                        {protagonista.nombre}
                      </h2>
                      <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-relaxed text-[var(--tf-texto-tenue)]">
                        {protagonista.descripcion || 'Sin descripción registrada para este proyecto.'}
                      </p>
                    </div>

                    {/* Anillo circular de progreso SVG */}
                    <div className="relative grid h-16 w-16 shrink-0 place-items-center">
                      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36" aria-hidden>
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="var(--tf-borde)"
                          strokeWidth="3"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke={colorEstado(protagonista, colorPrimario)}
                          strokeWidth="3"
                          strokeDasharray={`${porcentajeAvance(protagonista)} 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="font-mono text-xs font-bold text-[var(--tf-texto)]">
                        {porcentajeAvance(protagonista)}%
                      </span>
                    </div>
                  </div>

                  {/* Barra segmentada moderna */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--tf-texto-tenue)]">
                      <span>Avance de nodos</span>
                      <span className="font-mono font-semibold text-[var(--tf-texto)]">
                        {Math.min(protagonista.tareasCompletadas, protagonista.totalTareas)} /{' '}
                        {protagonista.totalTareas} tareas
                      </span>
                    </div>
                    <div className="grid grid-cols-8 gap-1.5">
                      {Array.from({ length: 8 }, (_, idx) => {
                        const pct = porcentajeAvance(protagonista);
                        const lleno = pct > 0 && ((idx + 1) / 8) * 100 <= pct + 8;
                        return (
                          <div
                            key={idx}
                            className={`h-2 rounded-full transition-all ${lleno ? 'tf-shimmer-cta' : ''}`}
                            style={{
                              backgroundColor: lleno
                                ? colorEstado(protagonista, colorPrimario)
                                : 'var(--tf-borde)',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--tf-borde)] pt-4">
                    <button
                      type="button"
                      onClick={() => onElegir(protagonista.id)}
                      className="rounded-xl border border-[var(--tf-borde)] px-3.5 py-2 text-xs font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
                    >
                      Ver detalles y equipo
                    </button>
                    <button
                      type="button"
                      onClick={() => onIrAlMapa(protagonista)}
                      style={{ backgroundColor: colorPrimario, color: 'var(--tf-texto-primario)' }}
                      className="tf-shimmer-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition hover:brightness-110"
                    >
                      <span>{esTrabajador ? 'Registrar avance' : 'Ir al mapa de nodos'}</span>
                      <ArrowRight size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>

              {/* Pulso general del portafolio */}
              <div
                onMouseMove={(e) => moverSpotlight(e, false)}
                className="tf-card-pro tf-spot flex flex-col justify-between gap-4 rounded-2xl p-6 xl:col-span-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-texto-suave)]">
                      Pulso del espacio
                    </p>
                    <h3 className="tf-display mt-0.5 text-lg font-bold text-[var(--tf-texto)]">
                      Panorama de proyectos
                    </h3>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[var(--tf-texto-tenue)]">
                    {metricas.total} total
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)] p-3">
                    <p className="text-[11px] text-[var(--tf-texto-tenue)]">En proceso</p>
                    <p className="tf-display mt-1 text-xl font-bold text-[var(--tf-texto)]">
                      {metricas.enCurso}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)] p-3">
                    <p className="text-[11px] text-[var(--tf-texto-tenue)]">Completados</p>
                    <p className="tf-display mt-1 text-xl font-bold text-[var(--tf-acento-verde)]">
                      {metricas.completados}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)] p-3">
                    <p className="text-[11px] text-[var(--tf-texto-tenue)]">Tareas</p>
                    <p className="tf-display mt-1 font-mono text-xl font-bold text-[var(--tf-texto)]">
                      {metricas.tareasHechas}/{metricas.tareasTotales}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--tf-texto-tenue)]">Cumplimiento global</span>
                    <span className="font-mono font-bold text-[var(--tf-texto)]">
                      {metricas.pctGlobal}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--tf-borde)]">
                    <div
                      className="tf-bar-grow tf-shimmer-cta h-full rounded-full"
                      style={{
                        width: `${metricas.pctGlobal}%`,
                        backgroundColor: colorPrimario,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grilla interactiva de todos los proyectos */}
          {filtrados.length === 0 ? (
            <p className="tf-card-pro rounded-2xl p-8 text-center text-xs text-[var(--tf-texto-tenue)]">
              No hay proyectos que coincidan con el filtro aplicado.
            </p>
          ) : (
            <div className="tf-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtrados.map((p) => {
                const pct = porcentajeAvance(p);
                const done = proyectoCompletado(p);
                const tono = colorEstado(p, colorPrimario);
                const enfocado = protagonista?.id === p.id;

                return (
                  <article
                    key={p.id}
                    onMouseMove={(e) => moverSpotlight(e, true)}
                    onMouseLeave={limpiarSpotlight}
                    onClick={() => setFocoId(p.id)}
                    style={enfocado ? { borderColor: tono } : undefined}
                    className="tf-card-pro tf-spot flex cursor-pointer flex-col justify-between gap-4 rounded-2xl p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium"
                          style={{
                            backgroundColor: colorConAlfa(tono, 0.16),
                            color: colorSobreSuave(tono),
                          }}
                        >
                          {done && <CheckCircle2 size={11} aria-hidden />}
                          {done ? 'Completado' : 'En proceso'}
                        </span>
                        <span className="font-mono font-semibold text-[var(--tf-texto-tenue)]">
                          {Math.min(p.tareasCompletadas, p.totalTareas)}/{p.totalTareas} tareas
                        </span>
                      </div>

                      <h3 className="tf-display mt-2.5 truncate text-base font-bold text-[var(--tf-texto)]">
                        {p.nombre}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--tf-texto-tenue)]">
                        {p.descripcion || 'Sin descripción'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex justify-between text-[11px]">
                          <span className="text-[var(--tf-texto-suave)]">Avance</span>
                          <span className="font-mono font-bold text-[var(--tf-texto)]">{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--tf-borde)]">
                          <div
                            className="tf-bar-grow h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: tono }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t border-[var(--tf-borde)] pt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onIrAlMapa(p);
                          }}
                          style={{
                            backgroundColor: colorConAlfa(tono, 0.16),
                            color: colorSobreSuave(tono),
                          }}
                          className="flex-1 rounded-xl py-2 text-xs font-semibold transition hover:brightness-110"
                        >
                          {esTrabajador ? 'Registrar avance' : 'Ir al mapa →'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onElegir(p.id);
                          }}
                          className="rounded-xl border border-[var(--tf-borde)] px-3 py-2 text-xs font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
                        >
                          Detalle
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
