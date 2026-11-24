'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Lock,
  PlayCircle,
  Redo2,
  Search,
  Unlock,
  Undo2,
} from 'lucide-react';
import ContadorTarea, { type EstadoContador } from '@/components/nodos/ContadorTarea';
import InterruptorJornada from '@/components/ui/InterruptorJornada';
import { fuenteTitulo } from '@/lib/fuentes';
import { estadoDeActividad } from '@/lib/formato';
import {
  ALTO_NODO,
  ALTO_RAIZ,
  ANCHO_NODO,
  ANCHO_RAIZ,
  PALETA_PROFUNDIDAD,
  type Orientacion,
} from '@/lib/mapaMental';

interface TareaDemo {
  id: string;
  orden: number;
  titulo: string;
  estado: 'COMPLETADA' | 'EN_PROGRESO' | 'PENDIENTE';
  llenado: number;
  responsable: string;
  esMia?: boolean;
  segundosBase: number;
  subtareas?: {
    id: string;
    titulo: string;
    estado: 'COMPLETADA' | 'EN_PROGRESO' | 'PENDIENTE';
    llenado: number;
    responsable: string;
    esMia?: boolean;
  }[];
}

interface EstadoMapa {
  orientacion: Orientacion;
  candado: boolean;
  t2Completada: boolean;
  expandidoRaiz: boolean;
  subtareasAbiertas: boolean;
}

const TAREAS_HERO: TareaDemo[] = [
  {
    id: 't1',
    orden: 1,
    titulo: 'Diseño de inicio',
    estado: 'COMPLETADA',
    llenado: 1,
    responsable: 'Camila Rojas',
    segundosBase: 8100,
  },
  {
    id: 't2',
    orden: 2,
    titulo: 'Formulario de contacto',
    estado: 'EN_PROGRESO',
    llenado: 0.65,
    responsable: 'Mateo Silva',
    esMia: true,
    segundosBase: 4360,
  },
  {
    id: 't3',
    orden: 3,
    titulo: 'Textos y fotos',
    estado: 'COMPLETADA',
    llenado: 1,
    responsable: 'Valentina Díaz',
    segundosBase: 2895,
  },
  {
    id: 't4',
    orden: 4,
    titulo: 'Revisión final',
    estado: 'PENDIENTE',
    llenado: 0,
    responsable: 'Camila Rojas',
    segundosBase: 0,
  },
];

const TAREAS_COMPLETO: TareaDemo[] = [
  {
    id: 't1',
    orden: 1,
    titulo: 'Arquitectura de datos',
    estado: 'COMPLETADA',
    llenado: 1,
    responsable: 'Camila Rojas',
    segundosBase: 11400,
  },
  {
    id: 't2',
    orden: 2,
    titulo: 'Panel de cronómetro',
    estado: 'EN_PROGRESO',
    llenado: 0.65,
    responsable: 'Mateo Silva',
    esMia: true,
    segundosBase: 2778,
    subtareas: [
      {
        id: 't2a',
        titulo: 'Interruptor de jornada',
        estado: 'COMPLETADA',
        llenado: 1,
        responsable: 'Mateo Silva',
        esMia: true,
      },
      {
        id: 't2b',
        titulo: 'Zona horaria individual',
        estado: 'EN_PROGRESO',
        llenado: 0.5,
        responsable: 'Mateo Silva',
        esMia: true,
      },
    ],
  },
  {
    id: 't3',
    orden: 3,
    titulo: 'Exportación Excel / PDF',
    estado: 'COMPLETADA',
    llenado: 1,
    responsable: 'Valentina Díaz',
    segundosBase: 5045,
  },
  {
    id: 't4',
    orden: 4,
    titulo: 'Validación y cierre',
    estado: 'PENDIENTE',
    llenado: 0,
    responsable: 'Camila Rojas',
    segundosBase: 0,
  },
];

interface AristaSvg {
  id: string;
  d: string;
  color: string;
  dashed: boolean;
}

