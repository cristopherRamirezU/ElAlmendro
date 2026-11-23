'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, History, Search, X } from 'lucide-react';
import Marco from '@/components/Marco';
import { api, ErrorApi } from '@/lib/api';
import { diaRelativo, hora } from '@/lib/formato';
import { PERMISOS } from '@/lib/rbac';
import { useTienePermiso } from '@/lib/sesion';

interface RegistroHistorial {
  id: string;
  accion: string;
  tipoEntidad: string;
  entidadId: string;
  valorAnterior: unknown;
  valorNuevo: unknown;
  ocurridoEn: string;
  actor: {
    id: string;
    nombreCompleto: string;
    email: string;
    rol: string;
  } | null;
  organizacion: { nombre: string } | null;
}

interface RespuestaHistorial {
  items: RegistroHistorial[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

const ENTIDADES = [
  { valor: '', texto: 'Todo' },
  { valor: 'Actividad', texto: 'Nodos / Tareas' },
  { valor: 'SesionTrabajo', texto: 'Sesiones' },
  { valor: 'Evidencia', texto: 'Evidencias' },
  { valor: 'Proyecto', texto: 'Proyectos' },
  { valor: 'Usuario', texto: 'Usuarios' },
  { valor: 'Organizacion', texto: 'Empresa' },
];

const ACCIONES_HUMANAS: Record<string, string> = {
  INICIO_SESION: 'inició sesión en la plataforma',
  CIERRE_SESION: 'cerró sesión',
  ORGANIZACION_COLOR_ACTUALIZADO: 'actualizó la apariencia de la empresa',
  ACTIVIDAD_CREADA: 'creó una actividad',
  ACTIVIDAD_REASIGNADA: 'derivó una actividad',
  ACTIVIDAD_ESTADO_ACTUALIZADO: 'cambió el estado de una actividad',
  SESION_AUTOCERRADA: 'autocerró una sesión vencida (>10 h)',
  EVIDENCIA_SUBIDA: 'adjuntó una evidencia',
  EVIDENCIA_ELIMINADA: 'eliminó una evidencia',
  USUARIO_CREADO: 'creó un usuario',
  USUARIO_ACTUALIZADO: 'actualizó un usuario',
};

function describirAccion(accion: string): string {
  if (ACCIONES_HUMANAS[accion]) return ACCIONES_HUMANAS[accion];
  return accion
    .toLowerCase()
    .split('_')
    .map((p, i) => (i === 0 ? p : p))
    .join(' ');
}

function extraerColorNuevo(val: unknown): string | null {
  if (val && typeof val === 'object' && 'colorPrimario' in val) {
    const c = (val as { colorPrimario?: unknown }).colorPrimario;
    return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null;
  }
  return null;
}

type EntradaAgrupada =
  | { tipo: 'evento'; item: RegistroHistorial }
  | { tipo: 'grupo_logins'; id: string; actor: RegistroHistorial['actor']; dia: string; items: RegistroHistorial[] };

function agruparEventos(items: RegistroHistorial[]): EntradaAgrupada[] {
  const salida: EntradaAgrupada[] = [];
  for (const item of items) {
    const esLogin = item.accion === 'INICIO_SESION';
    const dia = diaRelativo(item.ocurridoEn);
    const prev = salida[salida.length - 1];
    if (
      esLogin &&
      prev &&
      prev.tipo === 'grupo_logins' &&
      prev.dia === dia &&
      (prev.actor?.id ?? null) === (item.actor?.id ?? null)
    ) {
      prev.items.push(item);
      continue;
    }
    if (esLogin && prev && prev.tipo === 'evento' && prev.item.accion === 'INICIO_SESION') {
      const diaPrev = diaRelativo(prev.item.ocurridoEn);
      if (diaPrev === dia && (prev.item.actor?.id ?? null) === (item.actor?.id ?? null)) {
        salida[salida.length - 1] = {
          tipo: 'grupo_logins',
          id: `grp-${prev.item.id}`,
          actor: item.actor,
          dia,
          items: [prev.item, item],
        };
        continue;
      }
    }
    salida.push({ tipo: 'evento', item });
  }
  return salida;
}

export default function PaginaHistorial() {
  return (
    <Marco
      activo="/historial"
      titulo="Historial de actividad"
      subtitulo="Bitácora inmutable de modificaciones en nodos, sesiones, evidencias y accesos"
    >
      <ContenidoHistorial />
    </Marco>
  );
}

function ContenidoHistorial() {
  const puedeVer = useTienePermiso(PERMISOS.HISTORIAL_VER);
  const [tipoEntidad, setTipoEntidad] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [datos, setDatos] = useState<RespuestaHistorial | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!puedeVer) return;
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pagina: String(pagina), limite: '25' });
      if (tipoEntidad) params.set('tipoEntidad', tipoEntidad);
      if (busqueda.trim()) params.set('busqueda', busqueda.trim());
      const res = await api.get<RespuestaHistorial>(`/historial?${params.toString()}`);
      setDatos(res);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el historial.');
    } finally {
      setCargando(false);
    }
  }, [puedeVer, pagina, tipoEntidad, busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!puedeVer) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-rose-500/25 bg-slate-900/90 p-6 text-center">
        <p className="text-base font-bold text-white">Acceso restringido</p>
        <p className="mt-1 text-xs text-slate-400">
          Esta bitácora está reservada para supervisión y administración.
        </p>
        <Link
          href="/panel"
          className="mt-4 inline-block rounded-xl border border-sky-400/35 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
        >
          Volver a Proyectos
        </Link>
      </div>
    );
  }

  const entradas = datos ? agruparEventos(datos.items) : [];

  return (
    <div className="tf-enter mx-auto flex max-w-5xl flex-col gap-4">
      <section className="tf-card-pro flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {ENTIDADES.map((op) => {
            const activo = tipoEntidad === op.valor;
            return (
              <button
                key={op.valor || 'todos'}
                type="button"
                onClick={() => {
                  setTipoEntidad(op.valor);
                  setPagina(1);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activo
                    ? 'border-[var(--color-primario)] bg-sky-500/15 text-[var(--tf-texto)]'
                    : 'border-[var(--tf-borde)] bg-[var(--tf-hover)] text-[var(--tf-texto-tenue)] hover:text-[var(--tf-texto)]'
                }`}
              >
                {op.texto}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tf-texto-suave)]"
              aria-hidden
            />
            <input
              id="historial-busqueda"
              name="busqueda"
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por acción o responsable…"
              aria-label="Buscar en el historial"
              className="w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] py-1.5 pl-8 pr-8 text-xs text-[var(--tf-texto)] placeholder-[var(--tf-texto-suave)] outline-none focus:border-sky-400"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setPagina(1);
                }}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-texto-tenue)] hover:text-[var(--tf-texto)]"
              >
                <X size={13} aria-hidden />
              </button>
            )}
          </div>
          <span className="font-mono text-xs text-[var(--tf-texto-suave)]">
            {datos ? `${datos.total} evento(s)` : ''}
          </span>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          {error}
        </p>
      )}

      <section className="tf-card-pro overflow-hidden rounded-2xl p-5">
        {cargando && !datos ? (
          <p className="p-8 text-center text-sm text-[var(--tf-texto-tenue)]">Cargando bitácora…</p>
        ) : entradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-[var(--tf-texto-suave)]">
            <History size={28} aria-hidden />
            <p className="text-sm">No hay eventos registrados con esos filtros.</p>
          </div>
        ) : (
          <ul className="relative ml-2 space-y-3 border-l border-[var(--tf-borde-fuerte)] pl-5">
            {entradas.map((entrada) => {
              if (entrada.tipo === 'grupo_logins') {
                const abierta = Boolean(abiertas[entrada.id]);
                return (
                  <li key={entrada.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[25px] top-4 h-2.5 w-2.5 rounded-full bg-sky-400 ring-4 ring-[var(--tf-fondo)]"
                    />
                    <div className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)]">
                      <button
                        type="button"
                        onClick={() =>
                          setAbiertas((prev) => ({ ...prev, [entrada.id]: !abierta }))
                        }
                        aria-expanded={abierta}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[var(--tf-texto)]">
                            {entrada.actor?.nombreCompleto || 'Usuario'}
                          </span>
                          <span className="text-[var(--tf-texto-tenue)]">inició sesión</span>
                          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-400">
                            {entrada.items.length} veces ({entrada.dia})
                          </span>
                        </div>
                        <ChevronDown
                          size={15}
                          aria-hidden
                          className={`text-[var(--tf-texto-suave)] transition-transform ${
                            abierta ? 'rotate-180 text-sky-400' : ''
                          }`}
                        />
                      </button>
                      {abierta && (
                        <div className="flex flex-wrap gap-2 border-t border-[var(--tf-borde)] px-4 py-2.5">
                          {entrada.items.map((ev) => (
                            <span
                              key={ev.id}
                              className="rounded-lg border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] px-2.5 py-1 font-mono text-[11px] text-[var(--tf-texto-tenue)]"
                            >
                              {hora(ev.ocurridoEn)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              }

              const { item } = entrada;
              const abierta = Boolean(abiertas[item.id]);
              const tieneDetalle =
                item.valorAnterior !== null || item.valorNuevo !== null;
              const colorNuevo = extraerColorNuevo(item.valorNuevo);

              return (
                <li key={item.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[25px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--tf-fondo)]"
                    style={{ backgroundColor: colorNuevo || 'var(--color-primario, #38bdf8)' }}
                  />
                  <div className="overflow-hidden rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)]">
                    <button
                      type="button"
                      onClick={() =>
                        setAbiertas((prev) => ({ ...prev, [item.id]: !abierta }))
                      }
                      aria-expanded={abierta}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--tf-hover)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-semibold text-[var(--tf-texto)]">
                            {item.actor ? item.actor.nombreCompleto : 'Sistema automático'}
                          </span>
                          <span className="text-[var(--tf-texto-tenue)]">
                            {describirAccion(item.accion)}
                          </span>
                          <span className="rounded bg-[var(--tf-superficie-solida)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--tf-texto-suave)]">
                            {item.tipoEntidad}
                          </span>
                          {colorNuevo && (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] px-2 py-0.5 font-mono text-[10px] text-[var(--tf-texto)]">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: colorNuevo }}
                              />
                              {colorNuevo}
                            </span>
                          )}
                        </div>
                        {item.actor?.email && (
                          <p className="mt-0.5 text-[11px] text-[var(--tf-texto-suave)]">
                            {item.actor.email}
                            {item.organizacion?.nombre ? ` · ${item.organizacion.nombre}` : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="font-mono text-[11px] text-[var(--tf-texto-suave)]">
                          {diaRelativo(item.ocurridoEn)} · {hora(item.ocurridoEn)}
                        </span>
                        <ChevronDown
                          size={15}
                          aria-hidden
                          className={`text-[var(--tf-texto-suave)] transition-transform ${
                            abierta ? 'rotate-180 text-sky-400' : ''
                          }`}
                        />
                      </div>
                    </button>

                    {abierta && (
                      <div className="border-t border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] px-4 py-3 text-xs">
                        <p className="mb-2 font-mono text-[11px] text-[var(--tf-texto-suave)]">
                          ID entidad: <span className="text-[var(--tf-texto)]">{item.entidadId}</span>
                        </p>
                        {tieneDetalle ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            {item.valorAnterior !== null && (
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                                  Valor anterior
                                </p>
                                <pre className="overflow-x-auto rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] p-2.5 font-mono text-[11px] text-[var(--tf-texto)]">
                                  {JSON.stringify(item.valorAnterior, null, 2)}
                                </pre>
                              </div>
                            )}
                            {item.valorNuevo !== null && (
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                                  Valor nuevo
                                </p>
                                <pre className="overflow-x-auto rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] p-2.5 font-mono text-[11px] text-[var(--tf-texto)]">
                                  {JSON.stringify(item.valorNuevo, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[var(--tf-texto-suave)]">Sin payload adicional registrado.</p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {datos && datos.totalPaginas > 1 && (
        <div className="flex items-center justify-between text-xs text-[var(--tf-texto-tenue)]">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            className="rounded-xl border border-[var(--tf-borde)] px-3 py-1.5 text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)] disabled:opacity-40"
          >
            ‹ Anterior
          </button>
          <span>
            Página {datos.pagina} de {datos.totalPaginas}
          </span>
          <button
            type="button"
            disabled={pagina >= datos.totalPaginas}
            onClick={() => setPagina((p) => Math.min(datos.totalPaginas, p + 1))}
            className="rounded-xl border border-[var(--tf-borde)] px-3 py-1.5 text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)] disabled:opacity-40"
          >
            Siguiente ›
          </button>
        </div>
      )}
    </div>
  );
}
