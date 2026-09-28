import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { obtenerPermisosDeRol } from './rbac';

export const COOKIE_ACCESO = 'tf_acceso';

/**
 * Lee el token de acceso desde la cookie httpOnly y deja al usuario en la
 * peticion. La cookie no es accesible desde JavaScript del navegador, de modo
 * que un script inyectado no puede robar el token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[COOKIE_ACCESO];
    if (!token) throw new UnauthorizedException('No hay sesion iniciada.');

    try {
      const carga = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_ACCESO_SECRET ?? process.env.JWT_ACCESS_SECRET,
      });
      (req as any).usuario = {
        id: carga.sub,
        email: carga.email,
        rol: carga.rol,
        nombreCompleto: carga.nombre,
        permisos: obtenerPermisosDeRol(carga.rol),
        organizacionId: carga.organizacionId ?? null,
        organizacionNombre: carga.organizacionNombre ?? null,
        organizacionSlug: carga.organizacionSlug ?? null,
      };
      return true;
    } catch {
      throw new UnauthorizedException('La sesion expiro. Vuelve a ingresar.');
    }
  }
}
