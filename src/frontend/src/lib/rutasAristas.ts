import { Position } from '@xyflow/react';
import type { Orientacion, Punto } from './mapaMental';

/**
 * Trazado de las lineas del mapa. Cada linea elige por que borde sale y por
 * cual llega segun donde quedo un nodo respecto del otro, asi nunca pasa por
 * debajo de sus propias burbujas. Si aun asi la curva cruza una burbuja ajena
 * (porque alguien dejo un nodo justo en medio), esa linea se traza en angulos
 * rectos rodeando a las demas.
 */

/** Rectangulo de una burbuja en coordenadas del mapa. */
export interface Caja {
  id: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/**
 * Bordes enfrentados de dos burbujas. Se prefiere el eje del arbol (izquierda
 * y derecha en horizontal, arriba y abajo en vertical) mientras haya espacio
 * libre en ese eje: asi el acomodo automatico se ve como siempre. Si en ese
 * eje se solapan, se usa el otro.
 */
export function ladosEnfrentados(
  origen: Caja,
  destino: Caja,
  orientacion: Orientacion,
): { salida: Position; entrada: Position } {
  const dx = destino.x + destino.ancho / 2 - (origen.x + origen.ancho / 2);
  const dy = destino.y + destino.alto / 2 - (origen.y + origen.alto / 2);
  const holguraX = Math.abs(dx) - (origen.ancho + destino.ancho) / 2;
  const holguraY = Math.abs(dy) - (origen.alto + destino.alto) / 2;
  const holguraDelEje = orientacion === 'horizontal' ? holguraX : holguraY;
  const porLosCostados = holguraDelEje > 0 ? orientacion === 'horizontal' : holguraX > holguraY;

  if (porLosCostados) {
    return dx >= 0
      ? { salida: Position.Right, entrada: Position.Left }
      : { salida: Position.Left, entrada: Position.Right };
  }
  return dy >= 0
    ? { salida: Position.Bottom, entrada: Position.Top }
    : { salida: Position.Top, entrada: Position.Bottom };
}

/** Hacia donde apunta cada borde, como vector unitario. */
const DIRECCION: Record<Position, Punto> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
};

// ------------------------------------------------------------------ curva

/** Igual que la curva por defecto de React Flow, para que se vea identica. */
const CURVATURA = 0.25;

function desplazamientoControl(distancia: number) {
  return distancia >= 0 ? 0.5 * distancia : CURVATURA * 25 * Math.sqrt(-distancia);
}

function puntoControl(lado: Position, desde: Punto, hacia: Punto): Punto {
  switch (lado) {
    case Position.Left:
      return { x: desde.x - desplazamientoControl(desde.x - hacia.x), y: desde.y };
    case Position.Right:
      return { x: desde.x + desplazamientoControl(hacia.x - desde.x), y: desde.y };
    case Position.Top:
      return { x: desde.x, y: desde.y - desplazamientoControl(desde.y - hacia.y) };
    default:
      return { x: desde.x, y: desde.y + desplazamientoControl(hacia.y - desde.y) };
  }
}

/** Puntos de la curva cubica, lo bastante juntos para no saltarse una burbuja. */
function muestrasCurva(p0: Punto, p1: Punto, p2: Punto, p3: Punto): Punto[] {
  const largo = Math.hypot(p3.x - p0.x, p3.y - p0.y) + Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p3.x - p2.x, p3.y - p2.y);
  const n = Math.max(24, Math.ceil(largo / 10));
  const puntos: Punto[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    puntos.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return puntos;
}

function dentro(p: Punto, c: Caja, margen: number) {
  return (
    p.x > c.x - margen && p.x < c.x + c.ancho + margen && p.y > c.y - margen && p.y < c.y + c.alto + margen
  );
}

// ------------------------------------------------------- ruta ortogonal

/** Aire que deja la ruta alrededor de cada burbuja. */
const MARGEN = 14;
/** Tramo recto con que la linea sale del borde antes de doblar. */
const SALIDA_RECTA = MARGEN + 6;
/** Costo extra de cada doblez: entre rutas parecidas, la de menos codos. */
const COSTO_GIRO = 40;

