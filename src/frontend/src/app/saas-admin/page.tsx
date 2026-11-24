'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Marco from '@/components/Marco';
import Selector from '@/components/ui/Selector';
import Modal from '@/components/ui/Modal';
import ModalConfirmacion from '@/components/ui/ModalConfirmacion';
import { EsqueletoTabla } from '@/components/ui/Esqueleto';
import { useToast } from '@/components/ui/Toast';
import {
  api,
  ErrorApi,
  OrganizacionItem,
  MetricasSaaS,
  PlanSaaS,
  CrearOrganizacionPayload,
  ActualizarOrganizacionPayload,
} from '@/lib/api';
import { etiquetaPlan } from '@/lib/formato';
import { PERMISOS } from '@/lib/rbac';
import { useTienePermiso } from '@/lib/sesion';
import { AYUDA_CONTRASENA, CONTRASENA_MAXIMO } from '@/lib/contrasena';

export default function SaasAdminPage() {
  return (
    <Marco
      activo="/saas-admin"
      titulo="Consola Super Admin"
      subtitulo="Plataforma SaaS · Gestión de Empresas y Suscripciones"
    >
      <ContenidoSaasAdmin />
    </Marco>
  );
}

function ContenidoSaasAdmin() {
  const puedeVer = useTienePermiso(PERMISOS.ORGANIZACIONES_VER);
  const puedeGestionar = useTienePermiso(PERMISOS.ORGANIZACIONES_GESTIONAR);

  const [metricas, setMetricas] = useState<MetricasSaaS | null>(null);
  const [organizaciones, setOrganizaciones] = useState<OrganizacionItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos');

  // Modales
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState<OrganizacionItem | null>(null);
  const [orgPorAlternar, setOrgPorAlternar] = useState<OrganizacionItem | null>(null);
  const [alternandoOrg, setAlternandoOrg] = useState(false);
  const { toast } = useToast();

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (busqueda.trim()) q.set('buscar', busqueda.trim());
      if (filtroActivo === 'activos') q.set('activo', 'true');
      if (filtroActivo === 'inactivos') q.set('activo', 'false');

      const rutaListar = `/organizaciones${q.toString() ? `?${q.toString()}` : ''}`;
      const [met, orgs] = await Promise.all([
        api.get<MetricasSaaS>('/organizaciones/metricas'),
        api.get<OrganizacionItem[]>(rutaListar),
      ]);
      setMetricas(met);
      setOrganizaciones(orgs);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Error al cargar datos del SaaS.');
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroActivo]);

  useEffect(() => {
    if (!puedeVer) {
      setCargando(false);
      return;
    }
    cargarDatos();
  }, [puedeVer, filtroActivo, cargarDatos]);

  if (!puedeVer) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-[var(--tf-superficie)] p-8 text-center shadow-sm backdrop-blur">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-lg font-bold text-[var(--tf-acento-rojo)]">
          ✕
        </div>
        <h2 className="text-lg font-bold text-[var(--tf-texto)]">Acceso Restringido</h2>
        <p className="mt-1 text-sm text-[var(--tf-texto-tenue)]">
          Esta consola es exclusiva para la administración global de la plataforma SaaS.
        </p>
        <Link
          href="/panel"
          className="mt-5 inline-block rounded-xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-hover)] px-5 py-2.5 text-sm font-semibold text-[var(--tf-texto)] transition hover:bg-[var(--tf-borde)]"
        >
          Volver a Proyectos
        </Link>
      </div>
    );
  }

  function manejarBuscar(e: React.FormEvent) {
    e.preventDefault();
    cargarDatos();
  }

  async function confirmarAlternarEstado() {
    if (!orgPorAlternar) return;
    const org = orgPorAlternar;
    const nuevoEstado = !org.activo;
    setAlternandoOrg(true);
    try {
      await api.patch(`/organizaciones/${org.id}`, { activo: nuevoEstado });
      setOrgPorAlternar(null);
      toast({
        tipo: 'exito',
        titulo: nuevoEstado ? 'Organización reactivada' : 'Organización suspendida',
        descripcion: `«${org.nombre}» fue ${nuevoEstado ? 'reactivada' : 'suspendida'}.`,
        duracionMs: 7000,
        accion: {
          etiqueta: 'Deshacer',
          alHacer: async () => {
            await api.patch(`/organizaciones/${org.id}`, { activo: org.activo });
            cargarDatos();
          },
        },
      });
      cargarDatos();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar el estado.');
      setOrgPorAlternar(null);
    } finally {
      setAlternandoOrg(false);
    }
  }

  return (
    <>
      {puedeGestionar && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => {
              setError(null);
              setMensajeExito(null);
              setModalCrear(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Organización
          </button>
        </div>
      )}
      <div className="space-y-6">
        {mensajeExito && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            <span>{mensajeExito}</span>
            <button onClick={() => setMensajeExito(null)} className="text-emerald-400 hover:text-emerald-200">
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              ✕
            </button>
          </div>
        )}

        {/* Tarjetas Métricas */}
        {metricas && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Organizaciones</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{metricas.totalOrganizaciones}</span>
                <span className="text-xs text-emerald-400 font-medium">({metricas.activas} activas)</span>
              </div>
              <div className="mt-3 flex gap-2">
                <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  {metricas.activas} Activas
                </span>
                <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400">
                  {metricas.inactivas} Suspendidas
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Usuarios en la Plataforma</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-sky-400">{metricas.totalUsuarios}</span>
                <span className="text-xs text-slate-400">miembros globales</span>
              </div>
              <p className="mt-3 text-xs text-slate-400">Excluye cuentas Super Admin</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Proyectos Activos</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-400">{metricas.totalProyectos}</span>
                <span className="text-xs text-slate-400">en desarrollo</span>
              </div>
              <p className="mt-3 text-xs text-slate-400">Distribuidos entre clientes</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Distribución de Planes</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Empresa</span>
                  <span className="font-bold text-purple-400">{metricas.distribucionPlanes.EMPRESA || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Pro</span>
                  <span className="font-bold text-sky-400">{metricas.distribucionPlanes.PRO || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Gratis</span>
                  <span className="font-bold text-slate-300">{metricas.distribucionPlanes.GRATIS || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={manejarBuscar} className="relative flex-1">
            <input
              id="buscar-organizacion"
              name="buscarOrganizacion"
              type="text"
              placeholder="Buscar por nombre, slug o RUT..."
              aria-label="Buscar por nombre, slug o RUT"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </form>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Estado:</span>
            <div className="flex rounded-xl border border-white/10 bg-slate-950/60 p-1">
              {(['todos', 'activos', 'inactivos'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroActivo(f)}
                  className={`rounded-lg px-3 py-1 text-xs capitalize transition ${
                    filtroActivo === f
                      ? 'bg-sky-500/20 font-semibold text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={cargarDatos}
              title="Recargar datos"
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Tabla de Organizaciones */}
        <div className="tf-card-pro overflow-hidden rounded-2xl">
          {cargando ? (
            <EsqueletoTabla filas={5} columnas={6} />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--tf-borde)] bg-[var(--tf-hover)] uppercase tracking-wider text-[var(--tf-texto-suave)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Organización / Empresa</th>
                  <th className="px-5 py-3 font-semibold">Plan SaaS</th>
                  <th className="px-5 py-3 font-semibold">Usuarios (Uso / Límite)</th>
                  <th className="px-5 py-3 font-semibold">Proyectos (Uso / Límite)</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--tf-borde)] text-[var(--tf-texto-tenue)]">
                {organizaciones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--tf-texto-suave)]">
                      No se encontraron organizaciones registradas.
                    </td>
                  </tr>
                ) : (
                  organizaciones.map((org) => {
                    const pctUsuarios = Math.min(100, Math.round((org.totalUsuarios / org.maxUsuarios) * 100));
                    const pctProyectos = Math.min(100, Math.round((org.totalProyectos / org.maxProyectos) * 100));

                    return (
                      <tr key={org.id} className="transition hover:bg-[var(--tf-hover)]">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[var(--tf-texto)]">{org.nombre}</div>
                          <div className="flex items-center gap-2 text-[11px] text-[var(--tf-texto-tenue)]">
                            <span>identificador: <strong className="text-[var(--tf-texto)]">{org.slug}</strong></span>
                            {org.rut && <span>· RUT: {org.rut}</span>}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                              org.plan === 'EMPRESA'
                                ? 'border-purple-500/30 bg-purple-500/15 text-[var(--tf-acento-violeta)]'
                                : org.plan === 'PRO'
                                ? 'border-sky-500/30 bg-sky-500/15 text-[var(--tf-acento-azul)]'
                                : 'border-[var(--tf-borde)] bg-[var(--tf-hover)] text-[var(--tf-texto-tenue)]'
                            }`}
                          >
                            {etiquetaPlan(org.plan)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                            <span>{org.totalUsuarios} / {org.maxUsuarios}</span>
                            <span className="text-[10px] text-slate-400">{pctUsuarios}%</span>
                          </div>
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full rounded-full ${
                                pctUsuarios >= 90 ? 'bg-rose-500' : pctUsuarios >= 70 ? 'bg-amber-500' : 'bg-sky-500'
                              }`}
                              style={{ width: `${pctUsuarios}%` }}
                            />
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                            <span>{org.totalProyectos} / {org.maxProyectos}</span>
                            <span className="text-[10px] text-slate-400">{pctProyectos}%</span>
                          </div>
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full rounded-full ${
                                pctProyectos >= 90 ? 'bg-rose-500' : pctProyectos >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${pctProyectos}%` }}
                            />
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              org.activo
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${org.activo ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {org.activo ? 'Activa' : 'Suspendida'}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/reportes?organizacionId=${org.id}`}
                              className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-medium text-sky-300 transition hover:bg-sky-500/20"
                              title={`Ver métricas y reportes de ${org.nombre}`}
                            >
                              📊 Reportes
                            </Link>
                            <button
                              onClick={() => {
                                setError(null);
                                setMensajeExito(null);
                                setModalEditar(org);
                              }}
                              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                            >
                              Editar Plan
                            </button>
                            <button
                              onClick={() => setOrgPorAlternar(org)}
                              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                                org.activo
                                  ? 'border-rose-500/30 bg-rose-500/10 text-[var(--tf-acento-rojo)] hover:bg-rose-500/20'
                                  : 'border-emerald-500/30 bg-emerald-500/10 text-[var(--tf-acento-verde)] hover:bg-emerald-500/20'
                              }`}
                            >
                              {org.activo ? 'Suspender' : 'Reactivar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {/* Modal Crear Organización */}
      {modalCrear && (
        <ModalCrearOrganizacion
          alCerrar={() => setModalCrear(false)}
          alGuardar={() => {
            setModalCrear(false);
            setMensajeExito('Organización creada exitosamente.');
            cargarDatos();
          }}
        />
      )}

      {/* Modal Editar Organización */}
      {modalEditar && (
        <ModalEditarOrganizacion
          org={modalEditar}
          alCerrar={() => setModalEditar(null)}
          alGuardar={() => {
            setModalEditar(null);
            setMensajeExito('Organización actualizada con éxito.');
            cargarDatos();
          }}
        />
      )}

      <ModalConfirmacion
        abierto={orgPorAlternar !== null}
        variante={orgPorAlternar?.activo ? 'peligro' : 'advertencia'}
        titulo={orgPorAlternar?.activo ? 'Suspender organización' : 'Reactivar organización'}
        descripcion={
          orgPorAlternar?.activo
            ? `¿Seguro que deseas suspender «${orgPorAlternar.nombre}»? Sus usuarios no podrán iniciar sesión mientras esté suspendida.`
            : orgPorAlternar
              ? `¿Deseas reactivar la organización «${orgPorAlternar.nombre}»?`
              : ''
        }
        etiquetaConfirmar={orgPorAlternar?.activo ? 'Sí, suspender' : 'Sí, reactivar'}
        ocupado={alternandoOrg}
        onConfirmar={confirmarAlternarEstado}
        onCancelar={() => setOrgPorAlternar(null)}
      />
    </>
  );
}

function ModalCrearOrganizacion({
  alCerrar,
  alGuardar,
}: {
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [rut, setRut] = useState('');
  const [plan, setPlan] = useState<PlanSaaS>('PRO');
  const [maxUsuarios, setMaxUsuarios] = useState(25);
  const [maxProyectos, setMaxProyectos] = useState(10);

  // Admin inicial
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  // Sin clave por defecto: una clave fija y conocida para cada empresa nueva
  // dejaria cuentas de administrador que cualquiera puede adivinar.
  const [adminPassword, setAdminPassword] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  function autoSlug(val: string) {
    setNombre(val);
    const autogenerado = val
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(autogenerado);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);

    try {
      const payload: CrearOrganizacionPayload = {
        nombre: nombre.trim(),
        slug: slug.trim(),
        rut: rut.trim() || undefined,
        plan,
        maxUsuarios: Number(maxUsuarios),
        maxProyectos: Number(maxProyectos),
        adminEmail: adminEmail.trim() || undefined,
        adminNombre: adminNombre.trim() || undefined,
        adminPassword: adminPassword || undefined,
      };

      await api.post('/organizaciones', payload);
      alGuardar();
    } catch (err) {
      setErrorModal(err instanceof ErrorApi ? err.message : 'Error al crear la organización.');
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Alta de Nueva Empresa / Cliente" ancho="md" bloqueado={guardando} onCerrar={alCerrar}>
      {errorModal && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-[var(--tf-acento-rojo)]">
          {errorModal}
        </div>
      )}

      <form onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Nombre de la Empresa *</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => autoSlug(e.target.value)}
              placeholder="Ej. Minera Norte SpA"
              className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Identificador único *</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
              placeholder="ej. minera-norte"
              className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 font-mono text-xs text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">RUT (opcional)</label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="76.123.456-7"
              className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Plan Asignado</label>
            <Selector
              ariaLabel="Plan Asignado"
              valor={plan}
              onChange={(v) => setPlan(v as PlanSaaS)}
              className="mt-1"
              opciones={[
                { valor: 'GRATIS', etiqueta: 'Básico', badge: 'Inicial' },
                { valor: 'PRO', etiqueta: 'Pro', badge: 'Popular' },
                { valor: 'EMPRESA', etiqueta: 'Empresa', badge: 'Ilimitado' },
              ]}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Máx Usuarios</label>
            <input
              type="number"
              min={1}
              required
              value={maxUsuarios}
              onChange={(e) => setMaxUsuarios(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="border-t border-[var(--tf-borde)] pt-3">
          <h3 className="text-xs font-bold text-[var(--tf-acento-azul)]">Administrador Inicial (Opcional)</h3>
          <p className="text-[11px] text-[var(--tf-texto-tenue)]">Crea el primer usuario de gestión para este cliente.</p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Nombre Administrador</label>
              <input
                type="text"
                value={adminNombre}
                onChange={(e) => setAdminNombre(e.target.value)}
                placeholder="Carlos Mendoza"
                className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Correo Electrónico</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@empresa.cl"
                className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Contraseña Provisoria</label>
              <input
                type="text"
                autoComplete="new-password"
                maxLength={CONTRASENA_MAXIMO}
                placeholder={AYUDA_CONTRASENA}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 font-mono text-xs text-[var(--tf-texto)] focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--tf-borde)] pt-4">
          <button
            type="button"
            onClick={alCerrar}
            disabled={guardando}
            className="rounded-xl border border-[var(--tf-borde)] px-4 py-2 text-xs font-medium text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-xl bg-sky-500 px-5 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
          >
            {guardando ? 'Creando empresa...' : 'Dar de Alta Organización'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalEditarOrganizacion({
  org,
  alCerrar,
  alGuardar,
}: {
  org: OrganizacionItem;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [nombre, setNombre] = useState(org.nombre);
  const [rut, setRut] = useState(org.rut || '');
  const [plan, setPlan] = useState<PlanSaaS>(org.plan);
  const [maxUsuarios, setMaxUsuarios] = useState(org.maxUsuarios);
  const [maxProyectos, setMaxProyectos] = useState(org.maxProyectos);
  const [activo, setActivo] = useState(org.activo);

  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);

    try {
      const payload: ActualizarOrganizacionPayload = {
        nombre: nombre.trim(),
        rut: rut.trim() || undefined,
        plan,
        maxUsuarios: Number(maxUsuarios),
        maxProyectos: Number(maxProyectos),
        activo,
      };

      await api.patch(`/organizaciones/${org.id}`, payload);
      alGuardar();
    } catch (err) {
      setErrorModal(err instanceof ErrorApi ? err.message : 'Error al actualizar la organización.');
      setGuardando(false);
    }
  }

  return (
    <Modal
      ancho="md"
      bloqueado={guardando}
      onCerrar={alCerrar}
      titulo={
        <div>
          <span className="block text-base font-bold text-[var(--tf-texto)]">Editar Plan y Límites</span>
          <span className="block font-mono text-xs font-normal text-[var(--tf-texto-tenue)]">{org.slug}</span>
        </div>
      }
    >
      {errorModal && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-[var(--tf-acento-rojo)]">
          {errorModal}
        </div>
      )}

      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Nombre de la Empresa</label>
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Plan SaaS</label>
            <Selector
              ariaLabel="Plan SaaS"
              valor={plan}
              onChange={(v) => setPlan(v as PlanSaaS)}
              className="mt-1"
              opciones={[
                { valor: 'GRATIS', etiqueta: 'Básico', badge: 'Inicial' },
                { valor: 'PRO', etiqueta: 'Pro', badge: 'Popular' },
                { valor: 'EMPRESA', etiqueta: 'Empresa', badge: 'Ilimitado' },
              ]}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">RUT</label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Límite Usuarios</label>
            <input
              type="number"
              min={1}
              required
              value={maxUsuarios}
              onChange={(e) => setMaxUsuarios(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--tf-texto-tenue)]">Límite Proyectos</label>
            <input
              type="number"
              min={1}
              required
              value={maxProyectos}
              onChange={(e) => setMaxProyectos(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="h-4 w-4 rounded text-sky-500 focus:ring-sky-500"
            />
            <span className="text-xs text-[var(--tf-texto)]">Organización activa (permite inicio de sesión a sus usuarios)</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--tf-borde)] pt-4">
          <button
            type="button"
            onClick={alCerrar}
            disabled={guardando}
            className="rounded-xl border border-[var(--tf-borde)] px-4 py-2 text-xs font-medium text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-xl bg-sky-500 px-5 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
