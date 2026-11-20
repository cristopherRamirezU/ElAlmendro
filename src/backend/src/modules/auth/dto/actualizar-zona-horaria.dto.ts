import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Zona IANA (p. ej. "America/Santiago"); el servicio confirma que exista. */
export class ActualizarZonaHorariaDto {
  @IsString({ message: 'La zona horaria debe ser texto.' })
  @IsNotEmpty({ message: 'Elige una zona horaria.' })
  @MaxLength(64)
  zonaHoraria: string;
}
