/**
 * Escena decorativa del login: el ciclo de una tarea como una ruta luminosa
 * con cuatro nodos. Un punto de luz la recorre, las burbujas flotan y la
 * barra de la tarea en curso sube y baja como si alguien estuviera
 * trabajando en ella. Es solo ilustracion (aria-hidden).
 */
const RUTA = 'M300 140 C380 140 440 220 430 310 C420 400 560 390 560 480 C560 570 420 600 400 700';
const ANCHO = 280;
const ALTO = 92;

const PUNTOS = [
  { x: 300, y: 140, r: 15, color: '#a78bfa', demora: 0.4 },
  { x: 430, y: 310, r: 15, color: '#f59e0b', demora: 1 },
  { x: 560, y: 480, r: 15, color: '#38bdf8', demora: 1.6 },
  { x: 400, y: 700, r: 17, color: '#34d399', demora: 2.2 },
];

/** Ramas tenues que salen de la ruta, como un mapa de nodos que sigue creciendo. */
const RAMAS = [
  { x1: 300, y1: 140, x2: 285, y2: 245, color: '#a78bfa', demora: 2.6 },
  { x1: 430, y1: 310, x2: 320, y2: 375, color: '#f59e0b', demora: 2.8 },
  { x1: 560, y1: 480, x2: 725, y2: 600, color: '#38bdf8', demora: 3 },
  { x1: 400, y1: 700, x2: 300, y2: 610, color: '#34d399', demora: 3.2 },
];

const TAREAS = [
  { x: 330, y: 30, titulo: 'Nueva tarea', estado: 'Pendiente', colorEstado: '#a78bfa', quien: 'Ana', avance: 0, tramo: '#64748b', demora: 0.6 },
  { x: 470, y: 245, titulo: 'Asignar responsable', estado: 'En progreso', colorEstado: '#f59e0b', quien: 'Tú', avance: 67, tramo: '#facc15', demora: 1.2, viva: true },
  { x: 600, y: 420, titulo: 'Registrar avance', estado: 'En progreso', colorEstado: '#38bdf8', quien: 'Luis', avance: 35, tramo: '#d97706', demora: 1.7 },
  { x: 440, y: 690, titulo: 'Tarea completada', estado: 'Completada', colorEstado: '#10b981', quien: 'Tú', avance: 100, tramo: '#10b981', demora: 2.2 },
];

export default function RutaTareas({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="260 0 640 900"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className={`lg-escena pointer-events-none ${className}`}
    >
      <defs>
        <linearGradient id="lg-ruta" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset=".4" stopColor="#f59e0b" />
          <stop offset=".7" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>

      <path className="lg-ruta lg-dibuja" d={RUTA} />
      <path className="lg-pulso" d={RUTA} />

      {PUNTOS.map((p) => (
        <circle
          key={p.color}
          className="lg-aparece"
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill={p.color}
          style={{ filter: `drop-shadow(0 0 14px ${p.color})`, animationDelay: `${p.demora}s` }}
        />
      ))}

      {RAMAS.map((r) => (
        <g key={`${r.x2}-${r.y2}`}>
          <path
            d={`M${r.x1} ${r.y1} Q${Math.round((r.x1 + r.x2) / 2)} ${r.y1} ${r.x2} ${r.y2}`}
            fill="none"
            stroke={r.color}
            strokeWidth={1.6}
            strokeDasharray="4 6"
            opacity={0.45}
          />
          <circle className="lg-aparece" cx={r.x2} cy={r.y2} r={7} fill={r.color} opacity={0.75} style={{ animationDelay: `${r.demora}s` }} />
        </g>
      ))}

      {TAREAS.map((t, k) => {
        const esTuya = t.quien === 'Tú';
        return (
          <g key={t.titulo} className="lg-flota" style={{ animationDelay: `-${k * 1.6}s` }}>
            <g className="lg-entra" style={{ animationDelay: `${t.demora}s` }}>
              <rect x={t.x} y={t.y} width={ANCHO} height={ALTO} rx={16} fill={`${t.tramo}1f`} stroke={`${t.tramo}99`} strokeWidth={1.5} />
              <circle cx={t.x + 22} cy={t.y + 30} r={5.5} fill={t.colorEstado} />
              <text className="lg-tarea-titulo" x={t.x + 38} y={t.y + 37}>{t.titulo}</text>
              <rect x={t.x + 16} y={t.y + 52} width={esTuya ? 48 : 58} height={22} rx={6} fill={esTuya ? 'rgba(56,189,248,.3)' : 'rgba(30,41,59,.95)'} />
              <text className="lg-tarea-dato" x={t.x + 26} y={t.y + 68}>{t.quien}</text>
              <text className="lg-tarea-dato" x={t.x + (esTuya ? 78 : 88)} y={t.y + 68} fill="#93a3c4">{t.estado}</text>
              <text className="lg-tarea-avance" x={t.x + ANCHO - 18} y={t.y + 68} fill={t.tramo} textAnchor="end">{t.avance}%</text>
              <rect x={t.x + 1} y={t.y + ALTO - 5} width={ANCHO - 2} height={4} fill="rgba(255,255,255,.08)" />
              <g className={t.viva ? 'lg-viva' : undefined}>
                <rect
                  className="lg-llena"
                  x={t.x + 1}
                  y={t.y + ALTO - 5}
                  width={Math.max(0.01, ((ANCHO - 2) * t.avance) / 100)}
                  height={4}
                  fill={t.tramo}
                  style={{ animationDelay: `${t.demora + 0.4}s` }}
                />
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
