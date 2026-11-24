'use client';

import { useEffect, useState } from 'react';
import Selector from '@/components/ui/Selector';
import { api, ErrorApi, MiembroProyecto, PersonaRef, UsuarioItem } from '@/lib/api';
import { colorAvatarDe, etiquetaRol, iniciales } from '@/lib/formato';
import { PERMISOS } from '@/lib/rbac';
import { useTienePermiso } from '@/lib/sesion';

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
  const [personas, setPersonas] = useState<(PersonaRef & { rol?: string })[]>([]);
  const [elegido, setElegido] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const puedeVerUsuarios = useTienePermiso(PERMISOS.USUARIOS_VER);

  useEffect(() => {
    let vigente = true;
    setAviso(null);
    api
      .get<MiembroProyecto[]>(`/proyectos/${proyectoId}/miembros`)
      .then((m) => vigente && setMiembros(m))
      .catch(() => vigente && setAviso('No se pudo cargar el equipo.'));
    if (puedeGestionar) {
      Promise.all([
        api.get<PersonaRef[]>('/usuarios/trabajadores'),
        puedeVerUsuarios
          ? api.get<UsuarioItem[]>('/usuarios').catch(() => [] as UsuarioItem[])
          : Promise.resolve([] as UsuarioItem[]),
      ])
        .then(([p, usuarios]) => {
          if (!vigente) return;
          const rolPorId = new Map(usuarios.map((u) => [u.id, u.rol]));
          setPersonas(p.map((item) => ({ ...item, rol: rolPorId.get(item.id) })));
        })
        .catch(() => undefined);
    }
    return () => {
      vigente = false;
    };
  }, [proyectoId, puedeGestionar, puedeVerUsuarios]);

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
            className={`grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--tf-superficie-solida)] text-[10px] font-semibold text-white ${
              i > 0 ? '-ml-2' : ''
            } ${m.activo ? '' : 'opacity-50'}`}
            style={{ background: colorAvatarDe(m.id) }}
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
            className={`grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--tf-superficie-solida)] text-sm leading-none transition ${
              miembros.length > 0 ? '-ml-2' : ''
            } ${abierto ? 'bg-[var(--color-primario)] text-[var(--tf-texto-primario)]' : 'bg-[var(--tf-hover)] text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-borde)] hover:text-[var(--tf-texto)]'}`}
          >
            {puedeGestionar ? '+' : '…'}
          </button>
        )}
        </div>
      </div>

      {/* El detalle del equipo se despliega debajo, a todo lo ancho de la ventana. */}
      {abierto && (
        <div className="mt-3 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-2">
          {aviso && (
            <p role="alert" className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-[var(--tf-acento-rojo)]">
              {aviso}
            </p>
          )}
          {miembros.length === 0 ? (
            <p className="p-2 text-center text-xs text-[var(--tf-texto-suave)]">Nadie asignado todavía.</p>
          ) : (
            <ul className="flex flex-col">
              {miembros.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white"
                    style={{ background: colorAvatarDe(m.id) }}
                  >
                    {iniciales(m.nombre)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--tf-texto)]">{m.nombre}</span>
                  <span className="text-[11px] text-[var(--tf-texto-tenue)]">{rol(m)}</span>
                  {puedeGestionar && m.rolEnProyecto !== 'LIDER' && (
                    <button
                      onClick={() =>
                        ejecutar(() => api.delete<MiembroProyecto[]>(`/proyectos/${proyectoId}/miembros/${m.id}`))
                      }
                      disabled={ocupado}
                      aria-label={`Quitar a ${m.nombre}`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--tf-borde)] text-xs text-[var(--tf-texto-tenue)] transition hover:border-rose-400/40 hover:text-[var(--tf-acento-rojo)] disabled:opacity-50"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {puedeGestionar && (
            <div className="mt-1 flex gap-2 border-t border-[var(--tf-borde)] px-1 pt-2">
              <Selector
                ariaLabel="Agregar persona al proyecto"
                forma="compacto"
                buscable={disponibles.length > 5}
                placeholderBusqueda="Buscar persona…"
                placeholder={disponibles.length === 0 ? 'Todo el equipo ya está asignado' : 'Agregar persona…'}
                disabled={ocupado || disponibles.length === 0}
                valor={elegido}
                onChange={setElegido}
                className="min-w-0 flex-1"
                opciones={disponibles.map((p) => ({
                  valor: p.id,
                  etiqueta: p.nombre,
                  subtitulo: p.rol ? etiquetaRol(p.rol) : undefined,
                  inicialesAvatar: iniciales(p.nombre),
                  colorAvatar: colorAvatarDe(p.id),
                }))}
              />
              <button
                onClick={() =>
                  ejecutar(() =>
                    api.post<MiembroProyecto[]>(`/proyectos/${proyectoId}/miembros`, {
                      usuarioId: elegido,
                    }),
                  )
                }
                disabled={ocupado || !elegido}
                className="tf-boton-marca shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--tf-texto-primario)] disabled:opacity-50"
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
