'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Marco from '@/components/Marco';
import EquipoProyecto from '@/components/panel/EquipoProyecto';
import Modal from '@/components/ui/Modal';
import ModalConfirmacion from '@/components/ui/ModalConfirmacion';
import { BloqueEsqueleto, EsqueletoTarjetas } from '@/components/ui/Esqueleto';
import { useToast } from '@/components/ui/Toast';
import ConstelacionProyectos from '@/components/panel/ConstelacionProyectos';
import VistaResumenProyectos from '@/components/panel/VistaResumenProyectos';
import BandaAvance from '@/components/panel/BandaAvance';
import { api, ErrorApi, ProgresoPersonalItem, ProyectoItem, Sesion } from '@/lib/api';
import { useDatosCache } from '@/lib/cacheDatos';
import { useSesion } from '@/lib/sesion';
import { useColorPrimario } from '@/lib/color';

type VistaPanel = 'constelacion' | 'resumen';
const CLAVE_VISTA_PANEL = 'tf_panel_vista';

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
  const colorPrimario = useColorPrimario();

  const [vistaPanel, setVistaPanel] = useState<VistaPanel>('constelacion');
  useEffect(() => {
    try {
      const guardada = window.localStorage.getItem(CLAVE_VISTA_PANEL);
      if (guardada === 'constelacion' || guardada === 'resumen') setVistaPanel(guardada);
    } catch {
      /* almacenamiento bloqueado */
    }
  }, []);

  function cambiarVistaPanel(v: VistaPanel) {
    setVistaPanel(v);
    try {
      window.localStorage.setItem(CLAVE_VISTA_PANEL, v);
    } catch {
      /* ignorar si falla storage */
    }
  }

  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  // El detalle del proyecto se abre en una ventana emergente.
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<ProyectoItem | null>(null);
  const [proyectoPorEliminar, setProyectoPorEliminar] = useState<ProyectoItem | null>(null);
  const [eliminandoProyecto, setEliminandoProyecto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const { toast } = useToast();

  async function confirmarEliminarProyecto() {
    if (!esAdmin || !proyectoPorEliminar) return;
    setEliminandoProyecto(true);
    try {
      await api.delete(`/proyectos/${proyectoPorEliminar.id}`);
      const nombreEliminado = proyectoPorEliminar.nombre;
      setProyectoPorEliminar(null);
      setSeleccionado(null);
      setDetalleAbierto(false);
      setEditando(null);
      toast({
        tipo: 'info',
        titulo: 'Proyecto eliminado',
        descripcion: `Se eliminó «${nombreEliminado}» y sus nodos asociados.`,
      });
      await cargar();
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo eliminar el proyecto.');
      setProyectoPorEliminar(null);
    } finally {
      setEliminandoProyecto(false);
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
    else setAviso(error instanceof ErrorApi ? error.message : 'No se pudo conectar con el servidor.');
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

  const selectorVista = (
    <div
      role="group"
      aria-label="Modo de visualización de proyectos"
      className="inline-flex h-9 items-center rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-0.5 text-xs"
    >
      {(
        [
          { id: 'constelacion', texto: 'Mapa' },
          { id: 'resumen', texto: 'Resumen' },
        ] as const
      ).map((v) => {
        const activo = vistaPanel === v.id;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={activo}
            onClick={() => cambiarVistaPanel(v.id)}
            style={
              activo
                ? { backgroundColor: colorPrimario, color: 'var(--tf-texto-primario)' }
                : undefined
            }
            className={`rounded-full px-3.5 py-1.5 font-medium transition ${
              activo
                ? 'shadow-sm'
                : 'text-[var(--tf-texto-tenue)] hover:text-[var(--tf-texto)]'
            }`}
          >
            {v.texto}
          </button>
        );
      })}
    </div>
  );

  return (
    // En el Panel solo queda el mapa: el titulo no se muestra en la cabecera.
    <Marco
      activo="/panel"
      titulo={tituloVista}
      tituloOculto
      controlesEnSidebar
      compacto
    >
      {aviso && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-[var(--tf-acento-ambar)] shadow-sm"
        >
          <span>{aviso}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAviso(null);
                cargar();
              }}
              className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold hover:bg-amber-500/25"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => setAviso(null)}
              aria-label="Cerrar aviso"
              className="text-xs font-bold opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* -------------------- Isla Dinámica de sesión activa para trabajador -------------------- */}
      {esTrabajador && sesionActiva && (
        <div className="tf-glow-ring mb-6">
          <div className="tf-glow-inner flex flex-wrap items-center justify-between gap-3 px-4 py-3">
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
              className="group flex cursor-pointer items-center gap-3"
            >
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-acento-verde)]">
                  Sesión de trabajo en marcha{' '}
                  {sesionActiva.actividad.proyecto?.nombre
                    ? `· ${sesionActiva.actividad.proyecto.nombre}`
                    : ''}
                </p>
                <p className="tf-display text-sm font-bold text-[var(--tf-texto)] group-hover:underline">
                  {sesionActiva.actividad.titulo}
                </p>
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
              className="tf-shimmer-cta rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Ir al cronómetro y tarea →
            </button>
          </div>
        </div>
      )}

      {/* -------------------- Tarjetas de rendimiento del Trabajador -------------------- */}
      {esTrabajador && (
        <div className="mb-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--tf-texto-tenue)]">
              Métricas de Desempeño Personal
            </h2>
            {progreso && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-medium text-[var(--tf-acento-verde)]">
                  {progreso.tareasCompletadas} completadas
                </span>
                <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 font-medium text-[var(--tf-acento-azul)]">
                  {progreso.tareasEnProgreso} en progreso
                </span>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-medium text-[var(--tf-acento-ambar)]">
                  {progreso.tareasPendientes} pendientes
                </span>
              </div>
            )}
          </div>

          <div className="tf-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaMetrica
              etiqueta="Horas Semanales"
              valor={cargandoProgreso ? null : formatearHoras(progreso?.segundosSemana ?? 0)}
              subtexto="Semana en curso"
              icono="⏱️"
            />
            <TarjetaMetrica
              etiqueta="Horas Mensuales"
              valor={cargandoProgreso ? null : formatearHoras(progreso?.segundosMes ?? 0)}
              subtexto="Mes en curso"
              icono="📅"
            />
            <TarjetaMetrica
              etiqueta="Días Laborados"
              valor={cargandoProgreso ? null : `${progreso?.diasLaborados ?? 0} días`}
              subtexto="Presencia registrada"
              icono="📍"
            />
            <TarjetaMetrica
              etiqueta="Jornadas Completadas"
              valor={cargandoProgreso ? null : `${progreso?.totalJornadas ?? 0}`}
              subtexto="Turnos cerrados"
              icono="✅"
            />
          </div>
        </div>
      )}

      {/* -------------------- Proyectos: Constelación o Resumen -------------------- */}
      <section aria-label={esTrabajador ? 'Mis proyectos' : 'Proyectos'}>
        {cargando ? (
          <EsqueletoTarjetas />
        ) : vistaPanel === 'resumen' ? (
          <VistaResumenProyectos
            proyectos={proyectos}
            esTrabajador={esTrabajador}
            selectorVista={selectorVista}
            onElegir={(id) => {
              setSeleccionado(id);
              setDetalleAbierto(true);
            }}
            onIrAlMapa={irATareas}
            onCrear={() => setModalAbierto(true)}
          />
        ) : (
          <ConstelacionProyectos
            proyectos={proyectos}
            esTrabajador={esTrabajador}
            selectorVista={selectorVista}
            onElegir={(id) => {
              setSeleccionado(id);
              setDetalleAbierto(true);
            }}
            onIrAlMapa={irATareas}
            onCrear={() => setModalAbierto(true)}
          />
        )}
      </section>

      {proyecto && detalleAbierto && (
        <ModalDetalleProyecto
          proyecto={proyecto}
          puedeEditar={esAdmin || esSupervisor}
          esAdmin={esAdmin}
          esTrabajador={esTrabajador}
          // Con el formulario de edicion o confirmacion encima, Escape cierra solo ese.
          bloqueado={editando !== null || proyectoPorEliminar !== null}
          onCerrar={() => setDetalleAbierto(false)}
          onEditar={() => setEditando(proyecto)}
          onEliminar={() => setProyectoPorEliminar(proyecto)}
          onIrAlMapa={() => irATareas(proyecto)}
          onCambio={cargar}
        />
      )}

      {modalAbierto && (
        <ModalCrearProyecto
          onCerrar={() => setModalAbierto(false)}
          onCreado={async () => {
            setModalAbierto(false);
            toast({ tipo: 'exito', titulo: 'Proyecto creado' });
            await cargar();
          }}
        />
      )}

      {editando && (
        <ModalEditarProyecto
          proyecto={editando}
          esAdmin={esAdmin}
          bloqueado={proyectoPorEliminar !== null}
          onCerrar={() => setEditando(null)}
          onEliminar={() => setProyectoPorEliminar(editando)}
          onGuardado={async () => {
            setEditando(null);
            toast({ tipo: 'exito', titulo: 'Proyecto actualizado' });
            await cargar();
          }}
        />
      )}

      <ModalConfirmacion
        abierto={proyectoPorEliminar !== null}
        titulo="Eliminar proyecto"
        descripcion={
          proyectoPorEliminar
            ? `¿Seguro que deseas eliminar «${proyectoPorEliminar.nombre}»?`
            : ''
        }
        detalles={[
          'Se eliminarán todos los nodos y subtareas asociados al proyecto.',
          'Se cerrarán las sesiones de trabajo activas dentro de este proyecto.',
          'Esta acción es irreversible.',
        ]}
        etiquetaConfirmar="Sí, eliminar proyecto"
        ocupado={eliminandoProyecto}
        onConfirmar={confirmarEliminarProyecto}
        onCancelar={() => setProyectoPorEliminar(null)}
      />
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
  valor: string | null;
  subtexto: string;
  icono: string;
}) {
  return (
    <div className="tf-card-pro flex flex-col justify-between rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--tf-texto-tenue)]">{etiqueta}</span>
        <span className="text-base">{icono}</span>
      </div>
      <div className="mt-2">
        {valor === null ? (
          <BloqueEsqueleto className="h-7 w-20" />
        ) : (
          <p className="tf-display text-2xl font-bold text-[var(--tf-texto)]">{valor}</p>
        )}
        <p className="mt-0.5 text-[11px] text-[var(--tf-texto-suave)]">{subtexto}</p>
      </div>
    </div>
  );
}

