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

export const ORIENTACIONES_MAPA = ['horizontal', 'vertical'] as const;
export type OrientacionMapa = (typeof ORIENTACIONES_MAPA)[number];

/** Desplazamiento del nodo respecto de su padre en el mapa, en pixeles. */
export class PuntoMapaDto {
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'La coordenada x no es valida.' })
  @Min(-100000)
  @Max(100000)
  x: number;

  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'La coordenada y no es valida.' })
  @Min(-100000)
  @Max(100000)
  y: number;
}

export class CambioPosicionDto {
  @IsUUID(undefined, { message: 'Una de las tareas indicadas no es valida.' })
  id: string;

  /** `null` borra la posicion guardada: el nodo vuelve al acomodo automatico. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PuntoMapaDto)
  posicion?: PuntoMapaDto | null;
}

export class GuardarPosicionesDto {
  @IsIn(ORIENTACIONES_MAPA, { message: 'La orientacion debe ser horizontal o vertical.' })
  orientacion: OrientacionMapa;

  @IsArray({ message: 'Debes indicar los nodos a mover.' })
  @ArrayMinSize(1, { message: 'Debes indicar al menos un nodo.' })
  @ArrayMaxSize(500, { message: 'Demasiados nodos en un solo cambio.' })
  @ValidateNested({ each: true })
  @Type(() => CambioPosicionDto)
  cambios: CambioPosicionDto[];
}
