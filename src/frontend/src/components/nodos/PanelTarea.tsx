'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Actividad, api, Evidencia, ErrorApi, Sesion, URL_API } from '@/lib/api';
import { cronometro, duracion, ESTADOS, PRIORIDADES } from '@/lib/formato';
import { PERMISOS } from '@/lib/rbac';
import { useSesion, useTienePermiso } from '@/lib/sesion';
import ResponsableTarea from './ResponsableTarea';
import InstruccionesTarea from './InstruccionesTarea';
import BolsaOro from '@/components/tesoro/BolsaOro';
import { llenadoDeBolsa, porcentajeLlenado } from '@/components/tesoro/llenado';
import { useTesoro } from '@/lib/tesoro';

/**
 * Detalle de una tarea del mapa de nodos: instrucciones, cronometraje
 * (comenzar, pausar, reanudar, terminar) y evidencias adjuntas. Ocupa el lugar de
 * "Derivaciones" mientras hay una tarea seleccionada.
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
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Adjunto que se esta por eliminar: la fila pide confirmacion ahi mismo.
  const [porEliminar, setPorEliminar] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [avisoAdjuntos, setAvisoAdjuntos] = useState<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const tituloAdjuntos = useRef<HTMLParagraphElement>(null);
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
    setPorEliminar(null);
    setAvisoAdjuntos(null);
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

  async function subirArchivo(archivo: File) {
    setAviso(null);
    setSubiendo(true);
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      formulario.append('actividadId', actividadId);
      await api.subirArchivo('/evidencias', formulario);
      setEvidencias(await api.get<Evidencia[]>(`/evidencias?actividadId=${actividadId}`));
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
      if (inputArchivo.current) inputArchivo.current.value = '';
    }
  }

  /** Desiste de eliminar: el foco vuelve al boton de basurero de esa fila. */
  function cancelarEliminar(id: string) {
    setPorEliminar(null);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-eliminar-adjunto="${id}"]`)?.focus(),
    );
  }

  /** Elimina un adjunto ya confirmado; si el servidor lo rechaza, dice por que. */
  async function eliminarAdjunto(id: string) {
    setAvisoAdjuntos(null);
    setEliminando(true);
    try {
      await api.delete(`/evidencias/${id}`);
      setPorEliminar(null);
      setEvidencias(await api.get<Evidencia[]>(`/evidencias?actividadId=${actividadId}`));
      // La fila desaparece: el foco pasa al titulo de la lista en vez de perderse.
      requestAnimationFrame(() => tituloAdjuntos.current?.focus());
    } catch (err) {
      setAvisoAdjuntos(err instanceof ErrorApi ? err.message : 'No se pudo eliminar el archivo.');
      // Si algo cambio mientras tanto (p. ej. la tarea se completo en otra
      // ventana), el panel completo se pone al dia y la fila vuelve a su estado.
      setPorEliminar(null);
      cargar().catch(() => undefined);
      requestAnimationFrame(() => tituloAdjuntos.current?.focus());
    } finally {
      setEliminando(false);
    }
  }

  if (!actividad) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 text-sm text-slate-500 backdrop-blur">
        Cargando tarea…
      </div>
    );
  }

  const estado = ESTADOS[actividad.estado] ?? ESTADOS.PENDIENTE;
  const enEstaTarea = sesion?.actividad.id === actividadId;
  const terminada = actividad.estado === 'COMPLETADA';
  const monedasListas = actividad.subtareas.filter((m) => m.completada).length;
  // El servidor exige respaldo para cerrar como completada; aqui se avisa
  // antes de intentarlo, porque despues ya no se pueden adjuntar archivos.
  const hayRespaldo = evidencias.length > 0;
  const llenadoBolsa = llenadoDeBolsa({
    estado: actividad.estado,
    monedas: actividad.subtareas.length,
    monedasListas,
  });

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-bold leading-snug text-white">{actividad.titulo}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {puedeEliminarNodo && (
            <button
              onClick={handleEliminarNodo}
              title="Eliminar nodo y subnodos"
              aria-label="Eliminar nodo y subnodos"
              className="grid h-7 w-7 place-items-center rounded-full border border-rose-500/40 text-rose-400 transition hover:bg-rose-500/10"
            >
              🗑️
            </button>
          )}
          <button
            onClick={() => abrirBolsa({ id: actividadId, titulo: actividad.titulo })}
            title="Abrir en una ventana flotante que puedes mover y minimizar"
            className="grid h-7 w-7 place-items-center rounded-full border border-amber-500/40 text-amber-300 transition hover:bg-amber-500/10"
          >
            ⤢
          </button>
          <button
            onClick={onCerrar}
            aria-label="Cerrar detalle"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-slate-400 transition hover:bg-white/5"
          >
            ×
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${estado.clase}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${estado.punto}`} />
          {estado.texto}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORIDADES[actividad.prioridad] ?? ''}`}
        >
          {actividad.prioridad}
        </span>
      </div>

      {/* La bolsa de esta tarea: se llena con sus monedas (microtareas). */}
      <button
        onClick={() => abrirBolsa({ id: actividadId, titulo: actividad.titulo })}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-left transition hover:bg-amber-500/10"
      >
        <BolsaOro llenado={llenadoBolsa} tamano={56} guardada={terminada} />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-amber-300">
            {porcentajeLlenado(llenadoBolsa)}%
          </span>
          <span className="block text-[11px] text-slate-400">
            {actividad.subtareas.length > 0
              ? `${monedasListas} de ${actividad.subtareas.length} monedas`
              : terminada
                ? 'Guardada en el cofre'
                : 'Sin monedas todavia'}
          </span>
          <span className="mt-0.5 block text-[10px] text-amber-300/70">
            Abrir en ventana flotante →
          </span>
        </span>
      </button>

      <InstruccionesTarea actividad={actividad} onGuardadas={setActividad} />

      {aviso && (
        <p role="alert" className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {aviso}
        </p>
      )}

      <ResponsableTarea
        actividad={actividad}
        puedeGestionar={puedeGestionar}
        onReasignada={async () => {
          await cargar();
          onCambio?.();
        }}
      />

      {/* ------------------------------ cronometro */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          {enEstaTarea
            ? sesion!.estado === 'ACTIVA'
              ? 'Cronometro en marcha'
              : 'Cronometro en pausa'
            : 'Cronometro detenido'}
        </p>
        <p className={`my-1 font-mono text-3xl font-bold tabular-nums ${enEstaTarea ? 'text-white' : 'text-slate-600'}`}>
          {cronometro(enEstaTarea ? segundos : 0)}
        </p>
        <p className="text-[11px] text-slate-400">
          Total acumulado: {duracion(actividad.segundosTrabajados)}
        </p>
      </div>

      {!sesion ? (
        (actividad.responsable?.id === usuarioActual?.id || puedeGestionar) ? (
          <button
            onClick={() => accion(() => api.post('/sesiones/iniciar', { actividadId }))}
            disabled={terminada}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Comenzar
          </button>
        ) : (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-center text-xs text-sky-200">
            <div className="font-semibold text-white mb-1">
              👤 Tarea asignada a: {actividad.responsable?.nombreCompleto}
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Como integrante del proyecto puedes visualizar los requerimientos, avances y archivos adjuntos. El inicio del cronómetro está reservado para el responsable asignado.
            </p>
          </div>
        )
      ) : !enEstaTarea ? (
        <p className="rounded-xl border border-dashed border-white/15 p-3 text-center text-xs text-slate-500">
          Tienes otra sesion abierta en &quot;{sesion.actividad.titulo}&quot;. Ciérrala para
          cronometrar esta tarea.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() =>
                accion(() =>
                  api.post(`/sesiones/${sesion.id}/${sesion.estado === 'ACTIVA' ? 'pausar' : 'reanudar'}`),
                )
              }
              className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
            >
              {sesion.estado === 'ACTIVA' ? 'Pausar' : 'Reanudar'}
            </button>
            <button
              onClick={() => setCerrando(true)}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Terminar
            </button>
          </div>

          {cerrando && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="mb-2 text-xs font-medium text-slate-300">Como dejas la tarea?</p>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Nota de cierre (obligatoria si queda inconclusa)"
                className="mb-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
              />
              {!hayRespaldo && (
                <p className="mb-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-sky-200">
                  Para darla por completada adjunta primero una evidencia del
                  trabajo hecho: despues del cierre ya no se aceptan archivos.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    accion(async () => {
                      await api.post(`/sesiones/${sesion.id}/cerrar`, {
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
                      : 'Adjunta una evidencia del trabajo hecho para poder completarla'
                  }
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Completada
                </button>
                <button
                  onClick={() =>
                    accion(async () => {
                      await api.post(`/sesiones/${sesion.id}/cerrar`, {
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
        </div>
      )}

      {/* ------------------------------ evidencias */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p
            ref={tituloAdjuntos}
            tabIndex={-1}
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 outline-none"
          >
            Archivos adjuntos
          </p>
          {!terminada && (
            <button
              onClick={() => inputArchivo.current?.click()}
              disabled={subiendo}
              className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 disabled:opacity-50"
            >
              {subiendo ? 'Subiendo…' : '+ Adjuntar'}
            </button>
          )}
          <input
            ref={inputArchivo}
            type="file"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) subirArchivo(archivo);
            }}
          />
        </div>

        {avisoAdjuntos && (
          <p role="alert" className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {avisoAdjuntos}
          </p>
        )}

        {evidencias.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-slate-500">
            {terminada ? 'Tarea completada sin archivos adjuntos.' : 'Sin archivos adjuntos.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {evidencias.map((ev) =>
              porEliminar === ev.id ? (
                <li
                  key={ev.id}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && !eliminando) cancelarEliminar(ev.id);
                  }}
                >
                  <p className="mb-2 text-rose-200">
                    ¿Eliminar <span className="font-semibold break-all">{ev.nombreArchivo}</span>? No se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => eliminarAdjunto(ev.id)}
                      disabled={eliminando}
                      className="flex-1 rounded-lg bg-rose-600 py-1.5 font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                    >
                      {eliminando ? 'Eliminando…' : 'Eliminar'}
                    </button>
                    <button
                      autoFocus
                      onClick={() => cancelarEliminar(ev.id)}
                      disabled={eliminando}
                      className="flex-1 rounded-lg border border-white/15 py-1.5 font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </li>
              ) : (
                <li key={ev.id} className="flex items-stretch gap-1.5">
                  <a
                    href={`${URL_API}/evidencias/${ev.id}/descargar`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
                  >
                    <span className="truncate">{ev.nombreArchivo}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                      {(ev.tamanoBytes / 1024).toFixed(0)} KB
                    </span>
                  </a>
                  {ev.puedeEliminar && !terminada && (
                    <button
                      onClick={() => {
                        setAvisoAdjuntos(null);
                        setPorEliminar(ev.id);
                      }}
                      data-eliminar-adjunto={ev.id}
                      aria-label={`Eliminar ${ev.nombreArchivo}`}
                      title="Eliminar archivo"
                      className="grid w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {/* ------------------------------ Eliminación de nodo (permiso actividades:eliminar) */}
      {puedeEliminarNodo && (
        <div className="mt-8 border-t border-white/10 pt-4">
          <button
            onClick={handleEliminarNodo}
            title="Eliminar este nodo y todas sus ramas hijas"
            className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 hover:text-white"
          >
            🗑️ Eliminar nodo y subnodos
          </button>
        </div>
      )}
    </div>
  );
}
