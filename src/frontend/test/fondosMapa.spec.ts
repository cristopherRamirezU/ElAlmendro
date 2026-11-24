import {
  esFondoMapaClaro,
  FONDOS_MAPA,
  FONDO_MAPA_CLARO_DEFECTO,
  FONDO_MAPA_DEFECTO,
  fondoMapaValido,
} from '@/lib/fondosMapa';

describe('Fondos del mapa de nodos', () => {
  it('identifica correctamente cuales fondos son claros y cuales oscuros', () => {
    expect(esFondoMapaClaro('claro-puntos')).toBe(true);
    expect(esFondoMapaClaro('claro-cuadricula')).toBe(true);
    expect(esFondoMapaClaro('claro-bruma')).toBe(true);

    expect(esFondoMapaClaro('gris-puntos')).toBe(false);
    expect(esFondoMapaClaro('azul-puntos')).toBe(false);
    expect(esFondoMapaClaro('aurora')).toBe(false);
    expect(esFondoMapaClaro('hexagonos')).toBe(false);
  });

  it('fondoMapaValido respeta codigos validos y cae al defecto acorde al tema global', () => {
    expect(FONDOS_MAPA).toHaveLength(7);
    expect(fondoMapaValido('aurora', true)).toBe('aurora');
    expect(fondoMapaValido('claro-bruma', false)).toBe('claro-bruma');

    expect(fondoMapaValido(null, true)).toBe(FONDO_MAPA_CLARO_DEFECTO);
    expect(fondoMapaValido(undefined, false)).toBe(FONDO_MAPA_DEFECTO);
    expect(fondoMapaValido('fondo-inexistente', true)).toBe('claro-puntos');
    expect(fondoMapaValido('fondo-inexistente', false)).toBe('gris-puntos');
  });
});
