import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ORIENTACIONES_MAPA, OrientacionMapa } from './guardar-posiciones.dto';

export const LADOS_LINEA = ['top', 'right', 'bottom', 'left'] as const;
export type LadoLinea = (typeof LADOS_LINEA)[number];

/**
 * Bordes fijados de la linea que llega a una tarea (desde su padre o desde
 * el nodo principal). `null` o ausente = ese extremo lo elige el mapa solo.
 */
export class LadosLineaDto {
  @IsOptional()
  @IsIn(LADOS_LINEA, { message: 'El borde de salida debe ser top, right, bottom o left.' })
  salida?: LadoLinea | null;

  @IsOptional()
  @IsIn(LADOS_LINEA, { message: 'El borde de llegada debe ser top, right, bottom o left.' })
  entrada?: LadoLinea | null;

  /** Punto del borde de salida donde se solto la linea: 0 = un extremo, 1 = el otro. */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'La posicion en el borde no es valida.' })
  @Min(0, { message: 'La posicion en el borde va de 0 a 1.' })
  @Max(1, { message: 'La posicion en el borde va de 0 a 1.' })
  salidaPos?: number | null;

  /** Punto del borde de llegada donde se solto la linea. */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'La posicion en el borde no es valida.' })
  @Min(0, { message: 'La posicion en el borde va de 0 a 1.' })
  @Max(1, { message: 'La posicion en el borde va de 0 a 1.' })
  entradaPos?: number | null;
}

export class CambioLadosDto {
  /** La tarea a la que llega la linea. */
  @IsUUID(undefined, { message: 'Una de las tareas indicadas no es valida.' })
  id: string;

  /** `null` (o ambos extremos vacios) devuelve la linea al modo automatico. */
  @IsOptional()
  @ValidateNested()
  @Type(() => LadosLineaDto)
  lados?: LadosLineaDto | null;
}

export class GuardarLadosDto {
  @IsIn(ORIENTACIONES_MAPA, { message: 'La orientacion debe ser horizontal o vertical.' })
  orientacion: OrientacionMapa;

  @IsArray({ message: 'Debes indicar las lineas a cambiar.' })
  @ArrayMinSize(1, { message: 'Debes indicar al menos una linea.' })
  @ArrayMaxSize(500, { message: 'Demasiadas lineas en un solo cambio.' })
  @ValidateNested({ each: true })
  @Type(() => CambioLadosDto)
  cambios: CambioLadosDto[];
}
