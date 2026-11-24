'use client';

import { useEffect, useMemo, useState } from 'react';
import { GitBranch, Lock, Trash2, Unlock } from 'lucide-react';
import { Actividad, api, Evidencia, ErrorApi, Sesion } from '@/lib/api';
import { duracion } from '@/lib/formato';
import { obtenerDescendientes, validarCambioPadre } from '@/lib/mapaMental';
import type { ContextoEquipoUsuario, NodoActividad } from '@/lib/tipos';
import { PERMISOS } from '@/lib/rbac';
import { useSesion, useTienePermiso } from '@/lib/sesion';
import ResponsableTarea from './ResponsableTarea';
import ComentariosTarea from './ComentariosTarea';
import ContadorTarea, { TEXTO_ESTADO, type AccionContador, type EstadoContador } from './ContadorTarea';
import ZonaEvidencias from './ZonaEvidencias';
import Modal from '@/components/ui/Modal';
import ModalConfirmacion from '@/components/ui/ModalConfirmacion';
import Selector from '@/components/ui/Selector';
import TooltipAyuda from '@/components/ui/TooltipAyuda';
import { EsqueletoPanelTarea } from '@/components/ui/Esqueleto';
import { useToast } from '@/components/ui/Toast';
import { useTesoro } from '@/lib/tesoro';

/**
 * Detalle de una tarea del mapa de nodos, en una ventana emergente: arriba el
 * contador con su cronometraje (comenzar, pausar o reanudar, y terminar);
 * debajo, a la izquierda los comentarios y el responsable, y a la derecha las
 * evidencias, con vista previa antes de subirlas. Los objetivos de la tarea
 * se ven en su ventana aparte.
 */
