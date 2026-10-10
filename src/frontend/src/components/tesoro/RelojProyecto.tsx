'use client';

import { useEffect, useRef } from 'react';
import { ProyectoItem } from '@/lib/api';
import { useTesoro } from '@/lib/tesoro';
import RelojArena from './RelojArena';

/**
 * El reloj de arena del proyecto seleccionado: el reloj final, con columnas,
 * que se llena con las tareas terminadas. Es el destino al que vuela el reloj
 * de cada tarea al terminarla.
 *
 * Vive dentro del marco de la aplicacion, de modo que puede usar el contexto
 * del tesoro y avisar a la pantalla cuando algo cambia (una tarea terminada
 * cambia el avance del proyecto y hay que volver a pedir los proyectos).
 */
export default function RelojProyecto({
  proyecto,
  activo = true,
  onCambio,
}: {
  proyecto: ProyectoItem;
  /**
   * Si este reloj es el que se ve ahora mismo. Una pestana oculta sigue
   * montada, y un reloj invisible mide cero: registrarlo mandaria el vuelo
   * a la esquina de la pantalla.
   */
  activo?: boolean;
  /** Se llama cuando algo cambia: la pantalla debe recargar sus datos. */
  onCambio?: () => void;
}) {
  const { registrarCofre, version } = useTesoro();
  const caja = useRef<HTMLDivElement>(null);
  const versionVista = useRef(version);

  useEffect(() => {
    if (!activo) return;
    registrarCofre(caja.current);
    return () => registrarCofre(null);
  }, [registrarCofre, activo]);

  useEffect(() => {
    if (version === versionVista.current) return;
    versionVista.current = version;
    // Solo avisa el reloj visible: los dos estan montados (uno por pestana)
    // y de otro modo la pantalla recargaria dos veces por cada cambio.
    if (activo) onCambio?.();
  }, [version, onCambio, activo]);

  const total = proyecto.totalTareas;
  const terminadas = proyecto.tareasCompletadas;
  const llenado = total > 0 ? terminadas / total : 0;
  const porcentaje = Math.round(llenado * 100);

  return (
    <div className="mb-4 rounded-2xl border border-pink-500/20 bg-gradient-to-b from-pink-500/10 to-transparent p-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-300/70">
        Reloj del proyecto
      </p>

      <div ref={caja} className="mx-auto my-2 w-fit">
        <RelojArena variante="proyecto" llenado={llenado} tamano={104} terminado={total > 0 && llenado >= 1} />
      </div>

      <p className="text-3xl font-bold text-pink-300">{porcentaje}%</p>
      <p className="text-[11px] text-slate-400">
        {total === 0 ? 'Todavía no hay tareas' : `${terminadas} de ${total} tareas terminadas`}
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="tf-barra-brillo h-full rounded-full bg-gradient-to-r from-pink-600 to-pink-400 transition-[width] duration-700"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}
