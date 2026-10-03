import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService, duracionSesion } from '../../../src/modules/auth/auth.service';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';

jest.mock('argon2');

const verificarClave = argon2.verify as jest.MockedFunction<typeof argon2.verify>;

const USUARIO = {
  id: 'usuario-1',
  email: 'ana@timeflow.cl',
  nombreCompleto: 'Ana Perez',
  rol: 'TRABAJADOR',
  hashContrasena: 'hash',
  activo: true,
  // Multi-SaaS: salvo SUPER_ADMIN, nadie entra sin empresa activa.
  organizacionId: 'org-1',
  organizacion: { id: 'org-1', nombre: 'Hotel El Almendro', activo: true },
};

describe('AuthService', () => {
  let servicio: AuthService;
  let prisma: PrismaMock;
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    jwt = { signAsync: jest.fn().mockResolvedValue('token-firmado') };
    ({ servicio, prisma } = await montarServicio(AuthService, [
      { provide: JwtService, useValue: jwt },
    ]));
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

    it('firma el token con los permisos derivados del rol', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockResolvedValue(true);

      const resultado = await servicio.login({
        email: USUARIO.email,
        contrasena: 'buena',
      });

      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: USUARIO.id,
          email: USUARIO.email,
          rol: 'TRABAJADOR',
          nombre: USUARIO.nombreCompleto,
          permisos: expect.arrayContaining(['jornada:registrar']),
        }),
        expect.anything(),
      );
      expect(resultado.token).toBe('token-firmado');
      // La respuesta nunca debe arrastrar el hash de la contrasena.
      expect(resultado.usuario).not.toHaveProperty('hashContrasena');
    });

    it('audita el ingreso como INICIO_SESION, no como SESION_INICIADA', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO as never);
      verificarClave.mockResolvedValue(true);

      await servicio.login({ email: USUARIO.email, contrasena: 'buena' });

      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'INICIO_SESION',
          tipoEntidad: 'Usuario',
          actorId: USUARIO.id,
        }),
      });
    });
  });

  describe('duracionSesion', () => {
    const original = { ...process.env };

    afterEach(() => {
      process.env = { ...original };
    });

    it.each(['indefinido', 'never', '0', 'INDEFINIDO', '  '])(
      'devuelve null con %p (sesion sin expiracion)',
      (valor) => {
        process.env.JWT_ACCESO_TTL = valor;
        expect(duracionSesion()).toBeNull();
      },
    );

    it('devuelve el valor cuando es una duracion real', () => {
      process.env.JWT_ACCESO_TTL = '8h';
      expect(duracionSesion()).toBe('8h');
    });

    it('cae en JWT_ACCESS_TTL si no esta la variable en espanol', () => {
      delete process.env.JWT_ACCESO_TTL;
      process.env.JWT_ACCESS_TTL = '15m';
      expect(duracionSesion()).toBe('15m');
    });
  });
});
