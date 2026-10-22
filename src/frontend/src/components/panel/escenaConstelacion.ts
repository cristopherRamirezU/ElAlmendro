/**
 * Motor de la constelacion de proyectos del Panel: cada proyecto es una
 * tarjeta en un anillo en perspectiva (en proceso adentro, completados
 * afuera) alrededor de una mini esfera hecha de puntos, uno por tarea.
 *
 * Todo lo visual va en un unico canvas, tarjetas incluidas. Lo interactivo en
 * HTML (los filtros y la tarjetita del proyecto enfocado) lo pinta React; el
 * motor solo lo ubica y lo muestra u oculta en cada cuadro, sin pasar por el
 * estado de React.
 *
 * Portado de la maqueta (docs/mockups/constelacion-proyectos/maqueta.html):
 * medidas, colores y tiempos siguen ese archivo. La maqueta cuenta por cuadros
 * a 60 fps; aqui cada paso se escala por el tiempo real del cuadro, asi una
 * pantalla de 120 Hz no gira al doble.
 */

export type Filtro = 'todos' | 'proceso' | 'completados';

/** Lo que la escena necesita de cada proyecto. */
export interface ProyectoEscena {
  id: string;
  nombre: string;
  total: number;
  hechas: number;
  completado: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Elipse donde van las tarjetas; grupo 0 = en proceso, 1 = completados. */
interface Anillo {
  rx: number;
  ry: number;
  grupo: 0 | 1;
}

/** Lugar fijo de un proyecto: su anillo y su angulo en el (sin el giro). */
interface Lugar {
  anillo: number;
  a: number;
}

/**
 * Tarjeta tal como se dibuja: radios y angulo se acercan suave a su lugar,
 * asi un reacomodo (por ejemplo, al crear un proyecto) no hace saltar nada.
 */
interface Carta {
  p: ProyectoEscena;
  rx: number;
  ry: number;
  a: number;
  objetivo: { rx: number; ry: number; a: number };
  /** Avance del nacimiento desde la esfera (0 a 1,6), o null si ya llego. */
  nace: number | null;
}

/** Tarjeta ubicada en el cuadro actual (coordenadas sin el zoom). */
interface Nodo {
  c: Carta;
  x: number;
  y: number;
  /** Profundidad: -1 al fondo del anillo, 1 al frente. */
  z: number;
  /** Escala total de la tarjeta (profundidad, tamano general y nacimiento). */
  s: number;
}

interface PuntoEsfera {
  /** Indice del proyecto en `proyectos`, o -1 en la esfera vacia. */
  pi: number;
  hecha: boolean;
  s: [number, number, number];
  X: number;
  Y: number;
  Z: number;
}

/** Giro de los anillos y de la esfera: casi imperceptible a proposito. */
const GIRO_ANILLOS = 0.00025; // rad por cuadro a 60 fps
const GIRO_ESFERA = 0.00025;
/** Inclinacion de la esfera hacia quien mira. */
const INCLINACION_ESFERA = -0.38;
const RADIO_ESFERA = 30;
/** Zona sensible de la esfera para desplegar "Nuevo proyecto". */
const RADIO_HOVER_ESFERA = 40;
const ANCHO_BOTON = 150;
const ALTO_BOTON = 32;
const SEPARACION_BOTON = 18;
/** Tarjeta de proyecto a escala 1 (al frente se ve a 0,95 y al fondo a 0,8). */
const ANCHO_CARTA = 150;
const ALTO_CARTA = 50;
/** Tamano de las tarjetas segun el ancho de la vista: entre estas veces la base. */
const TAMANO_MINIMO = 1.35;
const TAMANO_MAXIMO = 1.75;
/** Acercamiento al enfocar un proyecto: la escena crece hasta 1 + esto. */
const ZOOM_FOCO = 0.35;
/** Desenfoque del resto de la escena con un proyecto enfocado, en px. */
const DESENFOQUE = 4;
/** Margen para ir del proyecto a su tarjetita, o de la esfera al boton. */
const RETENER_S = 0.4;
/** Sobre esta cantidad de tareas, cada punto de la esfera junta varias. */
const MAX_PUNTOS = 1500;
/**
 * Con menos tareas que esto, la esfera se completa con puntos de estructura
 * muy tenues (no son tareas), para que el nucleo siempre se vea como esfera.
 */
const PUNTOS_MINIMOS = 110;
/** Tope de nitidez del lienzo: por encima, el costo crece y no se nota. */
const DPR_MAXIMO = 1.5;
/** Lo mas que se avanza en un cuadro: si el navegador se demora, no salta. */
const PASO_MAXIMO = 0.08;
/** Fases de giro en que se revisa que las tarjetas no se encimen. */
const FASES = 24;
/** Angulos de prueba por anillo al acomodar. */
const DESFASES = 36;
/** Aire minimo entre tarjetas, en px. */
const MARGEN = 4;
/** Area encimada (px²) que se da por nula: absorbe el redondeo. */
const TOLERANCIA = 1;

const TAU = Math.PI * 2;
const suave = (v: number) => (v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2);
const salida = (v: number) => 1 - Math.pow(1 - v, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Escala por profundidad: 0,8 al fondo y 0,95 al frente, sin saltos al cruzar. */
const escalaProfundidad = (z: number) => 0.875 + 0.075 * z;

function solape(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  if (w <= 0) return 0;
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return h > 0 ? w * h : 0;
}

function rectCarta(cx: number, cy: number, an: Anillo, ang: number, escala: number): Rect {
  const s = escalaProfundidad(Math.sin(ang)) * escala;
  const w = ANCHO_CARTA * s + MARGEN * 2;
  const h = ALTO_CARTA * s + MARGEN * 2;
  return { x: cx + Math.cos(ang) * an.rx - w / 2, y: cy + Math.sin(ang) * an.ry - h / 2, w, h };
}

/** Boton "Nuevo proyecto": a la derecha de la esfera, centrado en su altura. */
const rectBoton = (cx: number, cy: number): Rect => ({
  x: cx + RADIO_ESFERA + SEPARACION_BOTON,
  y: cy - ALTO_BOTON / 2,
  w: ANCHO_BOTON,
  h: ALTO_BOTON,
});

/**
 * Anillos para una vista de W x H. Por omision, los dos de la maqueta
 * (27 % y 44 % del ancho, aplastados a 0,5 y 0,36). Con `separar`, los
 * anillos se abren en vertical para que una tarjeta de uno no pise a la del
 * otro cuando pasan por arriba o por abajo, y el interior puede ser mas
 * ancho (`anchoInterior`) para que quepan mas tarjetas; con mas de un anillo
 * por grupo, los intermedios se reparten entre el interior y el exterior.
 */
function geometria(
  W: number,
  H: number,
  porGrupo: [number, number],
  separar: boolean,
  anchoInterior: number,
  escala: number,
): Anillo[] {
  const n = porGrupo[0] + porGrupo[1];
  const cy = H / 2;
  // Que ninguna tarjeta se salga de la vista ni pise los filtros de arriba.
  const rxMax = Math.max(0, W / 2 - 8 - (ANCHO_CARTA / 2) * 0.875 * escala);
  const ryMax = Math.max(0, Math.min(cy - 44 - (ALTO_CARTA / 2) * 0.8 * escala, H - 8 - cy - (ALTO_CARTA / 2) * 0.95 * escala));
  const rxIn = Math.min(W * anchoInterior, rxMax);
  const rxOut = Math.max(rxIn, Math.min(W * 0.44, rxMax));
  // En diagonal, dos anillos se acercan a 0,7 de su separacion: se abre de mas.
  const sep = separar ? 1.45 * (ALTO_CARTA * 0.875 * escala + MARGEN * 2) : 0;
  // El anillo interior pasa por debajo del % sin taparlo; separados, se
  // aplana lo justo para que el exterior quepa en la vista.
  const ryMin = RADIO_ESFERA + 40 + (ALTO_CARTA / 2) * 0.95 * escala + MARGEN;
  let ryIn = Math.min(Math.max(rxIn * 0.5, ryMin), ryMax);
  if (separar) ryIn = Math.max(Math.min(ryMin, ryMax), Math.min(ryIn, ryMax - (n - 1) * sep));
  const ryOut = Math.min(Math.max(rxOut * 0.36, ryIn + (n - 1) * sep, ryIn), ryMax);
  return Array.from({ length: n }, (_, k) => {
    const f = n > 1 ? k / (n - 1) : 0;
    return { rx: lerp(rxIn, rxOut, f), ry: lerp(ryIn, ryOut, f), grupo: k < porGrupo[0] ? 0 : 1 };
  });
}

/**
 * Prueba un juego de anillos: reparte cada grupo en sus anillos (mas
 * tarjetas en los mas largos), separa parejo las de cada anillo y busca el
 * desfase de cada anillo que menos pisa lo ya ubicado. Como todo gira, el
 * solape se mide en varias fases del giro, no solo en la posicion actual.
 * Devuelve el costo (area encimada) y el lugar de cada proyecto; deja de
 * contar al llegar a `tope`.
 */
function probar(
  proyectos: ProyectoEscena[],
  anillos: Anillo[],
  W: number,
  H: number,
  escala: number,
  zonas: Rect[],
  tope = Infinity,
) {
  const cx = W / 2;
  const cy = H / 2;
  const vista: Rect = { x: 0, y: 0, w: W, h: H };
  const porAnillo: ProyectoEscena[][] = anillos.map(() => []);
  for (const grupo of [0, 1] as const) {
    const ids = anillos.map((a, i) => (a.grupo === grupo ? i : -1)).filter((i) => i >= 0);
    const lista = proyectos.filter((p) => (p.completado ? 1 : 0) === grupo);
    const largo = ids.reduce((s, i) => s + anillos[i].rx + anillos[i].ry, 0);
    let desde = 0;
    ids.forEach((i, k) => {
      const cuantos =
        k === ids.length - 1
          ? lista.length - desde
          : Math.round((lista.length * (anillos[i].rx + anillos[i].ry)) / largo);
      porAnillo[i] = lista.slice(desde, desde + cuantos);
      desde += cuantos;
    });
  }

  // Rectangulos ya ubicados, por fase del giro.
  const ubicados: Rect[][] = Array.from({ length: FASES }, () => []);
  const lugares = new Map<string, Lugar>();
  let costo = 0;
  for (let r = 0; r < anillos.length && costo < tope; r++) {
    const an = anillos[r];
    const lista = porAnillo[r];
    const m = lista.length;
    if (!m) continue;
    // Desfase de la maqueta primero: a igual costo, gana el de la maqueta.
    const base = an.grupo * 1.2 + 0.4 + r * 0.7;
    let mejor = base;
    let menor = Infinity;
    for (let d = 0; d < DESFASES && menor >= TOLERANCIA; d++) {
      const desfase = base + (d / DESFASES) * (TAU / m);
      const corte = Math.min(menor, tope - costo);
      let c = 0;
      for (let f = 0; f < FASES && c < corte; f++) {
        const fase = (f / FASES) * TAU;
        const propios: Rect[] = [];
        for (let j = 0; j < m; j++) {
          const rc = rectCarta(cx, cy, an, (j / m) * TAU + desfase + fase, escala);
          // Lo que se sale de la vista (con tolerancia al redondeo).
          const fuera = rc.w * rc.h - solape(rc, vista);
          if (fuera > 0.5) c += fuera * 2;
          for (const z of zonas) c += solape(rc, z);
          for (const o of ubicados[f]) c += solape(rc, o) * 2;
          for (const o of propios) c += solape(rc, o) * 2;
          propios.push(rc);
        }
      }
      if (c < menor) {
        menor = c;
        mejor = desfase;
      }
    }
    costo += menor;
    lista.forEach((p, j) => lugares.set(p.id, { anillo: r, a: (j / m) * TAU + mejor }));
    for (let f = 0; f < FASES; f++) {
      const fase = (f / FASES) * TAU;
      for (let j = 0; j < m; j++) ubicados[f].push(rectCarta(cx, cy, an, (j / m) * TAU + mejor + fase, escala));
    }
  }
  return { costo, lugares };
}

/**
 * Acomodo de todas las tarjetas sin que se encimen en ningun momento del giro.
 * Se prueba de lo mas parecido a la maqueta (dos anillos, tamano normal) a lo
 * mas apretado (anillos mas abiertos, mas anillos por grupo y tarjetas algo
 * mas chicas) y se queda con el primero que no pisa nada. Si ninguno lo
 * logra (muchisimos proyectos en poco espacio), con el que menos pisa.
 */
function acomodar(proyectos: ProyectoEscena[], W: number, H: number) {
  const cx = W / 2;
  const cy = H / 2;
  // La esfera, el % de abajo y los filtros. El boton "Nuevo proyecto" no
  // cuenta: se dibuja por encima de las tarjetas, que ademas se atenuan.
  const zonas: Rect[] = [
    { x: cx - 30, y: cy - 30, w: 60, h: 60 },
    { x: cx - 34, y: cy + RADIO_ESFERA + 12, w: 68, h: 28 },
    { x: cx - 170, y: 0, w: 340, h: 44 },
    // Boton del fondo, arriba a la derecha.
    { x: W - 230, y: 0, w: 230, h: 50 },
  ];
  const enProceso = proyectos.filter((p) => !p.completado).length;
  const completados = proyectos.length - enProceso;
  // [anillos en proceso, anillos completados, separar, ancho del interior]
  const opciones: [number, number, boolean, number][] = [
    [1, 1, false, 0.27],
    [1, 1, true, 0.27],
    [1, 1, true, 0.33],
    [1, 1, true, 0.37],
    [2, 1, true, 0.27],
    [1, 2, true, 0.27],
    [2, 2, true, 0.27],
    [3, 1, true, 0.24],
  ];
  // Las tarjetas crecen con el ancho de la vista (las de la maqueta, a 1100 px,
  // se ven chicas en pantallas grandes); con muchos proyectos se achican.
  const tamano = Math.min(TAMANO_MAXIMO, Math.max(TAMANO_MINIMO, W / 950));
  const pruebas: { anillos: Anillo[]; escala: number }[] = [];
  for (const escala of [1, 0.9, 0.8, 0.7, 0.6].map((e) => e * tamano)) {
    for (const [p, c, separar, ancho] of opciones) {
      // Un grupo no usa mas anillos que proyectos tiene.
      if ((p > 1 && p > enProceso) || (c > 1 && c > completados)) continue;
      pruebas.push({ anillos: geometria(W, H, [p, c], separar, ancho, escala), escala });
    }
  }
  // Primero se busca uno sin solapes, cortando cada prueba al primer roce.
  for (const t of pruebas) {
    const r = probar(proyectos, t.anillos, W, H, t.escala, zonas, TOLERANCIA);
    if (r.costo < TOLERANCIA) return { ...r, ...t };
  }
  let mejor: { costo: number; lugares: Map<string, Lugar>; anillos: Anillo[]; escala: number } | null = null;
  for (const t of pruebas) {
    const r = probar(proyectos, t.anillos, W, H, t.escala, zonas, mejor?.costo);
    if (!mejor || r.costo < mejor.costo) mejor = { ...r, ...t };
  }
  return mejor!;
}

/** Fondos que se pueden elegir para la constelacion. */
export const FONDOS = [
  'nebulosa',
  'aurora',
  'orion',
  'oceano',
  'atardecer',
  'esmeralda',
  'galaxia',
  'meteoros',
  'medianoche',
  'via-lactea',
  'carta',
  'horizonte',
  'estrellas',
] as const;
export type Fondo = (typeof FONDOS)[number];

/** Numero pseudoaleatorio repetible: el mismo fondo sale igual en cada visita. */
function azar(semilla: number) {
  let t = semilla >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mancha de luz difusa: un degradado radial que se apaga hacia el borde. */
function nube(g: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, r: number, color: string, opacidad: number) {
  const d = g.createRadialGradient(x, y, 0, x, y, r);
  d.addColorStop(0, `rgba(${color},${opacidad})`);
  d.addColorStop(0.45, `rgba(${color},${opacidad * 0.45})`);
  d.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = d;
  g.fillRect(0, 0, W, H);
}

/**
 * Fondo de la escena, pre-dibujado una vez por tamano de vista: cada cuadro
 * solo lo estampa, asi no cuesta rendimiento. "estrellas" no tiene capa
 * propia: queda solo el cielo estrellado de la maqueta.
 *  - nebulosa: nubes violeta, azul y rosa (los tonos de la marca) muy difusas.
 *  - aurora: velos verdes y turquesa que ondulan por arriba.
 *  - orion: rosa y coral calidos con un nucleo brillante.
 *  - oceano: azul y turquesa profundos, como bajo el agua.
 *  - atardecer: magenta arriba que se funde en naranja abajo.
 *  - esmeralda: verdes profundos con brillo menta.
 *  - galaxia: una espiral tenue en una esquina.
 *  - meteoros: estelas finas que cruzan en diagonal.
 *  - medianoche: azul noche casi plano, con los bordes oscurecidos.
 *  - via-lactea: una franja de polvo de estrellas que cruza en diagonal.
 *  - carta: reticula tenue y circulos de coordenadas, como un mapa del cielo
 *    (las lineas de la esfera a cada proyecto se dibujan en cada cuadro).
 *  - horizonte: el borde iluminado de un planeta abajo, como amanecer orbital.
 */
function crearFondo(tipo: Fondo, W: number, H: number, dpr: number, fuente: string) {
  if (tipo === 'estrellas' || W <= 0 || H <= 0) return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * dpr));
  c.height = Math.max(1, Math.round(H * dpr));
  const g = c.getContext('2d');
  if (!g) return null;
  g.scale(dpr, dpr);
  const lado = Math.max(W, H);

  if (tipo === 'nebulosa') {
    nube(g, W, H, W * 0.28, H * 0.34, lado * 0.5, '91,60,196', 0.32);
    nube(g, W, H, W * 0.76, H * 0.7, lado * 0.48, '26,127,168', 0.26);
    nube(g, W, H, W * 0.62, H * 0.18, lado * 0.32, '194,66,126', 0.16);
    nube(g, W, H, W * 0.12, H * 0.82, lado * 0.3, '63,107,255', 0.14);
  } else if (tipo === 'aurora') {
    // Tres velos ondulados que cuelgan desde arriba, cada uno de un tono.
    const velos: [number, string, number][] = [
      [0, '40,220,160', 0.3],
      [0.08, '30,170,200', 0.22],
      [0.16, '110,90,255', 0.15],
    ];
    // Desenfocados, los velos no tienen borde: se ven como luz y no como cerros.
    g.save();
    g.filter = `blur(${Math.round(Math.min(W, H) * 0.04)}px)`;
    for (const [desfase, color, opacidad] of velos) {
      const base = H * (0.18 + desfase);
      g.beginPath();
      g.moveTo(0, base);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, base + Math.sin(x / (W * 0.14) + desfase * 40) * H * 0.08);
      g.lineTo(W, 0);
      g.lineTo(0, 0);
      g.closePath();
      const d = g.createLinearGradient(0, 0, 0, H * (0.42 + desfase));
      d.addColorStop(0, `rgba(${color},0)`);
      d.addColorStop(0.7, `rgba(${color},${opacidad})`);
      d.addColorStop(1, `rgba(${color},${opacidad * 0.3})`);
      g.fillStyle = d;
      g.fill();
    }
    g.restore();
    nube(g, W, H, W * 0.5, H * 0.1, lado * 0.45, '40,200,170', 0.06);
  } else if (tipo === 'orion') {
    nube(g, W, H, W * 0.55, H * 0.45, lado * 0.42, '214,83,126', 0.3);
    nube(g, W, H, W * 0.6, H * 0.48, lado * 0.16, '255,170,140', 0.22);
    nube(g, W, H, W * 0.3, H * 0.7, lado * 0.4, '120,60,170', 0.2);
    nube(g, W, H, W * 0.85, H * 0.25, lado * 0.3, '240,120,90', 0.12);
  } else if (tipo === 'oceano') {
    nube(g, W, H, W * 0.3, H * 0.75, lado * 0.55, '20,90,150', 0.36);
    nube(g, W, H, W * 0.75, H * 0.3, lado * 0.45, '20,160,170', 0.22);
    nube(g, W, H, W * 0.5, H * 0.5, lado * 0.3, '40,110,255', 0.12);
  } else if (tipo === 'atardecer') {
    const cielo = g.createLinearGradient(0, 0, 0, H);
    cielo.addColorStop(0, 'rgba(150,40,140,0.36)');
    cielo.addColorStop(0.6, 'rgba(60,30,90,0.18)');
    cielo.addColorStop(1, 'rgba(240,120,60,0.28)');
    g.fillStyle = cielo;
    g.fillRect(0, 0, W, H);
    nube(g, W, H, W * 0.5, H, lado * 0.4, '255,140,70', 0.18);
  } else if (tipo === 'esmeralda') {
    nube(g, W, H, W * 0.35, H * 0.4, lado * 0.5, '16,110,86', 0.34);
    nube(g, W, H, W * 0.72, H * 0.68, lado * 0.4, '40,190,140', 0.2);
    nube(g, W, H, W * 0.8, H * 0.2, lado * 0.25, '60,120,200', 0.12);
  } else if (tipo === 'galaxia') {
    // Espiral de dos brazos, aplastada e inclinada, arriba a la derecha.
    const escala = Math.min(W, H) / 150;
    const r = azar(11);
    g.save();
    g.translate(W * 0.82, H * 0.26);
    g.rotate(-0.5);
    g.scale(1, 0.45);
    for (let i = 0; i < 2400; i++) {
      const t = (i / 2400) * 9;
      const radio = (3 + t * 6) * escala;
      const brazo = (i % 2 ? 0 : Math.PI) + t * 0.75;
      const jx = (r() - 0.5) * (2 + t * 0.6) * escala;
      const jy = (r() - 0.5) * (2 + t * 0.6) * escala;
      g.fillStyle = `rgba(205,195,255,${0.42 * (1 - t / 9)})`;
      g.fillRect(Math.cos(brazo) * radio + jx, Math.sin(brazo) * radio + jy, 1.1, 1.1);
    }
    const nucleo = g.createRadialGradient(0, 0, 0, 0, 0, 16 * escala);
    nucleo.addColorStop(0, 'rgba(225,210,255,0.45)');
    nucleo.addColorStop(1, 'rgba(225,210,255,0)');
    g.fillStyle = nucleo;
    g.beginPath();
    g.arc(0, 0, 16 * escala, 0, TAU);
    g.fill();
    g.restore();
    nube(g, W, H, W * 0.3, H * 0.6, lado * 0.45, '63,107,255', 0.08);
  } else if (tipo === 'meteoros') {
    nube(g, W, H, W * 0.5, H * 0.4, lado * 0.5, '63,107,255', 0.12);
    const r = azar(9);
    const total = Math.max(6, Math.round((W * H) / 70000));
    for (let i = 0; i < total; i++) {
      const x = r() * W;
      const y = r() * H * 0.75;
      const largo = (0.08 + r() * 0.12) * Math.min(W, H);
      const estela = g.createLinearGradient(x, y, x + largo, y + largo * 0.55);
      estela.addColorStop(0, 'rgba(220,230,255,0)');
      estela.addColorStop(1, `rgba(220,230,255,${0.35 + r() * 0.3})`);
      g.strokeStyle = estela;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + largo, y + largo * 0.55);
      g.stroke();
    }
  } else if (tipo === 'medianoche') {
    nube(g, W, H, W * 0.5, H * 0.45, lado * 0.7, '30,50,120', 0.3);
    const vineta = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, lado * 0.7);
    vineta.addColorStop(0, 'rgba(0,0,0,0)');
    vineta.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vineta;
    g.fillRect(0, 0, W, H);
  } else if (tipo === 'via-lactea') {
    // La franja va en diagonal, de abajo a la izquierda hacia arriba a la derecha.
    const ang = -Math.atan2(H, W) * 0.85;
    const ancho = Math.min(W, H) * 0.42;
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(ang);
    const banda = g.createLinearGradient(0, -ancho, 0, ancho);
    banda.addColorStop(0, 'rgba(138,162,255,0)');
    banda.addColorStop(0.35, 'rgba(138,162,255,0.14)');
    banda.addColorStop(0.5, 'rgba(170,185,255,0.24)');
    banda.addColorStop(0.65, 'rgba(138,162,255,0.14)');
    banda.addColorStop(1, 'rgba(138,162,255,0)');
    g.fillStyle = banda;
    g.fillRect(-lado, -ancho, lado * 2, ancho * 2);
    // Veta oscura de polvo por el medio, como en la Via Lactea real.
    const veta = g.createLinearGradient(0, -ancho * 0.16, 0, ancho * 0.16);
    veta.addColorStop(0, 'rgba(3,6,15,0)');
    veta.addColorStop(0.5, 'rgba(3,6,15,0.35)');
    veta.addColorStop(1, 'rgba(3,6,15,0)');
    g.fillStyle = veta;
    g.fillRect(-lado, -ancho * 0.16, lado * 2, ancho * 0.32);
    // Polvo de estrellas: muchas, chicas y apretadas hacia el eje de la franja.
    const r = azar(7);
    const total = Math.round((W * H) / 900);
    for (let i = 0; i < total; i++) {
      const x = (r() - 0.5) * lado * 2;
      const y = (r() + r() + r() - 1.5) * ancho * 0.7;
      const t = r() < 0.9 ? 0.8 : 1.4;
      g.fillStyle = `rgba(215,225,255,${0.18 + r() * 0.45})`;
      g.fillRect(x, y, t, t);
    }
    g.restore();
    nube(g, W, H, W * 0.5, H * 0.5, lado * 0.35, '91,60,196', 0.08);
  } else if (tipo === 'carta') {
    g.strokeStyle = 'rgba(110,150,255,0.06)';
    g.lineWidth = 1;
    const paso = 64;
    g.beginPath();
    for (let x = (W / 2) % paso; x < W; x += paso) {
      g.moveTo(Math.round(x) + 0.5, 0);
      g.lineTo(Math.round(x) + 0.5, H);
    }
    for (let y = (H / 2) % paso; y < H; y += paso) {
      g.moveTo(0, Math.round(y) + 0.5);
      g.lineTo(W, Math.round(y) + 0.5);
    }
    g.stroke();
    g.strokeStyle = 'rgba(110,150,255,0.09)';
    for (const f of [0.16, 0.3, 0.46]) {
      g.beginPath();
      g.arc(W / 2, H / 2, lado * f, 0, TAU);
      g.stroke();
    }
    // Rotulos de coordenadas en los bordes, muy tenues.
    g.fillStyle = 'rgba(127,141,184,0.45)';
    g.font = `400 10px ${fuente}`;
    g.textBaseline = 'top';
    g.fillText('AR 04h 12m', 14, H - 24);
    g.textAlign = 'right';
    g.fillText('DEC +12° 30′', W - 14, H - 24);
    nube(g, W, H, W * 0.5, H * 0.5, lado * 0.4, '63,107,255', 0.07);
  } else {
    // Planeta bajo el horizonte: solo asoma su borde, iluminado de azul.
    const R = Math.max(W * 0.95, H * 1.2);
    const px = W / 2;
    const py = H + R * 0.82;
    const atmosfera = g.createRadialGradient(px, py, R * 0.96, px, py, R * 1.16);
    atmosfera.addColorStop(0, 'rgba(91,125,255,0.38)');
    atmosfera.addColorStop(0.3, 'rgba(91,125,255,0.14)');
    atmosfera.addColorStop(1, 'rgba(91,125,255,0)');
    g.fillStyle = atmosfera;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#060a18';
    g.beginPath();
    g.arc(px, py, R, 0, TAU);
    g.fill();
    // Filo de luz del amanecer sobre el borde, mas intenso al centro.
    const filo = g.createLinearGradient(0, 0, W, 0);
    filo.addColorStop(0, 'rgba(160,185,255,0)');
    filo.addColorStop(0.5, 'rgba(190,205,255,0.7)');
    filo.addColorStop(1, 'rgba(160,185,255,0)');
    g.strokeStyle = filo;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(px, py, R, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    nube(g, W, H, W * 0.5, H, lado * 0.3, '130,90,255', 0.12);
    nube(g, W, H, W * 0.2, H * 0.2, lado * 0.3, '91,60,196', 0.08);
  }
  return c;
}

