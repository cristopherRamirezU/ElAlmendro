'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Marco from '@/components/Marco';
import EquipoProyecto from '@/components/panel/EquipoProyecto';
import Cofre from '@/components/tesoro/Cofre';
import CofreProyecto from '@/components/tesoro/CofreProyecto';
import RejillaBolsas from '@/components/tesoro/RejillaBolsas';
import { api, ErrorApi, ProgresoPersonalItem, ProyectoItem, Sesion } from '@/lib/api';
import { useDatosCache } from '@/lib/cacheDatos';
import { useSesion } from '@/lib/sesion';

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
  const [pestana, setPestana] = useState<'proyectos' | 'bolsas'>('proyectos');
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
          className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300"
        >
          {aviso}
        </p>
      )}

      {/* -------------------- Banner de sesión activa para trabajador -------------------- */}
      {esTrabajador && sesionActiva && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 backdrop-blur">
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
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur">
              <p className="text-xs text-slate-400">Proyectos Asignados / Supervisados</p>
              <p className="mt-1 text-2xl font-bold text-white">{proyectos.length}</p>
              <p className="mt-1 text-[11px] text-slate-500">Bajo supervisión activa</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur">
              <p className="text-xs text-slate-400">Total Tareas del Equipo</p>
              <p className="mt-1 text-2xl font-bold text-sky-400">
                {proyectos.reduce((acc, p) => acc + p.totalTareas, 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Distribuidas en proyectos</p>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 backdrop-blur">
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

      {/* -------------------- Proyectos y bolsas, en dos pestañas -------------------- */}
      <div className="mb-4 flex flex-wrap items-end gap-2 border-b border-white/10">
        <button
          onClick={() => setPestana('proyectos')}
          className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
            pestana === 'proyectos'
              ? 'border-sky-400 font-semibold text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {esTrabajador ? 'Mis Proyectos' : 'Proyectos del Sistema'}
          <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
            {proyectos.length}
          </span>
        </button>

        <button
          onClick={() => setPestana('bolsas')}
          className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition ${
            pestana === 'bolsas'
              ? 'border-amber-400 font-semibold text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Bolsas del proyecto
          {proyecto && (
            <span className="max-w-[12rem] truncate rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              {proyecto.nombre}
            </span>
          )}
        </button>

        <p className="ml-auto hidden pb-2 text-xs text-slate-400 sm:block">
          {pestana === 'proyectos'
            ? esTrabajador
              ? 'Proyectos donde tienes asignaciones'
              : 'Elige un proyecto para ver su cofre y su equipo'
            : 'Cada tarea es una bolsa: llénala con sus monedas y guárdala en el cofre'}
        </p>
      </div>

      {/* -------------------- Pestaña: bolsas del proyecto -------------------- */}
      {pestana === 'bolsas' &&
        (proyecto ? (
          <div className="mb-6 flex flex-col gap-4 lg:flex-row">
            <div className="min-w-0 flex-1">
              <RejillaBolsas key={proyecto.id} proyectoId={proyecto.id} />
            </div>
            <aside className="w-full shrink-0 lg:w-72">
              <CofreProyecto
                proyecto={proyecto}
                activo={pestana === 'bolsas'}
                onCambio={cargar}
              />
              <button
                onClick={() => irATareas(proyecto)}
                className="w-full rounded-xl border border-white/10 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                Ver el mapa de nodos
              </button>
            </aside>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-dashed border-white/15 p-12 text-center">
            <p className="text-sm text-slate-400">
              Elige primero un proyecto para ver sus bolsas.
            </p>
            <button
              onClick={() => setPestana('proyectos')}
              className="mt-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:from-amber-300 hover:to-amber-400"
            >
              Ir a los proyectos
            </button>
          </div>
        ))}

      {/* -------------------- Pestaña: proyectos -------------------- */}
      <div className={`flex-col gap-4 lg:flex-row ${pestana === 'proyectos' ? 'flex' : 'hidden'}`}>
        <section className="min-w-0 flex-1">
          {cargando ? (
            <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-500">
              Cargando proyectos…
            </p>
          ) : proyectos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
              <p className="text-sm font-medium text-slate-400">
                {esTrabajador
                  ? 'No tienes proyectos asignados con tareas activas por el momento.'
                  : 'No hay proyectos registrados.'}
              </p>
              <button
                onClick={() => setModalAbierto(true)}
                className="mt-4 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-400"
              >
                Crear primer proyecto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {proyectos.map((p) => {
                const porcentaje =
                  p.totalTareas > 0 ? Math.round((p.tareasCompletadas / p.totalTareas) * 100) : 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSeleccionado(p.id)}
                    className={`group flex aspect-square cursor-pointer flex-col items-center justify-between rounded-2xl border bg-slate-900/60 p-3 text-center backdrop-blur transition hover:bg-slate-900 ${
                      seleccionado === p.id
                        ? 'border-sky-400/50 ring-2 ring-sky-400/20'
                        : 'border-white/10'
                    }`}
                  >
                    <p
                      className="line-clamp-2 text-sm font-semibold leading-snug text-white"
                      title={p.nombre}
                    >
                      {p.nombre}
                    </p>

                    {/* El cofre del proyecto: se llena con cada bolsa guardada. */}
                    <Cofre
                      llenado={p.totalTareas > 0 ? p.tareasCompletadas / p.totalTareas : 0}
                      tamano={64}
                    />

                    <span className="text-xl font-bold text-amber-300">{porcentaje}%</span>

                    <div className="flex w-full items-center justify-center gap-1 border-t border-white/5 pt-2 text-xs text-slate-400 group-hover:text-sky-300">
                      <span>Ver detalles</span>
                      <span aria-hidden>→</span>
                    </div>
                  </div>
                );
              })}

              {/* Crear proyecto: todos los roles. Los trabajadores tienen
                  autonomia para abrir proyectos; lo que no pueden es editarlos. */}
              <button
                onClick={() => setModalAbierto(true)}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 p-3 text-slate-400 transition hover:border-sky-400/40 hover:text-sky-300"
              >
                <span className="text-2xl leading-none">+</span>
                <span className="text-sm font-medium">Crear proyecto</span>
              </button>
            </div>
          )}
        </section>

        {proyecto && (
          <aside className="w-full shrink-0 rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur lg:w-96">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="font-bold leading-snug text-white">{proyecto.nombre}</h2>
              <div className="flex shrink-0 items-center gap-2">
                {/* Editar: solo Administrador o Supervisor; el trabajador crea pero no modifica. */}
                {(esAdmin || esSupervisor) && (
                  <button
                    onClick={() => setEditando(proyecto)}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
                  >
                    Editar
                  </button>
                )}
                {esAdmin && (
                  <button
                    onClick={() => handleEliminarProyecto(proyecto)}
                    title="Eliminar proyecto (Exclusivo Administrador)"
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  onClick={() => setSeleccionado(null)}
                  aria-label="Cerrar detalle"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-slate-400 transition hover:bg-white/5"
                >
                  ×
                </button>
              </div>
            </div>

            <CofreProyecto
              proyecto={proyecto}
              activo={pestana === 'proyectos'}
              onCambio={cargar}
            />

            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Descripción
            </p>
            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              {proyecto.descripcion || 'Sin descripción'}
            </p>

            <EquipoProyecto
              key={proyecto.id}
              proyectoId={proyecto.id}
              puedeGestionar={esAdmin || esSupervisor}
            />

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

            <button
              onClick={() => setPestana('bolsas')}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-2.5 text-sm font-bold text-slate-950 transition hover:from-amber-300 hover:to-amber-400"
            >
              Ver las bolsas de este proyecto
            </button>
            <button
              onClick={() => irATareas(proyecto)}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-2.5 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-indigo-400"
            >
              {esTrabajador ? 'Iniciar tarea / Registrar avance' : 'Ir al mapa de nodos'}
            </button>
          </aside>
        )}
      </div>

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
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur">
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
              className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-indigo-400 disabled:opacity-50"
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
                className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-indigo-400 disabled:opacity-50"
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