function IconoEstadoReal({ estado }: { estado: string }) {
  switch (estado) {
    case 'COMPLETADA':
      return <CheckCircle2 size={10} aria-hidden className="shrink-0" />;
    case 'EN_PROGRESO':
      return <PlayCircle size={10} aria-hidden className="shrink-0" />;
    case 'BLOQUEADA':
      return <Lock size={10} aria-hidden className="shrink-0" />;
    case 'INCONCLUSA':
      return <AlertCircle size={10} aria-hidden className="shrink-0" />;
    default:
      return <Circle size={10} aria-hidden className="shrink-0" />;
  }
}

function AnilloAvanceReal({ avance }: { avance: number }) {
  const id = useId();
  const radio = 22;
  const largo = 2 * Math.PI * radio;
  return (
    <svg
      width="56"
      height="56"
      viewBox="-28 -28 56 56"
      className="shrink-0"
      role="img"
      aria-label={`Avance del proyecto: ${avance}%`}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="var(--color-primario, #0ea5e9)" />
          <stop offset="1" stopColor="var(--color-primario-2, #06b6d4)" />
        </linearGradient>
      </defs>
      <circle
        r={radio}
        fill="none"
        stroke="rgba(110,150,255,.15)"
        strokeWidth="5"
        className="tf-raiz-anillo-pista"
      />
      <circle
        r={radio}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(largo * avance) / 100} ${largo}`}
        transform="rotate(-90)"
        className="transition-[stroke-dasharray] duration-700 motion-reduce:transition-none"
      />
      <text
        y="4"
        fill="#fff"
        fontSize="12"
        fontWeight="400"
        textAnchor="middle"
        className="tf-raiz-anillo-texto tabular-nums"
      >
        {avance}%
      </text>
    </svg>
  );
}

/**
 * Réplica interactiva y pixel-exacta del Mapa de Nodos real de TimeFlow
 * (NodoRaiz + NodoTarea + fondo azul-puntos + curvas Bézier + ContadorTarea).
 */
export default function DemoMapaNodos({
  variante = 'hero',
}: {
  variante?: 'hero' | 'completo';
}) {
  const baseTareas = variante === 'hero' ? TAREAS_HERO : TAREAS_COMPLETO;
  const nombreProyecto = variante === 'hero' ? 'Sitio web' : 'Portal Clientes';

  const [montado, setMontado] = useState(false);
  const [enJornada, setEnJornada] = useState(true);
  const [corriendo, setCorriendo] = useState(true);
  const [segundosT2, setSegundosT2] = useState(variante === 'hero' ? 4360 : 2778);
  const [seleccionada, setSeleccionada] = useState<string>('t2');
  const [busqueda, setBusqueda] = useState('');
  const [menuRaizAbierto, setMenuRaizAbierto] = useState(false);
  const [avisoBloqueo, setAvisoBloqueo] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);

  const [mapa, setMapa] = useState<EstadoMapa>({
    orientacion: 'horizontal',
    candado: true,
    t2Completada: false,
    expandidoRaiz: true,
    subtareasAbiertas: variante === 'completo',
  });
  const [pilaDeshacer, setPilaDeshacer] = useState<EstadoMapa[]>([]);
  const [pilaRehacer, setPilaRehacer] = useState<EstadoMapa[]>([]);
  const [aristas, setAristas] = useState<AristaSvg[]>([]);

  const lienzoRef = useRef<HTMLDivElement | null>(null);
  const raizRef = useRef<HTMLDivElement | null>(null);
  const nodosRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!corriendo || mapa.t2Completada) return;
    const id = setInterval(() => setSegundosT2((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [corriendo, mapa.t2Completada]);

  const mutarMapa = useCallback((siguiente: EstadoMapa) => {
    setPilaDeshacer((prev) => [...prev, mapa]);
    setPilaRehacer([]);
    setMapa(siguiente);
  }, [mapa]);

  const deshacer = useCallback(() => {
    if (pilaDeshacer.length === 0) return;
    const anterior = pilaDeshacer[pilaDeshacer.length - 1];
    setPilaDeshacer((prev) => prev.slice(0, -1));
    setPilaRehacer((prev) => [...prev, mapa]);
    setMapa(anterior);
  }, [pilaDeshacer, mapa]);

  const rehacer = useCallback(() => {
    if (pilaRehacer.length === 0) return;
    const siguiente = pilaRehacer[pilaRehacer.length - 1];
    setPilaRehacer((prev) => prev.slice(0, -1));
    setPilaDeshacer((prev) => [...prev, mapa]);
    setMapa(siguiente);
  }, [pilaRehacer, mapa]);

  const tareasCalculadas = useMemo(() => {
    return baseTareas.map((t) => {
      if (t.id === 't2') {
        return {
          ...t,
          estado: (mapa.t2Completada ? 'COMPLETADA' : 'EN_PROGRESO') as TareaDemo['estado'],
          llenado: mapa.t2Completada ? 1 : 0.65,
          bloqueadaPorOrden: false,
        };
      }
      if (t.id === 't4') {
        const bloqueada = mapa.candado && !mapa.t2Completada;
        return {
          ...t,
          bloqueadaPorOrden: bloqueada,
        };
      }
      return { ...t, bloqueadaPorOrden: false };
    });
  }, [baseTareas, mapa.candado, mapa.t2Completada]);

  const totalTareas = tareasCalculadas.length;
  const completadas = tareasCalculadas.filter((t) => t.estado === 'COMPLETADA').length;
  const avance = Math.round((completadas / totalTareas) * 100);

  const recalcularAristas = useCallback(() => {
    const lienzo = lienzoRef.current;
    const raiz = raizRef.current;
    if (!lienzo || !raiz || !mapa.expandidoRaiz) {
      setAristas([]);
      return;
    }

    const lRect = lienzo.getBoundingClientRect();
    const rRect = raiz.getBoundingClientRect();
    if (lRect.width === 0) return;

    const esHorizontal = mapa.orientacion === 'horizontal';
    const rx = esHorizontal ? rRect.right - lRect.left : rRect.left - lRect.left + rRect.width / 2;
    const ry = esHorizontal ? rRect.top - lRect.top + rRect.height / 2 : rRect.bottom - lRect.top;

    const nuevas: AristaSvg[] = [];

    const crearCurva = (x1: number, y1: number, x2: number, y2: number) => {
      if (esHorizontal) {
        const dx = Math.max(36, Math.abs(x2 - x1) * 0.5);
        return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }
      const dy = Math.max(28, Math.abs(y2 - y1) * 0.5);
      return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${(y1 + dy).toFixed(1)}, ${x2.toFixed(1)} ${(y2 - dy).toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };

    tareasCalculadas.forEach((t) => {
      const el = nodosRef.current[t.id];
      if (!el) return;
      const nRect = el.getBoundingClientRect();
      const nx = esHorizontal ? nRect.left - lRect.left : nRect.left - lRect.left + nRect.width / 2;
      const ny = esHorizontal ? nRect.top - lRect.top + nRect.height / 2 : nRect.top - lRect.top;

      nuevas.push({
        id: `raiz-${t.id}`,
        d: crearCurva(rx, ry, nx, ny),
        color: t.bloqueadaPorOrden ? '#f43f5e' : PALETA_PROFUNDIDAD[0],
        dashed: t.bloqueadaPorOrden,
      });

      if (variante === 'completo' && mapa.subtareasAbiertas && t.subtareas) {
        const sx1 = esHorizontal ? nRect.right - lRect.left : nRect.left - lRect.left + nRect.width / 2;
        const sy1 = esHorizontal ? nRect.top - lRect.top + nRect.height / 2 : nRect.bottom - lRect.top;
        t.subtareas.forEach((sub) => {
          const subEl = nodosRef.current[sub.id];
          if (!subEl) return;
          const sRect = subEl.getBoundingClientRect();
          const sx2 = esHorizontal ? sRect.left - lRect.left : sRect.left - lRect.left + sRect.width / 2;
          const sy2 = esHorizontal ? sRect.top - lRect.top + sRect.height / 2 : sRect.top - lRect.top;
          nuevas.push({
            id: `${t.id}-${sub.id}`,
            d: crearCurva(sx1, sy1, sx2, sy2),
            color: PALETA_PROFUNDIDAD[1],
            dashed: false,
          });
        });
      }
    });

    setAristas(nuevas);
  }, [mapa.expandidoRaiz, mapa.orientacion, mapa.subtareasAbiertas, tareasCalculadas, variante]);

  useEffect(() => {
    const raf = requestAnimationFrame(recalcularAristas);
    const lienzo = lienzoRef.current;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recalcularAristas) : null;
    if (lienzo && ro) ro.observe(lienzo);
    window.addEventListener('resize', recalcularAristas);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', recalcularAristas);
    };
  }, [recalcularAristas]);

  const tareaActiva = tareasCalculadas.find((t) => t.id === seleccionada) ?? tareasCalculadas[1];
  const estadoContador: EstadoContador =
    tareaActiva.id === 't2'
      ? mapa.t2Completada
        ? 'terminado'
        : corriendo
          ? 'corriendo'
          : 'pausado'
      : tareaActiva.estado === 'COMPLETADA'
        ? 'terminado'
        : 'detenido';

  const segundosVisibles = tareaActiva.id === 't2' ? segundosT2 : tareaActiva.segundosBase;
  const q = busqueda.trim().toLowerCase();

  function manejarClickTarea(t: (typeof tareasCalculadas)[number]) {
    if (t.bloqueadaPorOrden) {
      setShakeId(t.id);
      setAvisoBloqueo(
        `Bloqueada por orden secuencial: termina primero «${tareasCalculadas[1].titulo}» o desactiva el candado.`,
      );
      setTimeout(() => setShakeId(null), 400);
      return;
    }
    setAvisoBloqueo(null);
    setSeleccionada(t.id);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[22px] border border-[var(--tf-borde-fuerte)] bg-[#060b18] shadow-[var(--tf-sombra)]">
      {/* Cabecera estilo app real */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 bg-[#080f22] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {variante === 'hero' ? (
            <InterruptorJornada
              encendido={enJornada}
              pendiente={null}
              desde={montado && enJornada ? '2026-11-24T12:05:00.000Z' : null}
              onAlternar={() => setEnJornada((v) => !v)}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  mutarMapa({
                    ...mapa,
                    orientacion: mapa.orientacion === 'horizontal' ? 'vertical' : 'horizontal',
                  })
                }
                aria-pressed={mapa.orientacion === 'vertical'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                {mapa.orientacion === 'horizontal' ? 'Vista: Horizontal' : 'Vista: Vertical'}
              </button>
              <button
                type="button"
                onClick={deshacer}
                disabled={pilaDeshacer.length === 0}
                title="Deshacer (Ctrl+Z)"
                aria-label="Deshacer cambio del mapa"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-35"
              >
                <Undo2 size={14} aria-hidden />
              </button>
              <button
                type="button"
                onClick={rehacer}
                disabled={pilaRehacer.length === 0}
                title="Rehacer (Ctrl+Y)"
                aria-label="Rehacer cambio del mapa"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-35"
              >
                <Redo2 size={14} aria-hidden />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {variante === 'completo' && (
            <label className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#040814] px-2.5 py-1.5 text-xs text-slate-300">
              <Search size={13} aria-hidden className="text-slate-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar tarea o persona…"
                aria-label="Buscar en el mapa"
                className="w-36 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => {
              setAvisoBloqueo(null);
              mutarMapa({ ...mapa, candado: !mapa.candado });
            }}
            aria-pressed={mapa.candado}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              mapa.candado
                ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {mapa.candado ? <Lock size={13} aria-hidden /> : <Unlock size={13} aria-hidden />}
            <span>{mapa.candado ? 'Bloqueo secuencial: ON' : 'Bloqueo secuencial: OFF'}</span>
          </button>
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Autoguardado
          </span>
        </div>
      </div>

      {/* Lienzo exacto "azul-puntos" de FondoMapa.tsx */}
      <div
        ref={lienzoRef}
        className="tf-mapa relative overflow-x-auto px-5 py-7 sm:px-7"
        style={{
          background:
            'radial-gradient(rgba(148,163,184,0.16) 1.2px, transparent 1.2px) 0 0 / 18px 18px, radial-gradient(800px 500px at 30% 45%, #0c1f47 0%, transparent 70%), #060b18',
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {aristas.map((a) => (
            <path
              key={a.id}
              d={a.d}
              fill="none"
              stroke={a.color}
              strokeOpacity={a.dashed ? 0.55 : 0.65}
              strokeWidth={1.8}
              strokeDasharray={a.dashed ? '5 4' : undefined}
            />
          ))}
        </svg>

        <div
          className={`relative z-[2] mx-auto flex min-w-max items-center justify-center ${
            mapa.orientacion === 'horizontal' ? 'flex-row gap-12' : 'flex-col gap-10'
          }`}
        >
          {/* NODO RAIZ EXACTO (NodoRaiz.tsx: 250x96px) */}
          <div
            ref={raizRef}
            className="relative shrink-0"
            style={{ width: ANCHO_RAIZ, height: ALTO_RAIZ }}
          >
            <div className="tf-insignia-marco h-full w-full">
              <div className="tf-insignia-cuerpo flex h-full items-center gap-3.5 px-[18px]">
                <AnilloAvanceReal avance={avance} />
                <div className="min-w-0 flex-1 text-left">
                  <p className="tf-raiz-etiqueta text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300">
                    Proyecto
                  </p>
                  <p
                    className={`tf-raiz-nombre ${fuenteTitulo.className} mt-0.5 truncate font-bold leading-[1.05] tracking-[-0.03em] text-white`}
                    style={{ fontSize: nombreProyecto.length <= 10 ? 26 : 19 }}
                    title={nombreProyecto}
                  >
                    {nombreProyecto}
                  </p>
                  <div aria-hidden className="mt-2 flex gap-[3px]">
                    {Array.from({ length: totalTareas }, (_, i) => {
                      const llena = i < completadas;
                      const activa = !llena && i === completadas;
                      return (
                        <div
                          key={i}
                          className={`tf-segmento tf-segmento-fino ${
                            llena ? 'tf-segmento-hecho' : activa ? 'tf-segmento-activo' : ''
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="tf-raiz-meta mt-1.5 truncate text-[11px] font-medium text-[#93a3c4]">
                    {totalTareas} tareas · {completadas} {completadas === 1 ? 'completada' : 'completadas'}
                  </p>
                </div>
              </div>
            </div>

            {variante === 'completo' && (
              <button
                type="button"
                onClick={() => setMenuRaizAbierto((v) => !v)}
                aria-label={`Proyecto ${nombreProyecto}: opciones para agregar tareas`}
                aria-expanded={menuRaizAbierto}
                className="absolute inset-0 rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              />
            )}

            <button
              type="button"
              onClick={() => mutarMapa({ ...mapa, expandidoRaiz: !mapa.expandidoRaiz })}
              title={mapa.expandidoRaiz ? 'Contraer' : 'Desplegar'}
              aria-label={mapa.expandidoRaiz ? 'Contraer las tareas del proyecto' : 'Desplegar las tareas del proyecto'}
              className={`tf-nodo-btn absolute z-10 grid h-6 w-6 place-items-center rounded-full bg-slate-800 text-white ring-1 ring-white/25 hover:bg-slate-700 ${
                mapa.orientacion === 'horizontal'
                  ? '-right-3 top-1/2 -translate-y-1/2'
                  : '-bottom-3 left-1/2 -translate-x-1/2'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-3.5 w-3.5 transition-transform ${
                  mapa.expandidoRaiz
                    ? mapa.orientacion === 'horizontal'
                      ? 'rotate-90'
                      : 'rotate-180'
                    : ''
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={mapa.orientacion === 'horizontal' ? 'm9 6 6 6-6 6' : 'm6 9 6 6 6-6'}
                />
              </svg>
            </button>

            {variante === 'completo' && menuRaizAbierto && (
              <div className="tf-menu-raiz absolute left-0 top-full z-20 flex flex-col items-start gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMenuRaizAbierto(false)}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full bg-slate-900/95 py-1.5 pl-2 pr-3.5 text-left text-xs font-bold text-slate-100 shadow-[inset_0_0_0_1px_rgba(148,163,184,.25),0_10px_24px_-10px_rgba(0,0,0,.8)]"
                >
                  <span className="grid h-[20px] w-[20px] place-items-center rounded-full bg-[#38bdf8] text-[14px] font-extrabold text-[#04121f]">
                    +
                  </span>
                  <span>
                    Nueva tarea
                    <small className="block text-[10px] font-medium text-slate-400">
                      Una tarea suelta del proyecto
                    </small>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMenuRaizAbierto(false)}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full bg-slate-900/95 py-1.5 pl-2 pr-3.5 text-left text-xs font-bold text-slate-100 shadow-[inset_0_0_0_1px_rgba(148,163,184,.25),0_10px_24px_-10px_rgba(0,0,0,.8)]"
                >
                  <span className="grid h-[20px] w-[20px] place-items-center rounded-full bg-[#f59e0b] text-[14px] font-extrabold text-[#04121f]">
                    +
                  </span>
                  <span>
                    Tarea para alguien
                    <small className="block text-[10px] font-medium text-slate-400">
                      Créala ya con responsable
                    </small>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* NIVEL 1: NODOS TAREA EXACTOS (NodoTarea.tsx: 220x64px) */}
          {mapa.expandidoRaiz && (
            <div
              className={`flex ${
                mapa.orientacion === 'horizontal' ? 'flex-col gap-4' : 'flex-row gap-4'
              }`}
            >
              {tareasCalculadas.map((t) => {
                const estadoEfectivo = t.bloqueadaPorOrden ? 'BLOQUEADA' : t.estado;
                const fase = estadoDeActividad(estadoEfectivo);
                const porcentaje = Math.round(t.llenado * 100);
                const coincide =
                  !q ||
                  t.titulo.toLowerCase().includes(q) ||
                  t.responsable.toLowerCase().includes(q);
                const esSel = seleccionada === t.id && !t.bloqueadaPorOrden;

                return (
                  <div
                    key={t.id}
                    className={`flex items-center ${
                      mapa.orientacion === 'horizontal' ? 'flex-row gap-10' : 'flex-col gap-8'
                    }`}
                  >
                    <div
                      ref={(el) => {
                        nodosRef.current[t.id] = el;
                      }}
                      className={`relative shrink-0 transition-opacity ${
                        !coincide ? 'opacity-30' : ''
                      } ${shakeId === t.id ? 'animate-[tf-menu-raiz-entra_0.2s_ease]' : ''}`}
                      style={{ width: ANCHO_NODO, height: ALTO_NODO }}
                    >
                      <button
                        type="button"
                        onClick={() => manejarClickTarea(t)}
                        className={`tf-tarea relative flex h-full w-full items-center gap-2 overflow-hidden rounded-xl pb-[3px] pl-2 pr-3 text-left transition ${
                          t.bloqueadaPorOrden ? 'opacity-80' : ''
                        } ${esSel ? 'ring-2 ring-sky-400/85 ring-offset-1 ring-offset-transparent' : ''}`}
                        style={{ '--c': fase.rgb } as React.CSSProperties}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="tf-nodo-orden shrink-0 rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                              #{t.orden}
                            </span>
                            {(t.bloqueadaPorOrden || (mapa.candado && t.id === 't2')) && (
                              <Lock
                                size={12}
                                aria-hidden
                                className={`shrink-0 ${
                                  t.bloqueadaPorOrden ? 'text-rose-400' : 'text-amber-400'
                                }`}
                              />
                            )}
                            <span className="tf-nodo-titulo truncate text-xs font-bold text-white">
                              {t.titulo}
                            </span>
                          </div>

                          <div className="flex min-w-0 items-center justify-between gap-1.5 text-[10px]">
                            <span
                              className={`min-w-0 truncate rounded-[5px] border px-[7px] py-0.5 font-bold ${
                                t.esMia
                                  ? 'tf-nodo-resp-mio border-sky-300/40 bg-sky-400/30 text-sky-200'
                                  : 'tf-nodo-resp border-white/10 bg-slate-800/80 text-slate-300'
                              }`}
                            >
                              {t.esMia ? 'Tú' : t.responsable}
                            </span>
                            <span
                              className="inline-flex shrink-0 items-center gap-1 font-semibold"
                              style={{ color: `rgb(${fase.rgb})` }}
                            >
                              <IconoEstadoReal estado={estadoEfectivo} />
                              {fase.texto}
                            </span>
                            <span
                              className="shrink-0 font-extrabold tabular-nums"
                              style={{ color: fase.color }}
                            >
                              {porcentaje}%
                            </span>
                          </div>
                        </div>

                        <span className="tf-nodo-barra-base absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-white/[.08]">
                          <span
                            className="block h-full transition-[width] duration-300"
                            style={{ width: `${porcentaje}%`, background: fase.color }}
                          />
                        </span>
                      </button>

                      {variante === 'completo' && t.subtareas && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            mutarMapa({
                              ...mapa,
                              subtareasAbiertas: !mapa.subtareasAbiertas,
                            });
                          }}
                          title={mapa.subtareasAbiertas ? 'Contraer subtareas' : 'Desplegar subtareas'}
                          aria-label="Alternar subtareas"
                          className={`tf-nodo-btn absolute z-10 grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-white ring-1 ring-white/25 hover:bg-slate-700 ${
                            mapa.orientacion === 'horizontal'
                              ? '-right-2.5 top-1/2 -translate-y-1/2'
                              : '-bottom-2.5 left-1/2 -translate-x-1/2'
                          }`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className={`h-3 w-3 transition-transform ${
                              mapa.subtareasAbiertas
                                ? mapa.orientacion === 'horizontal'
                                  ? 'rotate-90'
                                  : 'rotate-180'
                                : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d={mapa.orientacion === 'horizontal' ? 'm9 6 6 6-6 6' : 'm6 9 6 6 6-6'}
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* NIVEL 2: SUBTAREAS REALES (cuando estan desplegadas en completo) */}
                    {variante === 'completo' && mapa.subtareasAbiertas && t.subtareas && (
                      <div
                        className={`flex ${
                          mapa.orientacion === 'horizontal' ? 'flex-col gap-3' : 'flex-row gap-3'
                        }`}
                      >
                        {t.subtareas.map((sub) => {
                          const sFase = estadoDeActividad(sub.estado);
                          const sPct = Math.round(sub.llenado * 100);
                          return (
                            <div
                              key={sub.id}
                              ref={(el) => {
                                nodosRef.current[sub.id] = el;
                              }}
                              style={{ width: ANCHO_NODO, height: ALTO_NODO, '--c': sFase.rgb } as React.CSSProperties}
                              className="tf-tarea relative flex items-center gap-2 overflow-hidden rounded-xl pb-[3px] pl-2 pr-3"
                            >
                              <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="tf-nodo-titulo truncate text-xs font-bold text-white">
                                    {sub.titulo}
                                  </span>
                                </div>
                                <div className="flex min-w-0 items-center justify-between gap-1.5 text-[10px]">
                                  <span className="tf-nodo-resp-mio min-w-0 truncate rounded-[5px] border border-sky-300/40 bg-sky-400/30 px-[7px] py-0.5 font-bold text-sky-200">
                                    Tú
                                  </span>
                                  <span
                                    className="inline-flex shrink-0 items-center gap-1 font-semibold"
                                    style={{ color: `rgb(${sFase.rgb})` }}
                                  >
                                    <IconoEstadoReal estado={sub.estado} />
                                    {sFase.texto}
                                  </span>
                                  <span
                                    className="shrink-0 font-extrabold tabular-nums"
                                    style={{ color: sFase.color }}
                                  >
                                    {sPct}%
                                  </span>
                                </div>
                              </div>
                              <span className="tf-nodo-barra-base absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-white/[.08]">
                                <span
                                  className="block h-full"
                                  style={{ width: `${sPct}%`, background: sFase.color }}
                                />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Minimapa real estilo .react-flow__minimap */}
        {variante === 'completo' && (
          <div
            aria-label="Minimapa"
            className="mt-4 ml-auto w-32 rounded-[0.9rem] border border-white/15 bg-[#0a0f1e]/85 p-2 shadow-xl backdrop-blur"
          >
            <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <span>Minimapa</span>
              <span className="font-mono text-sky-300">{avance}%</span>
            </div>
            <div className="grid grid-cols-[18px_1fr] items-center gap-1.5">
              <span className="h-5 rounded bg-sky-400/80" />
              <div className="grid grid-cols-2 gap-1">
                {tareasCalculadas.map((t) => (
                  <span
                    key={t.id}
                    className="h-2 rounded-sm"
                    style={{
                      background: t.bloqueadaPorOrden
                        ? '#f43f5e'
                        : estadoDeActividad(t.estado).color,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pie interactivo con ContadorTarea REAL de TimeFlow */}
      <div className="flex flex-col gap-3 border-t border-white/10 bg-[#080f22] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 text-left">
          {avisoBloqueo ? (
            <p role="alert" className="text-xs font-semibold text-rose-300">
              {avisoBloqueo}
            </p>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                Tarea #{tareaActiva.orden} seleccionada · {tareaActiva.responsable}
              </p>
              <p className="truncate text-sm font-bold text-white">{tareaActiva.titulo}</p>
              <p className="text-xs text-slate-400">
                Haz clic en cualquier nodo del mapa o usa el cronómetro real para completar #2 y desbloquear #4.
              </p>
            </>
          )}
        </div>

        <div className="w-full shrink-0 sm:w-[330px]">
          <ContadorTarea
            compacto
            segundos={segundosVisibles}
            estado={estadoContador}
            detalle={
              tareaActiva.id === 't2'
                ? mapa.t2Completada
                  ? 'Terminada · #4 desbloqueada'
                  : corriendo
                    ? 'Corriendo · sesión activa'
                    : 'En pausa · clic en Play'
                : `${estadoDeActividad(tareaActiva.estado).texto} · tiempo registrado`
            }
            principal={{
              texto:
                tareaActiva.id === 't2' && !mapa.t2Completada
                  ? corriendo
                    ? 'Pausar sesión'
                    : 'Reanudar sesión'
                  : 'Reabrir tarea #2',
              titulo:
                tareaActiva.id === 't2' && !mapa.t2Completada
                  ? corriendo
                    ? 'Pausar cronómetro'
                    : 'Reanudar cronómetro'
                  : 'Volver a #2 en progreso',
              onClick: () => {
                if (tareaActiva.id !== 't2') {
                  setSeleccionada('t2');
                  if (mapa.t2Completada) mutarMapa({ ...mapa, t2Completada: false });
                  return;
                }
                if (mapa.t2Completada) {
                  mutarMapa({ ...mapa, t2Completada: false });
                  setCorriendo(true);
                } else {
                  setCorriendo((v) => !v);
                }
              },
            }}
            terminar={{
              texto: 'Terminar tarea',
              titulo: 'Completar tarea #2 y desbloquear la siguiente',
              deshabilitado: tareaActiva.id !== 't2' || mapa.t2Completada,
              onClick: () => {
                setAvisoBloqueo(null);
                mutarMapa({ ...mapa, t2Completada: true });
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
