import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ConsultarHistorialDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tipoEntidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  busqueda?: string;

  @IsOptional()
  @IsUUID()
  organizacionId?: string;
}
