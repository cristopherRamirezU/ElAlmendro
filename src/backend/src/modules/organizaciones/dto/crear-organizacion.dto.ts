import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PlanSaaS } from '@prisma/client';
import { EsContrasenaSegura } from '../../../common/seguridad/politica-contrasena';

export class CrearOrganizacionDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre de la organización no puede estar vacío.' })
  @MaxLength(120, { message: 'El nombre no puede superar los 120 caracteres.' })
  nombre: string;

  @IsString({ message: 'El slug debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El slug no puede estar vacío.' })
  @Matches(/^[a-z0-9-]+$/, { message: 'El slug solo puede contener letras minúsculas, números y guiones.' })
  @MaxLength(60, { message: 'El slug no puede superar los 60 caracteres.' })
  slug: string;

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
  @IsEmail({}, { message: 'El correo del administrador debe ser un correo válido.' })
  @MaxLength(254)
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  adminNombre?: string;

  @IsOptional()
  @IsString()
  @EsContrasenaSegura()
  adminPassword?: string;
}
