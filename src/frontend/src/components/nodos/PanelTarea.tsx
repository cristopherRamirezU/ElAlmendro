'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Actividad, api, Evidencia, ErrorApi, Sesion } from '@/lib/api';
import { duracion } from '@/lib/formato';
import { PERMISOS } from '@/lib/rbac';
import { useSesion, useTienePermiso } from '@/lib/sesion';
import ResponsableTarea from './ResponsableTarea';
import ComentariosTarea from './ComentariosTarea';
import ContadorTarea, { type AccionContador, type EstadoContador } from './ContadorTarea';
import ZonaEvidencias from './ZonaEvidencias';
import Modal from '@/components/ui/Modal';
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
  onCerrar,
  onCambio,
}: {
  actividadId: string;
  onCerrar: () => void;
  /** Avisa al mapa que recargue: el estado de la tarea cambio (color del nodo). */
  onCambio?: () => void;
}) {
  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [segundos, setSegundos] = useState(0);
  const [cerrando, setCerrando] = useState(false);
  const [nota, setNota] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const puedeGestionar = useTienePermiso(PERMISOS.ACTIVIDADES_GESTIONAR);
  const usuarioActual = useSesion();
  // Eliminar tareas: el administrador por su rol, o un trabajador al que se le
  // dio el permiso extra.
  const tienePermisoEliminar = useTienePermiso(PERMISOS.ACTIVIDADES_ELIMINAR);
  const puedeEliminarNodo = tienePermisoEliminar || usuarioActual?.rol === 'SUPER_ADMIN';
  const { abrirBolsa, version } = useTesoro();

  async function handleEliminarNodo() {
    if (!puedeEliminarNodo || !actividad) return;
    const confirmar = window.confirm(
      `¿Estás seguro de que deseas eliminar el nodo "${actividad.titulo}" y todas sus subtareas/ramas hijas?\n\nEsta acción es irreversible y finalizará cualquier cronómetro activo.`,
    );
    if (!confirmar) return;

    try {
      await api.delete(`/actividades/${actividadId}`);
      onCerrar();
      onCambio?.();
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo eliminar el nodo.');
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
      className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
    >
      ⤢
    </button>
  );

  if (!actividad) {
    return (
      <Modal titulo="Cargando tarea…" ancho="lg" claseVentana="tf-ventana-tarea" onCerrar={onCerrar} acciones={botonAbrirAparte}>
        {aviso ? (
          <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {aviso}
          </p>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">Cargando tarea…</p>
        )}
      </Modal>
    );
  }

  const enEstaTarea = sesion?.actividad.id === actividadId;
  const corriendo = enEstaTarea && sesion?.estado === 'ACTIVA';
  const pausada = enEstaTarea && !corriendo;
  const terminada = actividad.estado === 'COMPLETADA';
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
          texto: terminada ? 'Tarea terminada' : 'Comenzar',
          titulo: terminada
            ? 'La tarea ya está terminada'
            : sesion
              ? `Tienes otra sesión abierta en «${sesion.actividad.titulo}»`
              : !puedeCronometrar
                ? 'El cronómetro está reservado para el responsable de la tarea'
                : 'Comenzar a cronometrar esta tarea',
          deshabilitado: terminada || Boolean(sesion) || !puedeCronometrar,
          onClick: () => accion(() => api.post('/sesiones/iniciar', { actividadId })),
        };

  /** Terminar: abre el cierre, donde se elige si queda completada o inconclusa. */
  const terminar: AccionContador = {
    texto: 'Terminar',
    titulo: enEstaTarea ? 'Cerrar la sesión de esta tarea' : 'Comienza la tarea para poder terminarla',
    deshabilitado: !enEstaTarea,
    onClick: () => setCerrando((v) => !v),
  };

  return (
    <Modal
      titulo={
        <span className="text-xl font-medium tracking-[-0.01em] text-white">{actividad.titulo}</span>
      }
      ancho="lg"
      claseVentana="tf-ventana-tarea"
      onCerrar={onCerrar}
      acciones={
        <>
          {botonAbrirAparte}
          {puedeEliminarNodo && (
            <button
              onClick={handleEliminarNodo}
              title="Eliminar nodo y subnodos"
              aria-label="Eliminar nodo y subnodos"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-rose-400 transition hover:border-rose-500/40 hover:bg-rose-500/10"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
        </>
      }
    >
      <ContadorTarea
        segundos={terminada && !enEstaTarea ? actividad.segundosTrabajados : enEstaTarea ? segundos : 0}
        detalle={`${
          { corriendo: 'Corriendo', pausado: 'En pausa', terminado: 'Terminada', ocupado: 'Detenido', detenido: 'Detenido' }[
            estadoContador
          ]
        } · total ${duracion(actividad.segundosTrabajados)}`}
        estado={estadoContador}
        principal={principal}
        terminar={terminar}
      />

      {cerrando && enEstaTarea && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="mb-2 text-xs font-medium text-slate-300">¿Cómo dejas la tarea?</p>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Nota de cierre (obligatoria si queda inconclusa)"
            className="mb-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#7f9dff]"
          />
          {!hayRespaldo && (
            <p className="mb-2 rounded-lg border border-[#7f9dff]/30 bg-[#3f6bff]/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-[#c9d4ff]">
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
        <p className="mt-3 text-center text-[11px] text-[#8fa0d0]">
          El cronómetro está reservado para {actividad.responsable?.nombreCompleto}. Puedes ver los comentarios y
          las evidencias.
        </p>
      )}
      {sesion && !enEstaTarea && (
        <p className="mt-3 text-center text-[11px] text-[#8fa0d0]">
          Tienes otra sesión abierta en «{sesion.actividad.titulo}». Ciérrala para cronometrar esta tarea.
        </p>
      )}

      {aviso && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {aviso}
        </p>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <ComentariosTarea actividad={actividad} onGuardadas={setActividad} />
          <ResponsableTarea
            actividad={actividad}
            puedeGestionar={puedeGestionar}
            onReasignada={async () => {
              await cargar();
              onCambio?.();
            }}
          />
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
    </Modal>
  );
}
