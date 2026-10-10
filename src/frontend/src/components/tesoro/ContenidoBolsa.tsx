'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Actividad, api, ErrorApi, Evidencia, Sesion, Subtarea, URL_API } from '@/lib/api';
import { duracion } from '@/lib/formato';
import RelojArena from './RelojArena';
import RelojRetro, { type BotonReloj, type EstadoReloj } from './RelojRetro';
import { llenadoDeBolsa, porcentajeLlenado } from './llenado';

/**
 * El panel de una tarea abierta: su reloj de arena, el reloj retro con el
 * cronometro y sus tres botones (comenzar, pausar, terminar), la evidencia y
 * la lista de objetivos.
 *
 * No depende del contexto del tesoro ni de donde se dibuje, porque se usa en
 * dos sitios: la ventana independiente del navegador y la pantalla suelta
 * `/bolsa/[id]`. Lo que necesita del exterior llega por props.
 */
export default function ContenidoBolsa({
  bolsaId,
  titulo,
  modo = 'completo',
  onCambio,
  onGuardada,
}: {
  bolsaId: string;
  titulo: string;
  /**
   * `completo` es el panel entero; `reloj` deja solo el reloj retro, para
   * cuando la ventana se encoge hasta ocupar nada.
   */
  modo?: 'completo' | 'reloj';
  /** Algo cambio: la vista de fondo deberia recargar. */
  onCambio?: () => void;
  /** La tarea se termino; recibe el recuadro de su reloj para animar el vuelo. */
  onGuardada?: (origen: DOMRect | null) => void;
}) {
  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const [segundos, setSegundos] = useState(0);
  const [nuevoObjetivo, setNuevoObjetivo] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'objetivos' | 'evidencia'>('objetivos');
  const relojRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const [a, s, ev] = await Promise.all([
      api.get<Actividad>(`/actividades/${bolsaId}`),
      api.get<Sesion | null>('/sesiones/activa'),
      api.get<Evidencia[]>(`/evidencias?actividadId=${bolsaId}`),
    ]);
    setActividad(a);
    setSesion(s);
    setEvidencias(ev);
    setSegundos(s?.actividad.id === bolsaId ? s.segundosAcumulados : 0);
  }, [bolsaId]);

  /**
   * Adjunta el respaldo del trabajo. Solo puede hacerse mientras la tarea
   * sigue abierta: una vez terminada, el servidor ya no acepta archivos nuevos.
   */
  async function adjuntar(f: File) {
    setAviso(null);
    setSubiendo(true);
    try {
      const formulario = new FormData();
      formulario.append('archivo', f);
      formulario.append('actividadId', bolsaId);
      await api.subirArchivo('/evidencias', formulario);
      setEvidencias(await api.get<Evidencia[]>(`/evidencias?actividadId=${bolsaId}`));
      onCambio?.();
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
      if (archivo.current) archivo.current.value = '';
    }
  }

  useEffect(() => {
    setAviso(null);
    cargar().catch(() => setAviso('No se pudo cargar la tarea.'));
  }, [cargar]);

  useEffect(() => {
    if (sesion?.actividad.id !== bolsaId || sesion.estado !== 'ACTIVA') return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [sesion, bolsaId]);

  async function accion(fn: () => Promise<unknown>) {
    setAviso(null);
    setOcupado(true);
    try {
      await fn();
      await cargar();
      onCambio?.();
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo completar la accion.');
    } finally {
      setOcupado(false);
    }
  }

  /** Marca o desmarca un objetivo sin esperar al servidor: el tacto manda. */
  async function alternarObjetivo(objetivo: Subtarea) {
    if (!actividad) return;
    const previo = actividad;
    setActividad({
      ...actividad,
      subtareas: actividad.subtareas.map((s) =>
        s.id === objetivo.id ? { ...s, completada: !s.completada } : s,
      ),
    });
    try {
      await api.patch(`/actividades/subtareas/${objetivo.id}`, { completada: !objetivo.completada });
      onCambio?.();
    } catch (err) {
      setActividad(previo);
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo marcar el objetivo.');
    }
  }

  async function agregarObjetivo() {
    const texto = nuevoObjetivo.trim();
    setNuevoObjetivo('');
    setAgregando(false);
    if (!texto) return;
    await accion(() => api.post(`/actividades/${bolsaId}/subtareas`, { titulo: texto }));
  }

  /**
   * Termina la tarea. Si el cronometro corre en ella se cierra la sesion como
   * completada —el tiempo no puede quedar abierto en una tarea terminada—; si
   * no, basta con cambiar el estado.
   */
  async function terminar() {
    const caja = relojRef.current?.getBoundingClientRect() ?? null;
    let bien = true;
    await accion(async () => {
      try {
        if (sesion && sesion.actividad.id === bolsaId) {
          await api.post(`/sesiones/${sesion.id}/cerrar`, { desenlace: 'COMPLETADA' });
        } else {
          await api.patch(`/actividades/${bolsaId}/estado`, { estado: 'COMPLETADA' });
        }
      } catch (err) {
        bien = false;
        throw err;
      }
    });
    if (bien) onGuardada?.(caja);
  }

  const objetivos = actividad?.subtareas ?? [];
  const listos = objetivos.filter((m) => m.completada).length;
  const terminada = actividad?.estado === 'COMPLETADA';
  const llenado = actividad
    ? llenadoDeBolsa({ estado: actividad.estado, monedas: objetivos.length, monedasListas: listos })
    : 0;
  const enEstaTarea = sesion?.actividad.id === bolsaId;
  const corriendo = enEstaTarea && sesion?.estado === 'ACTIVA';
  const pausada = enEstaTarea && !corriendo;
  // Sin respaldo no hay nada que comprobar: el servidor rechaza el cierre y
  // aqui el boton lo dice antes de intentarlo.
  const hayRespaldo = evidencias.length > 0;

  const estadoReloj: EstadoReloj = terminada
    ? 'terminado'
    : corriendo
      ? 'corriendo'
      : pausada
        ? 'pausado'
        : sesion
          ? 'ocupado'
          : 'detenido';

  // ----------------------------------------------- los tres botones del reloj

  /** Rojo izquierdo: comienza la tarea, o la reanuda si quedo en pausa. */
  const botonComenzar: BotonReloj = pausada
    ? {
        texto: 'Reanudar',
        titulo: 'Reanudar el cronómetro',
        deshabilitado: ocupado,
        onClick: () => accion(() => api.post(`/sesiones/${sesion!.id}/reanudar`)),
      }
    : {
        texto: 'Comenzar',
        titulo: terminada
          ? 'La tarea ya está terminada'
          : sesion && !enEstaTarea
            ? `El cronómetro está ocupado en «${sesion.actividad.titulo}»`
            : corriendo
              ? 'El cronómetro ya está corriendo'
              : 'Comenzar a cronometrar esta tarea',
        deshabilitado: ocupado || terminada || Boolean(sesion),
        onClick: () => accion(() => api.post('/sesiones/iniciar', { actividadId: bolsaId })),
      };

  /** Amarillo central: pausa el cronometro que corre. */
  const botonPausar: BotonReloj = {
    texto: 'Pausar',
    titulo: corriendo ? 'Pausar el cronómetro' : 'No hay cronómetro corriendo en esta tarea',
    deshabilitado: ocupado || !corriendo,
    onClick: () => accion(() => api.post(`/sesiones/${sesion!.id}/pausar`)),
  };

  /** Rojo derecho: termina la tarea (exige evidencia). */
  const botonTerminar: BotonReloj = {
    texto: 'Terminar',
    titulo: terminada
      ? 'La tarea ya está terminada'
      : !hayRespaldo
        ? 'Adjunta una evidencia del trabajo hecho para poder terminarla'
        : 'Terminar la tarea',
    deshabilitado: ocupado || terminada || !hayRespaldo,
    onClick: terminar,
  };

  const tiempo = enEstaTarea ? segundos : 0;

  // El componente sigue montado en los tres modos: el reloj no se reinicia
  // al encoger la ventana ni al volver a abrirla.

  if (modo === 'reloj') {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center p-2">
        <RelojRetro
          compacto
          segundos={tiempo}
          titulo={titulo}
          estado={estadoReloj}
          izquierda={botonComenzar}
          centro={botonPausar}
          derecha={botonTerminar}
        />
      </div>
    );
  }

  return (
    // Ocupa justo el alto de la ventana: cabecera, reloj y, abajo, las
    // pestanas de objetivos y evidencia en el espacio que queda. Si una lista
    // es larga, solo se desplaza esa zona; el reloj queda siempre a la vista.
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
      {/* Cabecera: el reloj de arena de la tarea junto a su nombre y avance. */}
      <div className="flex shrink-0 items-center gap-2.5">
        <div ref={relojRef} className="shrink-0">
          <RelojArena llenado={llenado} tamano={30} terminado={terminada} fluyendo={corriendo} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] text-slate-500">{actividad?.proyecto.nombre ?? ''}</p>
          <h2 className="truncate text-sm font-bold leading-snug text-white" title={titulo}>
            {titulo}
          </h2>
        </div>
        <span className="shrink-0 text-lg font-bold text-orange-300">{porcentajeLlenado(llenado)}%</span>
      </div>

      {aviso && (
        <p
          role="alert"
          className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-300"
        >
          {aviso}
        </p>
      )}

      <div className="shrink-0">
        <RelojRetro
          segundos={tiempo}
          titulo={titulo}
          estado={estadoReloj}
          avance={llenado}
          objetivos={objetivos.length > 0 ? `${listos}/${objetivos.length}` : undefined}
          total={duracion(actividad?.segundosTrabajados ?? 0)}
          izquierda={botonComenzar}
          centro={botonPausar}
          derecha={botonTerminar}
        />
      </div>

      {/* Un solo aviso de una linea, el que corresponda. */}
      {terminada ? (
        <p className="shrink-0 text-center text-[11px] text-emerald-200">
          Tarea terminada ·{' '}
          <button
            onClick={() =>
              accion(() => api.patch(`/actividades/${bolsaId}/estado`, { estado: 'EN_PROGRESO' }))
            }
            disabled={ocupado}
            className="font-medium text-slate-400 underline underline-offset-2 hover:text-slate-200 disabled:opacity-40"
          >
            reabrirla
          </button>
        </p>
      ) : sesion && !enEstaTarea ? (
        <p className="shrink-0 truncate text-center text-[11px] text-slate-400" title={sesion.actividad.titulo}>
          Cronómetro ocupado en «{sesion.actividad.titulo}»
        </p>
      ) : !hayRespaldo ? (
        <p className="shrink-0 text-center text-[11px] text-sky-200">
          Adjunta una evidencia para poder terminarla.
        </p>
      ) : null}

      {/* ------------------------------------------ pestanas */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div role="tablist" aria-label="Contenido de la tarea" className="flex shrink-0 border-b border-white/10">
          <Pestana activa={pestana === 'objetivos'} onClick={() => setPestana('objetivos')}>
            Objetivos
            <Contador>{objetivos.length > 0 ? `${listos}/${objetivos.length}` : '0'}</Contador>
          </Pestana>
          <Pestana activa={pestana === 'evidencia'} onClick={() => setPestana('evidencia')}>
            Evidencia
            <Contador alerta={!terminada && !hayRespaldo}>{evidencias.length}</Contador>
          </Pestana>
        </div>

        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-2.5">
          {pestana === 'objetivos' ? (
            <>
              {!terminada &&
                (agregando ? (
                  <input
                    autoFocus
                    value={nuevoObjetivo}
                    onChange={(e) => setNuevoObjetivo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') agregarObjetivo();
                      if (e.key === 'Escape') {
                        setNuevoObjetivo('');
                        setAgregando(false);
                      }
                    }}
                    onBlur={agregarObjetivo}
                    aria-label="Nuevo objetivo"
                    placeholder="Nuevo objetivo…"
                    className="mb-1.5 w-full rounded-lg border border-white/15 bg-slate-950/60 px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-orange-400/60"
                  />
                ) : (
                  <button
                    onClick={() => setAgregando(true)}
                    className="mb-1.5 w-full rounded-lg border border-dashed border-orange-400/30 py-1.5 text-[11px] font-semibold text-orange-300 transition hover:bg-orange-500/10"
                  >
                    + Agregar objetivo
                  </button>
                ))}

              {objetivos.length === 0 ? (
                <p className="px-2 py-2 text-center text-[11px] text-slate-500">
                  Cada objetivo es un paso pequeño de la tarea.
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {objetivos.map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => alternarObjetivo(m)}
                        disabled={terminada}
                        aria-pressed={m.completada}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5 disabled:opacity-60"
                      >
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] ${
                            m.completada
                              ? 'border-orange-400 bg-orange-400 text-slate-900'
                              : 'border-white/25 text-transparent'
                          }`}
                          aria-hidden
                        >
                          ✓
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate text-xs ${
                            m.completada ? 'text-slate-500 line-through' : 'text-slate-200'
                          }`}
                        >
                          {m.titulo}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              {!terminada && (
                <button
                  onClick={() => archivo.current?.click()}
                  disabled={subiendo}
                  className="mb-1.5 w-full rounded-lg border border-dashed border-sky-400/30 py-1.5 text-[11px] font-semibold text-sky-300 transition hover:bg-sky-500/10 disabled:opacity-50"
                >
                  {subiendo ? 'Subiendo…' : '+ Adjuntar archivo'}
                </button>
              )}
              <input
                ref={archivo}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) adjuntar(f);
                }}
              />

              {evidencias.length === 0 ? (
                <p className="px-2 py-2 text-center text-[11px] leading-relaxed text-slate-500">
                  {terminada
                    ? 'Esta tarea se cerró sin archivos adjuntos.'
                    : 'Sube una captura, un archivo o un informe. Después de terminarla ya no se pueden agregar.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {evidencias.map((ev) => (
                    <li key={ev.id}>
                      <a
                        href={`${URL_API}/evidencias/${ev.id}/descargar`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-200 transition hover:bg-white/10"
                      >
                        <span className="truncate">{ev.nombreArchivo}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                          {(ev.tamanoBytes / 1024).toFixed(0)} KB
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Pestana({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${
        activa
          ? 'border-b-2 border-orange-400 text-white'
          : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function Contador({ alerta = false, children }: { alerta?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold normal-case ${
        alerta ? 'bg-sky-500/20 text-sky-200' : 'bg-white/10 text-slate-300'
      }`}
    >
      {children}
    </span>
  );
}
