import { NodoActividad } from './tipos';

/** Un color por nivel de profundidad (no por rama): asi se lee de un vistazo
 * en que "columna" del arbol esta cada tarea, igual que en el mapa mental de
 * referencia (NotebookLM). */
export const PALETA_PROFUNDIDAD = [
  '#38bdf8', // nivel 1 — sky
  '#34d399', // nivel 2 — emerald
  '#f97316', // nivel 3 — orange
  '#a78bfa', // nivel 4 — violet
  '#f472b6', // nivel 5 — pink
  '#facc15', // nivel 6 — amber
];

/**
 * Sentido en que crece el arbol: `horizontal` (de izquierda a derecha, cada
 * nivel una columna mas a la derecha) o `vertical` (de arriba a abajo, cada
 * nivel una fila mas abajo, tipo organigrama).
 */
export type Orientacion = 'horizontal' | 'vertical';

/** Medidas fijas de la burbuja de tarea: el layout reserva justo ese espacio. */
export const ANCHO_NODO = 220;
export const ALTO_NODO = 64;

/**
 * La insignia del proyecto (nodo principal) es mas grande que una tarea. El
 * acomodo le reserva el mismo lugar que a una tarea y la dibuja centrada en
 * ese lugar: asi sigue centrada respecto de sus hijas y las posiciones que se
 * guardaron a mano (relativas a ese lugar) no cambian.
 */
export const ANCHO_RAIZ = 250;
export const ALTO_RAIZ = 96;

/** Esquina superior izquierda de la insignia a partir del lugar reservado. */
export function posicionInsignia(lugar: { x: number; y: number }) {
  return {
    x: lugar.x - (ANCHO_RAIZ - ANCHO_NODO) / 2,
    y: lugar.y - (ALTO_RAIZ - ALTO_NODO) / 2,
  };
}

/** Distancia entre niveles y entre hermanos, en cada orientacion. */
const ESPACIO: Record<Orientacion, { nivel: number; hermano: number }> = {
  horizontal: { nivel: ANCHO_NODO + 50, hermano: ALTO_NODO + 24 },
  // Las burbujas son anchas y bajas: de arriba a abajo los hermanos
  // necesitan mas separacion lateral y los niveles menos.
  vertical: { nivel: ALTO_NODO + 56, hermano: ANCHO_NODO + 24 },
};

/** Hermanas en el orden guardado; a igual orden, la mas antigua primero. */
function compararHermanas(a: NodoActividad, b: NodoActividad) {
  return (a.orden ?? 0) - (b.orden ?? 0) || (a.creadoEn ?? '').localeCompare(b.creadoEn ?? '');
}

export interface NodoMapa {
  id: string;
  x: number;
  y: number;
  color: string;
  profundidad: number;
  tieneHijos: boolean;
}

export interface ArbolCalculado {
  posiciones: Map<string, NodoMapa>;
  posicionRaiz: { x: number; y: number };
  raicesProyecto: NodoActividad[];
}

/**
 * Layout de arbol colapsable tipo mapa mental. Primero se resuelve la forma
 * abstracta (nivel de profundidad y "carril" de cada tarea, centrando cada
 * padre sobre sus hijas visibles) y al final se traduce a coordenadas segun
 * la orientacion. Solo se calcula posicion para las tareas visibles: una
 * rama colapsada no ocupa espacio ni aparece en el resultado.
 */
export function calcularArbol(
  actividades: NodoActividad[],
  expandidoRaiz: boolean,
  expandido: ReadonlySet<string>,
  orientacion: Orientacion,
): ArbolCalculado {
  const hijosPorPadre = new Map<string, NodoActividad[]>();
  const raicesProyecto: NodoActividad[] = [];
  for (const a of actividades) {
    if (a.actividadPadreId) {
      if (!hijosPorPadre.has(a.actividadPadreId)) hijosPorPadre.set(a.actividadPadreId, []);
      hijosPorPadre.get(a.actividadPadreId)!.push(a);
    } else {
      raicesProyecto.push(a);
    }
  }
  raicesProyecto.sort(compararHermanas);
  for (const hijos of hijosPorPadre.values()) hijos.sort(compararHermanas);

  const espacio = ESPACIO[orientacion];
  const coordenadas = (profundidad: number, carril: number) =>
    orientacion === 'horizontal'
      ? { x: profundidad * espacio.nivel, y: carril * espacio.hermano }
      : { x: carril * espacio.hermano, y: profundidad * espacio.nivel };

  const posiciones = new Map<string, NodoMapa>();
  let contadorCarril = 0;

  function ubicar(a: NodoActividad, profundidad: number): number {
    const hijos = hijosPorPadre.get(a.id) ?? [];
    const hijosVisibles = expandido.has(a.id) ? hijos : [];

    let carril: number;
    if (hijosVisibles.length === 0) {
      carril = contadorCarril;
      contadorCarril += 1;
    } else {
      const carriles = hijosVisibles.map((h) => ubicar(h, profundidad + 1));
      carril = (Math.min(...carriles) + Math.max(...carriles)) / 2;
    }

    posiciones.set(a.id, {
      id: a.id,
      ...coordenadas(profundidad, carril),
      color: PALETA_PROFUNDIDAD[(profundidad - 1) % PALETA_PROFUNDIDAD.length],
      profundidad,
      tieneHijos: hijos.length > 0,
    });
    return carril;
  }

  const raicesVisibles = expandidoRaiz ? raicesProyecto : [];
  let carrilRaiz: number;
  if (raicesVisibles.length === 0) {
    carrilRaiz = contadorCarril;
    contadorCarril += 1;
  } else {
    const carriles = raicesVisibles.map((h) => ubicar(h, 1));
    carrilRaiz = (Math.min(...carriles) + Math.max(...carriles)) / 2;
  }

  return { posiciones, posicionRaiz: coordenadas(0, carrilRaiz), raicesProyecto };
}