interface Rect {
  izq: number;
  der: number;
  arr: number;
  aba: number;
}

function inflar(c: Caja): Rect {
  return { izq: c.x - MARGEN, der: c.x + c.ancho + MARGEN, arr: c.y - MARGEN, aba: c.y + c.alto + MARGEN };
}

function adentroDe(x: number, y: number, r: Rect) {
  return x > r.izq && x < r.der && y > r.arr && y < r.aba;
}

/** Cola de prioridad minima (monticulo binario) para Dijkstra. */
class Monticulo {
  private datos: [number, number][] = [];

  get vacio() {
    return this.datos.length === 0;
  }

  meter(costo: number, valor: number) {
    const d = this.datos;
    d.push([costo, valor]);
    let i = d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p][0] <= d[i][0]) break;
      [d[p], d[i]] = [d[i], d[p]];
      i = p;
    }
  }

  sacar(): [number, number] {
    const d = this.datos;
    const arriba = d[0];
    const ultimo = d.pop()!;
    if (d.length) {
      d[0] = ultimo;
      let i = 0;
      for (;;) {
        const a = 2 * i + 1;
        const b = a + 1;
        let menor = i;
        if (a < d.length && d[a][0] < d[menor][0]) menor = a;
        if (b < d.length && d[b][0] < d[menor][0]) menor = b;
        if (menor === i) break;
        [d[menor], d[i]] = [d[i], d[menor]];
        i = menor;
      }
    }
    return arriba;
  }
}

/** Direcciones de avance en la grilla: derecha, abajo, izquierda, arriba. */
const PASOS = [
  { di: 1, dj: 0 },
  { di: 0, dj: 1 },
  { di: -1, dj: 0 },
  { di: 0, dj: -1 },
];

function indicePaso(v: Punto) {
  if (v.x > 0) return 0;
  if (v.y > 0) return 1;
  if (v.x < 0) return 2;
  return 3;
}

/**
 * Ruta en angulos rectos de `inicio` a `fin` que no entra en ninguna burbuja.
 * La grilla sale de los bordes de las burbujas (mas su margen) y de los
 * extremos; sobre ella se busca el camino mas corto con pocos codos. Devuelve
 * null si no hay paso.
 */
