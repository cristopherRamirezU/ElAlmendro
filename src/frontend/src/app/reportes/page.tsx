'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Marco from '@/components/Marco';
import GraficoBarras from '@/components/reportes/GraficoBarras';
import { api, ErrorApi, URL_API, OrganizacionItem, Usuario } from '@/lib/api';
import { useTienePermiso } from '@/lib/sesion';
import { PERMISOS } from '@/lib/rbac';
import { useDatosCache } from '@/lib/cacheDatos';
import { HorasActividad, HorasTrabajador } from '@/lib/tipos';
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
  const [organizaciones, setOrganizaciones] = useState<OrganizacionItem[]>([]);
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
  const rango = useMemo(() => {
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    let q = `desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`;
    // El filtro de organizacion viaja tambien en la descarga: el archivo
    // exportado debe cubrir exactamente lo que se ve en pantalla.
    if (esSuperAdmin && orgSeleccionada) {
      q += `&organizacionId=${encodeURIComponent(orgSeleccionada)}`;
    }
    return q;
  }, [dias, esSuperAdmin, orgSeleccionada]);

  const puedeExportar = useTienePermiso(PERMISOS.REPORTES_VER_EQUIPO);

  const cargar = useCallback(async () => {
    const q = rango;

    const [trabajadores, actividades] = await Promise.all([
      api.get<HorasTrabajador[]>(`/reportes/horas?${q}`),
      api.get<HorasActividad[]>(`/reportes/actividades?${q}`),
    ]);
    return { trabajadores, actividades };
  }, [rango]);

  // Clave de cache reactiva al periodo y al inquilino seleccionado
  const claveCache = `reportes:${dias}:${esSuperAdmin ? orgSeleccionada || 'global' : 'org'}`;
  const { datos, cargando, error } = useDatosCache(claveCache, cargar);
  const trabajadores = datos?.trabajadores ?? [];
  const actividades = datos?.actividades ?? [];

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
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-400"
          >
            {RANGOS.map((r) => (
              <option key={r.dias} value={r.dias}>
                {r.texto}
              </option>
            ))}
          </select>

          {/*
            Se ocultan sin el permiso porque la descarga es un <a> normal: un
            403 se veria como JSON crudo en una pestana nueva, sin aviso. El
            control real lo hace el guard del backend, esto solo evita
            ofrecer un boton que va a fallar.
          */}
          {puedeExportar && (
            <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-slate-900 px-2 py-1">
              <span className="px-1 text-xs text-slate-400">Exportar</span>
              {FORMATOS.map((f) => (
                <a
                  key={f.clave}
                  // Navegacion GET de primer nivel: la cookie de sesion viaja
                  // sola (SameSite=Lax), igual que la descarga de evidencias.
                  href={`${URL_API}/reportes/periodo/exportar?${rango}&formato=${f.clave}`}
                  download
                  title={f.titulo}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-sky-300"
                >
                  {f.texto}
                </a>
              ))}
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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Indicador etiqueta="Horas del periodo" valor={cargando ? null : duracion(totalSeg)} />
        <Indicador
          etiqueta="Trabajadores con registro"
          valor={cargando ? null : String(trabajadores.length)}
        />
        <Indicador
          etiqueta="Actividades trabajadas"
          valor={cargando ? null : String(actividades.length)}
        />
      </div>

      <section className="mb-4 rounded-2xl border border-white/10 bg-slate-900 p-5 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-white">
            {orgActual ? `Horas por trabajador — ${orgActual.nombre}` : 'Horas por trabajador'}
          </h2>
          {esSuperAdmin && orgActual && (
            <span className="rounded-md bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-300 border border-sky-500/30">
              Inquilino: {orgActual.nombre}
            </span>
          )}
        </div>

        {cargando ? (
          <Esqueleto filas={3} />
        ) : trabajadores.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Sin registros en el periodo seleccionado {orgActual ? `para ${orgActual.nombre}` : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-medium">Trabajador</th>
                  {esSuperAdmin && !orgSeleccionada && (
                    <th className="pb-2 font-medium">Organización</th>
                  )}
                  <th className="pb-2 text-right font-medium">Horas</th>
                  <th className="pb-2 text-right font-medium">Días</th>
                  <th className="pb-2 text-right font-medium">Sesiones</th>
                  <th className="pb-2 text-right font-medium">Actividades</th>
                  <th className="pb-2 text-right font-medium">Promedio diario</th>
                </tr>
              </thead>
              <tbody>
                {trabajadores.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-2.5 font-medium text-white">{t.trabajador}</td>
                    {esSuperAdmin && !orgSeleccionada && (
                      <td className="py-2.5 text-xs font-semibold text-sky-300">
                        {t.organizacionNombre || 'Sin asignar'}
                      </td>
                    )}
                    <td className="py-2.5 text-right font-mono text-slate-200">{duracion(t.segundos)}</td>
                    <td className="py-2.5 text-right text-slate-400">{t.dias}</td>
                    <td className="py-2.5 text-right text-slate-400">{t.sesiones}</td>
                    <td className="py-2.5 text-right text-slate-400">{t.actividades}</td>
                    <td className="py-2.5 text-right font-mono text-slate-400">
                      {duracion(Math.round(t.segundos / Math.max(1, t.dias)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 backdrop-blur">
        <h2 className="mb-4 font-bold text-white">
          {orgActual ? `Horas por actividad — ${orgActual.nombre}` : 'Horas por actividad'}
        </h2>
        {cargando ? (
          <Esqueleto filas={5} />
        ) : grafico.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Sin registros en el periodo seleccionado {orgActual ? `para ${orgActual.nombre}` : ''}.
          </p>
        ) : (
          <GraficoBarras datos={grafico} unidad="h" />
        )}
      </section>
    </Marco>
  );
}

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 backdrop-blur">
      <p className="text-xs text-slate-400">{etiqueta}</p>
      {valor === null ? (
        <div className="mt-2 h-6 w-20 animate-pulse rounded-md bg-white/10" />
      ) : (
        <p className="mt-1 text-xl font-bold text-white">{valor}</p>
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
