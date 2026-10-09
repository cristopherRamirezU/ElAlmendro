import { IsIn } from 'class-validator';

/** Debe calzar exactamente con los codigos de FONDOS_MAPA en el frontend (lib/fondosMapa.ts). */
export const FONDOS_MAPA_VALIDOS = ['gris-puntos', 'azul-puntos', 'aurora', 'hexagonos'] as const;

/** Preferencias visuales propias de cada usuario (no de la organizacion). */
export class ActualizarPreferenciasDto {
  @IsIn(FONDOS_MAPA_VALIDOS, {
    message: `El fondo del mapa debe ser uno de: ${FONDOS_MAPA_VALIDOS.join(', ')}.`,
  })
  fondoMapa: string;
}
