'use client';

/**
 * Reloj digital retro (tipo Casio de los 80) para cronometrar una tarea: caja
 * negra, placa plateada, pantalla LCD con digitos de 7 segmentos y tres
 * botones fisicos: rojo a la izquierda para comenzar, amarillo al centro para
 * pausar y rojo a la derecha para terminar.
 *
 * No sabe nada de sesiones ni de la API: recibe el tiempo, el estado y que
 * hace cada boton. Asi lo usan igual la ventana aparte y la pantalla suelta
 * de la tarea.
 */

export type EstadoReloj = 'corriendo' | 'pausado' | 'detenido' | 'ocupado' | 'terminado';

export interface BotonReloj {
  texto: string;
  /** Explicacion al pasar el mouse (por que esta deshabilitado, por ejemplo). */
  titulo?: string;
  deshabilitado?: boolean;
  onClick?: () => void;
}

/** Indicadores de la pantalla: se encienden segun el estado, como en un LCD real. */
const INDICADORES: { estado: EstadoReloj; texto: string }[] = [
  { estado: 'corriendo', texto: 'RUN' },
  { estado: 'pausado', texto: 'PAUSA' },
  { estado: 'ocupado', texto: 'OCUPADO' },
  { estado: 'terminado', texto: 'FIN' },
];

const SEGMENTOS_BARRA = 10;

export default function RelojRetro({
  segundos,
  titulo,
  estado,
  avance = 0,
  objetivos,
  total,
  compacto = false,
  izquierda,
  centro,
  derecha,
}: {
  segundos: number;
  titulo: string;
  estado: EstadoReloj;
  /** 0 a 1: avance de la tarea, en la barra segmentada de la pantalla. */
  avance?: number;
  /** "3/5": objetivos listos sobre el total. */
  objetivos?: string;
  /** Tiempo acumulado de la tarea en todas sus sesiones. */
  total?: string;
  /** Solo pantalla y botones, para la ventana encogida. */
  compacto?: boolean;
  izquierda: BotonReloj;
  centro: BotonReloj;
  derecha: BotonReloj;
}) {
  const tiempo = cronometroLcd(segundos);
  const encendidos = Math.round(Math.max(0, Math.min(1, avance)) * SEGMENTOS_BARRA);

  return (
    <div className={`tf-retro ${compacto ? 'tf-retro-compacto' : ''}`}>
      <div className="tf-retro-placa">
        {!compacto && (
          <span aria-hidden className="tf-retro-lateral">
            MODE · ADJUST
          </span>
        )}

        <div className="tf-retro-marco">
          {!compacto && (
            <div aria-hidden className="tf-retro-cabecera">
              <span className="tf-retro-marca">TIMEFLOW</span>
              <span className="tf-retro-modelo-oro">TASK TIMER</span>
            </div>
          )}

          <div className="tf-retro-lcd">
            <div aria-hidden className="tf-lcd-indicadores">
              {INDICADORES.map((i) => (
                <span key={i.estado} className={estado === i.estado ? 'tf-lcd-on' : 'tf-lcd-off'}>
                  {i.texto}
                </span>
              ))}
            </div>

            {!compacto && (
              <p className="tf-lcd-titulo" title={titulo}>
                {titulo}
              </p>
            )}

            <div
              role="timer"
              aria-label={`Tiempo de esta sesión: ${tiempo.replace(/:/g, ' ')}`}
              className={`tf-lcd-digitos ${estado === 'pausado' ? 'tf-lcd-parpadea' : ''}`}
            >
              <DigitosLcd texto={tiempo} parpadeoDosPuntos={estado === 'corriendo'} />
            </div>

            {!compacto && (
              <div aria-hidden className="tf-lcd-pie">
                <span className="tf-lcd-barra">
                  {Array.from({ length: SEGMENTOS_BARRA }, (_, i) => (
                    <span key={i} className={i < encendidos ? 'tf-lcd-seg-on' : 'tf-lcd-seg-off'} />
                  ))}
                </span>
                {objetivos && <span>OBJ {objetivos}</span>}
              </div>
            )}
            {!compacto && total && (
              <p aria-hidden className="tf-lcd-total">
                TOTAL {total.toUpperCase()}
              </p>
            )}
          </div>
        </div>

        <div className="tf-retro-botones">
          <BotonFisico boton={izquierda} color="rojo" etiqueta="START" />
          <BotonFisico boton={centro} color="amarillo" etiqueta="PAUSE" />
          <BotonFisico boton={derecha} color="rojo" etiqueta="STOP" />
        </div>

        {!compacto && (
          <p aria-hidden className="tf-retro-modelo">
            TF-8
          </p>
        )}
      </div>
    </div>
  );
}

