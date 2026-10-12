import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';
import type { UsuarioActual } from '../../../src/common/usuario-actual.decorator';

jest.mock('argon2');

const verificarClave = argon2.verify as jest.MockedFunction<typeof argon2.verify>;
const hashear = argon2.hash as jest.MockedFunction<typeof argon2.hash>;

const USUARIO = {
  id: 'usuario-1',
  email: 'ana@timeflow.cl',
  nombreCompleto: 'Ana Perez',
  rol: 'TRABAJADOR',
  hashContrasena: 'hash',
  activo: true,
  versionSesion: 3,
  permisosExtra: [],
  // Multi-SaaS: salvo SUPER_ADMIN, nadie entra sin empresa activa.
  organizacionId: 'org-1',
  organizacion: { id: 'org-1', nombre: 'Hotel El Almendro', activo: true },
};

const ACTOR = {
  id: USUARIO.id,
  email: USUARIO.email,
  rol: 'TRABAJADOR',
  organizacionId: 'org-1',
} as unknown as UsuarioActual;

const IP = '200.1.2.3';

describe('AuthService', () => {
  let servicio: AuthService;
  let prisma: PrismaMock;
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'secreto-de-pruebas-con-largo-suficiente-123';
    jest.clearAllMocks();
    jwt = { signAsync: jest.fn().mockResolvedValue('token-firmado') };
    ({ servicio, prisma } = await montarServicio(AuthService, [
      { provide: JwtService, useValue: jwt },
    ]));
    hashear.mockResolvedValue('hash-nuevo' as never);
  });

  describe('login', () => {
    it('NO PERMITE ENUMERAR USUARIOS: mismo mensaje si el correo no existe o la clave es mala', async () => {
      // Correo inexistente.
      prisma.usuario.findUnique.mockResolvedValue(null as never);
      const porCorreo = await servicio
        .login({ email: 'nadie@timeflow.cl', contrasena: 'x' })
        .catch((e: Error) => e);

      // Correo valido, contrasena incorrecta.
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockResolvedValue(false);
      const porClave = await servicio
        .login({ email: USUARIO.email, contrasena: 'mala' })
        .catch((e: Error) => e);

      expect(porCorreo).toBeInstanceOf(UnauthorizedException);
      expect(porClave).toBeInstanceOf(UnauthorizedException);
      expect((porCorreo as Error).message).toBe('Correo o contrasena incorrectos.');
      expect((porClave as Error).message).toBe((porCorreo as Error).message);
    });

    it('con un correo inexistente igual calcula un hash: el tiempo no delata la cuenta', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null as never);

      await servicio.login({ email: 'nadie@timeflow.cl', contrasena: 'x' }).catch(() => undefined);

      expect(verificarClave).toHaveBeenCalledTimes(1);
    });

    it('distingue la cuenta suspendida solo tras validar la contrasena', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...USUARIO,
        activo: false,
      } as never);
      verificarClave.mockResolvedValue(true);

      await expect(
        servicio.login({ email: USUARIO.email, contrasena: 'buena' }),
      ).rejects.toThrow(/suspendida/i);
    });

    it('MULTI-SAAS: una cuenta sin empresa no puede entrar', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...USUARIO,
        organizacionId: null,
        organizacion: null,
      } as never);
      verificarClave.mockResolvedValue(true);

      await expect(
        servicio.login({ email: USUARIO.email, contrasena: 'buena' }),
      ).rejects.toThrow(/ninguna organizacion/i);
    });

    it('MULTI-SAAS: si la empresa esta suspendida, nadie de ella entra', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...USUARIO,
        organizacion: { ...USUARIO.organizacion, activo: false },
      } as never);
      verificarClave.mockResolvedValue(true);

      await expect(
        servicio.login({ email: USUARIO.email, contrasena: 'buena' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('normaliza el correo a minusculas y sin espacios antes de buscarlo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null as never);

      await servicio
        .login({ email: '  ANA@TimeFlow.CL  ', contrasena: 'x' })
        .catch(() => undefined);

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'ana@timeflow.cl' } }),
      );
    });

    it('el token solo lleva el id y la version de sesion, y vence', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockResolvedValue(true);

      const resultado = await servicio.login({
        email: USUARIO.email,
        contrasena: 'buena',
      });

      const [carga, opciones] = jwt.signAsync.mock.calls[0];
      expect(carga).toEqual({ sub: USUARIO.id, ver: 3 });
      expect(opciones).toEqual(
        expect.objectContaining({ algorithm: 'HS256', expiresIn: expect.any(String) }),
      );
      expect(resultado.token).toBe('token-firmado');
      expect(resultado.usuario.permisos).toEqual(expect.arrayContaining(['jornada:registrar']));
      // La respuesta nunca debe arrastrar el hash de la contrasena.
      expect(resultado.usuario).not.toHaveProperty('hashContrasena');
    });

    it('audita el ingreso como INICIO_SESION (con la IP), no como SESION_INICIADA', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockResolvedValue(true);

      await servicio.login({ email: USUARIO.email, contrasena: 'buena' }, IP);

      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'INICIO_SESION',
          tipoEntidad: 'Usuario',
          actorId: USUARIO.id,
          direccionIp: IP,
        }),
      });
    });

    it('audita cada intento fallido con la IP de origen', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockResolvedValue(false);

      await servicio.login({ email: USUARIO.email, contrasena: 'mala' }, IP).catch(() => undefined);

      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'INICIO_SESION_FALLIDO',
          entidadId: USUARIO.id,
          direccionIp: IP,
        }),
      });
    });

    it('FUERZA BRUTA: tras 5 fallos la cuenta queda bloqueada desde esa IP, aun con la clave buena', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockResolvedValue(false);
      for (let i = 0; i < 5; i++) {
        await servicio.login({ email: USUARIO.email, contrasena: `mala-${i}` }, IP).catch(() => undefined);
      }
      // El quinto fallo queda auditado como bloqueo.
      expect(prisma.registroAuditoria.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ accion: 'INICIO_SESION_BLOQUEADO' }),
      });

      verificarClave.mockClear();
      prisma.usuario.findUnique.mockClear();
      verificarClave.mockResolvedValue(true);
      const error = await servicio
        .login({ email: USUARIO.email, contrasena: 'buena' }, IP)
        .catch((e: HttpException) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as Error).message).toMatch(/espera 15 minutos/);
      // Bloqueado ni siquiera consulta la base ni calcula el hash.
      expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
      expect(verificarClave).not.toHaveBeenCalled();
    });

    it('FUERZA BRUTA: el bloqueo de una IP no afecta a otra IP en la misma cuenta (hasta 10 fallos)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockResolvedValue(false);
      for (let i = 0; i < 5; i++) {
        await servicio.login({ email: USUARIO.email, contrasena: 'mala' }, IP).catch(() => undefined);
      }

      verificarClave.mockResolvedValue(true);
      await expect(
        servicio.login({ email: USUARIO.email, contrasena: 'buena' }, '201.9.9.9'),
      ).resolves.toEqual(expect.objectContaining({ token: 'token-firmado' }));
    });

    it('FUERZA BRUTA: una IP que prueba muchas cuentas queda bloqueada', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null as never);
      for (let i = 0; i < 30; i++) {
        await servicio.login({ email: `c${i}@x.cl`, contrasena: 'x' }, IP).catch(() => undefined);
      }

      const error = await servicio
        .login({ email: 'otra@x.cl', contrasena: 'x' }, IP)
        .catch((e: HttpException) => e);
      expect((error as HttpException).getStatus()).toBe(429);
    });

    it('un acierto borra los fallos previos de esa cuenta', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockResolvedValue(false);
      for (let i = 0; i < 4; i++) {
        await servicio.login({ email: USUARIO.email, contrasena: 'mala' }, IP).catch(() => undefined);
      }
      verificarClave.mockResolvedValue(true);
      await servicio.login({ email: USUARIO.email, contrasena: 'buena' }, IP);

      // Cuatro fallos mas no bloquean: el contador volvio a cero.
      verificarClave.mockResolvedValue(false);
      for (let i = 0; i < 4; i++) {
        const e = await servicio
          .login({ email: USUARIO.email, contrasena: 'mala' }, IP)
          .catch((x: HttpException) => x);
        expect(e).toBeInstanceOf(UnauthorizedException);
      }
    });

    it('un hash corrupto en la base cuenta como clave incorrecta, no como error 500', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockRejectedValue(new Error('pchstr must contain a $'));

      await expect(
        servicio.login({ email: USUARIO.email, contrasena: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('cerrarTodas', () => {
    it('sube la version de sesion (invalida todos los tokens) y lo audita', async () => {
      await servicio.cerrarTodas(ACTOR, IP);

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: USUARIO.id },
        data: { versionSesion: { increment: 1 } },
      });
      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ accion: 'SESIONES_CERRADAS', direccionIp: IP }),
      });
    });
  });

  describe('cambiarContrasena', () => {
    beforeEach(() => {
      prisma.usuario.findUnique.mockResolvedValue({
        hashContrasena: 'hash',
        email: USUARIO.email,
      } as never);
      prisma.usuario.update.mockResolvedValue({ id: USUARIO.id, versionSesion: 4 } as never);
    });

    it('exige la contrasena actual (400, no 401: un 401 cerraria la sesion)', async () => {
      verificarClave.mockResolvedValue(false);

      await expect(
        servicio.cambiarContrasena(ACTOR, { actual: 'mala', nueva: 'Otra-clave-9' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('tras 5 intentos con la clave actual equivocada se bloquea', async () => {
      verificarClave.mockResolvedValue(false);
      for (let i = 0; i < 5; i++) {
        await servicio.cambiarContrasena(ACTOR, { actual: 'mala', nueva: 'Otra-clave-9' }).catch(() => undefined);
      }
      verificarClave.mockResolvedValue(true);
      const error = await servicio
        .cambiarContrasena(ACTOR, { actual: 'buena', nueva: 'Otra-clave-9' })
        .catch((e: HttpException) => e);
      expect((error as HttpException).getStatus()).toBe(429);
    });

    it('rechaza repetir la misma clave o una que contiene el correo', async () => {
      verificarClave.mockResolvedValue(true);
      prisma.usuario.findUnique.mockResolvedValue({
        hashContrasena: 'hash',
        email: 'valeria@timeflow.cl',
      } as never);

      await expect(
        servicio.cambiarContrasena(ACTOR, { actual: 'Igual-clave-1', nueva: 'Igual-clave-1' }),
      ).rejects.toThrow(/distinta/);
      await expect(
        servicio.cambiarContrasena(ACTOR, { actual: 'x', nueva: 'Valeria2026' }),
      ).rejects.toThrow(/correo/);
    });

    it('guarda el hash, cierra las demas sesiones y devuelve un token con la version nueva', async () => {
      verificarClave.mockResolvedValue(true);

      const token = await servicio.cambiarContrasena(ACTOR, { actual: 'buena', nueva: 'Otra-clave-9' }, IP);

      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { hashContrasena: 'hash-nuevo', versionSesion: { increment: 1 } },
        }),
      );
      expect(jwt.signAsync.mock.calls[0][0]).toEqual({ sub: USUARIO.id, ver: 4 });
      expect(token).toBe('token-firmado');
      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ accion: 'CONTRASENA_CAMBIADA', direccionIp: IP }),
      });
    });
  });
});
