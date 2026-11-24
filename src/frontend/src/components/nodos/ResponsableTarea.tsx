'use client';

import { useEffect, useState } from 'react';
import Selector from '@/components/ui/Selector';
import { Actividad, api, ErrorApi, PersonaRef } from '@/lib/api';
import { iniciales } from '@/lib/formato';

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
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-primario)] text-[11px] font-semibold text-[var(--tf-texto-primario)]"
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
          <p className="truncate text-sm text-[var(--tf-texto)]" title="Responsable">
            {actividad.responsable.nombreCompleto}
          </p>
        </div>
        {puedeGestionar && (
          <button
            onClick={() => setAbierto((v) => !v)}
            className="shrink-0 rounded-full border border-[var(--tf-borde)] px-3 py-1 text-[11px] font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
          >
            {abierto ? 'Cancelar' : 'Derivar'}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-3 flex flex-col gap-2">
          <Selector
            ariaLabel="Seleccionar nuevo responsable"
            placeholder="Derivar a…"
            buscable={candidatos.length > 5}
            placeholderBusqueda="Buscar persona…"
            valor={elegido}
            onChange={setElegido}
            disabled={ocupado}
            opciones={candidatos.map((p) => ({
              valor: p.id,
              etiqueta: p.nombre,
              inicialesAvatar: iniciales(p.nombre),
            }))}
          />
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={ocupado}
            maxLength={300}
            placeholder="Motivo (obligatorio)"
            className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 text-sm text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] outline-none focus:border-sky-400/50"
          />
          {aviso && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-[var(--tf-acento-rojo)]">
              {aviso}
            </p>
          )}
          <button
            onClick={derivar}
            disabled={ocupado || !elegido || !motivo.trim()}
            className="tf-boton-marca rounded-xl py-2 text-xs font-semibold text-[var(--tf-texto-primario)] disabled:opacity-50"
          >
            {ocupado ? 'Derivando…' : 'Confirmar derivacion'}
          </button>
        </div>
      )}
    </div>
  );
}
