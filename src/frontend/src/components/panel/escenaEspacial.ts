/**
 * Motor de la escena espacial del Panel de Proyectos: dos galaxias (proyectos
 * en proceso y completados) con el sol de la empresa al medio; al elegir una,
 * zoom cinematografico, tunel de estrellas, aparicion del sol y entrada de los
 * proyectos como planetas en orbita.
 *
 * Todo lo visual va en un unico canvas. Lo interactivo (chips, tarjetas,
 * botones sobre los planetas) es HTML encima, marcado con atributos `data-*`;
 * el motor lo reposiciona en cada cuadro con `transform`, sin pasar por el
 * estado de React. Galaxias, planetas y sol se generan al iniciar, sin
 * imagenes externas.
 *
 * Portado del prototipo de diseno (design_handoff_panel_galaxias). Los
 * tiempos de la animacion (segundos desde el clic) siguen ese documento.
 */

export type Mundo = 'proceso' | 'completados';
export type ModoEscena = 'overview' | 'system';

/** Un proyecto como planeta: tamano y textura salen de su id. */
export interface PlanetaEscena {
  id: string;
  size: number;
  tex: number;
}

/** Lugar fijo de un planeta en el sistema: su orbita y su angulo en ella. */
interface Lugar {
  orbit: number;
  ang: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Medidas de la tarjeta de cada proyecto (deben calzar con GalaxiaProyectos). */
export const ANCHO_TARJETA = 192;
const ALTO_TARJETA = 64;
/** Radio de cada orbita, como fraccion del tamano del sistema. */
const ORBITAS = [0.17, 0.32, 0.47];
/**
 * Velocidad de giro de cada orbita (radianes por segundo), con el movimiento
 * encendido: la interior gira mas rapido. Todos los planetas de una misma
 * orbita van a la misma velocidad, asi conservan su separacion.
 */
const VELOCIDAD_ORBITA = [0.085, 0.065, 0.05];

function solape(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Tarjeta a la derecha del planeta; si no cabe en la vista, a la izquierda. */
function rectTarjeta(x: number, y: number, r: number, W: number, ancho = ANCHO_TARJETA): Rect {
  let left = x + r * 1.25 + 10;
  if (left + ancho > W - 12) left = x - r * 1.25 - 10 - ancho;
  return { x: left, y: y - 34, w: ancho, h: ALTO_TARJETA };
}

interface Textura {
  c: HTMLCanvasElement;
  atm: string;
  ring?: string;
  /** Halo de atmosfera del planeta, pre-dibujado (va de r*0.85 a r*1.5). */
  halo?: HTMLCanvasElement;
}

interface Estrella {
  z: number;
  x: number;
  y: number;
  b: number;
  s: number;
  c: string;
  tw: number;
  ph: number;
}

interface Punto {
  x: number;
  y: number;
}

interface Diseno {
  R: number;
  proceso: Punto;
  completados: Punto;
  sun: Punto;
  sunR: number;
}

interface InfoPlaneta {
  it: PlanetaEscena;
  x: number;
  y: number;
  r: number;
  ca: number;
}

const TAU = Math.PI * 2;
const MUNDOS: Mundo[] = ['proceso', 'completados'];

/**
 * La entrada a una galaxia corre a esta velocidad respecto de la coreografia
 * original (unos 7 s): a 2x el viaje dura la mitad y conserva sus pasos. Una
 * vez armado el sistema, las orbitas giran a velocidad normal.
 */
const ACELERACION_ENTRADA = 2;
/** Volver al mapa tambien se acorta un poco. */
const ACELERACION_SALIDA = 1.4;
/** Momento (en tiempo de la coreografia) en que termina la entrada. */
const FIN_ENTRADA = 6.5;
/** Tope de nitidez del lienzo: por encima, el costo crece y no se nota. */
const DPR_MAXIMO = 1.5;
/** Lo mas que se avanza en un cuadro: si el navegador se demora, no salta. */
const PASO_MAXIMO = 0.08;

/**
 * Galaxias y texturas de planetas se generan una sola vez por visita a la
 * aplicacion (son decenas de miles de puntos): volver a la pantalla las
 * reutiliza en vez de recalcularlas y trabarse al entrar.
 */
let spritesGuardados: { galaxy: Record<Mundo, HTMLCanvasElement>; tex: Textura[] } | null = null;
const cl = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sm = (a: number, b: number, t: number) => {
  const x = cl((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = (t: number) => 1 - Math.pow(1 - t, 3);
const ei = (t: number) => t * t * t;

/** Numero pseudoaleatorio repetible a partir de una semilla. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Hash entero de un texto: el mismo id da siempre el mismo planeta. */
function hashTexto(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Los proyectos de una galaxia como planetas. Tamano y textura salen del id:
 * un proyecto se ve siempre igual. Los completados usan las texturas verdes
 * (6 a 8), los demas las calidas. Donde va cada uno lo decide el sistema al
 * armarse (ver `acomodar`).
 */
export function planetasDeMundo(ids: string[], mundo: Mundo): PlanetaEscena[] {
  return ids.map((id) => {
    const r = rng(hashTexto(id));
    return {
      id,
      size: 0.85 + r() * 0.25,
      tex: mundo === 'proceso' ? Math.floor(r() * 6) : 6 + Math.floor(r() * 3),
    };
  });
}

/** Piezas del sol dibujadas una vez; cada cuadro solo las estampa. */
interface SpritesSol {
  cuerpo: HTMLCanvasElement;
  edificio: HTMLCanvasElement;
  halo: HTMLCanvasElement;
  claro: HTMLCanvasElement;
  oscuro: HTMLCanvasElement;
  rayo: HTMLCanvasElement;
}

/** Radio (en pixeles) al que se pre-dibujan las piezas del sol. */
const RADIO_SOL = 160;

function lienzoNuevo(ancho: number, alto = ancho) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  return { c, g: c.getContext('2d')! };
}

/** Disco de luz: un degradado radial con sus paradas, en un cuadrado. */
function discoDeLuz(paradas: [number, string][], lado = 128) {
  const { c, g } = lienzoNuevo(lado);
  const h = lado / 2;
  const gr = g.createRadialGradient(h, h, 0, h, h, h);
  paradas.forEach(([pos, color]) => gr.addColorStop(pos, color));
  g.fillStyle = gr;
  g.fillRect(0, 0, lado, lado);
  return c;
}

/**
 * El sol tenia unos 25 degradados que se recreaban en cada cuadro; ahora sus
 * piezas se dibujan aqui una sola vez y el cuadro solo las escala y mueve.
 */
function crearSpritesSol(): SpritesSol {
  const R = RADIO_SOL;
  const lado = R * 2;

  const cuerpo = lienzoNuevo(lado);
  const gc = cuerpo.g.createRadialGradient(R - R * 0.25, R - R * 0.25, R * 0.1, R, R, R);
  gc.addColorStop(0, '#fffbe8');
  gc.addColorStop(0.35, '#ffe07a');
  gc.addColorStop(0.75, '#ffad2e');
  gc.addColorStop(1, '#e8700f');
  cuerpo.g.fillStyle = gc;
  cuerpo.g.beginPath();
  cuerpo.g.arc(R, R, R, 0, TAU);
  cuerpo.g.fill();

  // Edificio de la empresa sobre el sol, con su sombra.
  const edificio = lienzoNuevo(lado);
  const ge = edificio.g;
  ge.shadowColor = 'rgba(110,50,0,0.9)';
  ge.shadowBlur = R * 0.08;
  ge.strokeStyle = '#fff6dc';
  ge.lineWidth = R * 0.035;
  // Centrado en el sol: el nombre de la empresa va debajo, por fuera.
  const iw = R * 0.34;
  const ih = R * 0.42;
  const top = R - ih / 2;
  ge.strokeRect(R - iw / 2, top, iw, ih);
  ge.beginPath();
  ge.moveTo(R - iw * 0.25, top + ih * 0.35);
  ge.lineTo(R + iw * 0.25, top + ih * 0.35);
  ge.moveTo(R - iw * 0.25, top + ih * 0.65);
  ge.lineTo(R + iw * 0.25, top + ih * 0.65);
  ge.stroke();

  // Halo: va de r*0.6 a r*3.4; en el disco normalizado eso es 0.176 a 1.
  const halo = discoDeLuz(
    [
      [0, 'rgba(255,190,70,0.55)'],
      [0.176, 'rgba(255,190,70,0.55)'],
      [0.464, 'rgba(255,140,30,0.16)'],
      [1, 'rgba(255,120,20,0)'],
    ],
    256,
  );
  const claro = discoDeLuz([
    [0, 'rgba(255,240,170,0.16)'],
    [1, 'rgba(255,200,100,0)'],
  ]);
  const oscuro = discoDeLuz([
    [0, 'rgba(210,100,10,0.14)'],
    [1, 'rgba(210,100,10,0)'],
  ]);

  // Rayo: una cuna que se desvanece hacia la punta.
  const rayo = lienzoNuevo(256, 16);
  const gr = rayo.g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, 'rgba(255,215,140,1)');
  gr.addColorStop(1, 'rgba(255,200,120,0)');
  rayo.g.fillStyle = gr;
  rayo.g.beginPath();
  rayo.g.moveTo(0, 0);
  rayo.g.lineTo(256, 8);
  rayo.g.lineTo(0, 16);
  rayo.g.fill();

  return { cuerpo: cuerpo.c, edificio: edificio.c, halo, claro, oscuro, rayo: rayo.c };
}

export class EscenaEspacial {
  private raiz: HTMLElement;
  private lienzo: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fuente: string;
  private alCambiarModo: (modo: ModoEscena, mundo: Mundo) => void;

  private datos: Record<Mundo, PlanetaEscena[]> = { proceso: [], completados: [] };
  private modo: ModoEscena = 'overview';
  /** Proyecto resaltado (halo dorado), o ninguno. */
  seleccionado: string | null = null;
  /** Galaxia bajo el puntero en el mapa: brilla y gira mas rapido. */
  hover: Mundo | null = null;
  /** Nombre que lleva el sol: la empresa del usuario. */
  nombreEmpresa = 'EMPRESA';
  /**
   * Movimiento encendido: los planetas orbitan con sus tarjetas. Apagado,
   * quedan quietos donde esten; al volver a encender siguen desde ahi.
   */
  movimiento = true;
  /** Segundos que lleva girando el sistema (solo corren con movimiento). */
  private giro = 0;

  private reduced = false;
  private anim = { mode: 'overview' as 'overview' | 'enter' | 'exit', T: 0, xT: 0, world: 'proceso' as Mundo };
  private spin: Record<Mundo, number> = { proceso: 0, completados: 1.3 };
  private hk: Record<Mundo, number> = { proceso: 0, completados: 0 };
  private selK: Record<string, number> = {};
  private enterAt: Record<string, number> = {};
  private cardW: Record<string, number> = {};
  /** Lugar de cada planeta del sistema actual, y para que vista se calculo. */
  private lugares = new Map<string, Lugar>();
  private claveLugares = '';
  private galaxy!: Record<Mundo, HTMLCanvasElement>;
  private tex!: Textura[];
  private stars: Estrella[] = [];
  private W = 0;
  private H = 0;
  private dpr = 1;
  private last = 0;
  private raf = 0;
  /** Fondo (degradado azul tenue) pre-dibujado al tamano actual del lienzo. */
  private fondo: HTMLCanvasElement | null = null;
  private sol!: SpritesSol;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private visible = true;
  private dom: {
    ui: HTMLElement[];
    gchip: Record<string, HTMLElement>;
    ghit: Record<string, HTMLElement>;
    sys: HTMLElement | null;
    hit: Record<string, HTMLElement>;
    card: Record<string, HTMLElement>;
  } | null = null;

  constructor(
    raiz: HTMLElement,
    lienzo: HTMLCanvasElement,
    opciones: { fuente: string; alCambiarModo: (modo: ModoEscena, mundo: Mundo) => void },
  ) {
    this.raiz = raiz;
    this.lienzo = lienzo;
    this.ctx = lienzo.getContext('2d')!;
    this.fuente = opciones.fuente;
    this.alCambiarModo = opciones.alCambiarModo;
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    spritesGuardados ??= {
      galaxy: { proceso: this.makeGalaxy('proceso'), completados: this.makeGalaxy('completados') },
      tex: this.makePlanetTextures(),
    };
    this.galaxy = spritesGuardados.galaxy;
    this.tex = spritesGuardados.tex;
    this.sol = crearSpritesSol();
    this.initStars();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(raiz);
    // Fuera de la vista (por ejemplo, al bajar por la pagina) no se dibuja.
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
    });
    this.io.observe(raiz);
    this.resize();
    this.last = performance.now();
    let errores = 0;
    // Un solo bucle y un solo reloj (performance.now): con la pestana en
    // segundo plano el navegador lo pausa solo y la escena no gasta nada.
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (!this.visible) {
        this.last = performance.now();
        return;
      }
      try {
        this.frame(performance.now());
      } catch (err) {
        if (errores++ < 3) console.error('Escena espacial: error al dibujar', err);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  destruir() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.io?.disconnect();
  }

  /**
   * Proyectos de cada galaxia. Uno nuevo mientras se mira su sistema entra
   * animado desde fuera.
   */
  setDatos(datos: Record<Mundo, PlanetaEscena[]>) {
    if (this.modo === 'system') {
      const previos = new Set(this.datos[this.anim.world].map((p) => p.id));
      for (const p of datos[this.anim.world]) {
        if (!previos.has(p.id)) this.enterAt[p.id] = this.anim.T + 0.2;
      }
    }
    this.datos = datos;
    this.dom = null;
  }

  /** El HTML de encima cambio (React volvio a pintar): se vuelve a buscar. */
  refrescarDom() {
    this.dom = null;
  }

  /** Entra a una galaxia: zoom, tunel de estrellas y sistema de planetas. */
  abrir(w: Mundo) {
    if (this.anim.mode !== 'overview') return;
    this.anim = { mode: 'enter', T: this.reduced ? 3.6 : 0, xT: 0, world: w };
    this.enterAt = {};
    this.giro = 0;
    this.selK = {};
    this.hover = null;
    this.modo = 'system';
    this.alCambiarModo('system', w);
  }

  /** Vuelve al mapa de galaxias (cuando el sistema ya termino de aparecer). */
  volver() {
    if (this.anim.mode === 'enter' && this.anim.T > 3.5) {
      this.anim.mode = 'exit';
      this.anim.xT = 0;
    }
  }

  private resize() {
    this.W = this.raiz.clientWidth;
    this.H = this.raiz.clientHeight;
    this.dpr = Math.min(DPR_MAXIMO, window.devicePixelRatio || 1);
    this.lienzo.width = Math.round(this.W * this.dpr);
    this.lienzo.height = Math.round(this.H * this.dpr);
    this.fondo = this.W && this.H ? this.crearFondo() : null;
  }

  /** El fondo no cambia entre cuadros: se dibuja una vez por tamano. */
  private crearFondo() {
    const { W, H } = this;
    const c = document.createElement('canvas');
    c.width = Math.round(W * this.dpr);
    c.height = Math.round(H * this.dpr);
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    g.fillStyle = '#04060d';
    g.fillRect(0, 0, W, H);
    const bg = g.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.7);
    bg.addColorStop(0, 'rgba(22,30,58,0.5)');
    bg.addColorStop(1, 'rgba(4,6,13,0)');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    return c;
  }

  // ---------------------------------------------------------------- sprites

  private makeGalaxy(w: Mundo) {
    const S = 900;
    const h = S / 2;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const P =
      w === 'proceso'
        ? { core: [255, 236, 250], mid: [232, 112, 218], out: [82, 108, 255], glow: [170, 110, 255], dust: [24, 8, 40] }
        : { core: [235, 255, 245], mid: [70, 235, 165], out: [24, 160, 205], glow: [60, 220, 170], dust: [4, 28, 30] };
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const gs = () => Math.random() + Math.random() + Math.random() - 1.5;
    let gr = g.createRadialGradient(h, h, 0, h, h, h);
    gr.addColorStop(0, `rgba(${P.glow},0.7)`);
    gr.addColorStop(0.3, `rgba(${P.glow},0.24)`);
    gr.addColorStop(0.65, `rgba(${P.out},0.09)`);
    gr.addColorStop(1, `rgba(${P.out},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30000; i++) {
      const arm = i % 2;
      const r = Math.pow(Math.random(), 0.8);
      const inter = Math.random() < 0.22;
      const ang = inter ? Math.random() * TAU : arm * Math.PI + r * 4.4 + gs() * 0.55 * (0.45 + r * 0.5);
      const rr = r * h * 0.92 + gs() * 6;
      const x = h + Math.cos(ang) * rr;
      const y = h + Math.sin(ang) * rr;
      const col = r < 0.3 ? mix(P.core, P.mid, r / 0.3) : mix(P.mid, P.out, Math.min(1, (r - 0.3) / 0.5));
      const al = (inter ? 0.22 : 0.6) * (0.45 + Math.random() * 0.55);
      const sz = Math.random() < 0.04 ? 3 : Math.random() < 0.45 ? 2 : 1.3;
      g.fillStyle = `rgba(${col},${al})`;
      g.fillRect(x, y, sz, sz);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 5000; i++) {
      const arm = i % 2;
      const r = 0.12 + Math.random() * 0.72;
      const ang = arm * Math.PI + r * 4.4 - 0.32 + gs() * 0.1;
      g.fillStyle = `rgba(${P.dust},0.12)`;
      g.fillRect(h + Math.cos(ang) * r * h * 0.92, h + Math.sin(ang) * r * h * 0.92, 3, 3);
    }
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const arm = i % 2;
      const r = 0.15 + Math.random() * 0.8;
      const ang = arm * Math.PI + r * 4.4 + gs() * 0.25;
      const x = h + Math.cos(ang) * r * h * 0.92;
      const y = h + Math.sin(ang) * r * h * 0.92;
      const rad = 3 + Math.random() * 6;
      const col = Math.random() < 0.5 ? [255, 255, 255] : mix(P.mid, P.out, Math.random());
      const k = g.createRadialGradient(x, y, 0, x, y, rad);
      k.addColorStop(0, `rgba(${col},0.9)`);
      k.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = k;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    gr = g.createRadialGradient(h, h, 0, h, h, h * 0.24);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.3, `rgba(${P.core},0.6)`);
    gr.addColorStop(0.7, `rgba(${P.mid},0.15)`);
    gr.addColorStop(1, `rgba(${P.mid},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return c;
  }

  private makePlanetTextures(): Textura[] {
    const specs: { base: number[]; band: number[]; atm: string; craters?: boolean; ring?: string }[] = [
      { base: [198, 152, 104], band: [140, 92, 62], atm: 'rgba(255,200,140,' },
      { base: [126, 172, 222], band: [66, 104, 178], atm: 'rgba(120,180,255,' },
      { base: [172, 166, 160], band: [118, 112, 108], atm: 'rgba(220,222,235,', craters: true },
      { base: [204, 112, 82], band: [136, 66, 48], atm: 'rgba(255,140,100,' },
      { base: [224, 204, 156], band: [176, 146, 98], atm: 'rgba(255,230,170,', ring: 'rgba(230,205,150,' },
      { base: [112, 192, 182], band: [58, 138, 140], atm: 'rgba(120,240,220,' },
      { base: [104, 204, 152], band: [40, 128, 96], atm: 'rgba(110,255,190,' },
      { base: [76, 174, 196], band: [30, 104, 136], atm: 'rgba(100,220,255,' },
      { base: [160, 224, 176], band: [90, 160, 120], atm: 'rgba(170,255,210,', ring: 'rgba(170,240,210,' },
    ];
    return specs.map((sp, idx) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const g = c.getContext('2d')!;
      const r = rng(idx * 97 + 13);
      const f1 = 2 + r() * 5;
      const f2 = 9 + r() * 14;
      const ph = r() * 6;
      for (let y = 0; y < 128; y++) {
        const t = cl(
          0.5 + 0.35 * Math.sin((y / 128) * Math.PI * f1 + ph) + 0.15 * Math.sin((y / 128) * Math.PI * f2 + ph * 2) + (r() - 0.5) * 0.08,
        );
        const col = sp.base.map((v, i) => Math.round(v + (sp.band[i] - v) * t));
        g.fillStyle = `rgb(${col})`;
        g.fillRect(0, y, 256, 1);
      }
      for (let k = 0; k < (sp.craters ? 40 : 14); k++) {
        const x = r() * 256;
        const y = 10 + r() * 108;
        const rw = sp.craters ? 3 + r() * 9 : 8 + r() * 26;
        const rh = sp.craters ? rw : 2 + r() * 6;
        const dark = r() < 0.6;
        g.fillStyle = dark ? 'rgba(30,20,20,0.16)' : 'rgba(255,250,235,0.14)';
        [x - 256, x, x + 256].forEach((xx) => {
          g.beginPath();
          g.ellipse(xx, y, rw, rh, 0, 0, TAU);
          g.fill();
        });
      }
      // Halo normalizado al radio exterior (1.5r): el borde interior (0.85r)
      // cae en 0.85 / 1.5 del disco.
      const halo = discoDeLuz([
        [0, sp.atm + '0.35)'],
        [0.567, sp.atm + '0.35)'],
        [1, sp.atm + '0)'],
      ]);
      return { c, atm: sp.atm, ring: sp.ring, halo };
    });
  }

  private initStars() {
    const cols = ['#ffffff', '#cfdcff', '#ffe9d6', '#b9c8ff'];
    this.stars = Array.from({ length: 650 }, () => {
      const z = 0.08 + Math.random() * 0.92;
      return {
        z,
        x: (Math.random() * 2 - 1) * 1.15 * z,
        y: (Math.random() * 2 - 1) * 1.15 * z,
        b: 0.35 + Math.random() * 0.65,
        s: 0.6 + Math.random() * 1.1,
        c: cols[(Math.random() * cols.length) | 0],
        tw: 0.5 + Math.random() * 2,
        ph: Math.random() * 6,
      };
    });
  }

  // ----------------------------------------------------------------- tiempo

  /** Velocidad del tunel de estrellas a lo largo de la entrada. */
  private vel(T: number) {
    if (T < 0.6) return 0.004;
    if (T < 2.2) return 0.004 + 0.45 * ei((T - 0.6) / 1.6);
    if (T < 2.8) return 0.454 + 0.95 * sm(2.2, 2.8, T);
    if (T < 4.3) return 0.006 + 1.398 * (1 - eo((T - 2.8) / 1.5));
    return 0.006;
  }

  private layout(W: number, H: number): Diseno {
    const R = Math.min(W * 0.14, H * 0.28);
    const y = H * 0.55;
    return { R, proceso: { x: W * 0.27, y }, completados: { x: W * 0.73, y }, sun: { x: W / 2, y }, sunR: Math.min(W, H) * 0.05 };
  }

  private getDom() {
    if (this.dom) return this.dom;
    const r = this.raiz;
    const q = (s: string) => Array.from(r.querySelectorAll<HTMLElement>(s));
    const map = (s: string, a: string) => {
      const m: Record<string, HTMLElement> = {};
      q(s).forEach((e) => (m[e.getAttribute(a) ?? ''] = e));
      return m;
    };
    this.dom = {
      ui: q('[data-ui]'),
      gchip: map('[data-gchip]', 'data-gchip'),
      ghit: map('[data-ghit]', 'data-ghit'),
      sys: r.querySelector<HTMLElement>('[data-syschip]'),
      hit: map('[data-hit]', 'data-hit'),
      card: map('[data-card]', 'data-card'),
    };
    return this.dom;
  }

  // ---------------------------------------------------------------- cuadros

  private frame(now: number) {
    const g = this.ctx;
    if (!this.W) return;
    const rawDt = Math.max(0, Math.min(PASO_MAXIMO, (now - this.last) / 1000));
    this.last = now;
    const a = this.anim;
    const dt =
      a.mode === 'enter' && a.T < FIN_ENTRADA
        ? rawDt * ACELERACION_ENTRADA
        : a.mode === 'exit'
          ? rawDt * ACELERACION_SALIDA
          : rawDt;
    const W = this.W;
    const H = this.H;
    a.T += dt;
    if (a.mode === 'exit') a.xT += dt;
    const T = a.T;
    const L = this.layout(W, H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (this.fondo) g.drawImage(this.fondo, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const P = {
      g: { proceso: 0, completados: 0 },
      env: 0,
      boost: { proceso: 0, completados: 0 },
      pulse: -1,
      sel: a.world,
      chip: { proceso: 0, completados: 0 },
    };
    let cam = { x: W / 2, y: H / 2, s: 1 };
    let vp = { x: W / 2, y: H / 2 };
    let v = 0.004;
    let haze = 0;
    let ui = 1;
    let sysA = 0;
    let sysSc = 1;
    let sysChip = 0;
    MUNDOS.forEach((w) => {
      this.hk[w] += ((this.hover === w && a.mode === 'overview' ? 1 : 0) - this.hk[w]) * Math.min(1, rawDt * 6);
    });
    const spinBoost = { proceso: 0, completados: 0 };

    if (a.mode === 'overview') {
      P.g.proceso = P.g.completados = P.env = 1;
      P.chip.proceso = P.chip.completados = 1;
      P.boost.proceso = this.hk.proceso * 0.5;
      P.boost.completados = this.hk.completados * 0.5;
      spinBoost.proceso = this.hk.proceso * 0.15;
      spinBoost.completados = this.hk.completados * 0.15;
    } else if (a.mode === 'enter') {
      const w = a.world;
      const o: Mundo = w === 'proceso' ? 'completados' : 'proceso';
      const gp = L[w];
      const k = eio(cl((T - 0.35) / 1.85));
      const s = Math.pow(16, k);
      const mv = eio(cl((T - 0.35) / 1.5));
      const sp = { x: lerp(gp.x, W / 2, mv), y: lerp(gp.y, H / 2, mv) };
      cam = { s, x: gp.x - (sp.x - W / 2) / s, y: gp.y - (sp.y - H / 2) / s };
      const vk = sm(0.1, 0.7, T);
      vp = { x: lerp(W / 2, sp.x, vk), y: lerp(H / 2, sp.y, vk) };
      P.g[w] = 1 - sm(2.35, 3.3, T);
      P.g[o] = (1 - 0.7 * sm(0.1, 0.9, T)) * (1 - sm(1.2, 2.0, T));
      P.env = 1 - sm(0.3, 1.5, T);
      P.boost[w] = sm(0, 0.25, T) * (1 - 0.6 * sm(0.8, 2.4, T));
      P.pulse = T < 1.1 ? T / 1.1 : -1;
      P.chip[w] = 1 - sm(0.2, 0.9, T);
      P.chip[o] = 1 - sm(0, 0.6, T);
      spinBoost[w] = 0.4 * sm(0, 1.4, T);
      v = this.vel(T);
      haze = sm(2.05, 2.75, T) * (1 - sm(3.0, 3.7, T));
      ui = T < 3.5 ? 1 - sm(1.2, 1.8, T) : sm(5.2, 6.0, T);
      sysA = T > 3.2 ? 1 : 0;
      sysChip = sm(5.8, 6.4, T);
      if (this.reduced) {
        v = 0.004;
        haze = 0;
        ui = 1;
      }
    } else {
      const x = a.xT;
      sysA = 1 - sm(0, 0.55, x);
      sysSc = 1 + 0.45 * ei(cl(x / 0.6));
      v = 0.004 + (this.reduced ? 0 : 0.35 * Math.sin(Math.PI * cl(x / 1.1)));
      const ov = sm(0.35, 1.0, x);
      P.g.proceso = P.g.completados = P.env = ov;
      P.chip.proceso = P.chip.completados = sm(0.7, 1.2, x);
      cam = { x: W / 2, y: H / 2, s: lerp(0.7, 1, eo(cl((x - 0.3) / 0.9))) };
      sysChip = 1 - sm(0, 0.3, x);
      if (x > 1.25) {
        a.mode = 'overview';
        this.modo = 'overview';
        this.seleccionado = null;
        this.alCambiarModo('overview', a.world);
      }
    }
    MUNDOS.forEach((w) => {
      this.spin[w] -= rawDt * (0.035 + spinBoost[w]);
    });
    // Las orbitas empiezan a girar cuando el sistema termino de armarse.
    if (this.movimiento && this.modo === 'system' && a.mode === 'enter' && a.T > FIN_ENTRADA) this.giro += rawDt;

    if (P.g.proceso > 0 || P.g.completados > 0 || P.env > 0) this.drawOverview(g, W, H, L, cam, P, T);
    if (haze > 0.001) {
      const hc = a.world === 'proceso' ? '168,128,196' : '96,176,166';
      g.fillStyle = `rgba(${hc},${haze * 0.5})`;
      g.fillRect(0, 0, W, H);
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(10,8,22,${haze * 0.55})`);
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
    }
    this.drawStars(g, W, H, vp, v, dt, T);
    let sysInfo: InfoPlaneta[] = [];
    if (sysA > 0 && this.modo === 'system') sysInfo = this.drawSystem(g, W, H, T, sysA, sysSc, a.world);
    this.updateDom(L, cam, P, sysInfo, ui, sysChip, W);
  }

  private drawStars(g: CanvasRenderingContext2D, W: number, H: number, vp: Punto, v: number, dt: number, T: number) {
    const f = Math.max(W, H) * 0.5;
    g.lineCap = 'round';
    for (const st of this.stars) {
      st.z -= v * dt;
      if (st.z < 0.02) {
        st.z = 1;
        st.x = (Math.random() * 2 - 1) * 1.15;
        st.y = (Math.random() * 2 - 1) * 1.15;
      }
      const z = st.z;
      const sx = vp.x + (st.x * f) / z;
      const sy = vp.y + (st.y * f) / z;
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) {
        if (v > 0.02) {
          st.z = 1;
          st.x = (Math.random() * 2 - 1) * 1.15;
          st.y = (Math.random() * 2 - 1) * 1.15;
        }
        continue;
      }
      let br = st.b * cl((1.05 - z) * 1.5 + 0.15);
      if (v < 0.03) br *= 0.75 + 0.25 * Math.sin(T * st.tw + st.ph);
      const size = st.s * (0.6 + (1 - z) * 1.8);
      g.globalAlpha = Math.min(1, br);
      if (v > 0.03) {
        const z2 = Math.min(1.2, z + v * 0.07);
        const px = vp.x + (st.x * f) / z2;
        const py = vp.y + (st.y * f) / z2;
        g.strokeStyle = st.c;
        g.lineWidth = size;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(sx, sy);
        g.stroke();
      } else {
        g.fillStyle = st.c;
        g.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
    }
    g.globalAlpha = 1;
  }

  private drawOverview(
    g: CanvasRenderingContext2D,
    W: number,
    H: number,
    L: Diseno,
    cam: { x: number; y: number; s: number },
    P: { g: Record<Mundo, number>; env: number; boost: Record<Mundo, number>; pulse: number; sel: Mundo },
    T: number,
  ) {
    const S = (p: Punto) => ({ x: (p.x - cam.x) * cam.s + W / 2, y: (p.y - cam.y) * cam.s + H / 2 });
    const s = cam.s;
    const sp = S(L.sun);
    g.save();
    g.setLineDash([2, 6]);
    g.lineWidth = 1;
    if (P.env > 0) {
      g.strokeStyle = `rgba(140,160,220,${0.22 * P.env})`;
      g.beginPath();
      g.ellipse(sp.x, sp.y, W * 0.47 * s, H * 0.36 * s, 0, 0, TAU);
      g.stroke();
      g.beginPath();
      g.ellipse(sp.x, sp.y, W * 0.34 * s, H * 0.26 * s, 0, 0, TAU);
      g.stroke();
    }
    MUNDOS.forEach((w) => {
      const al = P.g[w];
      if (al <= 0) return;
      const p = S(L[w]);
      g.strokeStyle = `rgba(140,160,220,${0.22 * al * Math.max(P.env, w === P.sel ? 0 : 1)})`;
      g.beginPath();
      g.ellipse(p.x, p.y, L.R * 1.3 * s, L.R * 0.98 * s, 0, 0, TAU);
      g.stroke();
    });
    g.restore();
    if (P.env > 0) this.drawSun(g, sp.x, sp.y, L.sunR * s, P.env, 0.2, T);
    MUNDOS.forEach((w) => {
      const al = P.g[w];
      if (al <= 0) return;
      const p = S(L[w]);
      const R = L.R * s;
      g.save();
      g.globalAlpha = al / (1 + (s - 1) * 0.06);
      g.globalCompositeOperation = 'lighter';
      g.translate(p.x, p.y);
      g.rotate(this.spin[w]);
      // Durante el zoom la galaxia llega a medir decenas de miles de pixeles:
      // se dibuja solo el trozo que cae en pantalla (un circulo que cubre
      // toda la vista, sea cual sea el giro), no la imagen entera.
      const lado = R * 2.3;
      const alcance = Math.max(
        Math.hypot(p.x, p.y),
        Math.hypot(W - p.x, p.y),
        Math.hypot(p.x, H - p.y),
        Math.hypot(W - p.x, H - p.y),
      );
      if (alcance < lado / 2) {
        const img = this.galaxy[w];
        const escala = img.width / lado;
        const medio = img.width / 2;
        g.drawImage(img, medio - alcance * escala, medio - alcance * escala, alcance * 2 * escala, alcance * 2 * escala, -alcance, -alcance, alcance * 2, alcance * 2);
      } else {
        g.drawImage(this.galaxy[w], -lado / 2, -lado / 2, lado, lado);
      }
      g.restore();
      const col = w === 'proceso' ? '170,130,255' : '70,230,180';
      g.save();
      g.globalCompositeOperation = 'lighter';
      if (P.boost[w] > 0) {
        const bg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 0.7);
        bg.addColorStop(0, `rgba(${col},${0.45 * P.boost[w] * al})`);
        bg.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = bg;
        g.fillRect(p.x - R, p.y - R, R * 2, R * 2);
      }
      if (w === P.sel && P.pulse >= 0) {
        const k = eo(P.pulse);
        g.strokeStyle = `rgba(${col},${(1 - P.pulse) * 0.7})`;
        g.lineWidth = 3 * (1 - P.pulse) + 0.5;
        g.beginPath();
        g.arc(p.x, p.y, R * (0.15 + 1.1 * k), 0, TAU);
        g.stroke();
      }
      const orbC = w === 'proceso' ? ['120,170,255', '190,120,255', '255,140,220'] : ['80,240,190', '60,200,230', '160,255,200'];
      for (let k = 0; k < 3; k++) {
        const an = T * 0.12 + k * 2.1 + (w === 'proceso' ? 0 : 1);
        const ox = p.x + Math.cos(an) * L.R * 1.3 * s;
        const oy = p.y + Math.sin(an) * L.R * 0.98 * s;
        const rr = (3 + k) * Math.min(2.5, s);
        const og = g.createRadialGradient(ox - rr * 0.3, oy - rr * 0.3, 0, ox, oy, rr * 2.2);
        og.addColorStop(0, `rgba(255,255,255,${0.9 * al})`);
        og.addColorStop(0.35, `rgba(${orbC[k]},${0.8 * al})`);
        og.addColorStop(1, `rgba(${orbC[k]},0)`);
        g.fillStyle = og;
        g.fillRect(ox - rr * 2.2, oy - rr * 2.2, rr * 4.4, rr * 4.4);
      }
      g.restore();
    });
  }

  private drawSun(g: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, flare: number, T: number) {
    if (alpha <= 0 || r < 0.5) return;
    const S = this.sol;
    g.save();
    g.globalAlpha = alpha;
    g.globalCompositeOperation = 'lighter';
    const rh = r * 3.4 * (1 + 0.06 * Math.sin(T * 1.7));
    g.drawImage(S.halo, x - rh, y - rh, rh * 2, rh * 2);
    if (flare > 0) {
      // Destello horizontal
      g.save();
      g.translate(x, y);
      g.scale(7, 0.06);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
      gr.addColorStop(0, `rgba(255,230,170,${0.8 * flare})`);
      gr.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r * 1.4, 0, TAU);
      g.fill();
      g.restore();
      // Doce rayos que giran despacio y cambian de largo
      g.save();
      g.translate(x, y);
      g.rotate(T * 0.05);
      g.globalAlpha = alpha * 0.22 * flare;
      for (let i = 0; i < 12; i++) {
        g.rotate(TAU / 12);
        const len = r * (2.2 + 0.6 * Math.sin(T * 0.8 + i * 1.7));
        g.drawImage(S.rayo, r * 0.8, -r * 0.05, Math.max(0, len - r * 0.8), r * 0.1);
      }
      g.restore();
    }
    g.globalCompositeOperation = 'source-over';
    g.drawImage(S.cuerpo, x - r, y - r, r * 2, r * 2);
    // Manchas de la superficie que se mueven despacio
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.clip();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const bx = x + Math.cos(T * 0.25 * ((i % 3) + 1) + i * 1.3) * r * 0.55;
      const by = y + Math.sin(T * 0.2 * ((i % 2) + 1) + i * 2.1) * r * 0.55;
      g.drawImage(S.claro, bx - r * 0.45, by - r * 0.45, r * 0.9, r * 0.9);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 5; i++) {
      const bx = x + Math.cos(-T * 0.18 + i * 2.4) * r * 0.6;
      const by = y + Math.sin(-T * 0.15 + i * 1.9) * r * 0.5;
      g.drawImage(S.oscuro, bx - r * 0.35, by - r * 0.35, r * 0.7, r * 0.7);
    }
    g.restore();
    g.strokeStyle = 'rgba(255,232,160,0.7)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.stroke();
    g.drawImage(S.edificio, x - r, y - r, r * 2, r * 2);
    // El nombre de la empresa va debajo del sol, completo y nitido (dentro
    // no cabe uno largo). Solo se achica o recorta si es demasiado largo.
    const ancho = Math.max(r * 6, 160);
    let tam = Math.max(11, Math.min(15, r * 0.34));
    let rotulo = this.nombreEmpresa.toUpperCase();
    g.font = `800 ${tam}px ${this.fuente}`;
    while (g.measureText(rotulo).width > ancho && tam > 9) {
      tam -= 0.5;
      g.font = `800 ${tam}px ${this.fuente}`;
    }
    while (g.measureText(rotulo).width > ancho && rotulo.length > 4) rotulo = rotulo.slice(0, -2) + '…';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const yRotulo = y + r + Math.max(8, r * 0.25);
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(4,6,13,0.85)';
    g.strokeText(rotulo, x, yRotulo);
    g.fillStyle = '#ffe7b0';
    g.fillText(rotulo, x, yRotulo);
    g.restore();
  }

  private drawPlanet(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    tex: Textura,
    rot: number,
    lx: number,
    ly: number,
    sel: number,
    alpha: number,
    T: number,
  ) {
    if (alpha <= 0.01 || r < 0.5) return;
    g.save();
    g.globalAlpha = alpha;
    if (sel > 0.01) {
      g.globalCompositeOperation = 'lighter';
      const gg = g.createRadialGradient(x, y, r * 0.8, x, y, r * 2.8);
      gg.addColorStop(0, `rgba(255,190,80,${0.45 * sel})`);
      gg.addColorStop(1, 'rgba(255,190,80,0)');
      g.fillStyle = gg;
      g.fillRect(x - r * 2.8, y - r * 2.8, r * 5.6, r * 5.6);
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(255,205,110,${0.85 * sel})`;
      g.lineWidth = 1.5;
      g.setLineDash([4, 4]);
      g.lineDashOffset = -T * 12;
      g.beginPath();
      g.arc(x, y, r * 1.6, 0, TAU);
      g.stroke();
      g.setLineDash([]);
    }
    g.globalCompositeOperation = 'lighter';
    if (tex.halo) g.drawImage(tex.halo, x - r * 1.5, y - r * 1.5, r * 3, r * 3);
    g.globalCompositeOperation = 'source-over';
    if (tex.ring) this.drawRing(g, x, y, r, tex, true);
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.clip();
    const sc = (2 * r) / 128;
    const off = (((rot % 1) + 1) % 1) * 256 * sc;
    g.drawImage(tex.c, x - r - off, y - r, 256 * sc, 2 * r);
    g.drawImage(tex.c, x - r - off + 256 * sc, y - r, 256 * sc, 2 * r);
    const hx = x + lx * r * 0.5;
    const hy = y + ly * r * 0.5;
    const sh = g.createRadialGradient(hx, hy, r * 0.05, hx, hy, r * 2.1);
    sh.addColorStop(0, 'rgba(255,245,225,0.2)');
    sh.addColorStop(0.35, 'rgba(0,0,0,0)');
    sh.addColorStop(0.7, 'rgba(2,3,10,0.65)');
    sh.addColorStop(1, 'rgba(2,3,10,0.95)');
    g.fillStyle = sh;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
    const la = Math.atan2(ly, lx);
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = tex.atm + '0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, r, la - 1.2, la + 1.2);
    g.stroke();
    g.globalCompositeOperation = 'source-over';
    if (tex.ring) this.drawRing(g, x, y, r, tex, false);
    g.restore();
  }

  private drawRing(g: CanvasRenderingContext2D, x: number, y: number, r: number, tex: Textura, back: boolean) {
    g.save();
    g.strokeStyle = tex.ring + '0.55)';
    g.lineWidth = r * 0.22;
    g.beginPath();
    g.ellipse(x, y, r * 1.85, r * 0.48, -0.35, back ? Math.PI : 0, back ? TAU : Math.PI);
    g.stroke();
    g.strokeStyle = tex.ring + '0.3)';
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.ellipse(x, y, r * 2.2, r * 0.58, -0.35, back ? Math.PI : 0, back ? TAU : Math.PI);
    g.stroke();
    g.restore();
  }

  /**
   * Decide donde parte cada planeta (con el movimiento apagado, ahi se queda
   * y su tarjeta queda fija). Uno por uno, se prueba cada orbita en 72
   * angulos y se elige el lugar donde su tarjeta menos choca con las ya
   * puestas, con los planetas, con el sol y con los botones de la escena, y
   * que no se salga de la vista. Se reparte entre orbitas para no cargar una.
   */
  private acomodar(items: PlanetaEscena[], c: Punto, base: number, sunR: number, baseR: number, W: number, H: number) {
    const lugares = new Map<string, Lugar>();
    const tarjetas: Rect[] = [];
    const planetas: Rect[] = [];
    const usados: Lugar[] = [];
    const porOrbita = [0, 0, 0];
    // El sol y, debajo, el nombre de la empresa.
    const anchoSol = Math.max(sunR * 3.6, 190);
    const sol: Rect = { x: c.x - anchoSol / 2, y: c.y - sunR * 1.8, w: anchoSol, h: sunR * 2.8 + 40 };
    // Botones fijos: volver (arriba a la izquierda), ayuda (arriba al centro),
    // movimiento (arriba a la derecha) y crear proyecto (abajo a la derecha).
    const zonas: Rect[] = [
      { x: 0, y: 0, w: 230, h: 78 },
      { x: W / 2 - 150, y: 0, w: 300, h: 46 },
      { x: W - 200, y: 0, w: 200, h: 60 },
      { x: W - 210, y: H - 72, w: 210, h: 72 },
    ];
    const vista: Rect = { x: 8, y: 8, w: W - 16, h: H - 16 };
    for (const it of items) {
      const r = baseR * it.size * 1.1;
      let mejor: Lugar = { orbit: 0, ang: 0 };
      let menor = Infinity;
      for (let o = 0; o < 3; o++) {
        const rx = base * ORBITAS[o];
        const ry = rx * 0.42;
        for (let k = 0; k < 72; k++) {
          const ang = (k / 72) * TAU;
          const x = c.x + Math.cos(ang) * rx;
          const y = c.y + Math.sin(ang) * ry;
          const tarjeta = rectTarjeta(x, y, r, W);
          const planeta: Rect = { x: x - r * 1.6, y: y - r * 1.6, w: r * 3.2, h: r * 3.2 };
          let costo = porOrbita[o] * 900;
          costo += (tarjeta.w * tarjeta.h - solape(tarjeta, vista)) * 6;
          costo += solape(planeta, sol) * 3 + solape(tarjeta, sol) * 2;
          for (const z of zonas) costo += solape(tarjeta, z) * 3 + solape(planeta, z) * 3;
          for (const t of tarjetas) costo += solape(tarjeta, t) * 4 + solape(planeta, t) * 2;
          for (const p of planetas) costo += solape(tarjeta, p) * 2 + solape(planeta, p) * 4;
          // Que en una misma orbita no queden pegados.
          for (const u of usados) {
            if (u.orbit !== o) continue;
            const d = Math.abs(((ang - u.ang + Math.PI * 3) % TAU) - Math.PI);
            if (d < 0.6) costo += (0.6 - d) * 3000;
          }
          if (costo < menor) {
            menor = costo;
            mejor = { orbit: o, ang };
          }
        }
      }
      const rx = base * ORBITAS[mejor.orbit];
      const x = c.x + Math.cos(mejor.ang) * rx;
      const y = c.y + Math.sin(mejor.ang) * rx * 0.42;
      tarjetas.push(rectTarjeta(x, y, r, W));
      planetas.push({ x: x - r * 1.6, y: y - r * 1.6, w: r * 3.2, h: r * 3.2 });
      usados.push(mejor);
      porOrbita[mejor.orbit] += 1;
      lugares.set(it.id, mejor);
    }
    return lugares;
  }

  private drawSystem(g: CanvasRenderingContext2D, W: number, H: number, T: number, alpha: number, sc: number, world: Mundo) {
    const c = { x: W / 2, y: H * 0.56 };
    const base = Math.min(W * 0.92, H * 2.1);
    const orbits = ORBITAS.map((f) => ({ rx: base * f * sc, ry: base * f * 0.42 * sc }));
    const sunR = Math.min(W, H) * 0.065;
    const ss = T < 4.3 ? lerp(0.12, 1.45, eo(cl((T - 3.3) / 1.0))) : lerp(1.45, 1, eio(cl((T - 4.3) / 1.7)));
    const sunA = alpha * sm(3.25, 3.9, T);
    const flare = sm(3.4, 4.0, T) * (1 - 0.7 * sm(4.2, 6, T));
    if (sunA > 0) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const alcance = orbits[2].rx * 1.1;
      const wg = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, alcance);
      wg.addColorStop(0, `rgba(255,170,60,${0.09 * sunA})`);
      wg.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = wg;
      g.fillRect(c.x - alcance, c.y - alcance, alcance * 2, alcance * 2);
      g.restore();
    }
    g.save();
    g.lineWidth = 1;
    g.setLineDash([2, 5]);
    orbits.forEach((o, i) => {
      const p = sm(3.8 + i * 0.18, 4.7 + i * 0.18, T) * alpha;
      if (p <= 0) return;
      g.strokeStyle = `rgba(160,175,230,${0.3 * alpha})`;
      g.beginPath();
      g.ellipse(c.x, c.y, o.rx, o.ry, 0, -Math.PI / 2, -Math.PI / 2 + p * TAU);
      g.stroke();
    });
    g.restore();
    const dA = sm(4.8, 5.4, T) * alpha;
    if (dA > 0) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      orbits.forEach((o, i) => {
        for (let k = 0; k < 2; k++) {
          const an = (T * 0.14) / (i + 1) + k * Math.PI + i * 1.1;
          const dx = c.x + Math.cos(an) * o.rx;
          const dy = c.y + Math.sin(an) * o.ry;
          const dg = g.createRadialGradient(dx, dy, 0, dx, dy, 6);
          dg.addColorStop(0, `rgba(230,240,255,${0.9 * dA})`);
          dg.addColorStop(1, 'rgba(160,190,255,0)');
          g.fillStyle = dg;
          g.fillRect(dx - 6, dy - 6, 12, 12);
        }
      });
      g.restore();
    }
    const items = this.datos[world] || [];
    const baseR = Math.max(11, Math.min(26, Math.min(W, H) * 0.026));
    // El acomodo se recalcula solo si cambia la vista o los proyectos.
    const clave = `${world}|${W}x${H}|${items.map((it) => it.id).join(',')}`;
    if (clave !== this.claveLugares) {
      this.lugares = this.acomodar(items, c, base, sunR, baseR, W, H);
      this.claveLugares = clave;
    }
    const list = items.map((it, i) => {
      const lugar = this.lugares.get(it.id) ?? { orbit: i % 3, ang: 0 };
      const o = orbits[lugar.orbit];
      const ang = lugar.ang + VELOCIDAD_ORBITA[lugar.orbit] * this.giro;
      const tx = c.x + Math.cos(ang) * o.rx;
      const ty = c.y + Math.sin(ang) * o.ry;
      const depth = Math.sin(ang);
      // Los planetas entran uno tras otro; con muchos, el turno se acorta
      // para que el ultimo no llegue mucho despues del primero.
      const turno = Math.min(0.22, 1.4 / Math.max(1, items.length));
      const t0 = this.enterAt[it.id] ?? (this.reduced ? 3.7 + i * 0.1 : 4.6 + i * turno);
      const p = eo(cl((T - t0) / 1.1));
      let dx = tx - c.x;
      let dy = ty - c.y;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const far = Math.max(W, H) * 0.75 * (this.reduced ? 0.1 : 1);
      const x = lerp(tx + dx * far, tx, p);
      const y = lerp(ty + dy * far, ty, p);
      const tgt = this.seleccionado === it.id ? 1 : 0;
      this.selK[it.id] = (this.selK[it.id] ?? 0) + (tgt - (this.selK[it.id] ?? 0)) * 0.12;
      const sk = this.selK[it.id];
      const r = baseR * it.size * (0.88 + (0.24 * (depth + 1)) / 2) * (0.5 + 0.5 * p) * (1 + 0.25 * sk) * Math.min(1.2, sc);
      const lx = c.x - x;
      const ly = c.y - y;
      const ll = Math.hypot(lx, ly) || 1;
      return {
        it,
        x,
        y,
        r,
        depth,
        sk,
        lx: lx / ll,
        ly: ly / ll,
        pa: alpha * Math.min(1, p * 2),
        ca: sm(t0 + 0.75, t0 + 1.2, T) * alpha,
        rot: T * 0.015 * (1 + (i % 3) * 0.4) + i * 0.37,
      };
    });
    const order = list.slice().sort((a, b) => a.depth - b.depth);
    const dp = (q: (typeof list)[number]) =>
      this.drawPlanet(g, q.x, q.y, q.r, this.tex[q.it.tex % this.tex.length], q.rot, q.lx, q.ly, q.sk, q.pa, T);
    // Los planetas que pasan por detras del sol se dibujan antes que el.
    order.filter((q) => q.depth < 0).forEach(dp);
    this.drawSun(g, c.x, c.y, sunR * ss * Math.min(1.3, sc), sunA, flare, T);
    order.filter((q) => q.depth >= 0).forEach(dp);
    return list;
  }

  private updateDom(
    L: Diseno,
    cam: { x: number; y: number; s: number },
    P: { chip: Record<Mundo, number> },
    sysInfo: InfoPlaneta[],
    ui: number,
    sysChip: number,
    W: number,
  ) {
    const d = this.getDom();
    const ov = this.anim.mode === 'overview';
    d.ui.forEach((e) => {
      e.style.opacity = String(ui);
      e.style.pointerEvents = ui > 0.5 ? 'auto' : 'none';
    });
    MUNDOS.forEach((w) => {
      const p = { x: (L[w].x - cam.x) * cam.s + W / 2, y: (L[w].y - cam.y) * cam.s + this.H / 2 };
      const R = L.R * cam.s;
      const ch = d.gchip[w];
      const h = d.ghit[w];
      if (ch) {
        ch.style.transform = `translate(${Math.round(p.x - L.R * 0.75)}px,${Math.round(p.y - L.R * 1.12 - 22)}px)`;
        ch.style.opacity = String(P.chip[w]);
        ch.style.pointerEvents = ov ? 'auto' : 'none';
      }
      if (h) {
        const s = R * 1.8;
        h.style.width = h.style.height = s + 'px';
        h.style.transform = `translate(${p.x - s / 2}px,${p.y - s / 2}px)`;
        h.style.pointerEvents = ov ? 'auto' : 'none';
      }
    });
    if (d.sys) {
      d.sys.style.opacity = String(sysChip);
      d.sys.style.pointerEvents = sysChip > 0.5 ? 'auto' : 'none';
    }
    sysInfo.forEach((q) => {
      const id = q.it.id;
      const hb = d.hit[id];
      const cd = d.card[id];
      if (hb) {
        const s = q.r * 2 + 14;
        hb.style.width = hb.style.height = s + 'px';
        hb.style.transform = `translate(${q.x - s / 2}px,${q.y - s / 2}px)`;
        hb.style.pointerEvents = q.ca > 0.5 ? 'auto' : 'none';
      }
      if (cd) {
        const cw = this.cardW[id] || (this.cardW[id] = cd.offsetWidth || ANCHO_TARJETA);
        const t = rectTarjeta(q.x, q.y, q.r, W, cw);
        cd.style.transform = `translate(${Math.round(t.x)}px,${Math.round(t.y)}px)`;
        cd.style.opacity = String(q.ca);
        cd.style.pointerEvents = q.ca > 0.5 ? 'auto' : 'none';
      }
    });
  }
}
