import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { permisosEfectivos } from '../../common/rbac';
import { normalizarCorreo } from '../../common/organizacion';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import { LimiteIntentosService, REGLAS } from '../../common/seguridad/limite-intentos.service';
import { problemaContrasena } from '../../common/seguridad/politica-contrasena';
import { firmarSesion } from '../../common/seguridad/sesion';
import { LoginDto } from './dto/login.dto';
import { ActualizarPreferenciasDto } from './dto/actualizar-preferencias.dto';
import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto';

/**
 * Hash de una clave al azar que nadie conoce. Cuando el correo no existe se
 * verifica contra el igual: asi la respuesta tarda lo mismo que con una
 * cuenta real y el tiempo no delata que correos estan registrados.
 */
let hashSenuelo: Promise<string> | null = null;
function senuelo(): Promise<string> {
  hashSenuelo ??= argon2.hash(`senuelo-${randomUUID()}`);
  return hashSenuelo;
}

/** argon2.verify lanza si el hash guardado esta corrupto: eso es un "no". */
async function claveCoincide(hash: string, clave: string): Promise<boolean> {
  try {
    return Boolean(await argon2.verify(hash, clave));
  } catch {
    return false;
  }
}

@Injectable()
export class AuthService {
  private readonly registro = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly limites: LimiteIntentosService,
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
   * Verifica las credenciales y emite el token de sesion.
   *
   * - El mensaje de error es identico para correo inexistente y contrasena
   *   incorrecta, y tarda lo mismo: distinguirlos permitiria averiguar que
   *   correos estan registrados.
   * - Los fallos se cuentan por cuenta+IP, por cuenta y por IP; al pasarse
   *   del limite se responde 429 sin siquiera mirar la clave.
   * - Cada fallo queda en la auditoria con la IP de origen.
   */
  async login(dto: LoginDto, ip?: string) {
    const email = normalizarCorreo(dto.email);
    const origen = ip || 'desconocida';
    const claveCuentaIp = `login:cuenta-ip:${email}|${origen}`;
    const claveCuenta = `login:cuenta:${email}`;
    const claveIp = `login:ip:${origen}`;
    this.limites.verificar([claveCuentaIp, claveCuenta, claveIp]);

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: {
        organizacion: true,
      },
    });

    const valida = usuario
      ? await claveCoincide(usuario.hashContrasena, dto.contrasena)
      : (await claveCoincide(await senuelo(), dto.contrasena), false);

    if (!usuario || !valida) {
      const bloqueo = this.limites.registrar([
        [claveCuentaIp, REGLAS.loginCuentaIp],
        [claveCuenta, REGLAS.loginCuenta],
        [claveIp, REGLAS.loginIp],
      ]);
      await this.auditarFallo(email, usuario, ip, bloqueo);
      throw new UnauthorizedException('Correo o contrasena incorrectos.');
    }
    this.limites.limpiar([claveCuentaIp, claveCuenta]);

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
    const token = await firmarSesion(this.jwt, usuario);

    await this.prisma.registroAuditoria.create({
      data: {
        actorId: usuario.id,
        organizacionId: usuario.organizacionId ?? undefined,
        // Distinto de SESION_INICIADA, que corresponde al inicio de una
        // sesion de trabajo cronometrada.
        accion: 'INICIO_SESION',
        tipoEntidad: 'Usuario',
        entidadId: usuario.id,
        direccionIp: ip ?? null,
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

  /**
   * Cierra la sesion en todos los dispositivos: al subir la version, todo
   * token emitido antes deja de valer en la siguiente peticion.
   */
  async cerrarTodas(u: UsuarioActual, ip?: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: u.id },
        data: { versionSesion: { increment: 1 } },
      });
      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: u.organizacionId ?? undefined,
          accion: 'SESIONES_CERRADAS',
          tipoEntidad: 'Usuario',
          entidadId: u.id,
          direccionIp: ip ?? null,
        },
      });
    });
  }

  /**
   * Cambia la propia contrasena. Exige la actual (una sesion abierta ajena no
   * basta), aplica la politica y cierra las sesiones de los demas
   * dispositivos. Devuelve el token nuevo para este dispositivo.
   */
  async cambiarContrasena(u: UsuarioActual, dto: CambiarContrasenaDto, ip?: string) {
    const clave = `contrasena:${u.id}`;
    this.limites.verificar([clave]);

    const fila = await this.prisma.usuario.findUnique({
      where: { id: u.id },
      select: { hashContrasena: true, email: true },
    });
    if (!fila) throw new UnauthorizedException('Tu cuenta no esta activa. Vuelve a ingresar.');

    if (!(await claveCoincide(fila.hashContrasena, dto.actual))) {
      this.limites.registrar([[clave, REGLAS.cambioContrasena]]);
      // 400 y no 401: un 401 haria que la app cierre la sesion.
      throw new BadRequestException('La contraseña actual no es correcta.');
    }
    this.limites.limpiar([clave]);

    if (dto.nueva === dto.actual) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    }
    const problema = problemaContrasena(dto.nueva, fila.email);
    if (problema) throw new BadRequestException(problema);

    const hashContrasena = await argon2.hash(dto.nueva);
    const actualizado = await this.prisma.$transaction(async (tx) => {
      const r = await tx.usuario.update({
        where: { id: u.id },
        data: { hashContrasena, versionSesion: { increment: 1 } },
        select: { id: true, versionSesion: true },
      });
      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: u.organizacionId ?? undefined,
          accion: 'CONTRASENA_CAMBIADA',
          tipoEntidad: 'Usuario',
          entidadId: u.id,
          direccionIp: ip ?? null,
        },
      });
      return r;
    });

    return firmarSesion(this.jwt, actualizado);
  }

  /** Un fallo de auditoria nunca debe cambiar la respuesta del login. */
  private async auditarFallo(
    email: string,
    usuario: { id: string; organizacionId: string | null } | null,
    ip: string | undefined,
    bloqueo: boolean,
  ) {
    try {
      await this.prisma.registroAuditoria.create({
        data: {
          organizacionId: usuario?.organizacionId ?? undefined,
          accion: bloqueo ? 'INICIO_SESION_BLOQUEADO' : 'INICIO_SESION_FALLIDO',
          tipoEntidad: 'Usuario',
          entidadId: usuario?.id ?? email,
          valorNuevo: { correo: email, cuentaExiste: Boolean(usuario) },
          direccionIp: ip ?? null,
        },
      });
    } catch (error) {
      this.registro.warn(`No se pudo auditar un inicio de sesion fallido: ${(error as Error).message}`);
    }
  }
}