export class EscenaConstelacion {
  private lienzo: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** Lienzo aparte para lo que se desenfoca: se desenfoca de una sola vez. */
  private capa: HTMLCanvasElement;
  private ctxCapa: CanvasRenderingContext2D;
  /** Fondo elegido y su capa, pre-dibujada al tamano actual del lienzo. */
  private fondoActual: Fondo = 'nebulosa';
  private capaFondo: HTMLCanvasElement | null = null;
  private raiz: HTMLElement;
  private tarjeta: HTMLElement;
  private filtros: HTMLElement;
  private fuente: string;
  private alEnfocar: (id: string) => void;
  private alCrear: () => void;

  private filtroActual: Filtro = 'todos';
  private conBoton = true;

  private proyectos: ProyectoEscena[] = [];
  private claveDatos = '';
  private primeraCarga = true;
  private cartas = new Map<string, Carta>();
  private anillos: Anillo[] = [];
  /** Anillos tal como se dibujan: siguen suave a `anillos` tras un reacomodo. */
  private anillosVista: Anillo[] = [];
  private escala = 1;
  private puntos: PuntoEsfera[] = [];
  private nombres = new Map<string, string>();
  private estrellas = Array.from({ length: 120 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 0.9 + 0.2,
    p: Math.random() * 6,
  }));
  private chispas = Array.from({ length: 12 }, () => ({
    o: Math.random(),
    y: (Math.random() - 0.5) * 10,
    s: 0.4 + Math.random() * 0.6,
  }));

  private W = 0;
  private H = 0;
  private dpr = 1;
  private last = 0;
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private esperaMedida: ReturnType<typeof setTimeout> | null = null;
  private io: IntersectionObserver | null = null;
  private enVista = true;
  private reducido = false;
  private puedeDesenfocar = false;

  /** Segundos de animacion (las estrellas titilan y el boton brilla con esto). */
  private t = 0;
  /** Giro acumulado de los anillos y de la esfera. */
  private ang = 0;
  private giroEsfera = 0;
  /** Mouse sobre el lienzo, o -1 si no esta. */
  private mx = -1;
  private my = -1;
  /** Donde empezo un toque, para distinguirlo de un arrastre. */
  private toque: { x: number; y: number; t: number } | null = null;
  /** Proyecto enfocado (zoom y tarjetita), o ninguno. */
  private sel: string | null = null;
  /** Ultimo proyecto enfocado: la esfera lo sigue resaltando mientras se suelta. */
  private ultimoFoco: string | null = null;
  /** Proyecto fijado por toque o por teclado: no depende del mouse. */
  private fijo: string | null = null;
  private retener = 0;
  private enTarjeta = false;
  /** Avance del zoom hacia el proyecto enfocado, de 0 a 1. */
  private z = 0;
  private tarjetaVisible = false;
  /** Punto al que se acerca la camara. */
  private fx = 0;
  private fy = 0;
  /** Corrimiento de la camara al acercarse, para no cortar la tarjeta en un borde. */
  private desvio = { x: 0, y: 0 };
  /** Despliegue del boton "Nuevo proyecto", de 0 a 1. */
  private ab = 0;
  private abHover = 0;
  private retenerBoton = 0;
  private botonFijo = false;
  /** Onda de luz al hacer clic en el boton. */
  private pulso = 0;
  /** Ultimo cuadro: tarjetas y camara, para saber que hay bajo un toque. */
  private ultimos: Nodo[] = [];
  private camara = { fx: 0, fy: 0, S: 1, tx: 0, ty: 0 };

  constructor(
    raiz: HTMLElement,
    lienzo: HTMLCanvasElement,
    opciones: {
      tarjeta: HTMLElement;
      filtros: HTMLElement;
      fuente: string;
      alEnfocar: (id: string) => void;
      alCrear: () => void;
    },
  ) {
    this.raiz = raiz;
    this.lienzo = lienzo;
    this.ctx = lienzo.getContext('2d')!;
    this.capa = document.createElement('canvas');
    this.ctxCapa = this.capa.getContext('2d')!;
    this.tarjeta = opciones.tarjeta;
    this.tarjeta.inert = true;
    this.filtros = opciones.filtros;
    this.fuente = opciones.fuente;
    this.alEnfocar = opciones.alEnfocar;
    this.alCrear = opciones.alCrear;
    this.reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Safari antiguo no tiene filtros en el canvas: ahi el resto solo se oscurece.
    this.puedeDesenfocar = typeof this.ctx.filter === 'string';

    lienzo.addEventListener('pointermove', this.alMover);
    lienzo.addEventListener('pointerleave', this.alSalir);
    lienzo.addEventListener('pointerdown', this.alPresionar);
    lienzo.addEventListener('pointerup', this.alSoltar);
    this.tarjeta.addEventListener('pointerenter', this.alEntrarTarjeta);
    this.tarjeta.addEventListener('pointerleave', this.alSalirTarjeta);
    // Al terminar de cargar la fuente cambian los anchos: se recortan de nuevo los nombres.
    document.fonts?.addEventListener('loadingdone', this.alCargarFuentes);

    this.ro = new ResizeObserver(() => this.medir());
    this.ro.observe(raiz);
    // Fuera de la vista (por ejemplo, al bajar por la pagina) no se dibuja.
    this.io = new IntersectionObserver(([e]) => {
      this.enVista = e.isIntersecting;
    });
    this.io.observe(raiz);
    this.medir();
    this.fx = this.W / 2;
    this.fy = this.H / 2;
    this.last = performance.now();
    let errores = 0;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (!this.enVista) {
        this.last = performance.now();
        return;
      }
      try {
        this.cuadro(performance.now());
      } catch (err) {
        if (errores++ < 3) console.error('Constelacion: error al dibujar', err);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  destruir() {
    cancelAnimationFrame(this.raf);
    if (this.esperaMedida) clearTimeout(this.esperaMedida);
    this.ro?.disconnect();
    this.io?.disconnect();
    this.lienzo.removeEventListener('pointermove', this.alMover);
    this.lienzo.removeEventListener('pointerleave', this.alSalir);
    this.lienzo.removeEventListener('pointerdown', this.alPresionar);
    this.lienzo.removeEventListener('pointerup', this.alSoltar);
    this.tarjeta.removeEventListener('pointerenter', this.alEntrarTarjeta);
    this.tarjeta.removeEventListener('pointerleave', this.alSalirTarjeta);
    document.fonts?.removeEventListener('loadingdone', this.alCargarFuentes);
  }

  set filtro(f: Filtro) {
    this.filtroActual = f;
  }

  set fondo(f: Fondo) {
    if (f === this.fondoActual) return;
    this.fondoActual = f;
    this.capaFondo = crearFondo(f, this.W, this.H, this.dpr, this.fuente);
  }

  /** Sin permiso para crear, la esfera no despliega "Nuevo proyecto". */
  set puedeCrear(v: boolean) {
    this.conBoton = v;
  }

  /**
   * Proyectos a mostrar. Los que aparecen despues de la primera carga (uno
   * recien creado) nacen desde la esfera y viajan a su lugar.
   */
  setDatos(proyectos: ProyectoEscena[]) {
    const clave = proyectos.map((p) => `${p.id}:${p.total}:${p.hechas}:${p.completado ? 1 : 0}:${p.nombre}`).join('|');
    if (clave === this.claveDatos) return;
    this.claveDatos = clave;
    this.proyectos = proyectos;
    const ids = new Set(proyectos.map((p) => p.id));
    for (const id of this.cartas.keys()) if (!ids.has(id)) this.cartas.delete(id);
    if (this.sel && !ids.has(this.sel)) this.sel = null;
    if (this.fijo && !ids.has(this.fijo)) this.fijo = null;
    for (const p of proyectos) {
      const c = this.cartas.get(p.id);
      if (c) c.p = p;
    }
    this.nombres.clear();
    this.reacomodar(false);
    this.armarEsfera();
    this.primeraCarga = false;
  }

  /** Enfoca un proyecto sin el mouse (toque o teclado); null lo suelta. */
  fijar(id: string | null) {
    this.fijo = id;
    if (id) this.botonFijo = false;
  }

  /** Despliega (o recoge) "Nuevo proyecto" sin el mouse, por ejemplo con el teclado. */
  abrirBoton(v: boolean) {
    this.botonFijo = v && this.conBoton;
    if (v) this.fijo = null;
  }

  /** Clic en "Nuevo proyecto": onda de luz y, un instante despues, el modal. */
  crear() {
    if (!this.conBoton) return;
    this.pulso = 1;
    setTimeout(() => this.alCrear(), this.reducido ? 0 : 260);
  }

  // ------------------------------------------------------------ eventos

  private posicion(e: PointerEvent) {
    const r = this.lienzo.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private alMover = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const p = this.posicion(e);
    this.mx = p.x;
    this.my = p.y;
  };

  private alSalir = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.mx = -1;
  };

  private alPresionar = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    const p = this.posicion(e);
    this.toque = { x: p.x, y: p.y, t: performance.now() };
  };

  /**
   * Un clic en un proyecto no abre nada: solo los botones de su tarjetita
   * llevan al mapa o al detalle. Mouse: clic en "Nuevo proyecto" crea.
   * Toque: tocar un proyecto lo enfoca (zoom y tarjetita), tocar la esfera
   * despliega el boton y tocar fuera suelta todo.
   */
  private alSoltar = (e: PointerEvent) => {
    const p = this.posicion(e);
    if (e.pointerType === 'mouse') {
      if (e.button === 0 && this.queHay(p.x, p.y) === 'boton') this.crear();
      return;
    }
    const t = this.toque;
    this.toque = null;
    // Un arrastre (por ejemplo, para bajar por la pagina) no cuenta como toque.
    if (!t || Math.hypot(p.x - t.x, p.y - t.y) > 10 || performance.now() - t.t > 600) return;
    this.mx = -1;
    const que = this.queHay(p.x, p.y);
    if (que === 'boton') this.crear();
    else if (que === 'esfera') this.abrirBoton(true);
    else if (que) this.fijar(que);
    else {
      this.fijo = null;
      this.botonFijo = false;
    }
  };

  private alEntrarTarjeta = () => {
    this.enTarjeta = true;
  };

  private alSalirTarjeta = () => {
    this.enTarjeta = false;
  };

  private alCargarFuentes = () => {
    this.nombres.clear();
  };

  /** Que hay en un punto de la pantalla segun el ultimo cuadro dibujado. */
  private queHay(x: number, y: number): 'boton' | 'esfera' | string | null {
    const cx = this.W / 2;
    const cy = this.H / 2;
    if (!this.sel && this.conBoton) {
      const b = rectBoton(cx, cy);
      if (this.ab > 0.6 && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return 'boton';
      if (Math.hypot(x - cx, y - cy) < RADIO_HOVER_ESFERA) return 'esfera';
    }
    return this.cartaEn(x, y, this.ultimos);
  }

  /** Tarjeta (visible con el filtro) bajo un punto; la de mas adelante gana. */
  private cartaEn(x: number, y: number, nodos: Nodo[]) {
    const { S } = this.camara;
    let mejor: Nodo | null = null;
    for (const n of nodos) {
      if (!this.visible(n.c.p)) continue;
      const [sx, sy] = this.aPantalla(n.x, n.y);
      const media = (ANCHO_CARTA / 2) * n.s * S;
      const alto = (ALTO_CARTA / 2) * n.s * S;
      if (Math.abs(sx - x) < media && Math.abs(sy - y) < alto) {
        if (n.c.p.id === this.sel) return n.c.p.id;
        if (!mejor || n.z > mejor.z) mejor = n;
      }
    }
    return mejor?.c.p.id ?? null;
  }

  private aPantalla(px: number, py: number): [number, number] {
    const { fx, fy, S, tx, ty } = this.camara;
    return [(px - fx) * S + fx + tx, (py - fy) * S + fy + ty];
  }

  private visible(p: ProyectoEscena) {
    const f = this.filtroActual;
    return f === 'todos' || (f === 'proceso' && !p.completado) || (f === 'completados' && p.completado);
  }

  // ------------------------------------------------------------ armado

  private medir() {
    this.W = this.raiz.clientWidth;
    this.H = this.raiz.clientHeight;
    this.dpr = Math.min(DPR_MAXIMO, window.devicePixelRatio || 1);
    for (const c of [this.lienzo, this.capa]) {
      c.width = Math.max(1, Math.round(this.W * this.dpr));
      c.height = Math.max(1, Math.round(this.H * this.dpr));
    }
    this.capaFondo = crearFondo(this.fondoActual, this.W, this.H, this.dpr, this.fuente);
    // Acomodar cuesta con muchos proyectos: mientras se cambia el tamano de
    // la ventana se espera a que pare, y las tarjetas viajan suave a su lugar.
    if (this.esperaMedida) clearTimeout(this.esperaMedida);
    if (!this.anillos.length) this.reacomodar(true);
    else this.esperaMedida = setTimeout(() => this.reacomodar(false), 150);
  }

  /** Recalcula el lugar de cada tarjeta; con `saltar`, van directo a el. */
  private reacomodar(saltar: boolean) {
    if (this.W <= 0 || this.H <= 0) return;
    const r = acomodar(this.proyectos, this.W, this.H);
    this.anillos = r.anillos;
    this.escala = r.escala;
    if (saltar || this.anillosVista.length !== this.anillos.length) this.anillosVista = this.anillos.map((a) => ({ ...a }));
    for (const p of this.proyectos) {
      const l = r.lugares.get(p.id);
      if (!l) continue;
      const an = this.anillos[l.anillo];
      const objetivo = { rx: an.rx, ry: an.ry, a: l.a };
      const c = this.cartas.get(p.id);
      if (c) {
        c.objetivo = objetivo;
        if (saltar) Object.assign(c, { rx: objetivo.rx, ry: objetivo.ry, a: objetivo.a });
      } else {
        this.cartas.set(p.id, { p, ...objetivo, objetivo, nace: this.primeraCarga ? null : 0 });
      }
    }
  }

  /**
   * Un punto por tarea, repartidos en una esfera de Fibonacci; cada proyecto
   * ocupa una franja. Con muchas tareas, cada punto junta varias.
   */
  private armarEsfera() {
    const total = this.proyectos.reduce((s, p) => s + p.total, 0);
    const junta = Math.max(1, Math.ceil(total / MAX_PUNTOS));
    const tareas: PuntoEsfera[] = [];
    this.proyectos.forEach((p, pi) => {
      const n = Math.ceil(p.total / junta);
      const hechas = p.hechas >= p.total ? n : Math.min(n, Math.round(p.hechas / junta));
      for (let i = 0; i < n; i++) tareas.push({ pi, hecha: i < hechas, s: [0, 0, 0], X: 0, Y: 0, Z: 0 });
    });
    // Con pocas tareas se reparten entre puntos de estructura tenues, parejo por toda la esfera.
    let puntos = tareas;
    if (tareas.length < PUNTOS_MINIMOS) {
      puntos = Array.from({ length: PUNTOS_MINIMOS }, () => ({ pi: -1, hecha: false, s: [0, 0, 0], X: 0, Y: 0, Z: 0 }));
      tareas.forEach((t, j) => {
        puntos[Math.floor(((j + 0.5) * PUNTOS_MINIMOS) / tareas.length)] = t;
      });
    }
    const N = puntos.length;
    const GA = Math.PI * (3 - Math.sqrt(5));
    puntos.forEach((k, i) => {
      const y = N > 1 ? 1 - (i / (N - 1)) * 2 : 0;
      const r = Math.sqrt(1 - y * y);
      const th = GA * i;
      k.s = [Math.cos(th) * r, y, Math.sin(th) * r];
    });
    this.puntos = puntos;
  }

  /** Nombre recortado con "…" para que quepa en la tarjeta (a escala 1). */
  private nombreCorto(g: CanvasRenderingContext2D, p: ProyectoEscena) {
    const guardado = this.nombres.get(p.id);
    if (guardado !== undefined) return guardado;
    g.font = `500 12px ${this.fuente}`;
    const max = ANCHO_CARTA - 26;
    let texto = p.nombre;
    if (g.measureText(texto).width > max) {
      while (texto.length > 1 && g.measureText(texto + '…').width > max) texto = texto.slice(0, -1);
      texto = texto.trimEnd() + '…';
    }
    this.nombres.set(p.id, texto);
    return texto;
  }

  private mostrarTarjeta(v: boolean) {
    if (v === this.tarjetaVisible) return;
    this.tarjetaVisible = v;
    this.tarjeta.dataset.visible = String(v);
    // Oculta, sus botones tampoco se alcanzan con el teclado.
    this.tarjeta.inert = !v;
  }

  // ------------------------------------------------------------ cuadro

  private cuadro(ahora: number) {
    const dt = Math.min(PASO_MAXIMO, Math.max(0, (ahora - this.last) / 1000));
    this.last = ahora;
    const { W, H } = this;
    if (W <= 0 || H <= 0) return;
    // Pasos de la maqueta (por cuadro a 60 fps) llevados al tiempo real.
    const f = dt * 60;
    const paso = (v: number) => 1 - Math.pow(1 - v, f);
    if (!this.reducido) this.t += dt;
    const cx = W / 2;
    const cy = H / 2;
    if (!this.sel && !this.reducido) this.ang += GIRO_ANILLOS * f;

    // Tras un reacomodo, anillos y tarjetas se acercan suave a su lugar.
    const kl = 1 - Math.exp(-dt * 5);
    this.anillosVista.forEach((a, i) => {
      const o = this.anillos[i];
      a.rx = lerp(a.rx, o.rx, kl);
      a.ry = lerp(a.ry, o.ry, kl);
    });
    const nodos: Nodo[] = [];
    for (const p of this.proyectos) {
      const c = this.cartas.get(p.id);
      if (!c) continue;
      if (c.nace === null) {
        c.rx = lerp(c.rx, c.objetivo.rx, kl);
        c.ry = lerp(c.ry, c.objetivo.ry, kl);
        const d = ((c.objetivo.a - c.a + Math.PI * 3) % TAU) - Math.PI;
        c.a += d * kl;
      } else {
        c.nace += 0.012 * f;
        if (c.nace > 1.6) c.nace = null;
      }
      const th = c.a + this.ang;
      let x = cx + Math.cos(th) * c.rx;
      let y = cy + Math.sin(th) * c.ry;
      let crece = 1;
      if (c.nace !== null) {
        // Nace en la esfera y viaja a su lugar (con movimiento reducido, aparece ahi).
        const e = this.reducido ? 1 : suave(Math.min(1, c.nace));
        x = cx + (x - cx) * e;
        y = cy + (y - cy) * e;
        crece = this.reducido ? Math.min(1, c.nace * 2) : Math.min(1, c.nace * 1.4);
      }
      const z = Math.sin(th);
      nodos.push({ c, x, y, z, s: escalaProfundidad(z) * this.escala * crece });
    }

    // Zoom sobre el proyecto enfocado: crece en su lugar, bajo el mouse, y el
    // resto se abre a su alrededor. Solo se corre lo justo para no quedar
    // cortado en un borde. Con movimiento reducido la camara no se mueve:
    // solo se apaga el resto y aparece la tarjetita.
    const eFondo = suave(this.z);
    const eZoom = this.reducido ? 0 : eFondo;
    const S = 1 + eZoom * ZOOM_FOCO;
    const nodoSel = this.sel ? nodos.find((n) => n.c.p.id === this.sel) : undefined;
    if (nodoSel) {
      this.fx = nodoSel.x;
      this.fy = nodoSel.y;
      const Sf = 1 + ZOOM_FOCO;
      const media = (ANCHO_CARTA / 2) * nodoSel.s * Sf;
      const alto = (ALTO_CARTA / 2) * nodoSel.s * Sf;
      const entre = (v: number, min: number, max: number) => (min > max ? (min + max) / 2 : Math.min(max, Math.max(min, v)));
      this.desvio = {
        x: entre(0, 8 + media - this.fx, W - 8 - media - this.fx),
        y: entre(0, 52 + alto - this.fy, H - 8 - alto - this.fy),
      };
    }
    const tx = this.desvio.x * eZoom;
    const ty = this.desvio.y * eZoom;
    this.camara = { fx: this.fx, fy: this.fy, S, tx, ty };
    this.ultimos = nodos;

    // Boton "Nuevo proyecto": se despliega con el mouse en la esfera y se
    // sostiene mientras el mouse va hacia el. Sin proyectos, queda abierto.
    const b = rectBoton(cx, cy);
    const raton = this.mx >= 0;
    const vacio = this.proyectos.length === 0;
    const sobreEsfera = this.conBoton && !this.sel && raton && Math.hypot(this.mx - cx, this.my - cy) < RADIO_HOVER_ESFERA;
    const sobreBoton =
      this.conBoton &&
      !this.sel &&
      raton &&
      this.ab > 0.3 &&
      this.mx >= b.x - SEPARACION_BOTON &&
      this.mx <= b.x + b.w &&
      this.my >= b.y - 6 &&
      this.my <= b.y + b.h + 6;
    if (sobreEsfera || sobreBoton || this.botonFijo || (vacio && this.conBoton)) this.retenerBoton = RETENER_S;
    else this.retenerBoton -= dt;
    const abrir = this.retenerBoton > 0;
    this.ab += ((abrir ? 1 : 0) - this.ab) * paso(abrir ? 0.07 : 0.1);
    this.abHover += ((sobreBoton ? 1 : 0) - this.abHover) * paso(0.15);
    this.pulso *= Math.pow(0.9, f);

    // Proyecto bajo el mouse (o fijado): la camara se acerca a el.
    let h: string | null = null;
    if (this.fijo) h = this.fijo;
    else if (raton && !sobreEsfera && !sobreBoton) h = this.cartaEn(this.mx, this.my, nodos);
    if (this.sel && h && h !== this.sel && this.z > 0.3 && !this.fijo) h = this.sel;
    // Cerca de un borde la camara corre la tarjeta y puede dejar de estar
    // bajo el mouse: el enfoque sigue mientras el mouse quede donde estaba.
    if (!h && nodoSel && raton && !this.fijo) {
      const media = (ANCHO_CARTA / 2) * nodoSel.s;
      const alto = (ALTO_CARTA / 2) * nodoSel.s;
      if (Math.abs(this.mx - nodoSel.x) < media && Math.abs(this.my - nodoSel.y) < alto) h = this.sel;
    }
    if (h) {
      if (this.sel !== h) {
        const n = nodos.find((o) => o.c.p.id === h);
        if (n) {
          this.sel = h;
          this.ultimoFoco = h;
          this.fx = n.x;
          this.fy = n.y;
          this.mostrarTarjeta(false);
          this.alEnfocar(h);
        }
      }
      this.retener = RETENER_S;
    } else if (this.enTarjeta) this.retener = RETENER_S;
    else {
      this.retener -= dt;
      if (this.retener <= 0) this.sel = null;
    }
    this.z += ((this.sel ? 1 : 0) - this.z) * paso(this.sel ? 0.06 : 0.09);
    if (!this.sel && this.z < 0.01) {
      this.fx = cx;
      this.fy = cy;
    }
    // Primero llega la camara y despues la tarjetita; al salir, al reves.
    if (this.sel && this.z > 0.92) this.mostrarTarjeta(true);
    if (!this.sel || this.z < 0.85) this.mostrarTarjeta(false);
    this.filtros.style.opacity = String(1 - eFondo * 0.8);
    if (!this.reducido) this.giroEsfera += GIRO_ESFERA * f * (1 - this.ab * 0.8);
    // Solo la esfera y su boton responden al clic: los proyectos se abren desde su tarjetita.
    this.lienzo.style.cursor = sobreEsfera || sobreBoton ? 'pointer' : 'default';

    // ---------------------------------------------------------- dibujo
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Fondo: casi quieto, deriva unos pocos px y apenas se acerca con el
    // zoom, como lo mas lejano de la escena.
    if (this.capaFondo) {
      const deriva = this.reducido ? 0 : Math.sin(this.t * 0.03) * 12;
      const k = 1 + eZoom * 0.06;
      ctx.drawImage(this.capaFondo, (W - W * k) / 2 + deriva, (H - H * k) / 2, W * k, H * k);
    }
    for (const s of this.estrellas) {
      const [sx, sy] = this.aPantalla(s.x * W, s.y * H);
      const k = 1 / (1 + eZoom * 0.5);
      ctx.fillStyle = `rgba(190,205,255,${0.18 + 0.08 * Math.sin(this.t * 0.25 + s.p)})`;
      ctx.beginPath();
      ctx.arc((sx - W / 2) * k + W / 2, (sy - H / 2) * k + H / 2, s.r, 0, TAU);
      ctx.fill();
    }

    // Con un proyecto enfocado, todo lo demas va a la capa que se desenfoca.
    const desenfocar = eFondo > 0.02 && this.puedeDesenfocar;
    const g = desenfocar ? this.ctxCapa : ctx;
    if (desenfocar) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
    }
    g.save();
    g.translate(this.fx + tx, this.fy + ty);
    g.scale(S, S);
    g.translate(-this.fx, -this.fy);

    this.dibujarAnillos(g, S, eFondo);
    if (this.fondoActual === 'carta') this.dibujarTrazos(g, cx, cy, nodos, S, eFondo);
    const fondo = nodos.filter((n) => n.z <= 0 && n !== nodoSel).sort((a, c) => a.z - c.z);
    const frente = nodos.filter((n) => n.z > 0 && n !== nodoSel).sort((a, c) => a.z - c.z);
    for (const n of fondo) this.dibujarCarta(g, n, false, eFondo, S);
    // Sin proyecto enfocado, la esfera queda entre las tarjetas del fondo y las del frente.
    if (eFondo <= 0.02) this.dibujarEsfera(g, cx, cy, 0);
    for (const n of frente) this.dibujarCarta(g, n, false, eFondo, S);
    // El boton va sobre las tarjetas: en pantallas angostas el anillo interior pasa por ahi.
    if (this.ab > 0.01 && !this.sel) this.dibujarBoton(g, cx, cy, b);
    g.restore();

    if (desenfocar) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = `blur(${(eFondo * DESENFOQUE * dpr).toFixed(1)}px)`;
      ctx.drawImage(this.capa, 0, 0);
      ctx.restore();
    }
    if (eFondo > 0.02) {
      ctx.fillStyle = `rgba(3,6,15,${0.4 * eFondo})`;
      ctx.fillRect(0, 0, W, H);
      // Con un proyecto enfocado el nucleo nunca se apaga: queda nitido, en
      // su lugar y por encima del resto, con las tareas de ese proyecto encendidas.
      this.dibujarEsfera(ctx, cx, cy, eFondo);
      this.dibujarEtiqueta(ctx, cx, cy, eFondo);
    }
    if (nodoSel) {
      ctx.save();
      ctx.translate(this.fx + tx, this.fy + ty);
      ctx.scale(S, S);
      ctx.translate(-this.fx, -this.fy);
      this.dibujarCarta(ctx, nodoSel, true, eFondo, S);
      ctx.restore();
      // El cajon sale por debajo de la tarjeta, un poco mas angosto que ella
      // (entre sus esquinas redondeadas); si abajo no cabe, sale por encima.
      const [sx, sy] = this.aPantalla(nodoSel.x, nodoSel.y);
      const alto = this.tarjeta.offsetHeight || 40;
      const mitad = (ALTO_CARTA / 2) * nodoSel.s * S;
      // Siempre del ancho de la tarjeta menos sus esquinas: nunca mas ancho que ella.
      const ancho = (ANCHO_CARTA - 20) * nodoSel.s * S;
      const abajo = sy + mitad + alto <= H - 8;
      this.tarjeta.dataset.lado = abajo ? 'abajo' : 'arriba';
      this.tarjeta.style.width = `${ancho}px`;
      // La letra se ajusta al ancho, para que los dos botones quepan en cualquier tarjeta.
      this.tarjeta.style.fontSize = `${Math.max(9, Math.min(12.5, ancho / 19))}px`;
      this.tarjeta.style.left = `${sx - ancho / 2}px`;
      this.tarjeta.style.top = `${abajo ? sy + mitad - 1 : sy - mitad - alto + 1}px`;
    }
  }

  /** Carta estelar: una linea fina de la esfera a cada proyecto, como una constelacion. */
  private dibujarTrazos(g: CanvasRenderingContext2D, cx: number, cy: number, nodos: Nodo[], S: number, e: number) {
    g.save();
    g.lineWidth = 0.8 / S;
    for (const n of nodos) {
      const a = (this.visible(n.c.p) ? 0.2 : 0.04) * (1 - e * 0.5) * (1 - this.ab * 0.45);
      g.strokeStyle = `rgba(159,180,255,${a})`;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(n.x, n.y);
      g.stroke();
    }
    g.restore();
  }

  /** Anillos punteados; el del grupo filtrado se resalta y el otro se apaga. */
  private dibujarAnillos(g: CanvasRenderingContext2D, S: number, e: number) {
    const f = this.filtroActual;
    const cx = this.W / 2;
    const cy = this.H / 2;
    g.save();
    g.setLineDash([2, 7]);
    g.lineWidth = 1 / S;
    for (const a of this.anillosVista) {
      const resalta = (f === 'proceso' && a.grupo === 0) || (f === 'completados' && a.grupo === 1);
      const apaga = (f === 'proceso' && a.grupo === 1) || (f === 'completados' && a.grupo === 0);
      g.strokeStyle = a.grupo
        ? `rgba(60,220,170,${(resalta ? 0.32 : apaga ? 0.06 : 0.16) * (1 - e * 0.5)})`
        : `rgba(110,150,255,${(resalta ? 0.4 : apaga ? 0.06 : 0.2) * (1 - e * 0.5)})`;
      g.beginPath();
      g.ellipse(cx, cy, a.rx, a.ry, 0, 0, TAU);
      g.stroke();
    }
    g.restore();
  }

  /** Tarjeta de un proyecto: "PROYECTO", nombre, barra de avance y %. */
  private dibujarCarta(g: CanvasRenderingContext2D, n: Nodo, yo: boolean, e: number, S: number) {
    const p = n.c.p;
    const sc = n.s;
    if (sc < 0.05) return;
    const a = (this.visible(p) ? 1 : 0.12) * (yo ? 1 : 1 - e * 0.5) * (1 - this.ab * 0.45);
    const pr = p.total ? p.hechas / p.total : 0;
    const w = ANCHO_CARTA * sc;
    const hh = ALTO_CARTA * sc;
    const X = n.x - w / 2;
    const Y = n.y - hh / 2;
    g.save();
    if (n.c.nace !== null) {
      g.fillStyle = `rgba(120,150,255,${0.28 * (1.6 - n.c.nace)})`;
      g.beginPath();
      g.roundRect(X - 6, Y - 6, w + 12, hh + 12, 14);
      g.fill();
    }
    if (yo && e > 0.05) {
      g.fillStyle = `rgba(90,130,255,${0.18 * e})`;
      g.beginPath();
      g.roundRect(X - 5, Y - 5, w + 10, hh + 10, 14 * sc);
      g.fill();
    }
    g.fillStyle = `rgba(10,15,34,${0.96 * a})`;
    g.beginPath();
    g.roundRect(X, Y, w, hh, 10 * sc);
    g.fill();
    g.strokeStyle = yo ? `rgba(130,165,255,${0.3 + 0.4 * e})` : `rgba(110,150,255,${0.25 * a})`;
    g.lineWidth = (1 / S) * (yo ? 1.2 : 1);
    g.stroke();
    // Linea de color en el borde inferior: celeste en proceso, verde completado.
    g.fillStyle = `rgba(${p.completado ? '31,191,134' : '60,200,255'},${0.7 * a})`;
    g.fillRect(X + 8 * sc, Y + hh - 1.5, w - 16 * sc, 1.5);
    const tx = X + 13 * sc;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    const nombre = this.nombreCorto(g, p);
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.font = `500 ${12 * sc}px ${this.fuente}`;
    g.fillText(nombre, tx, Y + 23 * sc);
    const bw = w - 52 * sc;
    g.fillStyle = `rgba(255,255,255,${0.1 * a})`;
    g.fillRect(tx, Y + 33 * sc, bw, 2.5 * sc);
    g.fillStyle = p.completado ? `rgba(31,191,134,${a})` : `rgba(255,90,160,${a})`;
    g.fillRect(tx, Y + 33 * sc, Math.max(p.hechas ? 3 : 0, bw * pr), 2.5 * sc);
    g.textAlign = 'right';
    g.font = `500 ${8.5 * sc}px ${this.fuente}`;
    g.fillText(`${Math.round(pr * 100)}%`, X + w - 10 * sc, Y + 36 * sc);
    g.restore();
  }

  /**
   * "Nuevo proyecto": resplandor en la esfera, linea de luz con chispas que
   * despliega la pastilla, brillo que la recorre y el "+" que entra girando.
   */
  private dibujarBoton(g: CanvasRenderingContext2D, cx: number, cy: number, b: Rect) {
    const ab = this.ab;
    const abHover = this.abHover;
    // Con movimiento reducido no se despliega: aparece entera, de a poco.
    const ee = this.reducido ? 1 : salida(Math.min(1, ab * 1.15));
    const sx = cx + RADIO_ESFERA + 3;
    const len = (b.x + b.w - sx) * ee;
    g.save();
    if (this.reducido) g.globalAlpha = ab;
    const gl = g.createRadialGradient(cx, cy, 0, cx, cy, 60);
    gl.addColorStop(0, `rgba(110,140,255,${0.16 * ab})`);
    gl.addColorStop(1, 'rgba(110,140,255,0)');
    g.fillStyle = gl;
    g.beginPath();
    g.arc(cx, cy, 60, 0, TAU);
    g.fill();
    const st = g.createLinearGradient(sx, 0, b.x, 0);
    st.addColorStop(0, `rgba(200,215,255,${0.9 * ab})`);
    st.addColorStop(1, `rgba(120,150,255,${0.15 * ab})`);
    g.strokeStyle = st;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(sx, cy);
    g.lineTo(Math.min(sx + len, b.x), cy);
    g.stroke();
    if (!this.reducido) {
      for (const s of this.chispas) {
        const ph = (this.t * s.s * 0.5 + s.o) % 1;
        g.fillStyle = `rgba(220,230,255,${0.7 * ab * (1 - ph)})`;
        g.beginPath();
        g.arc(sx + ph * (SEPARACION_BOTON + 8) * ee, cy + s.y * (1 - ph) * 0.5, 1, 0, TAU);
        g.fill();
      }
    }
    const bw = Math.max(0, len - (b.x - sx));
    if (bw > 2) {
      g.save();
      g.beginPath();
      g.roundRect(b.x, b.y, bw, b.h, b.h / 2);
      g.clip();
      const bg = g.createLinearGradient(b.x, 0, b.x + b.w, 0);
      bg.addColorStop(0, 'rgba(63,107,255,.95)');
      bg.addColorStop(1, 'rgba(130,90,255,.95)');
      g.fillStyle = bg;
      g.fillRect(b.x, b.y, b.w, b.h);
      if (!this.reducido) {
        const brillo = ((this.t * 0.35) % 1.6) - 0.3;
        const sg = g.createLinearGradient(b.x + b.w * brillo - 40, 0, b.x + b.w * brillo + 40, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, `rgba(255,255,255,${0.18 + abHover * 0.12})`);
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sg;
        g.fillRect(b.x, b.y, b.w, b.h);
      }
      if (abHover > 0.01) {
        g.fillStyle = `rgba(255,255,255,${0.08 * abHover})`;
        g.fillRect(b.x, b.y, b.w, b.h);
      }
      // El "+" entra girando y el texto aparece un instante despues.
      const ta = Math.max(0, (ab - 0.5) * 2);
      g.save();
      g.translate(b.x + 17, cy);
      g.rotate((this.reducido ? 0 : (1 - ta) * -1.57) + abHover * 1.57);
      g.strokeStyle = `rgba(255,255,255,${ta})`;
      g.lineWidth = 1.8;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-5, 0);
      g.lineTo(5, 0);
      g.moveTo(0, -5);
      g.lineTo(0, 5);
      g.stroke();
      g.restore();
      g.fillStyle = `rgba(255,255,255,${ta})`;
      g.font = `500 13px ${this.fuente}`;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('Nuevo proyecto', b.x + 32 + (this.reducido ? 0 : (1 - ta) * 8), cy + 1);
      g.restore();
      g.strokeStyle = `rgba(190,205,255,${0.35 + abHover * 0.35})`;
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(b.x, b.y, bw, b.h, b.h / 2);
      g.stroke();
      // Onda de luz al hacer clic.
      if (this.pulso > 0.02) {
        const q = 1 - this.pulso;
        g.strokeStyle = `rgba(190,205,255,${this.pulso})`;
        g.beginPath();
        g.roundRect(b.x - q * 10, b.y - q * 10, bw + q * 20, b.h + q * 20, b.h / 2 + 10);
        g.stroke();
      }
    }
    g.restore();
  }

  /**
   * Esfera de tareas: hechas brillantes, pendientes tenues, mas luz al frente.
   * Con un proyecto enfocado (e > 0), sus tareas se encienden en lavanda y
   * crecen un poco, y las de los demas se apagan.
   */
  private dibujarEsfera(g: CanvasRenderingContext2D, cx: number, cy: number, e: number) {
    const foco = this.ultimoFoco ? this.proyectos.findIndex((p) => p.id === this.ultimoFoco) : -1;
    const radio = RADIO_ESFERA * (1 - e * 0.18);
    const lejania = 1 - e * 0.15;
    // Nucleo de luz: un halo amplio y un cuerpo azul violeta con brillo propio
    // (mas claro arriba a la izquierda), asi se ve como esfera aunque haya pocas tareas.
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, radio * 3.2);
    halo.addColorStop(0, `rgba(120,140,255,${0.3 * lejania})`);
    halo.addColorStop(1, 'rgba(120,140,255,0)');
    g.fillStyle = halo;
    g.beginPath();
    g.arc(cx, cy, radio * 3.2, 0, TAU);
    g.fill();
    const cuerpo = g.createRadialGradient(cx - radio * 0.26, cy - radio * 0.29, radio * 0.07, cx, cy, radio);
    cuerpo.addColorStop(0, `rgba(160,175,255,${0.55 * lejania})`);
    cuerpo.addColorStop(0.6, `rgba(70,80,180,${0.35 * lejania})`);
    cuerpo.addColorStop(1, `rgba(40,40,120,${0.05 * lejania})`);
    g.fillStyle = cuerpo;
    g.beginPath();
    g.arc(cx, cy, radio, 0, TAU);
    g.fill();
    const c = Math.cos(this.giroEsfera);
    const s = Math.sin(this.giroEsfera);
    const ci = Math.cos(INCLINACION_ESFERA);
    const si = Math.sin(INCLINACION_ESFERA);
    for (const k of this.puntos) {
      const X = k.s[0] * c - k.s[2] * s;
      const Z = k.s[0] * s + k.s[2] * c;
      const Y = k.s[1];
      k.X = X;
      k.Y = Y * ci - Z * si;
      k.Z = Y * si + Z * ci;
    }
    const orden = [...this.puntos].sort((a, b) => a.Z - b.Z);
    for (const k of orden) {
      const pz = (k.Z + 1) / 2;
      const p = k.pi >= 0 ? this.proyectos[k.pi] : null;
      const vacia = !p;
      const delFoco = foco >= 0 && k.pi === foco;
      const a =
        (k.hecha ? 0.95 : 0.45) *
        (0.45 + 0.55 * pz) *
        lejania *
        (p && !this.visible(p) ? 0.2 : vacia ? 0.45 : 1) *
        (foco >= 0 ? (delFoco ? 1 + e * 1.2 : 1 - e * 0.55) : 1) *
        (1 + this.ab * 0.3);
      const color = delFoco && e > 0.02
        ? k.hecha
          ? '214,200,255'
          : '150,130,255'
        : k.hecha
          ? p?.completado
            ? '120,240,200'
            : '235,240,255'
          : '110,125,190';
      const r = (k.hecha ? 1.5 : 1.15) * (0.6 + 0.5 * pz) * (delFoco ? 1 + e * 0.45 : 1);
      g.fillStyle = `rgba(${color},${Math.min(1, a)})`;
      g.beginPath();
      g.arc(cx + k.X * radio, cy + k.Y * radio, r, 0, TAU);
      g.fill();
    }
  }

  /** Bajo el nucleo, con un proyecto enfocado: su nombre y cuantas tareas lleva. */
  private dibujarEtiqueta(g: CanvasRenderingContext2D, cx: number, cy: number, e: number) {
    const lx = cx;
    const ly = cy + RADIO_ESFERA + 26;
    const enfocado = this.ultimoFoco ? this.proyectos.find((p) => p.id === this.ultimoFoco) : undefined;
    // Aparece cuando el zoom ya avanzo, para no distraer al pasar el mouse de largo.
    const lt = Math.max(0, (e - 0.45) / 0.55);
    if (enfocado && lt > 0.02) {
      g.save();
      g.globalAlpha = lt;
      g.font = `400 13px ${this.fuente}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(5,9,20,.9)';
      g.shadowBlur = 10;
      g.fillStyle = 'rgba(214,200,255,1)';
      g.fillText(`${enfocado.nombre} · ${enfocado.hechas} de ${enfocado.total} ${enfocado.total === 1 ? 'tarea' : 'tareas'}`, lx, ly);
      g.restore();
    }
  }
}
