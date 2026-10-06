/**
 * Marca de TimeFlow: los cuatro orbes de siempre unidos al nucleo azul, sin el
 * hexagono. Con `bucle` las conexiones se trazan, los orbes aparecen con un
 * rebote y, tras unos segundos, se recogen para volver a empezar.
 */
const NUCLEO = { x: 108, y: 112, r: 32, color: '#38bdf8' };
const ORBES = [
  { x: 66, y: 62, r: 27, color: '#34d399', demoraLinea: 0.3, demoraOrbe: 0.7, mece: 'lg-mece-a' },
  { x: 146, y: 74, r: 22, color: '#fb923c', demoraLinea: 0.45, demoraOrbe: 0.85, mece: 'lg-mece-b' },
  { x: 62, y: 146, r: 22, color: '#a855f7', demoraLinea: 0.6, demoraOrbe: 1, mece: 'lg-mece-c' },
];

function Orbe({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill={color} />
      <circle cx={x - r * 0.32} cy={y - r * 0.34} r={r * 0.3} fill="#ffffff" opacity={0.28} />
    </>
  );
}

export default function LogoTimeFlow({ tamano = 64, className = '' }: { tamano?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={tamano}
      height={tamano}
      aria-hidden
      className={`lg-logo overflow-visible ${className}`}
    >
      {ORBES.map((o) => (
        <path
          key={`linea-${o.color}`}
          className="lg-traza"
          d={`M${NUCLEO.x} ${NUCLEO.y} L${o.x} ${o.y}`}
          fill="none"
          stroke={o.color}
          strokeWidth={13}
          strokeLinecap="round"
          opacity={0.9}
          style={{ animationDelay: `${o.demoraLinea}s` }}
        />
      ))}
      {ORBES.map((o) => (
        <g key={`orbe-${o.color}`} className={o.mece}>
          <g className="lg-pop" style={{ animationDelay: `${o.demoraOrbe}s` }}>
            <Orbe {...o} />
          </g>
        </g>
      ))}
      <g className="lg-pop" style={{ animationDelay: '0.1s' }}>
        <g className="lg-late">
          <Orbe {...NUCLEO} />
        </g>
      </g>
    </svg>
  );
}
