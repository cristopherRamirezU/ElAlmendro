'use client';

import { useEffect, useRef } from 'react';
import { ProyectoItem } from '@/lib/api';
import { useTesoro } from '@/lib/tesoro';
import Cofre from './Cofre';

/**
 * El cofre del proyecto seleccionado: se llena con las tareas ya guardadas y
 * es el destino al que vuela cada bolsa terminada.
 *
 * Vive dentro del marco de la aplicacion, de modo que puede usar el contexto
 * del tesoro y avisar a la pantalla cuando algo cambia (una bolsa guardada
 * cambia el llenado del cofre y hay que volver a pedir los proyectos).
 */
export default function CofreProyecto({
  proyecto,
  activo = true,
  onCambio,
}: {
  proyecto: ProyectoItem;
  /**
   * Si este cofre es el que se ve ahora mismo. Una pestana oculta sigue
   * montada, y un cofre invisible mide cero: registrarlo mandaria la bolsa
   * a volar a la esquina de la pantalla.
   */
  activo?: boolean;
  /** Se llama cuando el tesoro cambia: la pantalla debe recargar sus datos. */
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
    // Solo avisa el cofre visible: los dos estan montados (uno por pestana)
    // y de otro modo la pantalla recargaria dos veces por cada cambio.
    if (activo) onCambio?.();
  }, [version, onCambio, activo]);

  const total = proyecto.totalTareas;
  const guardadas = proyecto.tareasCompletadas;
  const llenado = total > 0 ? guardadas / total : 0;
  const porcentaje = Math.round(llenado * 100);

  return (
    <div className="mb-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-transparent p-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/70">
        Cofre del proyecto
      </p>

      <div ref={caja} className="mx-auto my-1 w-fit">
        <Cofre llenado={llenado} tamano={164} />
      </div>

      <p className="text-3xl font-bold text-amber-300">{porcentaje}%</p>
      <p className="text-[11px] text-slate-400">
        {total === 0
          ? 'Todavía no hay bolsas que guardar'
          : `${guardadas} de ${total} bolsas guardadas`}
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="tf-barra-brillo h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-700"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}
