import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../infra/prisma/prisma.service';
import { permisosEfectivos } from './rbac';
import { UsuarioActual } from './usuario-actual.decorator';

export const COOKIE_ACCESO = 'tf_acceso';

/**
 * Lee el token de acceso desde la cookie httpOnly y deja al usuario en la
 * peticion. La cookie no es accesible desde JavaScript del navegador, de modo
 * que un script inyectado no puede robar el token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[COOKIE_ACCESO];
    if (!token) throw new UnauthorizedException('No hay sesion iniciada.');

    const usuarioId = await verificarToken(this.jwt, token);
    if (!usuarioId) throw new UnauthorizedException('La sesion expiro. Vuelve a ingresar.');

    (req as any).usuario = await cargarUsuarioVigente(this.prisma, usuarioId);
    return true;
  }
}

/** Devuelve el id del usuario del token, o null si la firma no es valida. */
export async function verificarToken(jwt: JwtService, token: string): Promise<string | null> {
  try {
    const carga = await jwt.verifyAsync(token, {
      secret: process.env.JWT_ACCESO_SECRET ?? process.env.JWT_ACCESS_SECRET,
    });
    return typeof carga?.sub === 'string' ? carga.sub : null;
  } catch {
    return null;
  }
}

/**
 * Estado vigente del usuario, leido de la base en cada peticion.
 *
 * El token solo prueba quien es; rol, permisos extra, organizacion y vigencia
 * se consultan aqui. Asi suspender una empresa, desactivar una cuenta o cambiar un rol
 * surte efecto en la siguiente peticion, aunque el token no expire nunca.
 *
 * Invariante Multi-SaaS: todo usuario distinto de SUPER_ADMIN sale de aqui
 * con `organizacionId`. Los servicios pueden confiar en ello.
 */
export async function cargarUsuarioVigente(
  prisma: PrismaService,
  usuarioId: string,
): Promise<UsuarioActual> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      email: true,
      rol: true,
      nombreCompleto: true,
      activo: true,
      fondoMapa: true,
      permisosExtra: true,
      organizacionId: true,
      organizacion: {
        select: { nombre: true, slug: true, activo: true, colorPrimario: true, temaFondo: true },
      },
    },
  });

  if (!usuario || !usuario.activo) {
    throw new UnauthorizedException('Tu cuenta no esta activa. Vuelve a ingresar.');
  }

  if (usuario.rol !== 'SUPER_ADMIN') {
    if (!usuario.organizacionId || !usuario.organizacion) {
      throw new UnauthorizedException('Tu cuenta no esta asociada a ninguna organizacion.');
    }
    if (!usuario.organizacion.activo) {
      throw new UnauthorizedException('Tu organizacion se encuentra suspendida. Contacta a soporte.');
    }
  }

  return {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    nombreCompleto: usuario.nombreCompleto,
    permisos: permisosEfectivos(usuario.rol, usuario.permisosExtra),
    organizacionId: usuario.rol === 'SUPER_ADMIN' ? null : usuario.organizacionId,
    organizacionNombre: usuario.organizacion?.nombre ?? null,
    organizacionSlug: usuario.organizacion?.slug ?? null,
    organizacionColor: usuario.organizacion?.colorPrimario ?? null,
    organizacionTema: usuario.organizacion?.temaFondo ?? null,
    fondoMapa: usuario.fondoMapa ?? null,
  };
}
