'use client';

import { useRef, useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { Actividad, api, ErrorApi } from '@/lib/api';
import { GRABACION_MAXIMA_SEGUNDOS, minutosSegundos, useGrabadora } from '@/lib/grabadora';
import { ReproductorComentarioVoz, ReproductorLocal } from './AudioComentario';

const LARGO_MAXIMO = 2000;

/**
 * Comentarios de la tarea: el texto que antes se llamaba "instrucciones" (la
 * descripcion de la tarea) y, si se quiere, un comentario de voz grabado con
 * el microfono. Todos lo leen y lo escuchan; quien creo la tarea o un
 * administrador pueden agregarlo o editarlo despues de crearla. Con el texto
 * vacio se quita el texto; el audio se quita con su propio boton.
 */
export default function ComentariosTarea({
  actividad,
  onGuardadas,
}: {
  actividad: Actividad;
  onGuardadas: (actualizada: Actividad) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  // El audio guardado se marca para quitar y se borra recien al Guardar.
  const [quitarAudio, setQuitarAudio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const botonEditar = useRef<HTMLButtonElement>(null);
  const grabadora = useGrabadora();
  const puedeEditar = actividad.puedeEditarInstrucciones === true;
  const tieneAudio = Boolean(actividad.audioComentario);
  const grabando = grabadora.estado !== 'inactiva';

  function abrir() {
    setTexto(actividad.descripcion ?? '');
    setQuitarAudio(false);
    grabadora.cancelar();
    setAviso(null);
    setEditando(true);
  }

  function cancelar() {
    grabadora.cancelar();
    setEditando(false);
    setAviso(null);
    // El foco vuelve al boton que abrio la edicion.
    requestAnimationFrame(() => botonEditar.current?.focus());
  }

  async function guardar() {
    if (grabando) return;
    setAviso(null);
    setGuardando(true);
    try {
      let actualizada = await api.patch<Actividad>(`/actividades/${actividad.id}/instrucciones`, {
        instrucciones: texto,
      });
      if (grabadora.grabacion) {
        const g = grabadora.grabacion;
        const extension = g.blob.type.includes('mp4') ? 'm4a' : g.blob.type.includes('ogg') ? 'ogg' : 'webm';
        const formulario = new FormData();
        formulario.append('segundos', String(g.segundos));
        formulario.append('audio', g.blob, `comentario.${extension}`);
        const audio = await api.subirArchivo<Pick<Actividad, 'audioComentario' | 'audioComentarioSegundos'>>(
          `/actividades/${actividad.id}/audio`,
          formulario,
        );
        actualizada = { ...actualizada, ...audio };
      } else if (quitarAudio && tieneAudio) {
        await api.delete(`/actividades/${actividad.id}/audio`);
        actualizada = { ...actualizada, audioComentario: null, audioComentarioSegundos: null };
      }
      grabadora.limpiar();
      onGuardadas(actualizada);
      setEditando(false);
      requestAnimationFrame(() => botonEditar.current?.focus());
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudieron guardar los comentarios.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-labelledby={`comentarios-${actividad.id}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3
          id={`comentarios-${actividad.id}`}
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8fa0d0]"
        >
          Comentarios
        </h3>
        {puedeEditar && !editando && (
          <button
            ref={botonEditar}
            onClick={abrir}
            className="text-[11px] font-semibold text-[#9fb4ff] hover:text-white"
          >
            {actividad.descripcion || tieneAudio ? '✎ Editar' : '+ Agregar'}
          </button>
        )}
      </div>

      {editando ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelar();
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                guardar();
              }
            }}
            rows={5}
            maxLength={LARGO_MAXIMO}
            aria-label="Comentarios de la tarea"
            placeholder="Qué hay que hacer, criterios de término, enlaces útiles…"
            className="w-full resize-y rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white placeholder-slate-500 outline-none focus:border-[#7f9dff]"
          />
          <p className="mb-2 mt-1 text-right text-[10px] tabular-nums text-slate-500">
            {texto.length} / {LARGO_MAXIMO}
          </p>

          <ComentarioDeVoz
            actividad={actividad}
            grabadora={grabadora}
            quitarAudio={quitarAudio}
            onQuitarAudio={setQuitarAudio}
            deshabilitado={guardando}
          />

          {aviso && (
            <p role="alert" className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-300">
              {aviso}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={guardando || grabando}
              title={grabando ? 'Detén la grabación antes de guardar' : undefined}
              className="tf-boton-marca flex-1 rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={cancelar}
              disabled={guardando}
              className="flex-1 rounded-lg border border-white/15 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : actividad.descripcion || tieneAudio ? (
        <div className="flex flex-col gap-2">
          {actividad.descripcion && (
            <p className="min-h-28 whitespace-pre-wrap break-words tf-vidrio rounded-2xl px-4 py-3 text-sm leading-relaxed text-slate-200">
              {actividad.descripcion}
            </p>
          )}
          {tieneAudio && (
            <ReproductorComentarioVoz
              actividadId={actividad.id}
              version={actividad.audioComentario!}
              segundos={actividad.audioComentarioSegundos}
            />
          )}
        </div>
      ) : (
        <p className="grid min-h-28 place-items-center rounded-2xl border border-dashed border-white/15 p-3 text-center text-xs text-slate-500">
          Sin comentarios.
        </p>
      )}
    </section>
  );
}

/**
 * Bloque de audio dentro del editor: grabar, escuchar lo grabado antes de
 * guardar, descartarlo, o quitar el audio que ya tenia la tarea.
 */
function ComentarioDeVoz({
  actividad,
  grabadora,
  quitarAudio,
  onQuitarAudio,
  deshabilitado,
}: {
  actividad: Actividad;
  grabadora: ReturnType<typeof useGrabadora>;
  quitarAudio: boolean;
  onQuitarAudio: (v: boolean) => void;
  deshabilitado: boolean;
}) {
  const { estado, segundos, grabacion, error, iniciar, detener, limpiar } = grabadora;
  const audioGuardado = Boolean(actividad.audioComentario) && !quitarAudio;

  return (
    <div className="mb-3 flex flex-col gap-2">
      {estado === 'grabando' ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2"
        >
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <span className="flex-1 text-xs text-rose-200">
            Grabando… <span className="tabular-nums">{minutosSegundos(segundos)}</span>
            <span className="text-rose-300/60"> / {minutosSegundos(GRABACION_MAXIMA_SEGUNDOS)}</span>
          </span>
          <button
            type="button"
            onClick={detener}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-rose-500"
          >
            <Square size={11} aria-hidden fill="currentColor" /> Detener
          </button>
        </div>
      ) : grabacion ? (
        <>
          <ReproductorLocal url={grabacion.url} segundos={grabacion.segundos} etiqueta="Nuevo comentario de voz (sin guardar)" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={iniciar}
              disabled={deshabilitado}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9fb4ff] hover:text-white disabled:opacity-50"
            >
              <Mic size={13} aria-hidden /> Grabar de nuevo
            </button>
            <button
              type="button"
              onClick={limpiar}
              disabled={deshabilitado}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-rose-300 disabled:opacity-50"
            >
              <Trash2 size={13} aria-hidden /> Descartar
            </button>
          </div>
        </>
      ) : (
        <>
          {audioGuardado && (
            <ReproductorComentarioVoz
              actividadId={actividad.id}
              version={actividad.audioComentario!}
              segundos={actividad.audioComentarioSegundos}
            />
          )}
          {quitarAudio && (
            <p className="text-[11px] text-amber-300">
              El comentario de voz se quitará al guardar.{' '}
              <button type="button" onClick={() => onQuitarAudio(false)} className="font-semibold underline">
                Deshacer
              </button>
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={iniciar}
              disabled={deshabilitado || estado === 'pidiendo'}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-50"
            >
              <Mic size={13} aria-hidden />
              {estado === 'pidiendo'
                ? 'Pidiendo micrófono…'
                : audioGuardado
                  ? 'Reemplazar comentario de voz'
                  : 'Grabar comentario de voz'}
            </button>
            {audioGuardado && (
              <button
                type="button"
                onClick={() => onQuitarAudio(true)}
                disabled={deshabilitado}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-rose-300 disabled:opacity-50"
              >
                <Trash2 size={13} aria-hidden /> Quitar audio
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
          {error}
        </p>
      )}
    </div>
  );
}
