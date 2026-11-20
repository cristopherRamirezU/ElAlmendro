import { Equals, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EsContrasenaSegura } from '../../../common/seguridad/politica-contrasena';

/** Alta publica de una empresa con el plan Basico y su primer administrador. */
export class RegistroDto {
  @IsString({ message: 'El nombre de la empresa debe ser texto.' })
  @IsNotEmpty({ message: 'Escribe el nombre de tu empresa.' })
  @MaxLength(120, { message: 'El nombre de la empresa no puede superar los 120 caracteres.' })
  empresa: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El RUT no es valido.' })
  rut?: string;

  @IsString({ message: 'Tu nombre debe ser texto.' })
  @IsNotEmpty({ message: 'Escribe tu nombre.' })
  @MaxLength(120, { message: 'Tu nombre no puede superar los 120 caracteres.' })
  nombre: string;

  @IsEmail({}, { message: 'Escribe un correo valido.' })
  @MaxLength(254)
  correo: string;

  @IsString()
  @EsContrasenaSegura()
  contrasena: string;

  @Equals(true, { message: 'Debes aceptar los terminos de uso y la politica de privacidad.' })
  aceptaTerminos: boolean;

  /**
   * Campo trampa: va oculto en el formulario. Una persona no lo ve ni lo
   * llena; un programa que rellena todo, si.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sitioWeb?: string;
}
