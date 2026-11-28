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
  /** Zona IANA en que trabaja la persona: define sus dias y sus horas. */
  zonaHoraria: string;
  /** Version de la foto de perfil (null = sin foto, se muestran iniciales). */
  fotoPerfil?: string | null;
  /** True si aun no acepta la version vigente de terminos y privacidad. */
  politicasPendientes?: boolean;
  /** Version vigente que debe aceptar (la que muestra la ventana). */
  versionPoliticas?: string;
}

export const Usuario = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioActual =>
    ctx.switchToHttp().getRequest().usuario,
);
