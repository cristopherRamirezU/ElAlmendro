import { Background } from '@xyflow/react';
import type { FondoMapa } from '@/lib/fondosMapa';

/** Color base del lienzo segun el fondo elegido (va en el contenedor del mapa). */
export function estiloFondoMapa(fondo: FondoMapa): React.CSSProperties {
  switch (fondo) {
    case 'azul-puntos':
      return { background: 'radial-gradient(800px 500px at 30% 45%, #0c1f47 0%, transparent 70%), #060b18' };
    case 'aurora':
      return { background: '#070a14' };
    case 'hexagonos':
      return { background: 'radial-gradient(900px 600px at 45% 50%, #0b1730 0%, #070c18 80%)' };
    default:
      return { background: '#141414' };
  }
}

/** Capas fijas detras del mapa (no se mueven al desplazarlo): luces o panal. */
export function DecoracionFondo({ fondo }: { fondo: FondoMapa }) {
  if (fondo === 'aurora') {
    const manchas = [
      { color: '#7c3aed', tamano: 420, left: '-8%', top: '55%' },
      { color: '#0ea5e9', tamano: 380, left: '38%', top: '-30%' },
      { color: '#10b981', tamano: 320, left: '78%', top: '50%' },
    ];
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {manchas.map((m) => (
          <div
            key={m.color}
            className="absolute rounded-full opacity-[0.28] blur-[90px]"
            style={{ width: m.tamano, height: m.tamano, left: m.left, top: m.top, background: m.color }}
          />
        ))}
      </div>
    );
  }
  if (fondo === 'hexagonos') {
    return (
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{
          maskImage: 'radial-gradient(ellipse 75% 70% at 45% 50%, #000 0%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 45% 50%, #000 0%, transparent 80%)',
        }}
      >
        <defs>
          {/* Panal de hexagonos de 22 px de radio (puntas arriba y abajo). */}
          <pattern id="panal-mapa" width="38.105" height="66" patternUnits="userSpaceOnUse">
            <path
              d="M19.05 0 L38.11 11 L38.11 33 L19.05 44 L0 33 L0 11 Z M0 33 L19.05 44 L19.05 66 L0 77 L-19.05 66 L-19.05 44 Z M38.11 33 L57.16 44 L57.16 66 L38.11 77 L19.05 66 L19.05 44 Z M0 -33 L19.05 -22 L19.05 0 L0 11 L-19.05 0 L-19.05 -22 Z M38.11 -33 L57.16 -22 L57.16 0 L38.11 11 L19.05 0 L19.05 -22 Z"
              fill="none"
              stroke="rgba(56,189,248,0.10)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#panal-mapa)" />
      </svg>
    );
  }
  return null;
}

/**
 * Trama de puntos de React Flow: se desplaza con el mapa. Solo en los fondos
 * con puntos. Sin `bgColor` transparente pintaria su propio gris encima del
 * color del contenedor.
 */
export function PuntosFondo({ fondo }: { fondo: FondoMapa }) {
  if (fondo === 'gris-puntos') return <Background bgColor="transparent" color="rgba(255,255,255,0.08)" gap={18} />;
  if (fondo === 'azul-puntos') return <Background bgColor="transparent" color="rgba(148,163,184,0.16)" gap={18} />;
  return null;
}
