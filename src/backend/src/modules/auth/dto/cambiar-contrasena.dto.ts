import { IsString, MaxLength, MinLength } from 'class-validator';
import { EsContrasenaSegura } from '../../../common/seguridad/politica-contrasena';

/** Cambio de la propia contrasena: pide la actual para que una sesion abierta ajena no baste. */
export class CambiarContrasenaDto {
  @IsString({ message: 'Ingresa tu contraseña actual.' })
  @MinLength(1, { message: 'Ingresa tu contraseña actual.' })
  @MaxLength(256, { message: 'La contraseña actual no es correcta.' })
  actual: string;

  @IsString({ message: 'La nueva contraseña debe ser texto.' })
  @EsContrasenaSegura()
  nueva: string;
}
