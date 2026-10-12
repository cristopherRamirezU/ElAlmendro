import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { PrismaService } from '../infra/prisma/prisma.service';
import { permisosEfectivos } from './rbac';
import { UsuarioActual } from './usuario-actual.decorator';
import {
  emitirCookieSesion,
  firmarSesion,
  leerSesion,
  nombreCookieSesion,
  renovarTrasMs,
} from './seguridad/sesion';

/**
 * Lee el token de sesion desde la cookie httpOnly y deja al usuario en la
 * peticion. La cookie no es accesible desde JavaScript del navegador, de modo
 * que un script inyectado no puede robar el token.
 *
 * Pasada la mitad de su vida (una hora como maximo) se emite un token nuevo
 * en la misma respuesta: quien sigue usando la app nunca llega al vencimiento.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[nombreCookieSesion()];
    if (!token) throw new UnauthorizedException('No hay sesion iniciada.');

    const carga = await leerSesion(this.jwt, token);
    if (!carga) throw new UnauthorizedException('La sesion expiro. Vuelve a ingresar.');

    (req as any).usuario = await cargarUsuarioVigente(this.prisma, carga.sub, carga.ver);

    if (!carga.iat || Date.now() - carga.iat * 1000 > renovarTrasMs()) {
      const res = ctx.switchToHttp().getResponse<Response>();
      emitirCookieSesion(res, await firmarSesion(this.jwt, { id: carga.sub, versionSesion: carga.ver }));
    }
    return true;
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
 *
 * `versionToken` es la version de sesion con que se firmo el token: si el
 * usuario cerro sesion en todos lados o cambio su contrasena despues, ya no
 * coincide y el token queda invalido.
 */
export async function cargarUsuarioVigente(
  prisma: PrismaService,
  usuarioId: string,
  versionToken: number,
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
      versionSesion: true,
      organizacionId: true,
      organizacion: {
        select: { nombre: true, slug: true, activo: true, colorPrimario: true, temaFondo: true },
      },
    },
  });

  if (!usuario || !usuario.activo) {
    throw new UnauthorizedException('Tu cuenta no esta activa. Vuelve a ingresar.');
  }

  if (usuario.versionSesion !== versionToken) {
    throw new UnauthorizedException('Tu sesion fue cerrada. Vuelve a ingresar.');
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
