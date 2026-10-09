/**
 * Fondos del mapa de nodos que cada usuario puede elegir. Los codigos deben
 * calzar con FONDOS_MAPA_VALIDOS del backend (auth/dto/actualizar-preferencias).
 */
export const FONDOS_MAPA = [
  { codigo: 'gris-puntos', nombre: 'Gris con puntos', muestra: 'radial-gradient(rgba(255,255,255,.25) 1px, transparent 1px) 0 0 / 6px 6px, #141414' },
  { codigo: 'azul-puntos', nombre: 'Azul noche', muestra: 'radial-gradient(rgba(148,163,184,.35) 1px, transparent 1px) 0 0 / 6px 6px, linear-gradient(135deg, #0c1f47, #060b18)' },
  { codigo: 'aurora', nombre: 'Aurora', muestra: 'radial-gradient(circle at 20% 80%, #7c3aed99, transparent 55%), radial-gradient(circle at 60% 10%, #0ea5e999, transparent 55%), radial-gradient(circle at 90% 90%, #10b98199, transparent 55%), #070a14' },
  { codigo: 'hexagonos', nombre: 'Hexágonos', muestra: 'linear-gradient(135deg, #0b1730, #070c18)' },
] as const;

export type FondoMapa = (typeof FONDOS_MAPA)[number]['codigo'];

export const FONDO_MAPA_DEFECTO: FondoMapa = 'gris-puntos';

/** El fondo guardado del usuario, o el de siempre si no eligio uno (o es desconocido). */
export function fondoMapaValido(codigo: string | null | undefined): FondoMapa {
  return FONDOS_MAPA.some((f) => f.codigo === codigo) ? (codigo as FondoMapa) : FONDO_MAPA_DEFECTO;
}
