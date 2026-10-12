import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El correo no tiene un formato valido.' })
  @MaxLength(254, { message: 'El correo no tiene un formato valido.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'La contrasena es obligatoria.' })
  // Tope holgado: no rechaza ninguna clave real y evita que alguien mande
  // un texto enorme solo para hacer trabajar al calculo del hash.
  @MaxLength(256, { message: 'Correo o contrasena incorrectos.' })
  contrasena: string;
}
