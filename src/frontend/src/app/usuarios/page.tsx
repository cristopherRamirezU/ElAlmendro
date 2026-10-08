'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISOS, Rol, ROLES_CATALOGO } from '@/lib/rbac';
import Marco from '@/components/Marco';
import { api, ErrorApi, RolCatalogoItem, UsuarioItem } from '@/lib/api';
import { iniciales } from '@/lib/formato';
import { useSesion } from '@/lib/sesion';
import { useColorPrimario } from '@/lib/color';

export default function UsuariosPage() {
  return (
    <Marco
      activo="/usuarios"
      titulo="Administración de Usuarios y Roles"
      subtitulo="Gestión del equipo de trabajo y control de permisos (RBAC)"
    >
      <ContenidoUsuarios />
    </Marco>
  );
}

function ContenidoUsuarios() {
  const router = useRouter();
  const sesionActual = useSesion();
  const colorPrimario = useColorPrimario();

  // Al estar dentro de Marco, sesionActual ya viene resuelto desde ContextoSesion.Provider
  const esAdmin = sesionActual?.rol === 'ADMINISTRADOR' || sesionActual?.rol === 'SUPER_ADMIN';
  const puedeVer =
    esAdmin || (sesionActual?.permisos?.includes(PERMISOS.USUARIOS_VER) ?? false);
  const puedeGestionar =
    esAdmin ||
    (sesionActual?.permisos?.includes(PERMISOS.USUARIOS_GESTIONAR) ?? false);

  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [rolesCatalogo, setRolesCatalogo] = useState<RolCatalogoItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');

  // Modales
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioItem | null>(null);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [lista, roles] = await Promise.all([
        api.get<UsuarioItem[]>('/usuarios'),
        api.get<RolCatalogoItem[]>('/usuarios/roles'),
      ]);
      setUsuarios(lista);
      setRolesCatalogo(roles.length ? roles : (ROLES_CATALOGO as any));
    } catch (err) {
      if (err instanceof ErrorApi && err.estado === 401) {
        router.replace('/login');
        return;
      }
      setMensaje({
        tipo: 'error',
        texto: err instanceof ErrorApi ? err.message : 'Error al conectar con la API de usuarios.',
      });
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    if (puedeVer) {
      cargarDatos();
    }
  }, [puedeVer, cargarDatos]);

  // Si el usuario no tiene permisos para ver este módulo
  if (!puedeVer) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-slate-900 p-8 text-center shadow-sm backdrop-blur">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-400 font-bold text-lg">
          ✕
        </div>
        <h2 className="text-lg font-bold text-white">Acceso Restringido</h2>
        <p className="mt-1 text-sm text-slate-400">
          No posees los permisos necesarios para administrar usuarios ni roles del sistema.
        </p>
        <button
          onClick={() => router.push('/panel')}
          className="mt-5 rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-600"
        >
          Volver a mis actividades
        </button>
      </div>
    );
  }

  // Filtrado reactivo en cliente
  const usuariosFiltrados = usuarios.filter((u) => {
    const coincideBusqueda =
      !busqueda.trim() ||
      u.nombreCompleto.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.email.toLowerCase().includes(busqueda.toLowerCase());

    const coincideRol = filtroRol === 'TODOS' || u.rol === filtroRol;

    const coincideEstado =
      filtroEstado === 'TODOS' ||
      (filtroEstado === 'ACTIVOS' && u.activo) ||
      (filtroEstado === 'INACTIVOS' && !u.activo);

    return coincideBusqueda && coincideRol && coincideEstado;
  });

  // Métricas de resumen
  const metricas = {
    total: usuarios.length,
    admins: usuarios.filter((u) => u.rol === 'ADMINISTRADOR').length,
    supervisores: usuarios.filter((u) => u.rol === 'SUPERVISOR').length,
    trabajadores: usuarios.filter((u) => u.rol === 'TRABAJADOR').length,
    activos: usuarios.filter((u) => u.activo).length,
  };

  async function handleToggleActivo(u: UsuarioItem) {
    if (!puedeGestionar) return;
    const accionTexto = u.activo ? 'desactivar' : 'reactivar';
    const confirmacion = window.confirm(
      `¿Estás seguro de que deseas ${accionTexto} a ${u.nombreCompleto}?`,
    );
    if (!confirmacion) return;

    try {
      await api.patch(`/usuarios/${u.id}`, { activo: !u.activo });
      setMensaje({
        tipo: 'exito',
        texto: `Usuario ${u.nombreCompleto} ${!u.activo ? 'reactivado' : 'desactivado'} exitosamente.`,
      });
      await cargarDatos();
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err instanceof ErrorApi ? err.message : 'No se pudo actualizar el estado del usuario.',
      });
    }
  }

  async function handleEliminar(u: UsuarioItem) {
    if (!esAdmin) return;
    const confirmacion = window.confirm(
      `¿Estás seguro de que deseas eliminar al usuario "${u.nombreCompleto}"?\n\nSi posee historial de registros o sesiones, sus accesos serán revocados de forma segura; si no posee registros previos, será eliminado permanentemente.`,
    );
    if (!confirmacion) return;

    try {
      const res = await api.delete<{ ok: boolean; mensaje?: string }>(`/usuarios/${u.id}`);
      setMensaje({
        tipo: 'exito',
        texto: res?.mensaje || `Usuario ${u.nombreCompleto} procesado exitosamente.`,
      });
      await cargarDatos();
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err instanceof ErrorApi ? err.message : 'No se pudo eliminar al usuario.',
      });
    }
  }

  return (
    <>
      {mensaje && (
        <div
          role="alert"
          className={`mb-5 flex items-center justify-between rounded-xl border p-4 text-sm ${
            mensaje.tipo === 'exito'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          <span>{mensaje.texto}</span>
          <button
            onClick={() => setMensaje(null)}
            className="text-xs font-bold uppercase opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {sesionActual?.rol === 'SUPERVISOR' && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-200">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-sky-500/20 text-sky-200 font-bold">
            i
          </div>
          <div>
            <span className="font-semibold">Modo Supervisor:</span> Tienes autorización para supervisar las operaciones del área y gestionar a los trabajadores a tu cargo. Las cuentas de administradores y la configuración crítica del sistema están protegidas.
          </div>
        </div>
      )}

      {/* -------------------- Tarjetas de métricas -------------------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <TarjetaMetrica
          etiqueta="Total Equipo"
          valor={metricas.total}
          subtexto={`${metricas.activos} activos`}
        />
        <TarjetaMetrica
          etiqueta="Administradores"
          valor={metricas.admins}
          subtexto="Acceso global"
          color="indigo"
        />
        <TarjetaMetrica
          etiqueta="Supervisores"
          valor={metricas.supervisores}
          subtexto="Monitoreo"
          color="sky"
        />
        <TarjetaMetrica
          etiqueta="Trabajadores"
          valor={metricas.trabajadores}
          subtexto="Cronometraje"
          color="emerald"
        />
        <TarjetaMetrica
          etiqueta="Inactivos"
          valor={metricas.total - metricas.activos}
          subtexto="Acceso restringido"
          color="slate"
        />
      </div>

      {/* -------------------- Barra de herramientas y filtros -------------------- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 backdrop-blur">
        <div className="flex min-w-[18rem] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus-within:border-sky-400 focus-within:bg-white/10">
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o correo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-slate-500"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="text-xs text-slate-400 hover:text-slate-200">
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
            aria-label="Filtrar por rol"
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-400"
          >
            <option value="TODOS">Todos los roles</option>
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="TRABAJADOR">Trabajador</option>
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            aria-label="Filtrar por estado"
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-400"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVOS">Solo Activos</option>
            <option value="INACTIVOS">Solo Inactivos</option>
          </select>

          {puedeGestionar && (
            <button
              onClick={() => setModalCrearAbierto(true)}
              style={{ backgroundColor: colorPrimario }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              <span className="text-base leading-none">+</span>
              <span>Nuevo Usuario</span>
            </button>
          )}
        </div>
      </div>

      {/* -------------------- Tabla de usuarios -------------------- */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 backdrop-blur">
        {cargando ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Cargando nómina de usuarios…
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No se encontraron usuarios con los criterios de búsqueda especificados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Usuario</th>
                  <th className="px-6 py-3.5">Rol y Permisos</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5">Zona Horaria</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usuariosFiltrados.map((u) => {
                  const esPropiaCuenta = sesionActual?.id === u.id;
                  return (
                    <tr key={u.id} className="transition hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-xs font-bold text-orange-300">
                            {iniciales(u.nombreCompleto)}
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              {u.nombreCompleto}
                              {esPropiaCuenta && (
                                <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                                  Tú
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <BadgeRol rol={u.rol} />
                        <p className="mt-1 text-[11px] text-slate-500">
                          {u.permisos?.length ?? 0} permiso(s) asignado(s)
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        {u.activo ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                            Inactivo
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {u.zonaHoraria || 'America/Santiago'}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {puedeGestionar && (
                          <div className="flex items-center justify-end gap-2">
                            {esAdmin || u.rol === 'TRABAJADOR' ? (
                              <>
                                <button
                                  onClick={() => setUsuarioEditando(u)}
                                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
                                >
                                  Editar
                                </button>

                                {!esPropiaCuenta && (
                                  <>
                                    <button
                                      onClick={() => handleToggleActivo(u)}
                                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                        u.activo
                                          ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                                          : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                      }`}
                                    >
                                      {u.activo ? 'Desactivar' : 'Activar'}
                                    </button>

                                    {esAdmin && (
                                      <button
                                        onClick={() => handleEliminar(u)}
                                        title="Eliminar usuario (Exclusivo Administrador)"
                                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20"
                                      >
                                        Eliminar
                                      </button>
                                    )}
                                  </>
                                )}
                              </>
                            ) : (
                              <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-500">
                                Protegido
                              </span>
                            )}
                          </div>
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

      {/* -------------------- Modal: Crear Usuario -------------------- */}
      {modalCrearAbierto && (
        <ModalCrearUsuario
          roles={rolesCatalogo}
          rolOperador={sesionActual?.rol}
          onCerrar={() => setModalCrearAbierto(false)}
          onGuardado={async () => {
            setModalCrearAbierto(false);
            setMensaje({ tipo: 'exito', texto: 'Usuario creado exitosamente.' });
            await cargarDatos();
          }}
        />
      )}

      {/* -------------------- Modal: Editar Usuario -------------------- */}
      {usuarioEditando && (
        <ModalEditarUsuario
          usuario={usuarioEditando}
          roles={rolesCatalogo}
          rolOperador={sesionActual?.rol}
          onCerrar={() => setUsuarioEditando(null)}
          onGuardado={async () => {
            setUsuarioEditando(null);
            setMensaje({ tipo: 'exito', texto: 'Usuario actualizado exitosamente.' });
            await cargarDatos();
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------- Componentes Auxiliares

function TarjetaMetrica({
  etiqueta,
  valor,
  subtexto,
  color = 'orange',
}: {
  etiqueta: string;
  valor: number;
  subtexto: string;
  color?: 'orange' | 'indigo' | 'sky' | 'emerald' | 'slate';
}) {
  const colores = {
    orange: 'border-orange-500/20 bg-orange-500/5 text-orange-300',
    indigo: 'border-indigo-500/20 bg-indigo-500/5 text-indigo-300',
    sky: 'border-sky-500/20 bg-sky-500/5 text-sky-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
    slate: 'border-white/10 bg-white/5 text-slate-300',
  };

  return (
    <div className={`rounded-2xl border p-4 ${colores[color]}`}>
      <p className="text-xs font-medium text-[var(--tf-texto-tenue)]">{etiqueta}</p>
      <p className="my-1 text-2xl font-bold tracking-tight text-[var(--tf-texto)]">{valor}</p>
      <p className="text-[11px] text-[var(--tf-texto-tenue)]">{subtexto}</p>
    </div>
  );
}

function BadgeRol({ rol }: { rol: Rol }) {
  switch (rol) {
    case 'ADMINISTRADOR':
      return (
        <span className="inline-flex items-center rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
          Administrador
        </span>
      );
    case 'SUPERVISOR':
      return (
        <span className="inline-flex items-center rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 border border-sky-500/30">
          Supervisor
        </span>
      );
    case 'TRABAJADOR':
    default:
      return (
        <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
          Trabajador
        </span>
      );
  }
}

// ------------------------------------------------------------- Modal: Crear Usuario

function ModalCrearUsuario({
  roles,
  rolOperador,
  onCerrar,
  onGuardado,
}: {
  roles: RolCatalogoItem[];
  rolOperador?: Rol;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const colorPrimario = useColorPrimario();
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [rol, setRol] = useState<Rol>('TRABAJADOR');
  const [zonaHoraria, setZonaHoraria] = useState('America/Santiago');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await api.post('/usuarios', {
        nombreCompleto,
        email,
        contrasena,
        rol,
        zonaHoraria,
      });
      await onGuardado();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setEnviando(false);
    }
  }

  const rolSeleccionado = roles.find((r) => r.codigo === rol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-lg font-bold text-white">Registrar Nuevo Trabajador</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Nombre Completo</label>
            <input
              type="text"
              required
              placeholder="Ej: Marcelo Morales"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Correo Electrónico</label>
            <input
              type="email"
              required
              placeholder="nombre@timeflow.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Contraseña Inicial</label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Rol en el Sistema (RBAC)</label>
            <select
              value={rol}
              disabled={rolOperador === 'SUPERVISOR'}
              onChange={(e) => setRol(e.target.value as Rol)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 disabled:bg-white/5 disabled:text-slate-500"
            >
              <option value="TRABAJADOR">Trabajador (Registro de tiempo y actividades)</option>
              {rolOperador !== 'SUPERVISOR' && (
                <>
                  <option value="SUPERVISOR">Supervisor (Monitoreo de equipo y reportes)</option>
                  <option value="ADMINISTRADOR">Administrador (Control total del sistema)</option>
                </>
              )}
            </select>
            {rolOperador === 'SUPERVISOR' && (
              <p className="mt-1 text-xs text-sky-400">
                Como supervisor, gestionas exclusivamente trabajadores a tu cargo.
              </p>
            )}
            {rolSeleccionado && (
              <p className="mt-1.5 rounded-lg bg-white/5 p-2 text-xs text-slate-400">
                {rolSeleccionado.descripcion}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Zona Horaria</label>
            <input
              type="text"
              value={zonaHoraria}
              onChange={(e) => setZonaHoraria(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 font-mono text-xs"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onCerrar}
              disabled={enviando}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              style={{ backgroundColor: colorPrimario }}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {enviando ? 'Guardando…' : 'Crear Trabajador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Modal: Editar Usuario

function ModalEditarUsuario({
  usuario,
  roles,
  rolOperador,
  onCerrar,
  onGuardado,
}: {
  usuario: UsuarioItem;
  roles: RolCatalogoItem[];
  rolOperador?: Rol;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const colorPrimario = useColorPrimario();
  const [nombreCompleto, setNombreCompleto] = useState(usuario.nombreCompleto);
  const [email, setEmail] = useState(usuario.email);
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [activo, setActivo] = useState(usuario.activo);
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [zonaHoraria, setZonaHoraria] = useState(usuario.zonaHoraria || 'America/Santiago');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const cuerpo: any = {
        nombreCompleto,
        email: email.trim(),
        rol,
        activo,
        zonaHoraria,
      };

      if (nuevaContrasena.trim().length >= 8) {
        cuerpo.contrasena = nuevaContrasena.trim();
      }

      await api.patch(`/usuarios/${usuario.id}`, cuerpo);
      await onGuardado();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo actualizar el usuario.');
    } finally {
      setEnviando(false);
    }
  }

  const rolSeleccionado = roles.find((r) => r.codigo === rol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">Editar Usuario</h2>
            <p className="text-xs text-slate-400">{usuario.email}</p>
          </div>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Nombre Completo</label>
            <input
              type="text"
              required
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Correo Electrónico (Ingreso)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Rol Asignado (RBAC)</label>
            <select
              value={rol}
              disabled={rolOperador === 'SUPERVISOR'}
              onChange={(e) => setRol(e.target.value as Rol)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 disabled:bg-white/5 disabled:text-slate-500"
            >
              <option value="TRABAJADOR">Trabajador</option>
              {rolOperador !== 'SUPERVISOR' && (
                <>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMINISTRADOR">Administrador</option>
                </>
              )}
            </select>
            {rolOperador === 'SUPERVISOR' && (
              <p className="mt-1 text-xs text-sky-400">
                La asignación o modificación de roles superiores está reservada a administradores.
              </p>
            )}
            {rolSeleccionado && (
              <p className="mt-1.5 rounded-lg bg-white/5 p-2 text-xs text-slate-400">
                {rolSeleccionado.descripcion}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <input
              type="checkbox"
              id="activo-check"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="h-4 w-4 rounded-sm text-sky-500 focus:ring-sky-400"
            />
            <label htmlFor="activo-check" className="text-sm font-medium text-slate-200">
              Usuario Activo (permite iniciar sesión en la plataforma)
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Nueva Contraseña <span className="font-normal text-slate-400">(dejar en blanco para conservar la actual)</span>
            </label>
            <input
              type="password"
              minLength={8}
              placeholder="Opcional: ingresar nueva contraseña"
              value={nuevaContrasena}
              onChange={(e) => setNuevaContrasena(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onCerrar}
              disabled={enviando}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              style={{ backgroundColor: colorPrimario }}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {enviando ? 'Guardando…' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
