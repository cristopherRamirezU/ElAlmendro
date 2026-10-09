import { IsString, MaxLength, ValidateIf } from 'class-validator';

export class ActualizarInstruccionesDto {
  /** Texto de las instrucciones de la tarea; `null` o vacio las quita. */
  @ValidateIf((_objeto, valor) => valor !== null)
  @IsString({ message: 'Las instrucciones deben ser texto.' })
  @MaxLength(2000, { message: 'Las instrucciones no pueden superar los 2000 caracteres.' })
  instrucciones: string | null;
}
