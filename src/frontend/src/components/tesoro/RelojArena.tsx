'use client';

import { useId } from 'react';

/** Contorno del vidrio: dos ampollas unidas por el cuello (y=70). */
const VIDRIO =
  'M24 20 C22 46 45 58 47.5 70 C45 82 22 94 24 120 H76 C78 94 55 82 52.5 70 C55 58 78 46 76 20 Z';

/** Colores de la arena: claro arriba, intenso al medio, profundo abajo. */
const ARENAS = {
  ambar: ['#fed7aa', '#fb923c', '#c2410c'],
  rosa: ['#fbcfe8', '#ec4899', '#9d174d'],
  azul: ['#bfdbfe', '#3b82f6', '#1e40af'],
} as const;

export type ColorArena = keyof typeof ARENAS;

/**
 * Reloj de arena: la representacion visual de una tarea (y, en su variante
 * con columnas, del proyecto completo).
 *
 * `llenado` (0 a 1) es la arena que ya cayo: la de arriba se vacia y la de
 * abajo crece. Mientras el cronometro corre (`fluyendo`) un hilo de arena cae
 * por el cuello. Las tapas de madera y los reflejos del vidrio van siempre al
 * frente, asi se lee como reloj aunque este vacio o lleno.
 */
export default function RelojArena({
  llenado,
  tamano = 72,
  variante = 'tarea',
  arena,
  fluyendo = false,
  terminado = false,
  animada = true,
  className = '',
}: {
  /** 0 a 1: proporcion de arena que ya cayo. */
  llenado: number;
  /** Ancho en pixeles; el alto sale de la proporcion del reloj. */
  tamano?: number;
  /** `proyecto` es el reloj final: mas ancho y con columnas torneadas. */
  variante?: 'tarea' | 'proyecto';
  arena?: ColorArena;
  /** El cronometro de esta tarea corre: cae un hilo de arena. */
  fluyendo?: boolean;
  /** Tarea terminada (o proyecto completo): brilla. */
  terminado?: boolean;
  animada?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const nivel = Math.max(0, Math.min(1, llenado));
  const completo = nivel >= 1 || terminado;
  const caido = terminado ? 1 : nivel;
  const proyecto = variante === 'proyecto';
  const [claro, medio, oscuro] = ARENAS[arena ?? (proyecto ? 'rosa' : 'ambar')];
  const transicion = animada ? 'transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1)' : undefined;
  // Un hilo solo tiene sentido si queda arena arriba.
  const hilo = fluyendo && caido < 1;
  // Las tapas del proyecto son mas anchas para dejar sitio a las columnas.
  const tapa = proyecto ? { x: 4, ancho: 92 } : { x: 12, ancho: 76 };

  return (
    <svg
      viewBox="0 0 100 140"
      width={tamano}
      height={(tamano * 140) / 100}
      className={className}
      role="img"
      aria-label={`Reloj de arena ${Math.round(caido * 100)}%`}
    >
      <defs>
        <clipPath id={`vidrio-${id}`}>
          <path d={VIDRIO} />
        </clipPath>
        <linearGradient id={`arena-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={claro} />
          <stop offset="45%" stopColor={medio} />
          <stop offset="100%" stopColor={oscuro} />
        </linearGradient>
        {/* Madera torneada: luz al centro-izquierda, sombra en los bordes. */}
        <linearGradient id={`madera-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6b3514" />
          <stop offset="30%" stopColor="#d08a45" />
          <stop offset="55%" stopColor="#b8702f" />
          <stop offset="100%" stopColor="#5e2e10" />
        </linearGradient>
        <linearGradient id={`vidrioLuz-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.22" />
          <stop offset="50%" stopColor="#a5b4fc" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.18" />
        </linearGradient>
        <radialGradient id={`aura-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={medio} stopOpacity="0.55" />
          <stop offset="100%" stopColor={medio} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Resplandor del reloj completo: pulsa suave sin parar. */}
      {completo && (
        <ellipse className="tf-reloj-brillo" cx="50" cy="96" rx="50" ry="40" fill={`url(#aura-${id})`} />
      )}

      {/* ------------------------------------------- columnas (proyecto) */}
      {proyecto && (
        <g>
          {[10, 90].map((x) => (
            <g key={x}>
              <rect x={x - 3} y="18" width="6" height="104" rx="2" fill={`url(#madera-${id})`} stroke="#3b1c08" strokeWidth="1" />
              <ellipse cx={x} cy="40" rx="5" ry="3.2" fill="#c27b3a" stroke="#3b1c08" strokeWidth="1" />
              <ellipse cx={x} cy="100" rx="5" ry="3.2" fill="#c27b3a" stroke="#3b1c08" strokeWidth="1" />
              {/* Gema azul al centro de cada columna */}
              <ellipse cx={x} cy="70" rx="4.4" ry="6.5" fill="#3b82f6" stroke="#1e3a8a" strokeWidth="1" />
              <ellipse cx={x - 1.3} cy="67.5" rx="1.3" ry="2.2" fill="#dbeafe" opacity="0.85" />
            </g>
          ))}
        </g>
      )}

      {/* ------------------------------------------------------- vidrio */}
      <path d={VIDRIO} fill={`url(#vidrioLuz-${id})`} />

      <g clipPath={`url(#vidrio-${id})`}>
        {/* Arena que queda arriba: se hunde hacia el cuello. */}
        <path
          d="M0 70 V27 Q50 33 100 27 V70 Z"
          fill={`url(#arena-${id})`}
          style={{
            transformBox: 'fill-box',
            transformOrigin: '50% 100%',
            transform: `scaleY(${1 - caido})`,
            transition: transicion,
          }}
        />

        {/* Hilo de arena cayendo por el cuello */}
        {hilo && (
          <line
            className="tf-arena-cae"
            x1="50"
            y1="66"
            x2="50"
            y2="119"
            stroke={claro}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}

        {/* Arena caida: un monticulo que crece desde el fondo. */}
        <path
          d="M0 120 V82 Q50 70 100 82 V120 Z"
          fill={`url(#arena-${id})`}
          style={{
            transformBox: 'fill-box',
            transformOrigin: '50% 100%',
            transform: `scaleY(${caido})`,
            transition: transicion,
          }}
        />
      </g>

      {/* Contorno y reflejos del vidrio, siempre sobre la arena */}
      <path d={VIDRIO} fill="none" stroke="#c4b5fd" strokeOpacity="0.7" strokeWidth="2" />
      <g fill="none" stroke="#ffffff" strokeLinecap="round">
        <path d="M30 26 C29 42 38 54 44 63" strokeOpacity="0.4" strokeWidth="2.5" />
        <path d="M30 114 C29 102 35 90 42 80" strokeOpacity="0.22" strokeWidth="2.5" />
        <path d="M70 30 C70 38 66 46 61 52" strokeOpacity="0.15" strokeWidth="1.5" />
      </g>

      {/* --------------------------------------------------------- tapas */}
      <Tapa x={tapa.x} y={6} ancho={tapa.ancho} madera={`url(#madera-${id})`} />
      <Tapa x={tapa.x - 2} y={120} ancho={tapa.ancho + 4} madera={`url(#madera-${id})`} />

      {/* Destellos del reloj completo */}
      {completo && (
        <g fill="#fef3c7">
          <path d="M14 34 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z" opacity="0.9" />
          <path d="M87 52 l1.4 3.2 3.2 1.4 -3.2 1.4 -1.4 3.2 -1.4 -3.2 -3.2 -1.4 3.2 -1.4 Z" opacity="0.75" />
        </g>
      )}
    </svg>
  );
}

/** Disco de madera: cuerpo cilindrico con su cara superior y los anillos del torneado. */
function Tapa({ x, y, ancho, madera }: { x: number; y: number; ancho: number; madera: string }) {
  const cx = x + ancho / 2;
  return (
    <g>
      <rect x={x} y={y} width={ancho} height="14" rx="5" fill={madera} stroke="#3b1c08" strokeWidth="1.5" />
      <ellipse cx={cx} cy={y + 2.5} rx={ancho / 2 - 2} ry="2.6" fill="#e3a464" opacity="0.9" />
      <ellipse cx={cx} cy={y + 2.5} rx={ancho / 4} ry="1.3" fill="none" stroke="#a35f26" strokeWidth="0.8" />
      <path d={`M${x + 3} ${y + 9} H${x + ancho - 3}`} stroke="#3b1c08" strokeOpacity="0.35" strokeWidth="1" />
    </g>
  );
}
