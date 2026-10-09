import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { PermisoCodigo, Rol } from './rbac';

/** Datos del usuario autenticado, puestos en la peticion por JwtAuthGuard. */
export interface UsuarioActual {
  id: string;
  email: string;
  rol: Rol;
  nombreCompleto: string;
  permisos: PermisoCodigo[];
  organizacionId: string | null;
  organizacionNombre?: string | null;
  organizacionSlug?: string | null;
  organizacionColor?: string | null;
  organizacionTema?: string | null;
  fondoMapa?: string | null;
}

export const Usuario = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioActual =>
    ctx.switchToHttp().getRequest().usuario,
);
