'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Actividad, api, ErrorApi, Evidencia, Sesion, Subtarea, URL_API } from '@/lib/api';
import { cronometro, duracion } from '@/lib/formato';
import BolsaOro from './BolsaOro';
import { llenadoDeBolsa, porcentajeLlenado } from './llenado';

/**
 * El panel de una bolsa: su llenado, el cronometro, las acciones y la lista
 * de monedas.
 *
 * No depende del contexto del tesoro ni de donde se dibuje, porque se usa en
 * tres sitios: la ventana flotante de la propia pagina, la ventana
 * independiente del navegador y la pantalla suelta `/bolsa/[id]`. Lo que
 * necesita del exterior llega por props.
 */
export default function ContenidoBolsa({
  bolsaId,
  titulo,
  modo = 'completo',
  onExpandir,
  onCambio,
  onGuardada,
}: {
  bolsaId: string;
  titulo: string;
  /**
   * `completo` es el panel entero; `barra` una pastilla de una linea con el
   * cronometro; `reloj` deja solo el cronometro, para cuando la ventana se
   * encoge hasta ocupar nada.
   */
  modo?: 'completo' | 'barra' | 'reloj';
  onExpandir?: () => void;
  /** El tesoro cambio: la vista de fondo deberia recargar. */
  onCambio?: () => void;
  /** La bolsa se guardo; recibe el recuadro que ocupaba para animar el vuelo. */
  onGuardada?: (origen: DOMRect | null) => void;
}) {
  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const [segundos, setSegundos] = useState(0);
  const [nuevaMoneda, setNuevaMoneda] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const bolsaRef = useRef<HTMLDivElement>(null);

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
   * sigue abierta: una vez guardada en el cofre, el servidor ya no acepta
   * archivos nuevos.
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
    cargar().catch(() => setAviso('No se pudo cargar la bolsa.'));
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

  /** Marca o desmarca una moneda sin esperar al servidor: el tacto manda. */
  async function alternarMoneda(moneda: Subtarea) {
    if (!actividad) return;
    const previo = actividad;
    setActividad({
      ...actividad,
      subtareas: actividad.subtareas.map((s) =>
        s.id === moneda.id ? { ...s, completada: !s.completada } : s,
      ),
    });
    try {
      await api.patch(`/actividades/subtareas/${moneda.id}`, { completada: !moneda.completada });
      onCambio?.();
    } catch (err) {
      setActividad(previo);
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo marcar la moneda.');
    }
  }

  async function agregarMoneda() {
    const titulo = nuevaMoneda.trim();
    setNuevaMoneda('');
    setAgregando(false);
    if (!titulo) return;
    await accion(() => api.post(`/actividades/${bolsaId}/subtareas`, { titulo }));
  }

  /**
   * Guarda la bolsa en el cofre. Si el cronometro corre en esta tarea se
   * cierra la sesion como completada —el tiempo no puede quedar abierto en
   * una tarea terminada—; si no, basta con cambiar el estado.
   */
  async function guardarEnCofre() {
    const caja = bolsaRef.current?.getBoundingClientRect() ?? null;
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

  const monedas = actividad?.subtareas ?? [];
  const listas = monedas.filter((m) => m.completada).length;
  const guardada = actividad?.estado === 'COMPLETADA';
  const llenado = actividad
    ? llenadoDeBolsa({ estado: actividad.estado, monedas: monedas.length, monedasListas: listas })
    : 0;
  const enEstaBolsa = sesion?.actividad.id === bolsaId;
  const corriendo = enEstaBolsa && sesion?.estado === 'ACTIVA';
  const todoListo = monedas.length > 0 && listas === monedas.length;
  // Sin respaldo no hay nada que comprobar: el servidor rechaza el cierre y
  // aqui el boton lo dice antes de intentarlo.
  const hayRespaldo = evidencias.length > 0;

  // El componente sigue montado en los tres modos: el reloj no se reinicia
  // al encoger la ventana ni al volver a abrirla.

  if (modo === 'reloj') {
    return (
      <div className="flex h-full min-h-[7rem] flex-col items-center justify-center gap-1 px-3 py-2">
        <p className="flex w-full items-center justify-center gap-2 truncate text-[10px] text-slate-500">
          {corriendo && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
          <span className="truncate">{titulo}</span>
        </p>
        <p
          className={`font-mono text-[2.6rem] font-bold leading-none tabular-nums ${
            corriendo ? 'text-amber-300' : 'text-slate-400'
          }`}
        >
          {cronometro(enEstaBolsa ? segundos : 0)}
        </p>
        {enEstaBolsa && !guardada ? (
          <button
            onClick={() =>
              accion(() => api.post(`/sesiones/${sesion!.id}/${corriendo ? 'pausar' : 'reanudar'}`))
            }
            disabled={ocupado}
            className="mt-1 rounded-lg border border-white/15 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
          >
            {corriendo ? 'Pausar' : 'Reanudar'}
          </button>
        ) : (
          <button
            onClick={onExpandir}
            className="mt-1 text-[11px] font-medium text-amber-300/80 transition hover:text-amber-200"
          >
            Ver la bolsa
          </button>
        )}
      </div>
    );
  }

  if (modo === 'barra') {
    return (
      <button
        onClick={onExpandir}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-white/5"
      >
        <BolsaOro llenado={llenado} tamano={34} guardada={guardada} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-white">{titulo}</span>
          <span
            className={`block font-mono text-sm tabular-nums ${corriendo ? 'text-amber-300' : 'text-slate-500'}`}
          >
            {cronometro(enEstaBolsa ? segundos : 0)}
          </span>
        </span>
        {corriendo && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />}
      </button>
    );
  }

  return (
    <div className="p-4">
      <p className="truncate text-[11px] text-slate-500">{actividad?.proyecto.nombre ?? ''}</p>
      <h2 className="mb-3 text-base font-bold leading-snug text-white">{titulo}</h2>

      {aviso && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300"
        >
          {aviso}
        </p>
      )}

      <div className="mb-3 flex flex-col items-center">
        <div ref={bolsaRef}>
          <BolsaOro llenado={llenado} tamano={104} guardada={guardada} />
        </div>
        <p className="mt-1 text-2xl font-bold text-amber-300">{porcentajeLlenado(llenado)}%</p>
        <p className="text-[11px] text-slate-400">
          {monedas.length > 0
            ? `${listas} / ${monedas.length} monedas`
            : guardada
              ? 'Tarea completada'
              : 'Sin monedas: divide la tarea en pasos'}
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
        <p
          className={`font-mono text-2xl font-bold tabular-nums ${enEstaBolsa ? 'text-white' : 'text-slate-600'}`}
        >
          {cronometro(enEstaBolsa ? segundos : 0)}
        </p>
        <p className="text-[10px] text-slate-500">
          Acumulado: {duracion(actividad?.segundosTrabajados ?? 0)}
        </p>
      </div>

      {!guardada && (
        <div className="mb-3 flex gap-2">
          {!sesion ? (
            <button
              onClick={() => accion(() => api.post('/sesiones/iniciar', { actividadId: bolsaId }))}
              disabled={ocupado}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
            >
              Comenzar
            </button>
          ) : enEstaBolsa ? (
            <button
              onClick={() =>
                accion(() => api.post(`/sesiones/${sesion.id}/${corriendo ? 'pausar' : 'reanudar'}`))
              }
              disabled={ocupado}
              className="flex-1 rounded-xl border border-white/15 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
            >
              {corriendo ? 'Pausar' : 'Reanudar'}
            </button>
          ) : (
            <p className="flex-1 rounded-xl border border-dashed border-white/15 px-2 py-2 text-center text-[10px] text-slate-500">
              Cronometro ocupado en &quot;{sesion.actividad.titulo}&quot;
            </p>
          )}

          <button
            onClick={guardarEnCofre}
            disabled={ocupado || !hayRespaldo}
            title={
              !hayRespaldo
                ? 'Adjunta una evidencia del trabajo hecho para poder guardarla'
                : todoListo
                  ? 'Guardar la bolsa en el cofre del proyecto'
                  : 'Puedes guardarla aunque queden monedas sueltas'
            }
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              todoListo && hayRespaldo
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400'
                : 'border border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            Guardar en el cofre
          </button>
        </div>
      )}

      {!guardada && !hayRespaldo && (
        <p className="mb-3 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-[11px] leading-relaxed text-sky-200">
          Para guardar esta bolsa hay que dejar constancia del trabajo: adjunta
          al menos una evidencia. Despues de guardarla ya no se pueden agregar.
        </p>
      )}

      {guardada && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-amber-200">
            Esta bolsa ya esta en el cofre del proyecto.
          </p>
          <button
            onClick={() =>
              accion(() => api.patch(`/actividades/${bolsaId}/estado`, { estado: 'EN_PROGRESO' }))
            }
            disabled={ocupado}
            className="mt-1 text-[11px] font-medium text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline disabled:opacity-40"
          >
            Sacarla para seguir trabajandola
          </button>
        </div>
      )}

      {/* ------------------------------------------------- evidencias */}
      <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Evidencia del trabajo
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                hayRespaldo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'
              }`}
            >
              {evidencias.length}
            </span>
          </p>
          {!guardada && (
            <button
              onClick={() => archivo.current?.click()}
              disabled={subiendo}
              className="text-[11px] font-semibold text-sky-300 transition hover:text-sky-200 disabled:opacity-50"
            >
              {subiendo ? 'Subiendo…' : '+ Adjuntar'}
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
        </div>

        {evidencias.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-center text-[11px] text-slate-500">
            {guardada
              ? 'Esta tarea se cerro sin archivos adjuntos.'
              : 'Sin respaldo todavia. Sube una captura, un archivo o un informe.'}
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
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Monedas de esta bolsa
        </p>
        {!guardada && (
          <button
            onClick={() => setAgregando(true)}
            className="text-base leading-none text-amber-300 transition hover:text-amber-200"
            title="Agregar moneda"
          >
            +
          </button>
        )}
      </div>

      {agregando && (
        <input
          autoFocus
          value={nuevaMoneda}
          onChange={(e) => setNuevaMoneda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') agregarMoneda();
            if (e.key === 'Escape') {
              setNuevaMoneda('');
              setAgregando(false);
            }
          }}
          onBlur={agregarMoneda}
          placeholder="Nueva moneda…"
          className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-amber-400/60"
        />
      )}

      {monedas.length === 0 && !agregando ? (
        <p className="mt-2 rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[11px] text-slate-500">
          Cada moneda es un paso pequeno. Agrega la primera.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {monedas.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => alternarMoneda(m)}
                disabled={guardada}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5 disabled:opacity-60"
              >
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] ${
                    m.completada
                      ? 'border-amber-400 bg-amber-400 text-slate-900'
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
    </div>
  );
}
