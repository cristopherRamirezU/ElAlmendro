import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import * as argon2 from 'argon2';
import { permisosEfectivos } from '../../common/rbac';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ActualizarPreferenciasDto } from './dto/actualizar-preferencias.dto';

/**
 * Duracion del token de acceso segun JWT_ACCESO_TTL / JWT_ACCESS_TTL
 * ("8h", "15m", ...). Los valores "indefinido", "never" o "0" desactivan la
 * expiracion: decision del equipo mientras no exista el refresco de tokens,
 * para que nadie pierda la sesion a mitad del trabajo.
 */
export function duracionSesion(): string | null {
  const ttl = (process.env.JWT_ACCESO_TTL ?? process.env.JWT_ACCESS_TTL ?? 'indefinido').trim();
  if (!ttl || ['indefinido', 'never', '0'].includes(ttl.toLowerCase())) return null;
  return ttl;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Guarda las preferencias visuales del propio usuario. */
  async actualizarPreferencias(usuarioId: string, dto: ActualizarPreferenciasDto) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { fondoMapa: dto.fondoMapa },
      select: { fondoMapa: true },
    });
  }

  /**
   * Verifica las credenciales y emite el token de acceso.
   *
   * El mensaje de error es identico para correo inexistente y contrasena
   * incorrecta: distinguirlos permitiria averiguar que correos estan
   * registrados en el sistema.
   */
  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        organizacion: true,
      },
    });

    const generico = new UnauthorizedException('Correo o contrasena incorrectos.');
    if (!usuario) throw generico;

    const valida = await argon2.verify(usuario.hashContrasena, dto.contrasena);
    if (!valida) throw generico;

    if (!usuario.activo) {
      throw new UnauthorizedException('Cuenta suspendida por el administrador.');
    }

    // Misma invariante que JwtAuthGuard: fuera de SUPER_ADMIN no existe una
    // cuenta sin empresa, porque no habria contra que acotar sus datos.
    if (usuario.rol !== 'SUPER_ADMIN' && !usuario.organizacion) {
      throw new UnauthorizedException('Tu cuenta no esta asociada a ninguna organizacion.');
    }

    if (usuario.organizacion && !usuario.organizacion.activo) {
      throw new UnauthorizedException('Tu organización se encuentra suspendida. Contacta a soporte.');
    }

    const permisos = permisosEfectivos(usuario.rol, usuario.permisosExtra);

    const token = await this.jwt.signAsync(
      {
        sub: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        nombre: usuario.nombreCompleto,
        permisos,
        organizacionId: usuario.organizacionId ?? null,
        organizacionNombre: usuario.organizacion?.nombre ?? null,
        organizacionSlug: usuario.organizacion?.slug ?? null,
      },
      {
        secret: process.env.JWT_ACCESO_SECRET ?? process.env.JWT_ACCESS_SECRET,
        // Sin `expiresIn` el token no lleva `exp` y la sesion dura hasta que
        // el usuario la cierre (ver duracionSesion).
        ...(duracionSesion() ? { expiresIn: duracionSesion() as SignOptions['expiresIn'] } : {}),
      },
    );

    await this.prisma.registroAuditoria.create({
      data: {
        actorId: usuario.id,
        organizacionId: usuario.organizacionId ?? undefined,
        // Distinto de SESION_INICIADA, que corresponde al inicio de una
        // sesion de trabajo cronometrada.
        accion: 'INICIO_SESION',
        tipoEntidad: 'Usuario',
        entidadId: usuario.id,
      },
    });

    return {
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
        permisos,
        organizacionId: usuario.organizacionId,
        organizacion: usuario.organizacion ? {
          id: usuario.organizacion.id,
          nombre: usuario.organizacion.nombre,
          slug: usuario.organizacion.slug,
          plan: usuario.organizacion.plan,
        } : null,
      },
    };
  }
}
