import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PlanSaaS } from '@prisma/client';

export class ActualizarOrganizacionDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @MaxLength(120, { message: 'El nombre no puede superar los 120 caracteres.' })
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El RUT no es válido.' })
  rut?: string;

  @IsOptional()
  @IsEnum(PlanSaaS, { message: 'El plan debe ser GRATIS, PRO o EMPRESA.' })
  plan?: PlanSaaS;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'El máximo de usuarios debe ser al menos 1.' })
  @Max(100000)
  maxUsuarios?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'El máximo de proyectos debe ser al menos 1.' })
  @Max(100000)
  maxProyectos?: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano.' })
  activo?: boolean;
}