/**
 * Detalle del proyecto en una ventana emergente, solo con lo esencial: el
 * avance (una barra con un segmento por tarea) con el acceso al mapa, la
 * descripcion y el equipo. Se cierra con la X, con Escape o con un clic fuera.
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
              className="rounded-lg border border-[var(--tf-borde)] px-2.5 py-1 text-xs font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
            >
              Editar
            </button>
          )}
          {esAdmin && (
            <button
              onClick={onEliminar}
              title="Eliminar proyecto (Exclusivo Administrador)"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-[var(--tf-acento-rojo)] transition hover:bg-rose-500/20"
            >
              Eliminar
            </button>
          )}
        </>
      }
    >
      <BandaAvance
        proyecto={proyecto}
        textoMapa={esTrabajador ? 'Registrar avance' : 'Ir al mapa'}
        onIrAlMapa={onIrAlMapa}
        onCambio={onCambio}
      />
      <div className="mt-4">
        <EquipoProyecto key={proyecto.id} proyectoId={proyecto.id} puedeGestionar={puedeEditar}>
          <p className={`text-sm leading-relaxed ${proyecto.descripcion ? 'text-[var(--tf-texto-tenue)]' : 'text-[var(--tf-texto-suave)]'}`}>
            {proyecto.descripcion || 'Sin descripción'}
          </p>
        </EquipoProyecto>
      </div>
    </Modal>
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
    <Modal titulo="Crear proyecto" ancho="md" bloqueado={enviando} onCerrar={onCerrar}>
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-[var(--tf-acento-rojo)]">
          {error}
        </div>
      )}

      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--tf-texto-tenue)]">Nombre</label>
          <input
            type="text"
            required
            autoFocus
            placeholder="Ej: Sitio web corporativo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-sm text-[var(--tf-texto)] outline-none focus:border-sky-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--tf-texto-tenue)]">
            Descripción <span className="font-normal text-[var(--tf-texto-suave)]">(opcional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="De qué trata este proyecto"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-sm text-[var(--tf-texto)] outline-none focus:border-sky-400"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-[var(--tf-borde)] pt-4">
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            className="rounded-xl border border-[var(--tf-borde)] px-4 py-2 text-sm font-medium text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            style={{ backgroundColor: colorPrimario, color: 'var(--tf-texto-primario)' }}
            className="tf-shimmer-cta rounded-xl px-5 py-2 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            {enviando ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalEditarProyecto({
  proyecto,
  esAdmin,
  bloqueado = false,
  onCerrar,
  onEliminar,
  onGuardado,
}: {
  proyecto: ProyectoItem;
  esAdmin?: boolean;
  bloqueado?: boolean;
  onCerrar: () => void;
  onEliminar?: () => void;
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
    <Modal titulo="Editar proyecto" ancho="md" bloqueado={bloqueado || enviando} onCerrar={onCerrar}>
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-[var(--tf-acento-rojo)]">
          {error}
        </div>
      )}

      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--tf-texto-tenue)]">Nombre</label>
          <input
            type="text"
            required
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-sm text-[var(--tf-texto)] outline-none focus:border-sky-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--tf-texto-tenue)]">
            Descripción <span className="font-normal text-[var(--tf-texto-suave)]">(opcional)</span>
          </label>
          <textarea
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-sm text-[var(--tf-texto)] outline-none focus:border-sky-400"
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--tf-borde)] pt-4">
          {esAdmin && onEliminar ? (
            <button
              type="button"
              onClick={onEliminar}
              disabled={enviando}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-[var(--tf-acento-rojo)] transition hover:bg-rose-500/20"
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
              className="rounded-xl border border-[var(--tf-borde)] px-4 py-2 text-sm font-medium text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              style={{ backgroundColor: colorPrimario, color: 'var(--tf-texto-primario)' }}
              className="rounded-xl px-5 py-2 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {enviando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
