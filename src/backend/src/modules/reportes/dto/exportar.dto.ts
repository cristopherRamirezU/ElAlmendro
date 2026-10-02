import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

/**
 * Parametros de una exportacion por periodo.
 *
 * OJO: main.ts aplica ValidationPipe con forbidNonWhitelisted, asi que
 * cualquier parametro de consulta que no este declarado aqui hace fallar la
 * peticion con 400. Si mas adelante se agrega algo (por ejemplo un ?t= para
 * evitar la cache del navegador), hay que declararlo tambien en este DTO.
 */
export class ExportarPeriodoDto {
  @ApiProperty({ example: '2026-08-23T00:00:00.000Z' })
  @IsISO8601()
  desde!: string;

  @ApiProperty({ example: '2026-09-22T00:00:00.000Z' })
  @IsISO8601()
  hasta!: string;

  @ApiProperty({ enum: ['csv', 'xlsx', 'pdf'] })
  @IsIn(['csv', 'xlsx', 'pdf'])
  formato!: 'csv' | 'xlsx' | 'pdf';

  @ApiPropertyOptional({
    enum: [';', ','],
    description: 'Separador del CSV. Por defecto ";" (locale es-CL).',
  })
  @IsOptional()
  @IsIn([';', ','])
  sep?: string;
  @ApiPropertyOptional({
    description:
      'Solo para SUPER_ADMIN: limita la exportacion a una organizacion. ' +
      'Debe declararse aqui porque el ValidationPipe global rechaza con 400 ' +
      'cualquier parametro no listado.',
  })
  @IsOptional()
  @IsString()
  organizacionId?: string;
}

/** Exportacion del detalle de un dia concreto. */
export class ExportarDiaDto {
  @ApiProperty({ example: '2026-09-22' })
  @IsISO8601()
  fecha!: string;

  @ApiProperty({ enum: ['csv', 'xlsx', 'pdf'] })
  @IsIn(['csv', 'xlsx', 'pdf'])
  formato!: 'csv' | 'xlsx' | 'pdf';

  @ApiPropertyOptional({ enum: [';', ','] })
  @IsOptional()
  @IsIn([';', ','])
  sep?: string;
  @ApiPropertyOptional({
    description:
      'Solo para SUPER_ADMIN: limita la exportacion a una organizacion. ' +
      'Debe declararse aqui porque el ValidationPipe global rechaza con 400 ' +
      'cualquier parametro no listado.',
  })
  @IsOptional()
  @IsString()
  organizacionId?: string;
}
