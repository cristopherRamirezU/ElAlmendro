import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Rol } from '../../../common/rbac';
import { EsContrasenaSegura } from '../../../common/seguridad/politica-contrasena';

export class CrearUsuarioDto {
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @MaxLength(254, { message: 'El correo electrónico no puede superar los 254 caracteres.' })
  email: string;

  @IsString({ message: 'El nombre completo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre completo no puede estar vacío.' })
  @MaxLength(120, { message: 'El nombre completo no puede superar los 120 caracteres.' })
  nombreCompleto: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @EsContrasenaSegura()
  contrasena: string;

  @IsIn(['ADMINISTRADOR', 'SUPERVISOR', 'TRABAJADOR'], {
    message: 'El rol debe ser ADMINISTRADOR, SUPERVISOR o TRABAJADOR.',
  })
  rol: Rol;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  zonaHoraria?: string;
}