export default function PanelTarea({
  actividadId,
  actividadesProyecto,
  contextoEquipo,
  onEstadoGuardado,
  onCerrar,
  onCambio,
}: {
  actividadId: string;
  actividadesProyecto?: NodoActividad[];
  contextoEquipo?: Record<string, ContextoEquipoUsuario>;
  onEstadoGuardado?: (estado: 'guardando' | 'guardado' | 'error', reintentar?: () => void) => void;
  onCerrar: () => void;
  /** Avisa al mapa que recargue: el estado de la tarea cambio (color del nodo). */
  onCambio?: () => void;
}) {
  const { toast } = useToast();
  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [segundos, setSegundos] = useState(0);
  const [cerrando, setCerrando] = useState(false);
  const [nota, setNota] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [cambiandoPadre, setCambiandoPadre] = useState(false);
  const puedeGestionar = useTienePermiso(PERMISOS.ACTIVIDADES_GESTIONAR);
  const usuarioActual = useSesion();
  // Eliminar tareas: el administrador por su rol, o un trabajador al que se le
  // dio el permiso extra.
  const tienePermisoEliminar = useTienePermiso(PERMISOS.ACTIVIDADES_ELIMINAR);
  const puedeEliminarNodo = tienePermisoEliminar || usuarioActual?.rol === 'SUPER_ADMIN';
  const { abrirBolsa, version } = useTesoro();

  async function confirmarEliminacionNodo() {
    if (!puedeEliminarNodo || !actividad) return;
    setEliminando(true);
    try {
      await api.delete(`/actividades/${actividadId}`);
      setConfirmarEliminar(false);
      toast({
        tipo: 'info',
        titulo: 'Nodo eliminado',
        descripcion: `Se eliminó «${actividad.titulo}» y sus subtareas.`,
      });
      onCerrar();
      onCambio?.();
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo eliminar el nodo.');
      setConfirmarEliminar(false);
    } finally {
      setEliminando(false);
    }
  }

  async function cargar() {
    const [a, s, ev] = await Promise.all([
      api.get<Actividad>(`/actividades/${actividadId}`),
      api.get<Sesion | null>('/sesiones/activa'),
      api.get<Evidencia[]>(`/evidencias?actividadId=${actividadId}`),
    ]);
    setActividad(a);
    setSesion(s);
    setEvidencias(ev);
    setSegundos(s?.actividad.id === actividadId ? s.segundosAcumulados : 0);
  }

  useEffect(() => {
    setCerrando(false);
    setNota('');
    setAviso(null);
    cargar().catch(() => setAviso('No se pudo cargar la tarea.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividadId]);

  useEffect(() => {
    if (version === 0) return;
    cargar().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    if (sesion?.actividad.id !== actividadId || sesion.estado !== 'ACTIVA') return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [sesion, actividadId]);

  async function accion(fn: () => Promise<unknown>) {
    setAviso(null);
    try {
      await fn();
      await cargar();
      onCambio?.();
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'Ocurrio un error.');
    }
  }

  const padreActualId = useMemo(
    () => actividadesProyecto?.find((a) => a.id === actividadId)?.actividadPadreId ?? '',
    [actividadesProyecto, actividadId],
  );

  const descendientes = useMemo(
    () => (actividadesProyecto ? obtenerDescendientes(actividadId, actividadesProyecto) : new Set<string>()),
    [actividadesProyecto, actividadId],
  );

  async function cambiarPadre(nuevoPadreId: string) {
    if (!actividadesProyecto || nuevoPadreId === padreActualId) return;
    const destino = nuevoPadreId || null;
    const validacion = validarCambioPadre(actividadId, destino, actividadesProyecto);
    if (!validacion.valido) {
      setAviso(validacion.motivo);
      toast({ tipo: 'advertencia', titulo: 'Conexión no permitida', descripcion: validacion.motivo });
      return;
    }

    const anterior = padreActualId || null;
    setAviso(null);
    setCambiandoPadre(true);
    onEstadoGuardado?.('guardando');
    try {
      await api.patch(`/actividades/${actividadId}`, { actividadPadreId: destino });
      await cargar();
      onCambio?.();
      onEstadoGuardado?.('guardado');
      toast({
        tipo: 'exito',
        titulo: 'Dependencia actualizada',
        descripcion: destino
          ? `Ahora depende de «${actividadesProyecto.find((a) => a.id === destino)?.titulo ?? 'tarea padre'}».`
          : 'Movida al nivel principal del proyecto.',
        duracionMs: 7000,
        accion: {
          etiqueta: 'Deshacer',
          alHacer: async () => {
            onEstadoGuardado?.('guardando');
            await api.patch(`/actividades/${actividadId}`, { actividadPadreId: anterior });
            await cargar();
            onCambio?.();
            onEstadoGuardado?.('guardado');
          },
        },
      });
    } catch (err) {
      const msg = err instanceof ErrorApi ? err.message : 'No se pudo cambiar la tarea padre.';
      setAviso(msg);
      onEstadoGuardado?.('error', () => cambiarPadre(nuevoPadreId));
    } finally {
      setCambiandoPadre(false);
    }
  }

  async function alternarCandado() {
    if (!actividad) return;
    const nuevoValor = !actividad.bloquearOrdenHijas;
    const valorAnterior = Boolean(actividad.bloquearOrdenHijas);
    onEstadoGuardado?.('guardando');
    try {
      await accion(() =>
        api.patch(`/actividades/${actividadId}/bloqueo-hijas`, {
          bloquearOrdenHijas: nuevoValor,
        }),
      );
      onEstadoGuardado?.('guardado');
      toast({
        tipo: 'info',
        titulo: nuevoValor ? 'Candado secuencial activado' : 'Orden libre activado',
        descripcion: nuevoValor
          ? 'Las tareas hijas ahora deben completarse en orden.'
          : 'Las tareas hijas pueden trabajarse en paralelo.',
        duracionMs: 6500,
        accion: {
          etiqueta: 'Deshacer',
          alHacer: async () => {
            onEstadoGuardado?.('guardando');
            await api.patch(`/actividades/${actividadId}/bloqueo-hijas`, {
              bloquearOrdenHijas: valorAnterior,
            });
            await cargar();
            onCambio?.();
            onEstadoGuardado?.('guardado');
          },
        },
      });
    } catch {
      onEstadoGuardado?.('error', alternarCandado);
    }
  }

  /** Pasa la tarea a su ventana aparte y cierra este popup: queda una sola vista. */
  function abrirAparte() {
    if (!actividad) return;
    abrirBolsa({ id: actividadId, titulo: actividad.titulo });
    onCerrar();
  }

  const botonAbrirAparte = (
    <button
      onClick={abrirAparte}
      disabled={!actividad}
      title="Abrir la tarea en su ventana aparte, con sus objetivos, siempre visible"
      aria-label="Abrir en ventana aparte"
      className="grid h-8 w-8 place-items-center rounded-full border border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-40"
    >
      ⤢
    </button>
  );

  if (!actividad) {
    return (
      <Modal titulo="Detalle de tarea" ancho="lg" claseVentana="tf-ventana-tarea" onCerrar={onCerrar} acciones={botonAbrirAparte}>
        {aviso ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-[var(--tf-acento-rojo)]">
              {aviso}
            </p>
            <button
              type="button"
              onClick={() => {
                setAviso(null);
                cargar().catch((err) =>
                  setAviso(err instanceof ErrorApi ? err.message : 'No se pudo cargar la tarea.'),
                );
              }}
              className="rounded-xl border border-[var(--tf-borde-fuerte)] px-4 py-1.5 text-xs font-semibold text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)]"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <EsqueletoPanelTarea />
        )}
      </Modal>
    );
  }

  const enEstaTarea = sesion?.actividad.id === actividadId;
  const corriendo = enEstaTarea && sesion?.estado === 'ACTIVA';
  const pausada = enEstaTarea && !corriendo;
  const terminada = actividad.estado === 'COMPLETADA';
  const bloqueadaPorOrden = Boolean(actividad.bloqueadaPorOrden);
  // Solo el responsable (o quien gestiona) puede echar a andar el cronometro.
  const puedeCronometrar = actividad.responsable?.id === usuarioActual?.id || puedeGestionar;
  // El servidor exige respaldo para cerrar como completada; aqui se avisa
  // antes de intentarlo, porque despues ya no se pueden adjuntar archivos.
  const hayRespaldo = evidencias.length > 0;

  const estadoContador: EstadoContador = terminada
    ? 'terminado'
    : corriendo
      ? 'corriendo'
      : pausada
        ? 'pausado'
        : sesion
          ? 'ocupado'
          : 'detenido';

  /** Boton principal: pausa si corre, reanuda si quedo en pausa, o comienza la tarea. */
  const principal: AccionContador = corriendo
    ? {
        texto: 'Pausar',
        titulo: 'Pausar el cronómetro',
        onClick: () => accion(() => api.post(`/sesiones/${sesion!.id}/pausar`)),
      }
    : pausada
      ? {
          texto: 'Reanudar',
          titulo: 'Reanudar el cronómetro',
          onClick: () => accion(() => api.post(`/sesiones/${sesion!.id}/reanudar`)),
        }
      : {
          texto: terminada ? 'Tarea terminada' : bloqueadaPorOrden ? 'Bloqueada' : 'Comenzar',
          titulo: terminada
            ? 'La tarea ya está terminada'
            : bloqueadaPorOrden
              ? `Bloqueada por orden secuencial: termina primero «${actividad.prerequisitoTitulo ?? 'la tarea anterior'}»`
              : sesion
                ? `Tienes otra sesión abierta en «${sesion.actividad.titulo}»`
                : !puedeCronometrar
                  ? 'El cronómetro está reservado para el responsable de la tarea'
                  : 'Comenzar a cronometrar esta tarea',
          deshabilitado: terminada || bloqueadaPorOrden || Boolean(sesion) || !puedeCronometrar,
          onClick: () => accion(() => api.post('/sesiones/iniciar', { actividadId })),
        };

  /** Terminar: abre el cierre, donde se elige si queda completada o inconclusa. */
  const terminar: AccionContador = {
    texto: 'Terminar',
    titulo: terminada
      ? 'La tarea ya está terminada'
      : enEstaTarea
        ? 'Cerrar la sesión de esta tarea'
        : 'Comienza la tarea para poder terminarla',
    deshabilitado: !enEstaTarea,
    onClick: () => setCerrando((v) => !v),
  };

  return (
    <Modal
      titulo={
        <span className="text-xl font-medium tracking-[-0.01em] text-[var(--tf-texto)]">{actividad.titulo}</span>
      }
      ancho="lg"
      claseVentana="tf-ventana-tarea"
      bloqueado={confirmarEliminar}
      onCerrar={onCerrar}
      acciones={
        <>
          {actividad.puedeGestionarBloqueo && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={alternarCandado}
                aria-pressed={Boolean(actividad.bloquearOrdenHijas)}
                title={
                  actividad.bloquearOrdenHijas
                    ? 'Candado activado: las tareas hijas deben completarse en orden. Clic para desactivar.'
                    : 'Activar candado: exigir orden secuencial para las tareas hijas de esta rama'
                }
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition ${
                  actividad.bloquearOrdenHijas
                    ? 'border-amber-500/50 bg-amber-500/20 text-[var(--tf-acento-ambar)] hover:bg-amber-500/30'
                    : 'border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
                }`}
              >
                {actividad.bloquearOrdenHijas ? (
                  <Lock size={13} aria-hidden />
                ) : (
                  <Unlock size={13} aria-hidden />
                )}
                <span className="hidden sm:inline">
                  {actividad.bloquearOrdenHijas ? 'Candado activo' : 'Orden libre'}
                </span>
              </button>
              <TooltipAyuda
                etiqueta="Ayuda sobre el candado secuencial"
                titulo="Candado secuencial"
                texto="Exige completar las tareas hijas directas en orden (#1 → #2 → …). Mientras la tarea previa no esté completada, la siguiente queda bloqueada."
              />
            </div>
          )}
          {botonAbrirAparte}
          {puedeEliminarNodo && (
            <button
              type="button"
              onClick={() => setConfirmarEliminar(true)}
              title="Eliminar nodo y subnodos"
              aria-label="Eliminar nodo y subnodos"
              className="grid h-8 w-8 place-items-center rounded-full border border-[var(--tf-borde)] text-[var(--tf-acento-rojo)] transition hover:border-rose-500/40 hover:bg-rose-500/10"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
        </>
      }
    >
      <ContadorTarea
        segundos={terminada && !enEstaTarea ? actividad.segundosTrabajados : enEstaTarea ? segundos : 0}
        detalle={`${TEXTO_ESTADO[estadoContador]} · total ${duracion(actividad.segundosTrabajados)}`}
        estado={estadoContador}
        principal={principal}
        terminar={terminar}
      />

      {bloqueadaPorOrden && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/12 px-3 py-2 text-xs text-[var(--tf-acento-ambar)]"
        >
          <Lock size={14} className="shrink-0 text-[var(--tf-acento-ambar)]" aria-hidden />
          <span>
            Bloqueada por orden secuencial: termina primero{' '}
            <strong>«{actividad.prerequisitoTitulo || 'la tarea anterior'}»</strong> para
            desbloquear esta tarea.
          </span>
        </div>
      )}

      {actividad.bloquearOrdenHijas && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-[var(--tf-acento-ambar)]">
          <Lock size={12} className="shrink-0 text-[var(--tf-acento-ambar)]" aria-hidden />
          <span>
            Candado secuencial activo sobre {actividad.totalHijas ?? 0} tarea(s) hija(s) de esta rama: se desbloquean en orden.
          </span>
        </div>
      )}

      {cerrando && enEstaTarea && (
        <div className="mt-3 rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--tf-texto-tenue)]">¿Cómo dejas la tarea?</p>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Nota de cierre (obligatoria si queda inconclusa)"
            className="mb-2 w-full rounded-lg border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] outline-none focus:border-[var(--color-primario)]"
          />
          {!hayRespaldo && (
            <p className="mb-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--tf-acento-azul)]">
              Para darla por completada sube primero una evidencia del trabajo hecho: después del cierre ya no se
              aceptan archivos.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() =>
                accion(async () => {
                  await api.post(`/sesiones/${sesion!.id}/cerrar`, {
                    desenlace: 'COMPLETADA',
                    notaCierre: nota || undefined,
                  });
                  setCerrando(false);
                  setNota('');
                })
              }
              disabled={!hayRespaldo}
              title={
                hayRespaldo
                  ? 'Cerrar la tarea como completada'
                  : 'Sube una evidencia del trabajo hecho para poder completarla'
              }
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Completada
            </button>
            <button
              onClick={() =>
                accion(async () => {
                  await api.post(`/sesiones/${sesion!.id}/cerrar`, {
                    desenlace: 'INCONCLUSA',
                    notaCierre: nota,
                  });
                  setCerrando(false);
                  setNota('');
                })
              }
              className="flex-1 rounded-lg bg-orange-500 py-2 text-xs font-semibold text-white hover:bg-orange-400"
            >
              Inconclusa
            </button>
          </div>
        </div>
      )}

      {!sesion && !puedeCronometrar && !terminada && (
        <p className="mt-3 text-center text-[11px] text-[var(--tf-texto-tenue)]">
          El cronómetro está reservado para {actividad.responsable?.nombreCompleto}. Puedes ver los comentarios y
          las evidencias.
        </p>
      )}
      {sesion && !enEstaTarea && (
        <p className="mt-3 text-center text-[11px] text-[var(--tf-texto-tenue)]">
          Tienes otra sesión abierta en «{sesion.actividad.titulo}». Ciérrala para cronometrar esta tarea.
        </p>
      )}

      {aviso && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-[var(--tf-acento-rojo)]">
          {aviso}
        </p>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <ComentariosTarea actividad={actividad} onGuardadas={setActividad} />
          <ResponsableTarea
            actividad={actividad}
            puedeGestionar={puedeGestionar}
            contextoEquipo={contextoEquipo}
            onReasignada={async () => {
              await cargar();
              onCambio?.();
            }}
          />
          {puedeGestionar && actividadesProyecto && actividadesProyecto.length > 0 && (
            <div className="tf-vidrio rounded-2xl px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tf-texto-tenue)]">
                  <GitBranch size={12} aria-hidden />
                  Depende de
                </span>
                <TooltipAyuda
                  etiqueta="Ayuda sobre dependencia de nodo"
                  titulo="Jerarquía del flujo"
                  texto="Elige de qué tarea cuelga este nodo en el mapa. No puedes conectarlo consigo mismo ni con sus propias subtareas para evitar ciclos."
                />
              </div>
              <Selector
                ariaLabel="Tarea padre de este nodo"
                forma="compacto"
                buscable={actividadesProyecto.length > 6}
                placeholderBusqueda="Buscar tarea padre…"
                disabled={cambiandoPadre}
                valor={padreActualId}
                onChange={cambiarPadre}
                opciones={[
                  {
                    valor: '',
                    etiqueta: 'Raíz del proyecto',
                    subtitulo: 'Nivel principal del mapa',
                  },
                  ...actividadesProyecto
                    .filter((a) => a.id !== actividadId)
                    .map((a) => {
                      const creaCiclo = descendientes.has(a.id);
                      return {
                        valor: a.id,
                        etiqueta: a.titulo,
                        deshabilitado: creaCiclo,
                        subtitulo: creaCiclo
                          ? 'No disponible (crearía un ciclo)'
                          : a.responsable?.nombreCompleto,
                      };
                    }),
                ]}
              />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <ZonaEvidencias
            actividadId={actividadId}
            evidencias={evidencias}
            terminada={terminada}
            onCambio={setEvidencias}
            onRecargar={cargar}
          />
        </div>
      </div>

      <ModalConfirmacion
        abierto={confirmarEliminar}
        titulo="Eliminar nodo y subtareas"
        descripcion={`¿Seguro que deseas eliminar «${actividad.titulo}»?`}
        detalles={[
          'Se eliminará este nodo junto con todas sus subtareas dependientes.',
          'Cualquier cronómetro activo en estas tareas se cerrará.',
          'Esta acción no se puede deshacer.',
        ]}
        etiquetaConfirmar="Sí, eliminar nodo"
        ocupado={eliminando}
        onConfirmar={confirmarEliminacionNodo}
        onCancelar={() => setConfirmarEliminar(false)}
      />
    </Modal>
  );
}
