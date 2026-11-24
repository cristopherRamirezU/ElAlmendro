/**
 * Fondos del mapa de nodos que cada usuario puede elegir. Los codigos deben
 * calzar con FONDOS_MAPA_VALIDOS del backend (auth/dto/actualizar-preferencias).
 */
export const FONDOS_MAPA = [
  {
    codigo: 'claro-puntos',
    nombre: 'Lienzo con puntos',
    claro: true,
    muestra: 'radial-gradient(rgba(15,23,42,.24) 1px, transparent 1px) 0 0 / 6px 6px, #f6f9fe',
  },
  {
    codigo: 'claro-cuadricula',
    nombre: 'Cuadrícula técnica',
    claro: true,
    muestra:
      'repeating-linear-gradient(0deg,rgba(15,23,42,.12) 0 1px,transparent 1px 7px),repeating-linear-gradient(90deg,rgba(15,23,42,.12) 0 1px,transparent 1px 7px),#f8fbff',
  },
  {
    codigo: 'claro-bruma',
    nombre: 'Bruma pastel',
    claro: true,
    muestra:
      'radial-gradient(circle at 22% 75%, rgba(56,189,248,.34), transparent 60%), radial-gradient(circle at 75% 25%, rgba(16,185,129,.26), transparent 60%), #f5f9ff',
  },
  {
    codigo: 'gris-puntos',
    nombre: 'Gris con puntos',
    claro: false,
    muestra: 'radial-gradient(rgba(255,255,255,.25) 1px, transparent 1px) 0 0 / 6px 6px, #141414',
  },
  {
    codigo: 'azul-puntos',
    nombre: 'Azul noche',
    claro: false,
    muestra:
      'radial-gradient(rgba(148,163,184,.35) 1px, transparent 1px) 0 0 / 6px 6px, linear-gradient(135deg, #0c1f47, #060b18)',
  },
  {
    codigo: 'aurora',
    nombre: 'Aurora',
    claro: false,
    muestra:
      'radial-gradient(circle at 20% 80%, #7c3aed99, transparent 55%), radial-gradient(circle at 60% 10%, #0ea5e999, transparent 55%), radial-gradient(circle at 90% 90%, #10b98199, transparent 55%), #070a14',
  },
  {
    codigo: 'hexagonos',
    nombre: 'Hexágonos',
    claro: false,
    muestra: 'linear-gradient(135deg, #0b1730, #070c18)',
  },
] as const;

export type FondoMapa = (typeof FONDOS_MAPA)[number]['codigo'];

export const FONDO_MAPA_DEFECTO: FondoMapa = 'gris-puntos';
export const FONDO_MAPA_CLARO_DEFECTO: FondoMapa = 'claro-puntos';

export const FONDOS_MAPA_CLAROS = FONDOS_MAPA.filter((f) => f.claro);
export const FONDOS_MAPA_OSCUROS = FONDOS_MAPA.filter((f) => !f.claro);

export function esFondoMapaClaro(codigo: FondoMapa): boolean {
  return FONDOS_MAPA_CLAROS.some((f) => f.codigo === codigo);
}

/**
 * El fondo guardado del usuario; si aún no guardó preferencia explícita,
 * acompaña al tema global (claro u oscuro).
 */
export function fondoMapaValido(codigo: string | null | undefined, temaEsClaro = false): FondoMapa {
  if (codigo && FONDOS_MAPA.some((f) => f.codigo === codigo)) return codigo as FondoMapa;
  return temaEsClaro ? FONDO_MAPA_CLARO_DEFECTO : FONDO_MAPA_DEFECTO;
}