function rutaEnCajas(
  inicio: Punto,
  ladoInicio: Position,
  fin: Punto,
  ladoFin: Position,
  cajas: Caja[],
): Punto[] | null {
  const dirInicio = DIRECCION[ladoInicio];
  const dirFin = DIRECCION[ladoFin];
  const a = { x: inicio.x + dirInicio.x * SALIDA_RECTA, y: inicio.y + dirInicio.y * SALIDA_RECTA };
  const b = { x: fin.x + dirFin.x * SALIDA_RECTA, y: fin.y + dirFin.y * SALIDA_RECTA };
  const rects = cajas.map(inflar);
  if (rects.some((r) => adentroDe(a.x, a.y, r) || adentroDe(b.x, b.y, r))) return null;

  const unicos = (valores: number[]) => [...new Set(valores.map((v) => Math.round(v * 10) / 10))].sort((p, q) => p - q);
  const xs = unicos([a.x, b.x, (a.x + b.x) / 2, ...rects.flatMap((r) => [r.izq, r.der])]);
  const ys = unicos([a.y, b.y, (a.y + b.y) / 2, ...rects.flatMap((r) => [r.arr, r.aba])]);
  const nx = xs.length;
  const ny = ys.length;
  const indice = (i: number, j: number) => j * nx + i;
  const libre = (x: number, y: number) => !rects.some((r) => adentroDe(x, y, r));

  const iA = xs.indexOf(Math.round(a.x * 10) / 10);
  const jA = ys.indexOf(Math.round(a.y * 10) / 10);
  const iB = xs.indexOf(Math.round(b.x * 10) / 10);
  const jB = ys.indexOf(Math.round(b.y * 10) / 10);
  const dirLlegada = indicePaso({ x: -dirFin.x, y: -dirFin.y });

  // Estado = punto de la grilla y direccion con que se llego a el.
  const costo = new Float64Array(nx * ny * 4).fill(Infinity);
  const previo = new Int32Array(nx * ny * 4).fill(-1);
  const cola = new Monticulo();
  const estadoInicial = indice(iA, jA) * 4 + indicePaso(dirInicio);
  costo[estadoInicial] = 0;
  cola.meter(0, estadoInicial);

  let final = -1;
  while (!cola.vacio) {
    const [c, estado] = cola.sacar();
    if (c > costo[estado]) continue;
    const punto = estado >> 2;
    const dir = estado & 3;
    const i = punto % nx;
    const j = (punto - i) / nx;
    if (i === iB && j === jB) {
      final = estado;
      if (dir === dirLlegada) break;
      // Llegar torcido cuesta un codo mas: se sigue buscando por si hay otra.
      const conGiro = c + COSTO_GIRO;
      const llegada = punto * 4 + dirLlegada;
      if (conGiro < costo[llegada]) {
        costo[llegada] = conGiro;
        previo[llegada] = estado;
        cola.meter(conGiro, llegada);
      }
      continue;
    }
    for (let d = 0; d < 4; d++) {
      if (d === (dir + 2) % 4) continue;
      const ni = i + PASOS[d].di;
      const nj = j + PASOS[d].dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      if (!libre(xs[ni], ys[nj])) continue;
      if (!libre((xs[i] + xs[ni]) / 2, (ys[j] + ys[nj]) / 2)) continue;
      const largo = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]);
      const nuevo = c + largo + (d === dir ? 0 : COSTO_GIRO);
      const siguiente = indice(ni, nj) * 4 + d;
      if (nuevo < costo[siguiente]) {
        costo[siguiente] = nuevo;
        previo[siguiente] = estado;
        cola.meter(nuevo, siguiente);
      }
    }
  }
  if (final < 0) return null;

  const llegada = indice(iB, jB) * 4 + dirLlegada;
  let estado = costo[llegada] < Infinity ? llegada : final;
  const tramo: Punto[] = [];
  while (estado >= 0) {
    const punto = estado >> 2;
    const i = punto % nx;
    const sigue = previo[estado];
    const anterior = sigue >= 0 ? sigue >> 2 : -1;
    if (punto !== anterior) tramo.push({ x: xs[i], y: ys[(punto - i) / nx] });
    estado = sigue;
  }
  tramo.reverse();
  return [inicio, ...tramo, fin];
}

/** Ruta ortogonal; primero solo con las burbujas cercanas, que es lo comun y es rapido. */
function rutaOrtogonal(
  inicio: Punto,
  ladoInicio: Position,
  fin: Punto,
  ladoFin: Position,
  cajas: Caja[],
): Punto[] | null {
  const holgura = 400;
  const izq = Math.min(inicio.x, fin.x) - holgura;
  const der = Math.max(inicio.x, fin.x) + holgura;
  const arr = Math.min(inicio.y, fin.y) - holgura;
  const aba = Math.max(inicio.y, fin.y) + holgura;
  const cercanas = cajas.filter((c) => c.x < der && c.x + c.ancho > izq && c.y < aba && c.y + c.alto > arr);
  const ruta = rutaEnCajas(inicio, ladoInicio, fin, ladoFin, cercanas);
  if (ruta && (cercanas.length === cajas.length || !rutaCruza(ruta, cajas))) return ruta;
  return rutaEnCajas(inicio, ladoInicio, fin, ladoFin, cajas);
}

/** Si algun tramo de la ruta (sin sus extremos pegados a las burbujas) entra en una caja. */
function rutaCruza(ruta: Punto[], cajas: Caja[]) {
  const rects = cajas.map(inflar);
  for (let k = 1; k < ruta.length - 2; k++) {
    const p = ruta[k];
    const q = ruta[k + 1];
    const pasos = Math.max(1, Math.ceil((Math.abs(q.x - p.x) + Math.abs(q.y - p.y)) / 10));
    for (let s = 0; s <= pasos; s++) {
      const x = p.x + ((q.x - p.x) * s) / pasos;
      const y = p.y + ((q.y - p.y) * s) / pasos;
      if (rects.some((r) => adentroDe(x, y, r))) return true;
    }
  }
  return false;
}

