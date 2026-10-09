import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CrearActividadDto {
  @IsUUID(undefined, { message: 'El proyecto indicado no es valido.' })
  proyectoId: string;

  @IsString({ message: 'El titulo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El titulo no puede estar vacio.' })
  @MaxLength(160, { message: 'El titulo no puede superar los 160 caracteres.' })
  titulo: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'La tarea padre indicada no es valida.' })
  actividadPadreId?: string;

  /**
   * "Tarea para alguien": la tarea nace ya asignada a esta persona. Sin el
   * campo, el responsable es quien la crea.
   */
  @IsOptional()
  @IsUUID(undefined, { message: 'La persona indicada no es valida.' })
  responsableId?: string;
}
