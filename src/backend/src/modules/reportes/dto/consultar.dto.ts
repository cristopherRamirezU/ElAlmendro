import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

/** Parametros validados para consultas JSON por periodo en reportes. */
export class ConsultarPeriodoDto {
  @ApiProperty({ example: '2026-08-23T00:00:00.000Z' })
  @IsISO8601()
  desde!: string;

  @ApiProperty({ example: '2026-09-22T00:00:00.000Z' })
  @IsISO8601()
  hasta!: string;

  @ApiPropertyOptional({
    description: 'Solo para SUPER_ADMIN: limita la consulta a una organizacion.',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'La organizacion indicada no es valida.' })
  organizacionId?: string;
}

/** Parametros validados para consultas JSON de un dia concreto. */
export class ConsultarDiaDto {
  @ApiProperty({ example: '2026-09-22' })
  @IsISO8601()
  fecha!: string;

  @ApiPropertyOptional({
    description: 'Solo para SUPER_ADMIN: limita la consulta a una organizacion.',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'La organizacion indicada no es valida.' })
  organizacionId?: string;
}
