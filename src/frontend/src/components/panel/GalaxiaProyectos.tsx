'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProyectoItem } from '@/lib/api';
import { fuenteTitulo } from '@/lib/fuentes';
import { useSesion } from '@/lib/sesion';
import RelojArena from '@/components/tesoro/RelojArena';
import { ANCHO_TARJETA, EscenaEspacial, type ModoEscena, type Mundo, planetasDeMundo } from './escenaEspacial';

/** Un proyecto esta completado si se cerro o si todas sus tareas terminaron. */
export function proyectoCompletado(p: ProyectoItem) {
  return p.estado === 'CERRADO' || (p.totalTareas > 0 && p.tareasCompletadas >= p.totalTareas);
}

const CLAVE_MOVIMIENTO = 'tf_galaxia_movimiento';

const avance = (p: ProyectoItem) => (p.totalTareas > 0 ? Math.round((p.tareasCompletadas / p.totalTareas) * 100) : 0);

const GALAXIAS: Record<
  Mundo,
  { titulo: string; detalle: string; borde: string; sombra: string; fondo: string; icono: string; acento: string }
> = {
  proceso: {
    titulo: 'EN PROCESO',
    detalle: 'Proyectos activos',
    borde: 'rgba(110,150,255,0.6)',
    sombra: '0 0 18px rgba(80,120,255,0.28)',
    fondo: 'rgba(10,16,34,0.8)',
    icono: '#3f6bff',
    acento: '#ff5aa0',
  },
  completados: {
    titulo: 'COMPLETADOS',
    detalle: 'Historial de proyectos',
    borde: 'rgba(60,220,170,0.6)',
    sombra: '0 0 18px rgba(40,220,160,0.25)',
    fondo: 'rgba(8,24,24,0.8)',
    icono: '#1fbf86',
    acento: '#34e3b4',
  },
};

/**
 * Panel de proyectos como mapa espacial: dos galaxias (en proceso y
 * completados) alrededor del sol de la empresa. Al elegir una, la camara viaja
 * hasta ella y sus proyectos aparecen como planetas alrededor del sol, cada
 * uno con su tarjeta (nombre, reloj de arena y avance), acomodados para que
 * no se encimen. Con "Movimiento" encendido orbitan; apagado, quedan quietos.
 * Tocar un planeta o su tarjeta abre el proyecto.
 */
