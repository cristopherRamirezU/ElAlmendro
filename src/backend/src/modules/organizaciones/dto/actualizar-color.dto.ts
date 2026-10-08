import { IsIn, IsOptional, Matches } from 'class-validator';

/** Debe calzar exactamente con los codigos de TEMAS en el frontend (lib/tema.ts). */
export const TEMAS_FONDO_VALIDOS = [
  'oscuro-medianoche',
  'oscuro-grafito',
  'claro-nube',
] as const;

export class ActualizarColorDto {
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'El color debe ser hexadecimal, por ejemplo #0ea5e9.',
  })
  colorPrimario: string;

  @IsOptional()
  @IsIn(TEMAS_FONDO_VALIDOS, {
    message: `El tema debe ser uno de: ${TEMAS_FONDO_VALIDOS.join(', ')}.`,
  })
  temaFondo?: string;
}