/** Un boton de goma con su plaquita dorada encima, como los del reloj. */
function BotonFisico({
  boton,
  color,
  etiqueta,
}: {
  boton: BotonReloj;
  color: 'rojo' | 'amarillo';
  etiqueta: string;
}) {
  return (
    <div className="tf-retro-control">
      <span aria-hidden className="tf-retro-plaquita">
        {etiqueta}
      </span>
      <button
        type="button"
        onClick={boton.onClick}
        disabled={boton.deshabilitado}
        title={boton.titulo ?? boton.texto}
        className={`tf-retro-boton tf-retro-boton-${color}`}
      >
        <span className="sr-only">{boton.texto}</span>
      </button>
      <span className="tf-retro-funcion">{boton.texto}</span>
    </div>
  );
}

/** HH:MM:SS sin limite de horas (el cronometro puede pasar de 99 h). */
function cronometroLcd(segundos: number) {
  const s = Math.max(0, Math.floor(segundos));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${ss}`;
}

// ------------------------------------------------------------ 7 segmentos

/** Un digito ocupa 12 x 22 unidades; cada segmento es un poligono biselado. */
const POLIGONOS: Record<string, string> = {
  a: '1.4,0 10.6,0 9.2,2.4 2.8,2.4',
  b: '12,1.4 12,9.8 10.8,10.8 9.6,9.8 9.6,2.8',
  c: '12,12.2 12,20.6 9.6,19.2 9.6,12.2 10.8,11.2',
  d: '2.8,19.6 9.2,19.6 10.6,22 1.4,22',
  e: '0,12.2 1.2,11.2 2.4,12.2 2.4,19.2 0,20.6',
  f: '0,1.4 2.4,2.8 2.4,9.8 1.2,10.8 0,9.8',
  g: '2,11 3.2,9.8 8.8,9.8 10,11 8.8,12.2 3.2,12.2',
};

const SEGMENTOS_DIGITO: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

const AVANCE_DIGITO = 15;
const ANCHO_DOS_PUNTOS = 7;
/** Los segundos van mas chicos, como en los relojes de la epoca. */
const ESCALA_SEGUNDOS = 0.62;

/**
 * Digitos de cristal liquido: los segmentos apagados se ven tenues detras de
 * los encendidos, que es lo que hace que una pantalla LCD se lea como tal.
 */
function DigitosLcd({ texto, parpadeoDosPuntos }: { texto: string; parpadeoDosPuntos: boolean }) {
  const corte = texto.lastIndexOf(':');
  const grande = texto.slice(0, corte);
  const chico = texto.slice(corte + 1);

  const piezas: React.ReactNode[] = [];
  let x = 0;
  for (const [i, car] of [...grande].entries()) {
    if (car === ':') {
      piezas.push(<DosPuntos key={`p${i}`} x={x} parpadea={parpadeoDosPuntos} />);
      x += ANCHO_DOS_PUNTOS;
    } else {
      piezas.push(<Digito key={`d${i}`} x={x} y={0} escala={1} valor={car} />);
      x += AVANCE_DIGITO;
    }
  }
  x += 2;
  const ySegundos = 22 - 22 * ESCALA_SEGUNDOS;
  for (const [i, car] of [...chico].entries()) {
    piezas.push(<Digito key={`s${i}`} x={x} y={ySegundos} escala={ESCALA_SEGUNDOS} valor={car} />);
    x += AVANCE_DIGITO * ESCALA_SEGUNDOS;
  }

  return (
    <svg viewBox={`-1 -1 ${x + 2} 24`} className="h-full w-auto overflow-visible" aria-hidden>
      {/* Leve inclinacion de las pantallas de la epoca */}
      <g transform="skewX(-6) translate(2 0)">{piezas}</g>
    </svg>
  );
}

function Digito({ x, y, escala, valor }: { x: number; y: number; escala: number; valor: string }) {
  const encendidos = SEGMENTOS_DIGITO[valor] ?? '';
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      {Object.entries(POLIGONOS).map(([seg, puntos]) => (
        <polygon key={seg} points={puntos} className={encendidos.includes(seg) ? 'tf-lcd-seg-lit' : 'tf-lcd-seg-ghost'} />
      ))}
    </g>
  );
}

function DosPuntos({ x, parpadea }: { x: number; parpadea: boolean }) {
  return (
    <g className={`tf-lcd-seg-lit ${parpadea ? 'tf-lcd-dos-puntos' : ''}`}>
      <rect x={x + 2.3} y="5.5" width="2.4" height="2.4" />
      <rect x={x + 2.3} y="14" width="2.4" height="2.4" />
    </g>
  );
}