export interface Punto {
  x: number;
  y: number;
}

/** Posicion que alguien fijo a mano para el nodo en esta orientacion, si la hay. */
export function posicionGuardada(a: NodoActividad, orientacion: Orientacion): Punto | null {
  const punto = a.posicionNodo?.[orientacion] as Partial<Punto> | undefined;
  return punto && typeof punto.x === 'number' && typeof punto.y === 'number'
    ? { x: punto.x, y: punto.y }
    : null;
}

/** `posicionNodo` con la posicion de una orientacion cambiada (o borrada con `null`). */
export function conPosicion(
  a: NodoActividad,
  orientacion: Orientacion,
  punto: Punto | null,
): NodoActividad['posicionNodo'] {
  const resultado: Record<string, Punto> = {};
  for (const o of ['horizontal', 'vertical'] as const) {
    const actual = o === orientacion ? punto : posicionGuardada(a, o);
    if (actual) resultado[o] = actual;
  }
  return Object.keys(resultado).length ? resultado : null;
}

/**
 * Posiciones finales del mapa: el acomodo automatico corregido por lo que se
 * movio a mano. Cada nodo se ubica relativo a su padre (o a la raiz del
 * proyecto): con el desplazamiento guardado si lo tiene, o con el que le da el
 * acomodo automatico si no. Asi, al mover un padre lo acompana toda su rama.
 */
export function aplicarPosicionesGuardadas(
  arbol: ArbolCalculado,
  actividades: NodoActividad[],
  orientacion: Orientacion,
): Map<string, NodoMapa> {
  const porId = new Map(actividades.map((a) => [a.id, a]));
  const finales = new Map<string, NodoMapa>();
  const porProfundidad = [...arbol.posiciones.values()].sort((a, b) => a.profundidad - b.profundidad);

  for (const auto of porProfundidad) {
    const a = porId.get(auto.id)!;
    const padreId = a.actividadPadreId;
    const padreAuto = (padreId && arbol.posiciones.get(padreId)) || arbol.posicionRaiz;
    const padreFinal = (padreId && finales.get(padreId)) || arbol.posicionRaiz;
    const desplazamiento = posicionGuardada(a, orientacion) ?? {
      x: auto.x - padreAuto.x,
      y: auto.y - padreAuto.y,
    };
    finales.set(auto.id, {
      ...auto,
      x: padreFinal.x + desplazamiento.x,
      y: padreFinal.y + desplazamiento.y,
    });
  }
  return finales;
}

export type LadoLinea = 'top' | 'right' | 'bottom' | 'left';
const LADOS_LINEA: readonly LadoLinea[] = ['top', 'right', 'bottom', 'left'];

/** Extremos de una linea fijados a mano; el que falta lo elige el mapa. */
export interface LadosFijados {
  salida?: LadoLinea;
  entrada?: LadoLinea;
}

/** Bordes fijados de la linea que llega a la tarea, en esta orientacion. */
export function ladosGuardados(a: NodoActividad | undefined, orientacion: Orientacion): LadosFijados {
  const lados = a?.ladosLinea?.[orientacion] as Record<string, unknown> | undefined;
  const resultado: LadosFijados = {};
  if (!lados || typeof lados !== 'object') return resultado;
  if (LADOS_LINEA.includes(lados.salida as LadoLinea)) resultado.salida = lados.salida as LadoLinea;
  if (LADOS_LINEA.includes(lados.entrada as LadoLinea)) resultado.entrada = lados.entrada as LadoLinea;
  return resultado;
}

/** `ladosLinea` con los de una orientacion cambiados (o borrados con `null`). */
export function conLados(
  a: NodoActividad,
  orientacion: Orientacion,
  lados: LadosFijados | null,
): NodoActividad['ladosLinea'] {
  const resultado: Record<string, LadosFijados> = {};
  for (const o of ['horizontal', 'vertical'] as const) {
    const actuales = o === orientacion ? lados ?? {} : ladosGuardados(a, o);
    if (actuales.salida || actuales.entrada) resultado[o] = actuales;
  }
  return Object.keys(resultado).length ? resultado : null;
}

/** Desplazamiento a guardar para un nodo soltado en `punto`, relativo a su padre. */
export function desplazamientoRespectoDelPadre(
  a: NodoActividad,
  punto: Punto,
  finales: Map<string, NodoMapa>,
  posicionRaiz: Punto,
): Punto {
  const padre = (a.actividadPadreId && finales.get(a.actividadPadreId)) || posicionRaiz;
  return { x: Math.round(punto.x - padre.x), y: Math.round(punto.y - padre.y) };
}
