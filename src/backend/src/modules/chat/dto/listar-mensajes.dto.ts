import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const CANAL_GENERAL = 'general';

export class ListarMensajesDto {
  /** Id del otro usuario, o `general` para el canal del equipo. */
  @IsString()
  @MaxLength(64)
  con: string;

  /** Cursor: solo mensajes anteriores a este instante (para cargar mas antiguos). */
  @IsOptional()
  @IsISO8601({}, { message: 'El cursor debe ser una fecha ISO 8601.' })
  antes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number;
}
