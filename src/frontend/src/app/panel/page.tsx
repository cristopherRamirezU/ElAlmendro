'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Marco from '@/components/Marco';
import EquipoProyecto from '@/components/panel/EquipoProyecto';
import Modal from '@/components/ui/Modal';
import GalaxiaProyectos from '@/components/panel/GalaxiaProyectos';
import RelojProyecto from '@/components/tesoro/RelojProyecto';
import { api, ErrorApi, ProgresoPersonalItem, ProyectoItem, Sesion } from '@/lib/api';
import { useDatosCache } from '@/lib/cacheDatos';
import { useSesion } from '@/lib/sesion';
import { useColorPrimario } from '@/lib/color';

function formatearHoras(segundos: number): string {
  if (!segundos || segundos <= 0) return '0h 0m';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Panel principal: adaptativo según rol (Trabajador, Supervisor, Administrador). */
export default function Panel() {
  const router = useRouter();
  const usuario = useSesion();

  const esTrabajador = usuario?.rol === 'TRABAJADOR';
  const esSupervisor = usuario?.rol === 'SUPERVISOR';
  const esAdmin = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPER_ADMIN';

  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  // El detalle del proyecto se abre en una ventana emergente.
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<ProyectoItem | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function handleEliminarProyecto(p: ProyectoItem) {
    if (!esAdmin) return;
    const confirmacion = window.confirm(
      `¿Estás seguro de que deseas eliminar el proyecto "${p.nombre}" y todos sus nodos asociados?\n\nEsta acción es irreversible y finalizará las tareas activas de este proyecto.`,
    );
    if (!confirmacion) return;

    try {
      await api.delete(`/proyectos/${p.id}`);
      setSeleccionado(null);
      setDetalleAbierto(false);
      setEditando(null);
      await cargar();
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo eliminar el proyecto.');
    }
  }

  // Métricas personales del trabajador
  const [progreso, setProgreso] = useState<ProgresoPersonalItem | null>(null);
  const [sesionActiva, setSesionActiva] = useState<Sesion | null>(null);
  const [cargandoProgreso, setCargandoProgreso] = useState(false);

  const pedir = useCallback(() => api.get<ProyectoItem[]>('/proyectos/mios'), []);
  const { datos, cargando, error, recargar: cargar } = useDatosCache('proyectos:mios', pedir);
  const proyectos = datos ?? [];

  useEffect(() => {
    if (!error) return;
    if (error instanceof ErrorApi && error.estado === 401) router.replace('/login');
    else setAviso('No se pudo conectar con el servidor.');
  }, [error, router]);

  useEffect(() => {
    if (esTrabajador) {
      setCargandoProgreso(true);
      Promise.all([
        api.get<ProgresoPersonalItem>('/dashboard/mi-progreso').catch(() => null),
        api.get<Sesion | null>('/sesiones/activa').catch(() => null),
      ])
        .then(([p, s]) => {
          if (p) setProgreso(p);
          if (s) setSesionActiva(s);
        })
        .finally(() => setCargandoProgreso(false));
    }
  }, [esTrabajador]);

  const proyecto = proyectos.find((p) => p.id === seleccionado) ?? null;

  function irATareas(p: ProyectoItem) {
    router.push(`/nodos?proyectoId=${p.id}&nombre=${encodeURIComponent(p.nombre)}`);
  }

  const tituloVista = esTrabajador
    ? 'Mis Avances / Mi Progreso'
    : esSupervisor
    ? 'Panel de Supervisión'
    : 'Panel de Proyectos';

  const subtituloVista = esTrabajador
    ? 'Rendimiento personal, jornadas y proyectos asignados'
    : esSupervisor
    ? 'Resumen general de proyectos supervisados y flujo de trabajo del equipo'
    : 'Gestión centralizada de proyectos, tareas y equipo';

  return (
    <Marco activo="/panel" titulo={tituloVista} subtitulo={subtituloVista}>
      {aviso && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300 shadow-sm"
        >
          {aviso}
        </p>
      )}

      {/* -------------------- Banner de sesión activa para trabajador -------------------- */}
      {esTrabajador && sesionActiva && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm backdrop-blur">
          <div
            onClick={() => {
              if (sesionActiva.actividad.proyectoId) {
                const nombre = sesionActiva.actividad.proyecto?.nombre || 'Proyecto';
                router.push(
                  `/nodos?proyectoId=${sesionActiva.actividad.proyectoId}&nombre=${encodeURIComponent(
                    nombre,
                  )}&tarea=${sesionActiva.actividad.id}`,
                );
              }
            }}
            className="flex cursor-pointer items-center gap-3 group"
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Sesión de trabajo en marcha {sesionActiva.actividad.proyecto?.nombre ? `· ${sesionActiva.actividad.proyecto.nombre}` : ''}
              </p>
              <p className="text-sm font-bold text-white group-hover:underline">{sesionActiva.actividad.titulo}</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (sesionActiva.actividad.proyectoId) {
                const nombre = sesionActiva.actividad.proyecto?.nombre || 'Proyecto';
                router.push(
                  `/nodos?proyectoId=${sesionActiva.actividad.proyectoId}&nombre=${encodeURIComponent(
                    nombre,
                  )}&tarea=${sesionActiva.actividad.id}`,
                );
              } else {
                router.push('/nodos');
              }
            }}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            Ir al cronómetro y tarea →
          </button>
        </div>
      )}

      {/* -------------------- Tarjetas de rendimiento del Trabajador -------------------- */}
      {esTrabajador && (
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Métricas de Desempeño Personal
            </h2>
            {progreso && (
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-medium text-emerald-300">
                  {progreso.tareasCompletadas} completadas
                </span>
                <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 font-medium text-sky-300">
                  {progreso.tareasEnProgreso} en progreso
                </span>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-medium text-amber-300">
                  {progreso.tareasPendientes} pendientes
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaMetrica
              etiqueta="Horas Semanales"
              valor={cargandoProgreso ? '…' : formatearHoras(progreso?.segundosSemana ?? 0)}
              subtexto="Semana en curso"
              icono="⏱️"
            />
            <TarjetaMetrica
              etiqueta="Horas Mensuales"
              valor={cargandoProgreso ? '…' : formatearHoras(progreso?.segundosMes ?? 0)}
              subtexto="Mes en curso"
              icono="📅"
            />
            <TarjetaMetrica
              etiqueta="Días Laborados"
              valor={cargandoProgreso ? '…' : `${progreso?.diasLaborados ?? 0} días`}
              subtexto="Presencia registrada"
              icono="📍"
            />
            <TarjetaMetrica
              etiqueta="Jornadas Completadas"
              valor={cargandoProgreso ? '…' : `${progreso?.totalJornadas ?? 0}`}
              subtexto="Turnos cerrados"
              icono="✅"
            />
          </div>
        </div>
      )}

      {/* -------------------- Panel Superior de Supervisión -------------------- */}
      {esSupervisor && (
        <div className="mb-8 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Resumen Operativo de Supervisión
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-sm backdrop-blur">
              <p className="text-xs text-slate-400">Proyectos Asignados / Supervisados</p>
              <p className="mt-1 text-2xl font-bold text-white">{proyectos.length}</p>
              <p className="mt-1 text-[11px] text-slate-500">Bajo supervisión activa</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-sm backdrop-blur">
              <p className="text-xs text-slate-400">Total Tareas del Equipo</p>
              <p className="mt-1 text-2xl font-bold text-sky-400">
                {proyectos.reduce((acc, p) => acc + p.totalTareas, 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Distribuidas en proyectos</p>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 shadow-sm backdrop-blur">
              <div>
                <p className="text-xs font-semibold text-sky-300">Mapa de Nodos y Reportes</p>
                <p className="mt-1 text-xs text-slate-300">
                  Visualiza el árbol completo del equipo o revisa reportes de horas.
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/reportes"
                  className="rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/30"
                >
                  Ver Reportes
                </Link>
                <Link
                  href="/chat"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5"
                >
                  Chat Equipo
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- Proyectos -------------------- */}
      <div className="mb-4 flex flex-wrap items-end gap-2 border-b border-[var(--tf-borde)]">
        <h2 className="-mb-px border-b-2 border-sky-400 px-3 py-2 text-sm font-semibold text-[var(--tf-texto)]">
          {esTrabajador ? 'Mis Proyectos' : 'Proyectos del Sistema'}
          <span className="ml-2 rounded-full bg-[var(--tf-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tf-texto-tenue)]">
            {proyectos.length}
          </span>
        </h2>
        <p className="ml-auto hidden pb-2 text-xs text-[var(--tf-texto-tenue)] sm:block">
          {esTrabajador ? 'Proyectos donde tienes asignaciones' : 'Elige una galaxia y luego un proyecto'}
        </p>
      </div>

      <div>
        <section>
          {cargando ? (
            <p className="rounded-2xl border border-dashed border-[var(--tf-borde)] p-10 text-center text-sm text-[var(--tf-texto-tenue)]">
              Cargando proyectos…
            </p>
          ) : (
            // Los proyectos como planetas de dos galaxias (en proceso y
            // completados). Tocar uno abre su ventana, con el acceso al mapa.
            <GalaxiaProyectos
              proyectos={proyectos}
              seleccionado={detalleAbierto ? seleccionado : null}
              onElegir={(id) => {
                setSeleccionado(id);
                setDetalleAbierto(true);
              }}
              onCrear={() => setModalAbierto(true)}
            />
          )}
        </section>
      </div>

      {proyecto && detalleAbierto && (
        <ModalDetalleProyecto
          proyecto={proyecto}
          puedeEditar={esAdmin || esSupervisor}
          esAdmin={esAdmin}
          esTrabajador={esTrabajador}
          // Con el formulario de edicion encima, Escape cierra solo ese.
          bloqueado={editando !== null}
          onCerrar={() => setDetalleAbierto(false)}
          onEditar={() => setEditando(proyecto)}
          onEliminar={() => handleEliminarProyecto(proyecto)}
          onIrAlMapa={() => irATareas(proyecto)}
          onCambio={cargar}
        />
      )}

      {modalAbierto && (
        <ModalCrearProyecto
          onCerrar={() => setModalAbierto(false)}
          onCreado={async () => {
            setModalAbierto(false);
            await cargar();
          }}
        />
      )}

      {editando && (
        <ModalEditarProyecto
          proyecto={editando}
          esAdmin={esAdmin}
          onCerrar={() => setEditando(null)}
          onEliminar={async () => {
            await handleEliminarProyecto(editando);
          }}
          onGuardado={async () => {
            setEditando(null);
            await cargar();
          }}
        />
      )}
    </Marco>
  );
}

function TarjetaMetrica({
  etiqueta,
  valor,
  subtexto,
  icono,
}: {
  etiqueta: string;
  valor: string;
  subtexto: string;
  icono: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{etiqueta}</span>
        <span className="text-base">{icono}</span>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold tracking-tight text-white">{valor}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{subtexto}</p>
      </div>
    </div>
  );
}

/**
 * Detalle del proyecto en una ventana emergente: a la izquierda su reloj de
 * arena y el acceso al mapa de nodos, a la derecha la descripcion,
 * el equipo y los datos. Asi lo importante queda a la vista sin bajar. Se
 * cierra con la X, con Escape o con un clic fuera.
 */
function ModalDetalleProyecto({
  proyecto,
  puedeEditar,
  esAdmin,
  esTrabajador,
  bloqueado,
  onCerrar,
  onEditar,
  onEliminar,
  onIrAlMapa,
  onCambio,
}: {
  proyecto: ProyectoItem;
  puedeEditar: boolean;
  esAdmin: boolean;
  esTrabajador: boolean;
  /** Hay otro dialogo encima: no reacciona a Escape. */
  bloqueado: boolean;
  onCerrar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  onIrAlMapa: () => void;
  onCambio: () => void;
}) {
  const colorPrimario = useColorPrimario();

  return (
    <Modal
      titulo={proyecto.nombre}
      bloqueado={bloqueado}
      onCerrar={onCerrar}
      acciones={
        <>
          {/* Editar: solo Administrador o Supervisor; el trabajador crea pero no modifica. */}
          {puedeEditar && (
            <button
              onClick={onEditar}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Editar
            </button>
          )}
          {esAdmin && (
            <button
              onClick={onEliminar}
              title="Eliminar proyecto (Exclusivo Administrador)"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20"
            >
              Eliminar
            </button>
          )}
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[17rem_1fr]">
        {/* Reloj y accesos: lo que se busca al abrir un proyecto. */}
        <div className="flex flex-col">
          <RelojProyecto proyecto={proyecto} onCambio={onCambio} />
          <button
            onClick={onIrAlMapa}
            style={{ backgroundColor: colorPrimario }}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            {esTrabajador ? 'Iniciar tarea / Registrar avance' : 'Ir al mapa de nodos'}
          </button>
        </div>

        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Descripción
          </p>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">
            {proyecto.descripcion || 'Sin descripción'}
          </p>

          <EquipoProyecto key={proyecto.id} proyectoId={proyecto.id} puedeGestionar={puedeEditar} />

          <Fila
            etiqueta="Creado el"
            valor={new Date(proyecto.creadoEn).toLocaleDateString('es-CL', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          />
          <Fila
            etiqueta="Tareas asociadas"
            valor={`${proyecto.totalTareas} tarea${proyecto.totalTareas === 1 ? '' : 's'}`}
          />
        </div>
      </div>
    </Modal>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 text-sm">
      <span className="text-slate-400">{etiqueta}</span>
      <span className="font-medium text-white">{valor}</span>
    </div>
  );
}

function ModalCrearProyecto({
  onCerrar,
  onCreado,
}: {
  onCerrar: () => void;
  onCreado: () => Promise<void>;
}) {
  const colorPrimario = useColorPrimario();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api.post('/proyectos', {
        nombre,
        descripcion: descripcion || undefined,
      });
      await onCreado();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo crear el proyecto.');
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-lg font-bold text-white">Crear proyecto</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Nombre</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ej: Sitio web corporativo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Descripción <span className="font-normal text-slate-500">(opcional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="De qué trata este proyecto"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
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
              {enviando ? 'Creando…' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalEditarProyecto({
  proyecto,
  esAdmin,
  onCerrar,
  onEliminar,
  onGuardado,
}: {
  proyecto: ProyectoItem;
  esAdmin?: boolean;
  onCerrar: () => void;
  onEliminar?: () => Promise<void>;
  onGuardado: () => Promise<void>;
}) {
  const colorPrimario = useColorPrimario();
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [descripcion, setDescripcion] = useState(proyecto.descripcion ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api.patch(`/proyectos/${proyecto.id}`, {
        nombre,
        descripcion: descripcion || undefined,
      });
      await onGuardado();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo actualizar el proyecto.');
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-lg font-bold text-white">Editar proyecto</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Nombre</label>
            <input
              type="text"
              required
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Descripción <span className="font-normal text-slate-500">(opcional)</span>
            </label>
            <textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </div>

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
            {esAdmin && onEliminar ? (
              <button
                type="button"
                onClick={onEliminar}
                disabled={enviando}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20"
              >
                Eliminar Proyecto
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
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
                {enviando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
