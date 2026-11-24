import { FONDOS_MAPA_VALIDOS } from '../src/modules/auth/dto/actualizar-preferencias.dto';
import {
  FONDOS_MAPA,
  FONDOS_MAPA_CLAROS,
  FONDOS_MAPA_OSCUROS,
} from '../../frontend/src/lib/fondosMapa';

/**
 * Los codigos de fondo del mapa viven en dos lugares: el DTO del backend
 * valida el PATCH /auth/yo/preferencias y el frontend los ofrece al usuario.
 * Si se desincronizan, elegir un fondo nuevo falla con 400.
 */
describe('Fondos de mapa sincronizados entre backend y frontend', () => {
  it('el catalogo de codigos es identico y sin duplicados', () => {
    const codigosFrontend = FONDOS_MAPA.map((f) => f.codigo);
    expect(new Set(codigosFrontend).size).toBe(codigosFrontend.length);
    expect([...codigosFrontend].sort()).toEqual([...FONDOS_MAPA_VALIDOS].sort());
  });

  it('los fondos claros y oscuros particionan el catalogo completo', () => {
    const claros: string[] = FONDOS_MAPA_CLAROS.map((f) => f.codigo);
    const oscuros: string[] = FONDOS_MAPA_OSCUROS.map((f) => f.codigo);
    expect(claros.length + oscuros.length).toBe(FONDOS_MAPA.length);
    expect(claros.some((c) => oscuros.includes(c))).toBe(false);
    expect(claros).toEqual(
      expect.arrayContaining(['claro-puntos', 'claro-cuadricula', 'claro-bruma']),
    );
  });
});