/** Trazo SVG de una polilinea con las esquinas redondeadas. */
function trazoConEsquinas(puntos: Punto[], radio = 10): string {
  // Fuera los puntos repetidos o alineados con sus vecinos.
  const limpios: Punto[] = [];
  for (const p of puntos) {
    const ultimo = limpios[limpios.length - 1];
    if (ultimo && Math.abs(ultimo.x - p.x) < 0.5 && Math.abs(ultimo.y - p.y) < 0.5) continue;
    const penultimo = limpios[limpios.length - 2];
    if (
      penultimo &&
      ((Math.abs(penultimo.x - ultimo.x) < 0.5 && Math.abs(ultimo.x - p.x) < 0.5) ||
        (Math.abs(penultimo.y - ultimo.y) < 0.5 && Math.abs(ultimo.y - p.y) < 0.5))
    ) {
      limpios.pop();
    }
    limpios.push(p);
  }

  let trazo = `M${limpios[0].x},${limpios[0].y}`;
  for (let k = 1; k < limpios.length - 1; k++) {
    const antes = limpios[k - 1];
    const p = limpios[k];
    const despues = limpios[k + 1];
    const largoAntes = Math.hypot(p.x - antes.x, p.y - antes.y);
    const largoDespues = Math.hypot(despues.x - p.x, despues.y - p.y);
    const r = Math.min(radio, largoAntes / 2, largoDespues / 2);
    const desde = { x: p.x - ((p.x - antes.x) / largoAntes) * r, y: p.y - ((p.y - antes.y) / largoAntes) * r };
    const hasta = { x: p.x + ((despues.x - p.x) / largoDespues) * r, y: p.y + ((despues.y - p.y) / largoDespues) * r };
    trazo += ` L${desde.x},${desde.y} Q${p.x},${p.y} ${hasta.x},${hasta.y}`;
  }
  const ultimo = limpios[limpios.length - 1];
  return `${trazo} L${ultimo.x},${ultimo.y}`;
}

/**
 * Trazo SVG de una linea del mapa: la curva de siempre si no toca ninguna
 * burbuja ajena; si la toca, una ruta en angulos rectos que las rodea (o la
 * curva, si no hay por donde pasar). `cajas` son todas las burbujas visibles.
 *
 * Con bordes enfrentados la curva nunca cruza sus propias burbujas, pero un
 * borde fijado a mano (por ejemplo, salir por abajo hacia una tarea que esta
 * a la derecha) puede hacer que las atraviese: por eso tambien se revisan,
 * achicadas un poco para no contar el borde donde la linea nace y llega.
 */
export function trazarArista({
  inicio,
  ladoInicio,
  fin,
  ladoFin,
  origenId,
  destinoId,
  cajas,
}: {
  inicio: Punto;
  ladoInicio: Position;
  fin: Punto;
  ladoFin: Position;
  origenId: string;
  destinoId: string;
  cajas: Caja[];
}): string {
  const c1 = puntoControl(ladoInicio, inicio, fin);
  const c2 = puntoControl(ladoFin, fin, inicio);
  const curva = `M${inicio.x},${inicio.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${fin.x},${fin.y}`;

  const propias = cajas.filter((c) => c.id === origenId || c.id === destinoId);
  const ajenas = cajas.filter((c) => c.id !== origenId && c.id !== destinoId);
  const muestras = muestrasCurva(inicio, c1, c2, fin);
  const choca =
    ajenas.some((c) => muestras.some((p) => dentro(p, c, 4))) ||
    propias.some((c) => muestras.some((p) => dentro(p, c, -3)));
  if (!choca) return curva;

  const ruta = rutaOrtogonal(inicio, ladoInicio, fin, ladoFin, cajas);
  return ruta ? trazoConEsquinas(ruta) : curva;
}
