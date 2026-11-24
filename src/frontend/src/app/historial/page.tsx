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
  { valor: '', texto: 'Todas las entidades' },
  { valor: 'Actividad', texto: 'Nodos / Tareas' },
  { valor: 'SesionTrabajo', texto: 'Sesiones y cronómetro' },
  { valor: 'Evidencia', texto: 'Evidencias' },
  { valor: 'Proyecto', texto: 'Proyectos' },
  { valor: 'Usuario', texto: 'Usuarios y roles' },
  { valor: 'Organizacion', texto: 'Organización' },
];

function nombreAccion(accion: string): string {
  return accion
    .toLowerCase()
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 p-4">
        <select
          id="historial-entidad"
          name="tipoEntidad"
          aria-label="Filtrar por tipo de entidad"
          value={tipoEntidad}
          onChange={(e) => {
            setTipoEntidad(e.target.value);
            setPagina(1);
          }}
          className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-400"
        >
          {ENTIDADES.map((op) => (
            <option key={op.valor} value={op.valor}>
              {op.texto}
            </option>
          ))}
        </select>

        <div className="relative min-w-56 flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
            className="w-full rounded-xl border border-white/15 bg-slate-950 py-2 pl-8 pr-8 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setPagina(1);
              }}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={13} aria-hidden />
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400">
          {datos ? `${datos.total} evento(s)` : ''}
        </span>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90">
        {cargando && !datos ? (
          <p className="p-8 text-center text-sm text-slate-400">Cargando bitácora…</p>
        ) : !datos || datos.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-slate-500">
            <History size={28} aria-hidden />
            <p className="text-sm">No hay eventos registrados con esos filtros.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {datos.items.map((item) => {
              const abierta = Boolean(abiertas[item.id]);
              const tieneDetalle =
                item.valorAnterior !== null || item.valorNuevo !== null;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setAbiertas((prev) => ({ ...prev, [item.id]: !abierta }))
                    }
                    aria-expanded={abierta}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                          {nombreAccion(item.accion)}
                        </span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                          {item.tipoEntidad}
                        </span>
                        {item.organizacion?.nombre && (
                          <span className="text-[11px] text-slate-400">
                            · {item.organizacion.nombre}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        {item.actor
                          ? `${item.actor.nombreCompleto} (${item.actor.email})`
                          : 'Sistema automático'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="font-mono text-[11px] text-slate-400">
                        {diaRelativo(item.ocurridoEn)} · {hora(item.ocurridoEn)}
                      </span>
                      <ChevronDown
                        size={15}
                        aria-hidden
                        className={`text-slate-500 transition-transform ${
                          abierta ? 'rotate-180 text-sky-300' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {abierta && (
                    <div className="border-t border-white/5 bg-slate-950/50 px-4 py-3 text-xs">
                      <p className="mb-2 font-mono text-[11px] text-slate-400">
                        ID entidad: <span className="text-slate-200">{item.entidadId}</span>
                      </p>
                      {tieneDetalle ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {item.valorAnterior !== null && (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                                Valor anterior
                              </p>
                              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300">
                                {JSON.stringify(item.valorAnterior, null, 2)}
                              </pre>
                            </div>
                          )}
                          {item.valorNuevo !== null && (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                Valor nuevo
                              </p>
                              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300">
                                {JSON.stringify(item.valorNuevo, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500">Sin payload adicional registrado.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {datos && datos.totalPaginas > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
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
            className="rounded-xl border border-white/15 px-3 py-1.5 text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
          >
            Siguiente ›
          </button>
        </div>
      )}
    </div>
  );
}
