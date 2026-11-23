'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Download } from 'lucide-react';
import Marco from '@/components/Marco';
import GraficoBarras from '@/components/reportes/GraficoBarras';
import CartaGantt from '@/components/reportes/CartaGantt';
import { api, ErrorApi, URL_API, OrganizacionItem, Usuario } from '@/lib/api';
import { useTienePermiso } from '@/lib/sesion';
import { PERMISOS } from '@/lib/rbac';
import { useDatosCache } from '@/lib/cacheDatos';
import { HorasActividad, HorasTrabajador, TareaGantt } from '@/lib/tipos';
import { duracion } from '@/lib/formato';
import {
  leerCacheSesion,
  leerCacheSesionServidor,
  suscribirCacheSesion,
} from '@/lib/cacheSesion';

const FORMATOS = [
  { clave: 'csv', texto: 'CSV', titulo: 'Valores separados, para Excel o Sheets' },
  { clave: 'xlsx', texto: 'Excel', titulo: 'Libro con una hoja por tabla' },
  { clave: 'pdf', texto: 'PDF', titulo: 'Documento listo para imprimir' },
];

const RANGOS = [
  { dias: 7, texto: 'Última semana' },
  { dias: 30, texto: 'Último mes' },
  { dias: 90, texto: 'Últimos 3 meses' },
];

type Vista = 'registro' | 'actividades' | 'gantt';

const VISTAS: { clave: Vista; texto: string }[] = [
  { clave: 'registro', texto: 'Registro' },
  { clave: 'actividades', texto: 'Por actividad' },
  { clave: 'gantt', texto: 'Carta Gantt' },
];

export default function Reportes() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400">
          Cargando reportes...
        </main>
      }
    >
      <ReportesContenido />
    </Suspense>
  );
}

