import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PlanSaaS } from '@prisma/client';

export class ActualizarOrganizacionDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  nombre?: string;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsOptional()
  @IsEnum(PlanSaaS, { message: 'El plan debe ser GRATIS, PRO o EMPRESA.' })
  plan?: PlanSaaS;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'El máximo de usuarios debe ser al menos 1.' })
  maxUsuarios?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'El máximo de proyectos debe ser al menos 1.' })
  maxProyectos?: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano.' })
  activo?: boolean;
}
