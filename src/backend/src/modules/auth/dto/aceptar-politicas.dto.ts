import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** La version de los terminos que la persona leyo y acepta. */
export class AceptarPoliticasDto {
  @IsString()
  @IsNotEmpty({ message: 'Falta la version de los terminos.' })
  @MaxLength(32)
  version: string;
}
