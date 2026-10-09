import { ArrayUnique, IsArray, IsIn } from 'class-validator';
import { CODIGOS_PERMISOS_EXTRA, PermisoCodigo } from '../../../common/rbac';

export class ActualizarPermisosUsuarioDto {
  /** Lista completa de permisos extra que queda con el trabajador (vacia = ninguno). */
  @IsArray({ message: 'Los permisos deben enviarse como una lista.' })
  @ArrayUnique({ message: 'Un permiso aparece repetido en la lista.' })
  @IsIn(CODIGOS_PERMISOS_EXTRA as PermisoCodigo[], {
    each: true,
    message: 'El permiso $value no se puede asignar como permiso extra.',
  })
  permisos: PermisoCodigo[];
}