export default function GalaxiaProyectos({
  proyectos,
  seleccionado,
  onElegir,
  onCrear,
}: {
  proyectos: ProyectoItem[];
  /** Proyecto abierto ahora: su planeta lleva el halo dorado. */
  seleccionado: string | null;
  onElegir: (id: string) => void;
  onCrear: () => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<EscenaEspacial | null>(null);
  const [modo, setModo] = useState<ModoEscena>('overview');
  const [mundo, setMundo] = useState<Mundo>('proceso');
  // Movimiento de los planetas: encendido de entrada; la eleccion se
  // recuerda en este navegador.
  const [movimiento, setMovimiento] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_MOVIMIENTO) === 'no') setMovimiento(false);
    } catch {
      /* almacenamiento bloqueado: queda encendido */
    }
  }, []);
  function alternarMovimiento() {
    setMovimiento((v) => {
      try {
        window.localStorage.setItem(CLAVE_MOVIMIENTO, v ? 'no' : 'si');
      } catch {
        /* sin persistencia, pero el cambio aplica igual */
      }
      return !v;
    });
  }
  // El sol lleva el nombre de la empresa de quien mira.
  const nombreEmpresa = useSesion()?.organizacionNombre || 'Empresa';

  const porMundo = useMemo(() => {
    const proceso = proyectos.filter((p) => !proyectoCompletado(p));
    const completados = proyectos.filter(proyectoCompletado);
    return { proceso, completados };
  }, [proyectos]);

  // El motor se crea una vez: genera galaxias y planetas y anima por su cuenta.
  useEffect(() => {
    if (!raiz.current || !lienzo.current) return;
    const motor = new EscenaEspacial(raiz.current, lienzo.current, {
      fuente: fuenteTitulo.style.fontFamily,
      alCambiarModo: (m, w) => {
        setModo(m);
        setMundo(w);
      },
    });
    escena.current = motor;
    return () => {
      motor.destruir();
      escena.current = null;
    };
  }, []);

  useEffect(() => {
    escena.current?.setDatos({
      proceso: planetasDeMundo(porMundo.proceso.map((p) => p.id), 'proceso'),
      completados: planetasDeMundo(porMundo.completados.map((p) => p.id), 'completados'),
    });
  }, [porMundo]);

  useEffect(() => {
    if (escena.current) escena.current.seleccionado = seleccionado;
  }, [seleccionado]);

  useEffect(() => {
    if (escena.current) escena.current.nombreEmpresa = nombreEmpresa;
  }, [nombreEmpresa]);

  useEffect(() => {
    if (escena.current) escena.current.movimiento = movimiento;
  }, [movimiento]);

  // Tras cada pintado de React las tarjetas pueden ser otras: el motor las
  // vuelve a buscar para seguir moviendolas.
  useEffect(() => {
    escena.current?.refrescarDom();
  });

  const abrir = (w: Mundo) => (e: React.MouseEvent) => {
    e.stopPropagation();
    escena.current?.abrir(w);
  };
  const hover = (w: Mundo | null) => () => {
    if (escena.current) escena.current.hover = w;
  };
  const elegir = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onElegir(id);
  };

  const visibles = modo === 'system' ? porMundo[mundo] : [];
  const g = GALAXIAS[mundo];

  return (
    <div
      ref={raiz}
      className="relative h-[max(30rem,calc(100vh-17rem))] select-none overflow-hidden rounded-2xl border border-white/10 bg-[#04060d] text-[#e8ecf8]"
    >
      <canvas ref={lienzo} aria-hidden className="pointer-events-none absolute inset-0 block h-full w-full" />

      {/* --------------------------------------------- galaxias (mapa) */}
      {(['proceso', 'completados'] as Mundo[]).map((w) => (
        <button
          key={`hit-${w}`}
          data-ghit={w}
          onClick={abrir(w)}
          onMouseEnter={hover(w)}
          onMouseLeave={hover(null)}
          aria-label={`Abrir la galaxia ${GALAXIAS[w].titulo.toLowerCase()}`}
          className="absolute left-0 top-0 z-[2] rounded-full p-0"
          style={{ transform: 'translate(-9999px,0)', pointerEvents: 'none' }}
        />
      ))}
      {(['proceso', 'completados'] as Mundo[]).map((w) => {
        const d = GALAXIAS[w];
        return (
          <div
            key={`chip-${w}`}
            data-gchip={w}
            className="absolute left-0 top-0 z-[3]"
            style={{ transform: 'translate(-9999px,0)', pointerEvents: 'none' }}
          >
            <button
              onClick={abrir(w)}
              onMouseEnter={hover(w)}
              onMouseLeave={hover(null)}
              className="flex items-center gap-2.5 rounded-[10px] py-[7px] pl-2.5 pr-[9px] text-[#eef2ff]"
              style={{ background: d.fondo, border: `1px solid ${d.borde}`, boxShadow: d.sombra }}
            >
              <span className="grid h-6 w-6 place-items-center rounded-[7px]" style={{ background: d.icono }}>
                {w === 'proceso' ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M2 10 L10 2 M5 2 H10 V7" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M2.5 6.2 L5 8.6 L9.6 3.6" stroke="#fff" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="flex flex-col items-start gap-px">
                <span className="text-[11px] font-extrabold tracking-[0.05em]">{d.titulo}</span>
                <span className="text-[10px] text-[#93a0c4]">{d.detalle}</span>
              </span>
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-white/10 text-[10.5px] font-bold">
                {porMundo[w].length}
              </span>
            </button>
          </div>
        );
      })}

      {/* --------------------------------------- planetas y sus tarjetas */}
      {visibles.map((p) => {
        const pct = avance(p);
        const elegido = seleccionado === p.id;
        return (
          <div key={p.id}>
            <button
              data-hit={p.id}
              onClick={elegir(p.id)}
              aria-label={`Abrir el proyecto ${p.nombre}`}
              className="absolute left-0 top-0 z-[3] h-14 w-14 rounded-full p-0"
              style={{ transform: 'translate(-9999px,0)' }}
            />
            <div
              data-card={p.id}
              onClick={elegir(p.id)}
              className="absolute left-0 top-0 z-[4] cursor-pointer hover:z-[5]"
              style={{ width: ANCHO_TARJETA, transform: 'translate(-9999px,0)', opacity: 0 }}
            >
              {/* Misma insignia que el nodo principal del mapa: borde de luz que gira. */}
              <div
                className="tf-insignia-marco"
                style={{
                  borderRadius: 14,
                  ...(elegido ? { boxShadow: '0 0 0 2px rgba(255,196,92,.8), 0 0 26px rgba(255,170,60,.45)' } : {}),
                }}
              >
                <div className="tf-insignia-cuerpo flex items-center gap-2.5 px-3 py-2" style={{ borderRadius: 13 }}>
                  <RelojArena
                    variante="proyecto"
                    llenado={pct / 100}
                    terminado={proyectoCompletado(p) && p.totalTareas > 0}
                    tamano={24}
                    animada={false}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-bold uppercase tracking-[0.24em] text-sky-300">Proyecto</p>
                    <p
                      className={`${fuenteTitulo.className} truncate text-[13px] font-bold leading-tight tracking-[-0.02em] text-white`}
                      title={p.nombre}
                    >
                      {p.nombre}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: g.acento }} />
                      </span>
                      <span className="text-[10px] font-extrabold tabular-nums" style={{ color: g.acento }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {modo === 'system' && visibles.length === 0 && (
        <p className="tf-galaxia-vacia pointer-events-none absolute inset-x-0 bottom-16 z-[3] text-center text-xs text-[#93a0c4]">
          Todavía no hay proyectos en esta galaxia.
        </p>
      )}

      {/* ------------------------------------- volver al mapa de galaxias */}
      <div data-syschip className="absolute left-4 top-4 z-[5]" style={{ opacity: 0, pointerEvents: 'none' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            escena.current?.volver();
          }}
          title="Volver al mapa de galaxias"
          className="flex items-center gap-2.5 rounded-[10px] bg-[rgba(10,16,34,0.8)] py-[7px] pl-2 pr-[9px] text-[#eef2ff]"
          style={{ border: `1px solid ${g.borde}` }}
        >
          <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-white/10 text-sm leading-none">‹</span>
          <span className="flex flex-col items-start gap-px">
            <span className="text-[11px] font-extrabold tracking-[0.05em]">{g.titulo}</span>
            <span className="text-[10px] text-[#93a0c4]">Volver a galaxias</span>
          </span>
          <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-white/10 text-[10.5px] font-bold">
            {porMundo[mundo].length}
          </span>
        </button>
      </div>

      {/* --------------------- movimiento de los planetas (en el sistema) */}
      {modo === 'system' && (
        <button
          type="button"
          role="switch"
          aria-checked={movimiento}
          onClick={(e) => {
            e.stopPropagation();
            alternarMovimiento();
          }}
          title={movimiento ? 'Dejar los planetas quietos' : 'Hacer girar los planetas'}
          data-encendido={movimiento}
          className="tf-interruptor tf-galaxia-vacia absolute right-4 top-4 z-[5] flex items-center gap-2.5 rounded-full py-1 pl-3 pr-1 text-xs font-medium"
        >
          <span className={movimiento ? 'text-emerald-300' : 'text-[#93a0c4]'}>Movimiento</span>
          <span aria-hidden className="tf-interruptor-pista">
            <span className="tf-interruptor-rotulo tf-interruptor-on">ON</span>
            <span className="tf-interruptor-rotulo tf-interruptor-off">OFF</span>
            <span className="tf-interruptor-perilla" />
          </span>
        </button>
      )}

      {/* ------------------------------------------- ayuda y crear proyecto */}
      <p
        data-ui
        className="absolute left-1/2 top-4 z-[4] -translate-x-1/2 whitespace-nowrap text-[11px] text-[#8a93ab]"
      >
        {modo === 'overview'
          ? 'Elige una galaxia para ver sus proyectos'
          : 'Toca un planeta para abrir su proyecto'}
      </p>
      <button
        data-ui
        onClick={(e) => {
          e.stopPropagation();
          onCrear();
        }}
        className="absolute bottom-5 right-6 z-[6] flex items-center gap-2.5 text-[11.5px] text-[#c9d0e2]"
      >
        <span className="grid h-[38px] w-[38px] place-items-center rounded-full border border-[rgba(160,175,220,0.35)] bg-[rgba(12,16,30,0.85)] text-xl leading-none text-[#dfe5f5]">
          +
        </span>
        <span className="whitespace-nowrap">Crear proyecto</span>
      </button>
    </div>
  );
}
