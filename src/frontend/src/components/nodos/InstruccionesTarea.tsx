'use client';

import { useRef, useState } from 'react';
import { Actividad, api, ErrorApi } from '@/lib/api';

const LARGO_MAXIMO = 2000;

/**
 * Instrucciones de la tarea (su descripcion). Todos las leen; quien creo la
 * tarea o un administrador pueden agregarlas o editarlas despues de crearla.
 * Con el texto vacio se quitan.
 */
export default function InstruccionesTarea({
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
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudieron guardar las instrucciones.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="mb-4" aria-labelledby={`instrucciones-${actividad.id}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3
          id={`instrucciones-${actividad.id}`}
          className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
        >
          Instrucciones
        </h3>
        {puedeEditar && !editando && (
          <button
            ref={botonEditar}
            onClick={abrir}
            className="text-[11px] font-semibold text-sky-300 hover:text-sky-200"
          >
            {actividad.descripcion ? 'Editar' : '+ Agregar'}
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
            aria-label="Instrucciones de la tarea"
            placeholder="Qué hay que hacer, criterios de término, enlaces útiles…"
            className="w-full resize-y rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white placeholder-slate-500 outline-none focus:border-sky-400"
          />
          <p className="mb-2 mt-1 text-right text-[10px] tabular-nums text-slate-500">
            {texto.length} / {LARGO_MAXIMO}
          </p>
          {aviso && (
            <p role="alert" className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-300">
              {aviso}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex-1 rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
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
      ) : actividad.descripcion ? (
        <p className="whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-slate-300">
          {actividad.descripcion}
        </p>
      ) : (
        <p className="rounded-xl border border-dashed border-white/15 p-3 text-center text-xs text-slate-500">
          Sin instrucciones.
        </p>
      )}
    </section>
  );
}
