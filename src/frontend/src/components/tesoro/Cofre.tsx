'use client';

import { useId } from 'react';

/** Frente del arcon. El oro se ve asomando por encima de este borde. */
const ARCON = 'M26 72 H174 V112 Q174 124 162 124 H38 Q26 124 26 112 Z';

/**
 * Cofre del proyecto: se llena con las bolsas ya guardadas.
 *
 * `llenado` (0 a 1) es la proporcion de tareas completadas. El oro no pinta el
 * arcon por dentro: se amontona por encima del borde, que es como se lee un
 * cofre con tesoro. La madera y los herrajes quedan siempre al frente.
 */
export default function Cofre({
  llenado,
  tamano = 180,
  abierto = false,
  className = '',
}: {
  /** 0 a 1. */
  llenado: number;
  tamano?: number;
  /** Tapa levantada: el cofre esta recibiendo una bolsa. */
  abierto?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const nivel = Math.max(0, Math.min(1, llenado));
  const lleno = nivel >= 1;
  const destapado = abierto || nivel > 0;

  // Monton de monedas sobre el borde del arcon (y=72): crece con el avance.
  const alturaMonton = nivel > 0 ? 5 + nivel * 26 : 0;
  const anchoMonton = 34 + nivel * 40;
  const cima = 72 - alturaMonton;

  return (
    <svg
      viewBox="0 0 200 150"
      width={tamano}
      height={(tamano * 150) / 200}
      className={className}
      role="img"
      aria-label={`Cofre ${Math.round(nivel * 100)}% lleno`}
    >
      <defs>
        <linearGradient id={`madera-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7b5228" />
          <stop offset="100%" stopColor="#4a3118" />
        </linearGradient>
        <linearGradient id={`tapa-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8d5f2e" />
          <stop offset="100%" stopColor="#5d3d1d" />
        </linearGradient>
        <linearGradient id={`oroCofre-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde9b0" />
          <stop offset="55%" stopColor="#f2bf4a" />
          <stop offset="100%" stopColor="#d09520" />
        </linearGradient>
        <radialGradient id={`aura-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Resplandor del tesoro: crece con el avance y pulsa suave sin parar. */}
      {nivel > 0 && (
        <ellipse
          className="tf-cofre-brillo"
          cx="100"
          cy="68"
          rx={60 * (0.5 + nivel * 0.5)}
          ry={34 * (0.5 + nivel * 0.5)}
          fill={`url(#aura-${id})`}
          style={{ transition: 'rx 600ms ease-out, ry 600ms ease-out' }}
        />
      )}

      {/* ---------------------------------------------------------- tapa
          Al abrirse se levanta y se inclina hacia atras; queda detras del
          monton de monedas, que es lo que debe verse primero. */}
      <g
        style={{
          transformOrigin: '100px 72px',
          transform: destapado
            ? `translateY(-${10 + nivel * 8}px) rotate(-12deg) scaleY(0.82)`
            : 'none',
          transition: 'transform 500ms cubic-bezier(.34,1.2,.64,1)',
        }}
      >
        <path
          d="M26 72 Q26 28 100 28 Q174 28 174 72 Z"
          fill={`url(#tapa-${id})`}
          stroke="#2f1d0c"
          strokeWidth="3"
        />
        <path d="M62 33 Q60 52 60 72" fill="none" stroke="#c9a227" strokeWidth="4" opacity="0.85" />
        <path d="M138 33 Q140 52 140 72" fill="none" stroke="#c9a227" strokeWidth="4" opacity="0.85" />
        <path
          d="M26 68 Q26 30 100 30 Q174 30 174 68"
          fill="none"
          stroke="#c9a227"
          strokeWidth="3.5"
          opacity="0.9"
        />
      </g>

      {/* ------------------------------------------- monton de monedas */}
      {nivel > 0 && (
        <g style={{ transition: 'opacity 500ms' }}>
          <path
            d={`M${100 - anchoMonton} 74 Q100 ${cima} ${100 + anchoMonton} 74 Z`}
            fill={`url(#oroCofre-${id})`}
            style={{ transition: 'd 600ms ease-out' }}
          />
          {/* Monedas sueltas sobre el monton, para que se lea de que es. */}
          <circle cx={100 - anchoMonton * 0.45} cy={70 - alturaMonton * 0.2} r="6" fill="#f7cf62" stroke="#a9761a" strokeWidth="1.4" />
          <circle cx="100" cy={cima + 8} r="7" fill="#fde9b0" stroke="#a9761a" strokeWidth="1.4" />
          <circle cx={100 + anchoMonton * 0.45} cy={70 - alturaMonton * 0.22} r="5.5" fill="#eab63f" stroke="#a9761a" strokeWidth="1.4" />
        </g>
      )}

      {/* ----------------------------------------------- frente del arcon */}
      <path d={ARCON} fill={`url(#madera-${id})`} stroke="#2f1d0c" strokeWidth="3" />
      <path d="M62 72 V124" stroke="#c9a227" strokeWidth="4" opacity="0.85" />
      <path d="M138 72 V124" stroke="#c9a227" strokeWidth="4" opacity="0.85" />
      <rect x="26" y="70" width="148" height="7" rx="3" fill="#c9a227" opacity="0.95" />
      <rect x="90" y="80" width="20" height="18" rx="4" fill="#e3bd4d" stroke="#8a6410" strokeWidth="2" />
      <circle cx="100" cy="88" r="3" fill="#5d3d1d" />

      {/* Chispas del cofre completo */}
      {lleno && (
        <g fill="#fde68a">
          <path d="M40 40 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4 Z" opacity="0.9" />
          <path d="M162 52 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z" opacity="0.75" />
        </g>
      )}
    </svg>
  );
}
