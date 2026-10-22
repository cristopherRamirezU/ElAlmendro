'use client';

import { useEffect, useState } from 'react';
import { api, ErrorApi, MiembroProyecto, PersonaRef } from '@/lib/api';

/** Colores de los avatares: cada persona tiene siempre el mismo. */
const COLORES = ['#3f6bff', '#825aff', '#1d9e75', '#0ea5e9', '#d4537e', '#ba7517'];

function colorDe(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COLORES[Math.abs(h) % COLORES.length];
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/**
 * Equipo de un proyecto, compacto: en una fila, lo que va a la izquierda
 * (`children`, la descripcion en el detalle) y a la derecha los avatares de
 * quienes trabajan en el, con un "+" que despliega debajo la lista para ver
 * los nombres y, si se puede gestionar (administrador y supervisor), agregar
 * o quitar personas. Ser miembro es lo que hace que el proyecto aparezca en
 * "Mis proyectos" del trabajador.
 */
export default function EquipoProyecto({
  proyectoId,
  puedeGestionar,
  children,
}: {
  proyectoId: string;
  puedeGestionar: boolean;
  children?: React.ReactNode;
}) {
  const [miembros, setMiembros] = useState<MiembroProyecto[]>([]);
  const [personas, setPersonas] = useState<PersonaRef[]>([]);
  const [elegido, setElegido] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;
    setAviso(null);
    api
      .get<MiembroProyecto[]>(`/proyectos/${proyectoId}/miembros`)
      .then((m) => vigente && setMiembros(m))
      .catch(() => vigente && setAviso('No se pudo cargar el equipo.'));
    if (puedeGestionar) {
      api
        .get<PersonaRef[]>('/usuarios/trabajadores')
        .then((p) => vigente && setPersonas(p))
        .catch(() => undefined);
    }
    return () => {
      vigente = false;
    };
  }, [proyectoId, puedeGestionar]);

  const disponibles = personas.filter((p) => !miembros.some((m) => m.id === p.id));

  async function ejecutar(fn: () => Promise<MiembroProyecto[]>) {
    setAviso(null);
    setOcupado(true);
    try {
      setMiembros(await fn());
      setElegido('');
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo actualizar el equipo.');
    } finally {
      setOcupado(false);
    }
  }

  const rol = (m: MiembroProyecto) =>
    `${m.rolEnProyecto === 'LIDER' ? 'Líder del proyecto' : 'Miembro'}${m.activo ? '' : ' · desactivado'}`;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex shrink-0 items-center">
        {miembros.map((m, i) => (
          <span
            key={m.id}
            title={`${m.nombre} · ${rol(m)}`}
            className={`grid h-7 w-7 place-items-center rounded-full border-2 border-slate-900 text-[10px] font-semibold text-white ${
              i > 0 ? '-ml-2' : ''
            } ${m.activo ? '' : 'opacity-50'}`}
            style={{ background: colorDe(m.id) }}
          >
            {iniciales(m.nombre)}
          </span>
        ))}
        {(puedeGestionar || miembros.length > 0) && (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-label={puedeGestionar ? 'Ver y gestionar el equipo' : 'Ver el equipo'}
            title={puedeGestionar ? 'Equipo: agregar o quitar personas' : 'Ver el equipo'}
            className={`grid h-7 w-7 place-items-center rounded-full border-2 border-slate-900 text-sm leading-none transition ${
              miembros.length > 0 ? '-ml-2' : ''
            } ${abierto ? 'bg-[#3f6bff] text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
          >
            {puedeGestionar ? '+' : '…'}
          </button>
        )}
        </div>
      </div>

      {/* El detalle del equipo se despliega debajo, a todo lo ancho de la ventana. */}
      {abierto && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/60 p-2">
          {aviso && (
            <p role="alert" className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {aviso}
            </p>
          )}
          {miembros.length === 0 ? (
            <p className="p-2 text-center text-xs text-slate-500">Nadie asignado todavía.</p>
          ) : (
            <ul className="flex flex-col">
              {miembros.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white"
                    style={{ background: colorDe(m.id) }}
                  >
                    {iniciales(m.nombre)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{m.nombre}</span>
                  <span className="text-[11px] text-slate-400">{rol(m)}</span>
                  {puedeGestionar && m.rolEnProyecto !== 'LIDER' && (
                    <button
                      onClick={() =>
                        ejecutar(() => api.delete<MiembroProyecto[]>(`/proyectos/${proyectoId}/miembros/${m.id}`))
                      }
                      disabled={ocupado}
                      aria-label={`Quitar a ${m.nombre}`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 text-xs text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {puedeGestionar && (
            <div className="mt-1 flex gap-2 border-t border-white/10 px-1 pt-2">
              <select
                value={elegido}
                onChange={(e) => setElegido(e.target.value)}
                disabled={ocupado || disponibles.length === 0}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white outline-none focus:border-[#7f9dff]/60 disabled:opacity-50"
              >
                <option value="">{disponibles.length === 0 ? 'Todo el equipo ya está asignado' : 'Agregar persona…'}</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  ejecutar(() =>
                    api.post<MiembroProyecto[]>(`/proyectos/${proyectoId}/miembros`, {
                      usuarioId: elegido,
                    }),
                  )
                }
                disabled={ocupado || !elegido}
                className="tf-boton-marca shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Asignar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
