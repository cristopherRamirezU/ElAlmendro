'use client';

import { useEffect, useRef } from 'react';
import type { ProyectoItem } from '@/lib/api';
import { useTesoro } from '@/lib/tesoro';
import { fuenteEscena } from '@/lib/fuentes';

/** Con mas tareas que esto, cada segmento de la barra junta varias. */
const MAX_SEGMENTOS = 40;
/** Segmentos tenues que se muestran mientras el proyecto no tiene tareas. */
const SEGMENTOS_VACIA = 12;

/**
 * Avance del proyecto en su ventana de detalle: el % grande, el acceso al
 * mapa y una barra con un segmento por tarea. Los terminados llevan el
 * degradado de la marca y el siguiente tiene rayas que avanzan.
 *
 * Reemplaza al reloj de arena como "cofre": el reloj de cada tarea que se
 * termina vuela hasta el segmento siguiente, que se enciende. Por eso
 * registra ese segmento en el contexto del tesoro y avisa a la pantalla
 * cuando algo cambia (hay que volver a pedir los proyectos).
 */
export default function BandaAvance({
  proyecto,
  textoMapa,
  onIrAlMapa,
  onCambio,
}: {
  proyecto: ProyectoItem;
  textoMapa: string;
  onIrAlMapa: () => void;
  /** Se llama cuando algo cambia: la pantalla debe recargar sus datos. */
  onCambio?: () => void;
}) {
  const { registrarCofre, version } = useTesoro();
  const barra = useRef<HTMLDivElement>(null);
  const siguiente = useRef<HTMLDivElement>(null);
  const versionVista = useRef(version);

  const total = proyecto.totalTareas;
  const hechas = Math.min(proyecto.tareasCompletadas, total);
  const porcentaje = total > 0 ? Math.round((hechas / total) * 100) : 0;
  const segmentos = total > 0 ? Math.min(total, MAX_SEGMENTOS) : SEGMENTOS_VACIA;
  const llenos = total > 0 ? (hechas >= total ? segmentos : Math.floor((hechas / total) * segmentos)) : 0;
  // El segmento que sigue: ahi aterriza la proxima tarea terminada.
  const activo = total > 0 && hechas < total ? llenos : -1;

  useEffect(() => {
    registrarCofre(siguiente.current ?? barra.current);
    return () => registrarCofre(null);
  }, [registrarCofre, activo]);

  useEffect(() => {
    if (version === versionVista.current) return;
    versionVista.current = version;
    onCambio?.();
  }, [version, onCambio]);

  return (
    <section className={`${fuenteEscena.className} tf-banda-avance rounded-2xl p-5`}>
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <p className="text-[34px] font-light leading-none tracking-[-0.02em] text-white">
          {porcentaje}
          <span className="ml-0.5 text-base text-[#9fb0e0]">%</span>
        </p>
        <button type="button" onClick={onIrAlMapa} className="tf-boton-marca rounded-xl px-5 py-2.5 text-xs font-medium text-white">
          {textoMapa}
        </button>
      </div>
      <div
        ref={barra}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        aria-label={total > 0 ? `${hechas} de ${total} tareas terminadas` : 'Todavía no hay tareas'}
        className="flex gap-1"
      >
        {Array.from({ length: segmentos }, (_, i) => (
          <div
            key={i}
            ref={i === activo ? siguiente : undefined}
            className={`tf-segmento ${i < llenos ? 'tf-segmento-hecho' : i === activo ? 'tf-segmento-activo' : ''}`}
          />
        ))}
      </div>
    </section>
  );
}
