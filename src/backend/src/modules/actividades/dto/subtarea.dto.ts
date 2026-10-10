import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Una moneda de la bolsa: el paso mas pequeno en que se parte una tarea. */
export class CrearSubtareaDto {
  @IsString({ message: 'El titulo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El titulo no puede estar vacio.' })
  @MaxLength(160, { message: 'El titulo no puede superar los 160 caracteres.' })
  titulo: string;
}

export class ActualizarSubtareaDto {
  @IsOptional()
  @IsBoolean({ message: 'El estado del objetivo debe ser verdadero o falso.' })
  completada?: boolean;

  @IsOptional()
  @IsString({ message: 'El titulo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El titulo no puede estar vacio.' })
  @MaxLength(160, { message: 'El titulo no puede superar los 160 caracteres.' })
  titulo?: string;
}

/**
 * Cambio manual de estado de la tarea: guardar la bolsa en el cofre
 * (COMPLETADA) o sacarla de vuelta para seguir trabajandola.
 */
export class CambiarEstadoActividadDto {
  @IsIn(['PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA', 'COMPLETADA'], {
    message: 'Estado de tarea no valido.',
  })
  estado: 'PENDIENTE' | 'EN_PROGRESO' | 'BLOQUEADA' | 'COMPLETADA';
}
