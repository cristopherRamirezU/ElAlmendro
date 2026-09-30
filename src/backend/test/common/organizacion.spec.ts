import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  asegurarMismaOrganizacion,
  exigirOrganizacion,
  filtroActividadOrganizacion,
  filtroOrganizacion,
  normalizarCorreo,
  normalizarRut,
} from '../../src/common/organizacion';
import { UsuarioActual } from '../../src/common/usuario-actual.decorator';

const ORG_A = 'a0000000-0000-0000-0000-00000000000a';
const ORG_B = 'b0000000-0000-0000-0000-00000000000b';

const usuario = (rol: UsuarioActual['rol'], organizacionId: string | null): UsuarioActual => ({
  id: 'u1',
  email: 'u1@x.cl',
  rol,
  nombreCompleto: 'U1',
  permisos: [],
  organizacionId,
});

describe('Aislamiento Multi-SaaS (common/organizacion)', () => {
  describe('filtroOrganizacion', () => {
    it('acota a la empresa del usuario', () => {
      expect(filtroOrganizacion(usuario('ADMINISTRADOR', ORG_A))).toEqual({ organizacionId: ORG_A });
    });

    it('SUPER_ADMIN ve la plataforma completa', () => {
      expect(filtroOrganizacion(usuario('SUPER_ADMIN', null))).toEqual({});
    });

    it('falla cerrado: un usuario comun sin empresa no recibe "todo"', () => {
      expect(() => filtroOrganizacion(usuario('ADMINISTRADOR', null))).toThrow(ForbiddenException);
      expect(() => filtroOrganizacion(usuario('TRABAJADOR', null))).toThrow(ForbiddenException);
    });
  });

  it('filtroActividadOrganizacion acota por el proyecto', () => {
    expect(filtroActividadOrganizacion(usuario('SUPERVISOR', ORG_A))).toEqual({
      proyecto: { organizacionId: ORG_A },
    });
  });

  it('exigirOrganizacion rechaza a SUPER_ADMIN en operaciones de una empresa', () => {
    expect(() => exigirOrganizacion(usuario('SUPER_ADMIN', null))).toThrow(ForbiddenException);
    expect(exigirOrganizacion(usuario('TRABAJADOR', ORG_A))).toBe(ORG_A);
  });

  describe('asegurarMismaOrganizacion', () => {
    it('responde 404 ante un recurso de otra empresa (no confirma que exista)', () => {
      expect(() => asegurarMismaOrganizacion(usuario('ADMINISTRADOR', ORG_A), ORG_B)).toThrow(
        NotFoundException,
      );
    });

    it('responde 404 si el recurso no tiene empresa', () => {
      expect(() => asegurarMismaOrganizacion(usuario('ADMINISTRADOR', ORG_A), null)).toThrow(
        NotFoundException,
      );
    });

    it('deja pasar la misma empresa y a SUPER_ADMIN', () => {
      expect(() => asegurarMismaOrganizacion(usuario('ADMINISTRADOR', ORG_A), ORG_A)).not.toThrow();
      expect(() => asegurarMismaOrganizacion(usuario('SUPER_ADMIN', null), ORG_B)).not.toThrow();
    });
  });

  it('normalizarCorreo deja una sola forma por correo', () => {
    expect(normalizarCorreo('  Admin@Admin.CL ')).toBe('admin@admin.cl');
  });

  it('normalizarRut unifica los formatos de un mismo RUT', () => {
    expect(normalizarRut('12.345.678-k')).toBe('12345678-K');
    expect(normalizarRut('12345678K')).toBe('12345678-K');
    expect(normalizarRut(' 12 345 678 - k ')).toBe('12345678-K');
  });
});
