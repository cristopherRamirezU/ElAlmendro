'use client';

import { useEffect, useState } from 'react';
import { Actividad, api, ErrorApi, PersonaRef } from '@/lib/api';

/**
 * Responsable de la tarea. Todos lo ven; administrador y supervisor pueden
 * derivarla a otra persona (US-06). El motivo es obligatorio: queda en el
 * historial de derivaciones del mapa.
 */
export default function ResponsableTarea({
  actividad,
  puedeGestionar,
  onReasignada,
}: {
  actividad: Actividad;
  puedeGestionar: boolean;
  onReasignada: () => Promise<void> | void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [personas, setPersonas] = useState<PersonaRef[]>([]);
  const [elegido, setElegido] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || personas.length > 0) return;
    api
      .get<PersonaRef[]>('/usuarios/trabajadores')
      .then(setPersonas)
      .catch(() => setAviso('No se pudo cargar el equipo.'));
  }, [abierto, personas.length]);

  const candidatos = personas.filter((p) => p.id !== actividad.responsable.id);

  async function derivar() {
    setAviso(null);
    setOcupado(true);
    try {
      await api.patch(`/actividades/${actividad.id}/responsable`, {
        usuarioId: elegido,
        motivo,
      });
      setAbierto(false);
      setElegido('');
      setMotivo('');
      await onReasignada();
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo derivar la tarea.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="tf-vidrio rounded-2xl px-3 py-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#3f6bff] text-[11px] font-semibold text-white"
        >
          {actividad.responsable.nombreCompleto
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join('')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="sr-only">Responsable</p>
          <p className="truncate text-sm text-white" title="Responsable">
            {actividad.responsable.nombreCompleto}
          </p>
        </div>
        {puedeGestionar && (
          <button
            onClick={() => setAbierto((v) => !v)}
            className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            {abierto ? 'Cancelar' : 'Derivar'}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-3 flex flex-col gap-2">
          <select
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
            disabled={ocupado}
            className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50"
          >
            <option value="">Derivar a…</option>
            {candidatos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={ocupado}
            maxLength={300}
            placeholder="Motivo (obligatorio)"
            className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50"
          />
          {aviso && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {aviso}
            </p>
          )}
          <button
            onClick={derivar}
            disabled={ocupado || !elegido || !motivo.trim()}
            className="tf-boton-marca rounded-xl py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {ocupado ? 'Derivando…' : 'Confirmar derivacion'}
          </button>
        </div>
      )}
    </div>
  );
}
