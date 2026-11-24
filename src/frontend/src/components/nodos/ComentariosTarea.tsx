'use client';

import { useRef, useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import ModalConfirmacion from '@/components/ui/ModalConfirmacion';
import { Actividad, api, AudioComentario, ErrorApi } from '@/lib/api';
import { diaRelativo, hora, tiempoRelativo } from '@/lib/formato';
import { GRABACION_MAXIMA_SEGUNDOS, minutosSegundos, useGrabadora } from '@/lib/grabadora';
import { ReproductorComentarioVoz, ReproductorLocal } from './AudioComentario';

const LARGO_MAXIMO = 2000;

/**
 * Comentarios de la tarea: el texto que antes se llamaba "instrucciones" (la
 * descripcion de la tarea) y, debajo, los comentarios de voz.
 *
 * - El texto lo agrega o edita quien creo la tarea o un administrador; con el
 *   texto vacio se quita.
 * - Los comentarios de voz los graba quien trabaja la tarea (su responsable,
 *   quien la creo, supervisores y administradores). Cada uno queda con su
 *   autor y lo quita quien lo grabo o un administrador.
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
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const botonEditar = useRef<HTMLButtonElement>(null);
  const puedeEditar = actividad.puedeEditarInstrucciones === true;
  const audios = actividad.audios ?? [];

  function abrir() {
    setTexto(actividad.descripcion ?? '');
    setAviso(null);
    setEditando(true);
  }

  function cancelar() {
    setEditando(false);
    setAviso(null);
    // El foco vuelve al boton que abrio la edicion.
    requestAnimationFrame(() => botonEditar.current?.focus());
  }

  async function guardar() {
    setAviso(null);
    setGuardando(true);
    try {
      const actualizada = await api.patch<Actividad>(`/actividades/${actividad.id}/instrucciones`, {
        instrucciones: texto,
      });
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
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--tf-texto-tenue)]"
        >
          Comentarios
        </h3>
        {puedeEditar && !editando && (
          <button
            ref={botonEditar}
            onClick={abrir}
            className="text-[11px] font-semibold text-[var(--tf-acento-azul)] hover:opacity-80"
          >
            {actividad.descripcion ? '✎ Editar' : '+ Agregar'}
          </button>
        )}
      </div>

      {editando ? (
        <div className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-3">
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
            className="w-full resize-y rounded-lg border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-xs leading-relaxed text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] outline-none focus:border-[#7f9dff]"
          />
          <p className="mb-2 mt-1 text-right text-[10px] tabular-nums text-[var(--tf-texto-suave)]">
            {texto.length} / {LARGO_MAXIMO}
          </p>
          {aviso && (
            <p role="alert" className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-[var(--tf-acento-rojo)]">
              {aviso}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={guardando}
              className="tf-boton-marca flex-1 rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={cancelar}
              disabled={guardando}
              className="flex-1 rounded-lg border border-[var(--tf-borde)] py-2 text-xs font-semibold text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : actividad.descripcion ? (
        <p className="min-h-28 whitespace-pre-wrap break-words tf-vidrio rounded-2xl px-4 py-3 text-sm leading-relaxed text-[var(--tf-texto)]">
          {actividad.descripcion}
        </p>
      ) : audios.length === 0 ? (
        <p className="grid min-h-28 place-items-center rounded-2xl border border-dashed border-[var(--tf-borde-fuerte)] p-3 text-center text-xs text-[var(--tf-texto-suave)]">
          Sin comentarios.
        </p>
      ) : null}

      <ComentariosDeVoz actividad={actividad} onCambio={(lista) => onGuardadas({ ...actividad, audios: lista })} />
    </section>
  );
}

/** "20 nov, 14:05" en la zona de quien mira. */
function cuando(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Lista de comentarios de voz y la grabadora: grabar, escuchar lo grabado
 * antes de adjuntarlo, adjuntarlo o descartarlo.
 */
function ComentariosDeVoz({
  actividad,
  onCambio,
}: {
  actividad: Actividad;
  onCambio: (audios: AudioComentario[]) => void;
}) {
  const grabadora = useGrabadora();
  const { estado, segundos, grabacion, error, iniciar, detener, limpiar } = grabadora;
  const [enviando, setEnviando] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [audioPorEliminar, setAudioPorEliminar] = useState<AudioComentario | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const audios = actividad.audios ?? [];
  const puedeGrabar = actividad.puedeGrabarAudio === true;

  if (!puedeGrabar && audios.length === 0) return null;

  async function adjuntar() {
    if (!grabacion) return;
    setAviso(null);
    setEnviando(true);
    try {
      const extension = grabacion.blob.type.includes('mp4') ? 'm4a' : grabacion.blob.type.includes('ogg') ? 'ogg' : 'webm';
      const formulario = new FormData();
      formulario.append('segundos', String(grabacion.segundos));
      formulario.append('audio', grabacion.blob, `comentario.${extension}`);
      const nuevo = await api.subirArchivo<AudioComentario>(`/actividades/${actividad.id}/audios`, formulario);
      limpiar();
      onCambio([...audios, nuevo]);
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo adjuntar el audio.');
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarEliminarAudio() {
    if (!audioPorEliminar) return;
    const a = audioPorEliminar;
    setAviso(null);
    setBorrando(a.id);
    try {
      await api.delete(`/actividades/${actividad.id}/audios/${a.id}`);
      onCambio(audios.filter((x) => x.id !== a.id));
      setAudioPorEliminar(null);
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo quitar el audio.');
    } finally {
      setBorrando(null);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {audios.map((a) => (
        <div key={a.id} className="flex flex-col gap-1">
          <ReproductorComentarioVoz
            actividadId={actividad.id}
            audioId={a.id}
            segundos={a.segundos}
            etiqueta={`${a.autor.nombreCompleto} · ${tiempoRelativo(a.creadoEn)}`}
          />
          <span className="sr-only">{`${diaRelativo(a.creadoEn)} ${hora(a.creadoEn)}`}</span>
          {a.puedeEliminar && (
            <button
              type="button"
              onClick={() => setAudioPorEliminar(a)}
              disabled={borrando === a.id}
              className="flex items-center gap-1 self-end text-[10px] font-semibold text-[var(--tf-texto-suave)] hover:text-[var(--tf-acento-rojo)] disabled:opacity-50"
            >
              <Trash2 size={11} aria-hidden /> {borrando === a.id ? 'Quitando…' : 'Quitar'}
            </button>
          )}
        </div>
      ))}

      {puedeGrabar &&
        (estado === 'grabando' ? (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            <span className="flex-1 text-xs text-[var(--tf-acento-rojo)]">
              Grabando… <span className="tabular-nums">{minutosSegundos(segundos)}</span>
              <span className="opacity-70"> / {minutosSegundos(GRABACION_MAXIMA_SEGUNDOS)}</span>
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
          <div className="flex flex-col gap-2 rounded-xl border border-[#7f9dff]/30 bg-[#7f9dff]/5 p-2">
            <ReproductorLocal url={grabacion.url} segundos={grabacion.segundos} etiqueta="Escucha antes de adjuntar" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={adjuntar}
                disabled={enviando}
                className="tf-boton-marca flex-1 rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {enviando ? 'Adjuntando…' : 'Adjuntar audio'}
              </button>
              <button
                type="button"
                onClick={limpiar}
                disabled={enviando}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--tf-borde)] px-3 py-2 text-xs font-semibold text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-50"
              >
                <Trash2 size={13} aria-hidden /> Descartar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={iniciar}
            disabled={estado === 'pidiendo'}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--tf-borde)] px-3 py-2 text-[11px] font-semibold text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)] disabled:opacity-50"
          >
            <Mic size={13} aria-hidden />
            {estado === 'pidiendo' ? 'Pidiendo micrófono…' : 'Grabar comentario de voz'}
          </button>
        ))}

      {(error || aviso) && (
        <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-[var(--tf-acento-ambar)]">
          {error ?? aviso}
        </p>
      )}

      <ModalConfirmacion
        abierto={audioPorEliminar !== null}
        titulo="Quitar comentario de voz"
        descripcion={
          audioPorEliminar
            ? `¿Deseas eliminar el comentario de voz grabado por ${audioPorEliminar.autor.nombreCompleto}?`
            : ''
        }
        etiquetaConfirmar="Sí, quitar audio"
        ocupado={borrando !== null}
        onConfirmar={confirmarEliminarAudio}
        onCancelar={() => setAudioPorEliminar(null)}
      />
    </div>
  );
}
