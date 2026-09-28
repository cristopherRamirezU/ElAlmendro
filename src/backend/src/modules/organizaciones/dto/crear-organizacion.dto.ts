import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { PlanSaaS } from '@prisma/client';

export class CrearOrganizacionDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre de la organización no puede estar vacío.' })
  nombre: string;

  @IsString({ message: 'El slug debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El slug no puede estar vacío.' })
  @Matches(/^[a-z0-9-]+$/, { message: 'El slug solo puede contener letras minúsculas, números y guiones.' })
  slug: string;

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
  @IsEmail({}, { message: 'El correo del administrador debe ser un correo válido.' })
  adminEmail?: string;

  @IsOptional()
  @IsString()
  adminNombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña del administrador debe tener al menos 8 caracteres.' })
  adminPassword?: string;
}