/** US-07 y Multi-SaaS — horas por trabajador y por actividad en un periodo, con filtro por organización para Super Admin. */
function ReportesContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const cache = useSyncExternalStore(suscribirCacheSesion, leerCacheSesion, leerCacheSesionServidor);
  const usuario: Usuario | null = cache?.usuario ?? null;
  const esSuperAdmin = usuario?.rol === 'SUPER_ADMIN';

  const [dias, setDias] = useState(30);
  const [vista, setVista] = useState<Vista>('registro');
  const [menuExportar, setMenuExportar] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [organizaciones, setOrganizaciones] = useState<OrganizacionItem[]>([]);

  useEffect(() => {
    if (!menuExportar) return;
    const alClic = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setMenuExportar(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuExportar(false);
    };
    document.addEventListener('mousedown', alClic);
    window.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alClic);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [menuExportar]);
  const [orgSeleccionada, setOrgSeleccionada] = useState<string>(
    searchParams.get('organizacionId') || ''
  );

  // Sincronizar parametro de query si cambia externamente (ej: navegacion directa)
  useEffect(() => {
    const orgParam = searchParams.get('organizacionId') || '';
    setOrgSeleccionada(orgParam);
  }, [searchParams]);

  // Si es Super Admin, cargar el catalogo de organizaciones activas
  useEffect(() => {
    if (esSuperAdmin) {
      api
        .get<OrganizacionItem[]>('/organizaciones')
        .then((orgs) => setOrganizaciones(orgs || []))
        .catch(() => {});
    }
  }, [esSuperAdmin]);

  // Un solo rango para la consulta y para los enlaces de descarga, de modo
  // que el archivo exportado cubra exactamente lo que se ve en pantalla.
  const { rango, desdeIso, hastaIso } = useMemo(() => {
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const dIso = desde.toISOString();
    const hIso = hasta.toISOString();
    let q = `desde=${dIso}&hasta=${hIso}`;
    // El filtro de organizacion viaja tambien en la descarga: el archivo
    // exportado debe cubrir exactamente lo que se ve en pantalla.
    if (esSuperAdmin && orgSeleccionada) {
      q += `&organizacionId=${encodeURIComponent(orgSeleccionada)}`;
    }
    return { rango: q, desdeIso: dIso, hastaIso: hIso };
  }, [dias, esSuperAdmin, orgSeleccionada]);

  const puedeExportar = useTienePermiso(PERMISOS.REPORTES_VER_EQUIPO);

  const cargar = useCallback(async () => {
    const q = rango;

    const [trabajadores, actividades, gantt] = await Promise.all([
      api.get<HorasTrabajador[]>(`/reportes/horas?${q}`),
      api.get<HorasActividad[]>(`/reportes/actividades?${q}`),
      api.get<TareaGantt[]>(`/reportes/gantt?${q}`),
    ]);
    return { trabajadores, actividades, gantt };
  }, [rango]);

  // Clave de cache reactiva al periodo y al inquilino seleccionado
  const claveCache = `reportes:${dias}:${esSuperAdmin ? orgSeleccionada || 'global' : 'org'}`;
  const { datos, cargando, error } = useDatosCache(claveCache, cargar);
  const trabajadores = datos?.trabajadores ?? [];
  const actividades = datos?.actividades ?? [];
  const gantt = datos?.gantt ?? [];

  useEffect(() => {
    if (error instanceof ErrorApi && error.estado === 401) router.replace('/login');
  }, [error, router]);

  const totalSeg = trabajadores.reduce((s, t) => s + t.segundos, 0);
  const grafico = actividades.map((a) => ({
    nombre: a.actividad + (a.organizacionNombre && esSuperAdmin && !orgSeleccionada ? ` (${a.organizacionNombre})` : ''),
    valor: Number((a.segundos / 3600).toFixed(1)),
    etiqueta: duracion(a.segundos),
  }));

  const orgActual = organizaciones.find((o) => o.id === orgSeleccionada);

  const cambiarOrganizacion = (nuevaOrgId: string) => {
    setOrgSeleccionada(nuevaOrgId);
    if (nuevaOrgId) {
      router.replace(`/reportes?organizacionId=${encodeURIComponent(nuevaOrgId)}`);
    } else {
      router.replace('/reportes');
    }
  };

  return (
    <Marco
      activo="/reportes"
      titulo="Reportes de horas"
      subtitulo={
        esSuperAdmin
          ? 'Métricas de productividad · Plataforma Multi-SaaS'
          : 'Agregación por trabajador y por actividad'
      }
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          {esSuperAdmin && (
            <select
              id="reportes-organizacion"
              name="organizacionId"
              aria-label="Filtrar por organización"
              value={orgSeleccionada}
              onChange={(e) => cambiarOrganizacion(e.target.value)}
              className="rounded-xl border border-sky-500/30 bg-slate-900 px-3 py-2 text-sm text-sky-200 outline-none focus:border-sky-400"
            >
              <option value="">🏢 Todas las Empresas (Consolidado Global)</option>
              {organizaciones.map((org) => (
                <option key={org.id} value={org.id}>
                  🏢 {org.nombre} ({org.plan})
                </option>
              ))}
            </select>
          )}

          <select
            id="reportes-rango"
            name="dias"
            aria-label="Rango de días"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] px-3 py-2 text-xs font-medium text-[var(--tf-texto)] outline-none focus:border-sky-400"
          >
            {RANGOS.map((r) => (
              <option key={r.dias} value={r.dias}>
                {r.texto}
              </option>
            ))}
          </select>

          {puedeExportar && (
            <div ref={exportRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuExportar}
                onClick={() => setMenuExportar((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] px-3.5 py-2 text-xs font-medium text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)]"
              >
                <Download size={13} aria-hidden />
                <span>Exportar</span>
                <ChevronDown
                  size={13}
                  aria-hidden
                  className={`transition-transform duration-200 ${menuExportar ? 'rotate-180' : ''}`}
                />
              </button>
              {menuExportar && (
                <div
                  role="menu"
                  aria-label="Formatos de exportación"
                  className="absolute right-0 z-30 mt-2 w-44 rounded-2xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] p-1.5 shadow-2xl"
                >
                  {FORMATOS.map((f) => (
                    <a
                      key={f.clave}
                      role="menuitem"
                      href={`${URL_API}/reportes/periodo/exportar?${rango}&formato=${f.clave}`}
                      download
                      title={f.titulo}
                      onClick={() => setMenuExportar(false)}
                      className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)]"
                    >
                      <span>Descargar {f.texto}</span>
                      <span className="font-mono text-[10px] uppercase text-[var(--tf-texto-suave)]">
                        .{f.clave}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
      {/* Banner explicativo del alcance actual para Super Admin */}
      {esSuperAdmin && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm text-sky-300">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏢</span>
            <div>
              <div className="font-semibold text-white">
                {orgActual
                  ? `Organización Seleccionada: ${orgActual.nombre}`
                  : 'Consolidado Global de la Plataforma'}
              </div>
              <p className="text-xs text-sky-300/80">
                {orgActual
                  ? `Visualizando exclusivamente las métricas, actividades y colaboradores de ${orgActual.nombre} (Plan ${orgActual.plan}).`
                  : 'Mostrando datos acumulados de todas las organizaciones registradas en TimeFlow.'}
              </p>
            </div>
          </div>
          {orgActual && (
            <button
              onClick={() => cambiarOrganizacion('')}
              className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/20"
            >
              Ver Consolidado Global
            </button>
          )}
        </div>
      )}

      <div className="tf-stagger mb-5 grid gap-3 sm:grid-cols-3">
        <Indicador
          etiqueta="Horas del período"
          valor={cargando ? null : duracion(totalSeg)}
          subtexto={
            cargando
              ? undefined
              : trabajadores.length > 0
                ? `${duracion(Math.round(totalSeg / trabajadores.length))} prom. por persona`
                : 'Sin registros aún'
          }
          conSparkline
        />
        <Indicador
          etiqueta="Trabajadores con registro"
          valor={cargando ? null : String(trabajadores.length)}
          subtexto={`Últimos ${dias} días`}
        />
        <Indicador
          etiqueta="Actividades trabajadas"
          valor={cargando ? null : String(actividades.length)}
          subtexto="Nodos con sesiones cerradas"
        />
      </div>

      {/* Pestañas segmentadas limpias */}
      <div
        role="tablist"
        aria-label="Vista del reporte"
        className="mb-4 inline-flex rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-1"
      >
        {VISTAS.map((v) => (
          <button
            key={v.clave}
            type="button"
            role="tab"
            aria-selected={vista === v.clave}
            onClick={() => setVista(v.clave)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              vista === v.clave
                ? 'bg-[var(--color-primario)] text-white shadow-sm'
                : 'text-[var(--tf-texto-tenue)] hover:text-[var(--tf-texto)]'
            }`}
          >
            {v.texto}
          </button>
        ))}
      </div>

      {vista === 'registro' && (
      <section className="tf-card-pro tf-enter mb-4 rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="tf-display font-bold text-[var(--tf-texto)]">
            {orgActual ? `Horas por trabajador — ${orgActual.nombre}` : 'Horas por trabajador'}
          </h2>
          {esSuperAdmin && orgActual && (
            <span className="rounded-md border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-400">
              Inquilino: {orgActual.nombre}
            </span>
          )}
        </div>

        {cargando ? (
          <Esqueleto filas={3} />
        ) : trabajadores.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--tf-texto-suave)]">
            Sin registros en el periodo seleccionado {orgActual ? `para ${orgActual.nombre}` : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--tf-borde)] text-left text-xs uppercase tracking-wide text-[var(--tf-texto-suave)]">
                  <th className="pb-2.5 font-medium">Trabajador</th>
                  {esSuperAdmin && !orgSeleccionada && (
                    <th className="pb-2.5 font-medium">Organización</th>
                  )}
                  <th className="pb-2.5 text-right font-medium">Horas</th>
                  <th className="pb-2.5 pl-4 font-medium">Participación</th>
                  <th className="pb-2.5 text-right font-medium" title="Días con horas cronometradas">Días</th>
                  <th className="pb-2.5 text-right font-medium" title="Veces que marcó el inicio del día en la app">
                    Marcaje
                  </th>
                  <th className="pb-2.5 text-right font-medium" title="Proyectos distintos en que trabajó">Nodos</th>
                  <th className="pb-2.5 text-right font-medium" title="Tareas distintas en que trabajó">Tareas</th>
                  <th className="pb-2.5 text-right font-medium">Promedio diario</th>
                </tr>
              </thead>
              <tbody>
                {trabajadores.map((t) => {
                  const promedioSeg = Math.round(t.segundos / Math.max(1, t.dias));
                  const promedioAnomalo = promedioSeg > 12 * 3600;
                  const pct = totalSeg > 0 ? Math.round((t.segundos / totalSeg) * 100) : 0;
                  return (
                    <tr key={t.id} className="border-b border-[var(--tf-borde)] last:border-0 transition hover:bg-[var(--tf-hover)]">
                      <td className="py-3 font-medium text-[var(--tf-texto)]">{t.trabajador}</td>
                      {esSuperAdmin && !orgSeleccionada && (
                        <td className="py-3 text-xs font-semibold text-sky-400">
                          {t.organizacionNombre || 'Sin asignar'}
                        </td>
                      )}
                      <td className="py-3 text-right font-mono font-semibold text-[var(--tf-texto)]">
                        {duracion(t.segundos)}
                      </td>
                      <td className="w-36 py-3 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--tf-borde)]">
                            <div
                              className="tf-bar-grow h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: 'var(--color-primario, #38bdf8)' }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-[11px] text-[var(--tf-texto-tenue)]">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-[var(--tf-texto-tenue)]">{t.dias}</td>
                      <td className="py-3 text-right font-mono text-[var(--tf-texto-tenue)]">{t.marcajes}</td>
                      <td className="py-3 text-right font-mono text-[var(--tf-texto-tenue)]">{t.nodos}</td>
                      <td className="py-3 text-right font-mono text-[var(--tf-texto-tenue)]">{t.actividades}</td>
                      <td className="py-3 text-right font-mono text-[var(--tf-texto-tenue)]">
                        <span>{duracion(promedioSeg)}</span>
                        {promedioAnomalo && (
                          <span
                            title="Promedio diario inusualmente alto (posible sesión sin cerrar)"
                            className="ml-2 inline-block rounded bg-amber-400/20 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-amber-400"
                          >
                            ▲ Revisar
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {vista === 'actividades' && (
      <section className="tf-card-pro tf-enter rounded-2xl p-5">
        <h2 className="tf-display mb-4 font-bold text-[var(--tf-texto)]">
          {orgActual ? `Horas por actividad — ${orgActual.nombre}` : 'Horas por actividad'}
        </h2>
        {cargando ? (
          <Esqueleto filas={5} />
        ) : grafico.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--tf-texto-suave)]">
            Sin registros en el periodo seleccionado {orgActual ? `para ${orgActual.nombre}` : ''}.
          </p>
        ) : (
          <GraficoBarras datos={grafico} unidad="h" />
        )}
      </section>
      )}

      {vista === 'gantt' && (
      <section className="tf-card-pro tf-enter rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="tf-display font-bold text-[var(--tf-texto)]">
            {orgActual ? `Carta Gantt por día — ${orgActual.nombre}` : 'Carta Gantt por día'}
          </h2>
          <span className="text-xs text-[var(--tf-texto-tenue)]">
            Haz clic en una tarea para ver fechas, responsable y enlace directo al mapa.
          </span>
        </div>
        {cargando ? (
          <Esqueleto filas={5} />
        ) : (
          <CartaGantt tareas={gantt} desdeIso={desdeIso} hastaIso={hastaIso} />
        )}
      </section>
      )}
    </Marco>
  );
}

function Indicador({
  etiqueta,
  valor,
  subtexto,
  conSparkline = false,
}: {
  etiqueta: string;
  valor: string | null;
  subtexto?: string;
  conSparkline?: boolean;
}) {
  return (
    <div className="tf-card-pro flex items-start justify-between gap-3 rounded-2xl p-5">
      <div>
        <p className="text-xs font-medium text-[var(--tf-texto-tenue)]">{etiqueta}</p>
        {valor === null ? (
          <div className="mt-2 h-7 w-24 animate-pulse rounded-md bg-[var(--tf-hover)]" />
        ) : (
          <p className="tf-display mt-1.5 text-2xl font-bold text-[var(--tf-texto)] sm:text-3xl">
            {valor}
          </p>
        )}
        {subtexto && <p className="mt-1.5 text-[11px] text-[var(--tf-texto-suave)]">{subtexto}</p>}
      </div>
      {conSparkline && (
        <svg width="64" height="32" viewBox="0 0 64 32" fill="none" aria-hidden className="mt-1 shrink-0">
          <path
            d="M2 25 C15 23, 20 11, 30 15 C40 19, 46 7, 62 4"
            stroke="var(--color-primario, #38bdf8)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}

/** Placeholder con la forma del contenido: la pantalla no salta al llegar los datos. */
function Esqueleto({ filas }: { filas: number }) {
  return (
    <div className="flex flex-col gap-3 py-1">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-3.5 w-40 animate-pulse rounded bg-white/10" />
          <div
            className="h-3.5 animate-pulse rounded bg-white/5"
            style={{ width: `${70 - i * 11}%` }}
          />
        </div>
      ))}
    </div>
  );
}
