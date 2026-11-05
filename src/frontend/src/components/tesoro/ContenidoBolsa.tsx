'use client';

import { useCallback, useEffect, useState } from 'react';
import { Actividad, api, ErrorApi, Evidencia, Sesion, Subtarea } from '@/lib/api';
import { duracion } from '@/lib/formato';
import ContadorTarea, {
  TEXTO_ESTADO,
  type AccionContador,
  type EstadoContador,
} from '@/components/nodos/ContadorTarea';
import ZonaEvidencias from '@/components/nodos/ZonaEvidencias';
import { llenadoDeBolsa, porcentajeLlenado } from './llenado';

/**
 * La tarea en su ventana aparte, con el mismo diseno que su ventana del mapa
 * de nodos: el contador (comenzar, pausar, terminar) y, debajo, los objetivos
 * y las evidencias.
 *
 * No depende del contexto del tesoro ni de donde se dibuje, porque se usa en
 * dos sitios: la ventana independiente del navegador y la pantalla suelta
 * `/bolsa/[id]`. Lo que necesita del exterior llega por props.
 */
export default function ContenidoBolsa({
  bolsaId,
  titulo,
  modo = 'completo',
  acciones,
  onCambio,
  onGuardada,
}: {
  bolsaId: string;
  titulo: string;
  /**
   * `completo` es el panel entero; `reloj` deja solo el contador, para cuando
   * la ventana se encoge hasta ocupar nada.
   */
  modo?: 'completo' | 'reloj';
  /** Botones de la cabecera: encoger y cerrar la ventana. */
  acciones?: React.ReactNode;
  /** Algo cambio: la vista de fondo deberia recargar. */
  onCambio?: () => void;
  /** La tarea se termino. */
  onGuardada?: () => void;
}) {
  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [segundos, setSegundos] = useState(0);
  const [nuevoObjetivo, setNuevoObjetivo] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'objetivos' | 'evidencia'>('objetivos');

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
  async function terminarTarea() {
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
    if (bien) onGuardada?.();
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
        deshabilitado: ocupado,
        onClick: () => accion(() => api.post(`/sesiones/${sesion!.id}/pausar`)),
      }
    : pausada
      ? {
          texto: 'Reanudar',
          titulo: 'Reanudar el cronómetro',
          deshabilitado: ocupado,
          onClick: () => accion(() => api.post(`/sesiones/${sesion!.id}/reanudar`)),
        }
      : {
          texto: terminada ? 'Tarea terminada' : 'Comenzar',
          titulo: terminada
            ? 'La tarea ya está terminada'
            : sesion
              ? `El cronómetro está ocupado en «${sesion.actividad.titulo}»`
              : 'Comenzar a cronometrar esta tarea',
          deshabilitado: ocupado || terminada || Boolean(sesion),
          onClick: () => accion(() => api.post('/sesiones/iniciar', { actividadId: bolsaId })),
        };

  /** Termina la tarea (exige evidencia). */
  const terminar: AccionContador = {
    texto: 'Terminar',
    titulo: terminada
      ? 'La tarea ya está terminada'
      : !hayRespaldo
        ? 'Adjunta una evidencia del trabajo hecho para poder terminarla'
        : 'Terminar la tarea',
    deshabilitado: ocupado || terminada || !hayRespaldo,
    onClick: terminarTarea,
  };

  const contador = (
    <ContadorTarea
      compacto={modo === 'reloj'}
      segundos={terminada && !enEstaTarea ? (actividad?.segundosTrabajados ?? 0) : enEstaTarea ? segundos : 0}
      detalle={`${TEXTO_ESTADO[estadoContador]} · total ${duracion(actividad?.segundosTrabajados ?? 0)}`}
      estado={estadoContador}
      principal={principal}
      terminar={terminar}
    />
  );

  // El componente sigue montado en los dos modos: el contador no se reinicia
  // al encoger la ventana ni al volver a abrirla.

  if (modo === 'reloj') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-white" title={titulo}>
            {titulo}
          </h2>
          {acciones}
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center p-2.5">{contador}</div>
      </div>
    );
  }

  return (
    // Ocupa justo el alto de la ventana: cabecera, contador y, abajo, las
    // pestanas de objetivos y evidencia en el espacio que queda. Si una lista
    // es larga, solo se desplaza esa zona; el contador queda siempre a la vista.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-lg font-medium leading-snug tracking-[-0.01em] text-white"
            title={titulo}
          >
            {titulo}
          </h2>
          <p className="truncate text-[11px] text-[#8fa0d0]">
            {actividad?.proyecto.nombre ?? ''}
            {actividad ? ` · ${porcentajeLlenado(llenado)}%` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">{acciones}</div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="shrink-0">{contador}</div>

        {aviso && (
          <p
            role="alert"
            className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
          >
            {aviso}
          </p>
        )}

        {/* Un solo aviso de una linea, el que corresponda. */}
        {terminada ? (
          <p className="shrink-0 text-center text-[11px] text-[#8fa0d0]">
            Tarea terminada ·{' '}
            <button
              onClick={() =>
                accion(() => api.patch(`/actividades/${bolsaId}/estado`, { estado: 'EN_PROGRESO' }))
              }
              disabled={ocupado}
              className="font-semibold text-[#9fb4ff] hover:text-white disabled:opacity-40"
            >
              reabrirla
            </button>
          </p>
        ) : sesion && !enEstaTarea ? (
          <p className="shrink-0 truncate text-center text-[11px] text-[#8fa0d0]" title={sesion.actividad.titulo}>
            Cronómetro ocupado en «{sesion.actividad.titulo}»
          </p>
        ) : !hayRespaldo ? (
          <p className="shrink-0 text-center text-[11px] text-[#8fa0d0]">
            Adjunta una evidencia para poder terminarla.
          </p>
        ) : null}

        {/* ------------------------------------------ pestanas */}
        <div className="tf-vidrio flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <div role="tablist" aria-label="Contenido de la tarea" className="flex shrink-0 border-b border-white/10">
            <Pestana activa={pestana === 'objetivos'} onClick={() => setPestana('objetivos')}>
              Objetivos
              <Contador>{objetivos.length > 0 ? `${listos}/${objetivos.length}` : '0'}</Contador>
            </Pestana>
            <Pestana activa={pestana === 'evidencia'} onClick={() => setPestana('evidencia')}>
              Evidencia
              <Contador>{evidencias.length}</Contador>
            </Pestana>
          </div>

          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-3">
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
                      className="mb-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#7f9dff]"
                    />
                  ) : (
                    <button
                      onClick={() => setAgregando(true)}
                      className="mb-2 w-full rounded-lg border border-dashed border-white/15 py-2 text-[11px] font-semibold text-[#9fb4ff] transition hover:bg-white/5 hover:text-white"
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
                                ? 'border-[#7f9dff] bg-[#7f9dff] text-slate-900'
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
              <ZonaEvidencias
                actividadId={bolsaId}
                evidencias={evidencias}
                terminada={terminada}
                onCambio={(lista) => {
                  setEvidencias(lista);
                  onCambio?.();
                }}
                onRecargar={cargar}
              />
            )}
          </div>
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
      className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
        activa ? 'border-[#7f9dff] text-white' : 'border-transparent text-[#8fa0d0] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Contador({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-slate-300">
      {children}
    </span>
  );
}
