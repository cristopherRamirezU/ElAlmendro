import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsuariosService } from '../../../src/modules/usuarios/usuarios.service';
import { UsuarioActual } from '../../../src/common/usuario-actual.decorator';
import { montarServicio } from '../../utilidades/modulo';
import { PrismaMock } from '../../utilidades/prisma-mock';

jest.mock('argon2');

const hashear = argon2.hash as jest.MockedFunction<typeof argon2.hash>;

const actor = (rol: string, id = 'actor-1'): UsuarioActual =>
  ({
    id,
    rol,
    email: 'a@b.cl',
    nombreCompleto: 'Actor',
    permisos: [],
    organizacionId: 'org-1',
  }) as UsuarioActual;

const ADMIN = actor('ADMINISTRADOR');
const SUPERVISOR = actor('SUPERVISOR');

const usuario = (extra: Record<string, unknown> = {}) => ({
  id: 'usuario-9',
  email: 'ana@timeflow.cl',
  nombreCompleto: 'Ana Perez',
  rol: 'TRABAJADOR',
  activo: true,
  // Misma organizacion que el actor: de lo contrario salta primero la
  // barrera de aislamiento entre inquilinos (Multi-SaaS).
  organizacionId: 'org-1',
  ...extra,
});

describe('UsuariosService', () => {
  let servicio: UsuariosService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    ({ servicio, prisma } = await montarServicio(UsuariosService));
    hashear.mockResolvedValue('hash-nuevo' as never);
  });

  describe('crear', () => {
    const nuevo = {
      email: 'nueva@timeflow.cl',
      nombreCompleto: 'Nueva',
      contrasena: 'clave-larga',
      rol: 'TRABAJADOR',
    };

    it('un SUPERVISOR no puede dar de alta administradores', async () => {
      await expect(
        servicio.crear(SUPERVISOR, { ...nuevo, rol: 'ADMINISTRADOR' } as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza un correo ya registrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuario() as never);

      await expect(servicio.crear(ADMIN, nuevo as never)).rejects.toThrow(
        ConflictException,
      );
    });

    it('nunca guarda la contrasena en claro', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null as never);
      prisma.usuario.create.mockResolvedValue(usuario() as never);

      await servicio.crear(ADMIN, nuevo as never);

      const datos = prisma.usuario.create.mock.calls[0][0].data as Record<
        string,
        unknown
      >;
      expect(datos.hashContrasena).toBe('hash-nuevo');
      expect(JSON.stringify(datos)).not.toContain('clave-larga');
    });

    it('normaliza el correo y deja America/Santiago por defecto', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null as never);
      prisma.usuario.create.mockResolvedValue(usuario() as never);

      await servicio.crear(ADMIN, {
        ...nuevo,
        email: '  NUEVA@TimeFlow.CL ',
      } as never);

      expect(prisma.usuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'nueva@timeflow.cl',
            zonaHoraria: 'America/Santiago',
          }),
        }),
      );
    });
  });

  describe('actualizar', () => {
    it('AISLAMIENTO MULTI-SAAS: alguien de otra empresa ni siquiera se encuentra', async () => {
      // El filtro va en la consulta, por eso responde 404 y no 403: confirmar
      // que el id existe en otra empresa ya seria filtrar informacion.
      prisma.usuario.findFirst.mockResolvedValue(null as never);

      await expect(
        servicio.actualizar(ADMIN, 'usuario-9', {} as never),
      ).rejects.toThrow(/no pertenece a tu organización/i);

      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('la consulta de actualizar siempre lleva el filtro de organizacion', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuario() as never);
      prisma.usuario.update.mockResolvedValue(usuario() as never);

      await servicio.actualizar(ADMIN, 'usuario-9', {
        nombreCompleto: 'Ana Nueva',
      } as never);

      expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
        where: { id: 'usuario-9', organizacionId: 'org-1' },
      });
    });

    it('un SUPER_ADMIN consulta sin filtro de empresa', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuario() as never);
      prisma.usuario.update.mockResolvedValue(usuario() as never);

      await servicio.actualizar(actor('SUPER_ADMIN'), 'usuario-9', {
        nombreCompleto: 'Ana Nueva',
      } as never);

      expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
        where: { id: 'usuario-9' },
      });
    });

    it('rechaza un usuario inexistente', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null as never);

      await expect(
        servicio.actualizar(ADMIN, 'fantasma', {} as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('un SUPERVISOR no puede tocar a quien no sea TRABAJADOR', async () => {
      prisma.usuario.findFirst.mockResolvedValue(
        usuario({ rol: 'ADMINISTRADOR' }) as never,
      );

      await expect(
        servicio.actualizar(SUPERVISOR, 'usuario-9', {} as never),
      ).rejects.toThrow(/solo tiene autorización para gestionar trabajadores/i);
    });

    it('un SUPERVISOR no puede promover a nadie', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuario() as never);

      await expect(
        servicio.actualizar(SUPERVISOR, 'usuario-9', {
          rol: 'SUPERVISOR',
        } as never),
      ).rejects.toThrow(/no puede promover/i);
    });

    it('NO DEJA AL SISTEMA SIN ADMINISTRADOR: degradar al ultimo activo falla', async () => {
      prisma.usuario.findFirst.mockResolvedValue(
        usuario({ rol: 'ADMINISTRADOR' }) as never,
      );
      prisma.usuario.count.mockResolvedValue(0 as never); // no queda ningun otro

      await expect(
        servicio.actualizar(ADMIN, 'usuario-9', { rol: 'TRABAJADOR' } as never),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('permite degradar a un administrador si queda otro activo', async () => {
      prisma.usuario.findFirst.mockResolvedValue(
        usuario({ rol: 'ADMINISTRADOR' }) as never,
      );
      prisma.usuario.count.mockResolvedValue(1 as never);
      prisma.usuario.update.mockResolvedValue(usuario() as never);

      await servicio.actualizar(ADMIN, 'usuario-9', {
        rol: 'TRABAJADOR',
      } as never);

      expect(prisma.usuario.update).toHaveBeenCalled();
    });

    it('rechaza cambiar a un correo que ya usa otra cuenta', async () => {
      // El usuario a editar se busca con findFirst (filtrado por empresa);
      // la comprobacion de correo duplicado usa findUnique sobre el indice.
      prisma.usuario.findFirst.mockResolvedValue(usuario() as never);
      prisma.usuario.findUnique.mockResolvedValue({ id: 'otro' } as never);

      await expect(
        servicio.actualizar(ADMIN, 'usuario-9', {
          email: 'ocupado@timeflow.cl',
        } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('DOCUMENTA: una contrasena de menos de 8 caracteres se ignora en silencio', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuario() as never);
      prisma.usuario.update.mockResolvedValue(usuario() as never);

      await servicio.actualizar(ADMIN, 'usuario-9', {
        contrasena: 'corta',
      } as never);

      // Hoy no lanza error ni cambia la clave. Si se decide rechazarla,
      // este test es el que cae y hay que actualizar.
      expect(hashear).not.toHaveBeenCalled();
      const datos = prisma.usuario.update.mock.calls[0][0].data as Record<
        string,
        unknown
      >;
      expect(datos).not.toHaveProperty('hashContrasena');
    });

    it('deja rastro de auditoria con el valor anterior y el nuevo', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuario() as never);
      prisma.usuario.update.mockResolvedValue(
        usuario({ nombreCompleto: 'Ana Nueva' }) as never,
      );

      await servicio.actualizar(ADMIN, 'usuario-9', {
        nombreCompleto: 'Ana Nueva',
      } as never);

      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'USUARIO_ACTUALIZADO',
          valorAnterior: expect.objectContaining({ nombreCompleto: 'Ana Perez' }),
          valorNuevo: expect.objectContaining({ nombreCompleto: 'Ana Nueva' }),
        }),
      });
    });
  });

  describe('actualizarPermisos (permisos extra por trabajador)', () => {
    it('el administrador se los da a un trabajador de su organizacion, queda auditado', async () => {
      prisma.usuario.findFirst.mockResolvedValue({
        id: 'usuario-9',
        rol: 'TRABAJADOR',
        permisosExtra: [],
      } as never);

      const r = await servicio.actualizarPermisos(ADMIN, 'usuario-9', {
        permisos: ['actividades:eliminar', 'nodos:editar'],
      });

      // Se guardan en el orden del catalogo.
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'usuario-9' },
        data: { permisosExtra: ['nodos:editar', 'actividades:eliminar'] },
      });
      expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'usuario-9', organizacionId: 'org-1' } }),
      );
      expect(prisma.registroAuditoria.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accion: 'USUARIO_PERMISOS',
          valorAnterior: { permisosExtra: [] },
          valorNuevo: { permisosExtra: ['nodos:editar', 'actividades:eliminar'] },
        }),
      });
      expect(r.permisos).toEqual(expect.arrayContaining(['nodos:editar', 'actividades:eliminar']));
    });

    it('una lista vacia se los quita', async () => {
      prisma.usuario.findFirst.mockResolvedValue({
        id: 'usuario-9',
        rol: 'TRABAJADOR',
        permisosExtra: ['nodos:editar'],
      } as never);

      const r = await servicio.actualizarPermisos(ADMIN, 'usuario-9', { permisos: [] });

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'usuario-9' },
        data: { permisosExtra: [] },
      });
      expect(r.permisos).not.toContain('nodos:editar');
    });

    it('un supervisor no puede asignarlos', async () => {
      await expect(
        servicio.actualizarPermisos(SUPERVISOR, 'usuario-9', { permisos: ['nodos:editar'] }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('un usuario de otra organizacion responde como inexistente', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null as never);

      await expect(
        servicio.actualizarPermisos(ADMIN, 'ajeno', { permisos: ['nodos:editar'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('solo se dan a trabajadores: a un supervisor no', async () => {
      prisma.usuario.findFirst.mockResolvedValue({
        id: 'sup-2',
        rol: 'SUPERVISOR',
        permisosExtra: [],
      } as never);

      await expect(
        servicio.actualizarPermisos(ADMIN, 'sup-2', { permisos: ['actividades:eliminar'] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('a quien ya no es trabajador igual se le pueden quitar los que le quedaron', async () => {
      prisma.usuario.findFirst.mockResolvedValue({
        id: 'sup-2',
        rol: 'SUPERVISOR',
        permisosExtra: ['actividades:eliminar'],
      } as never);

      await servicio.actualizarPermisos(ADMIN, 'sup-2', { permisos: [] });

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'sup-2' },
        data: { permisosExtra: [] },
      });
    });
  });

  describe('desactivar', () => {
    it('nadie puede desactivarse a si mismo', async () => {
      await expect(servicio.desactivar(ADMIN, ADMIN.id)).rejects.toThrow(
        /tu propia cuenta/i,
      );
    });

    it('un SUPERVISOR no puede desactivar administradores', async () => {
      prisma.usuario.findFirst.mockResolvedValue(
        usuario({ rol: 'ADMINISTRADOR' }) as never,
      );

      await expect(
        servicio.desactivar(SUPERVISOR, 'usuario-9'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('es idempotente: desactivar a un inactivo no escribe en la base', async () => {
      prisma.usuario.findFirst.mockResolvedValue(
        usuario({ activo: false }) as never,
      );

      const resultado = await servicio.desactivar(ADMIN, 'usuario-9');

      expect(resultado).toEqual(
        expect.objectContaining({ ok: true, id: 'usuario-9' }),
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('no deja al sistema sin administrador activo', async () => {
      prisma.usuario.findFirst.mockResolvedValue(
        usuario({ rol: 'ADMINISTRADOR' }) as never,
      );
      prisma.usuario.count.mockResolvedValue(0 as never);

      await expect(servicio.desactivar(ADMIN, 'usuario-9')).rejects.toThrow(
        /unico administrador activo|único administrador activo/i,
      );
    });

    /**
     * La baja tiene dos caminos: si la persona dejo rastro (sesiones,
     * evidencias, auditoria...) se desactiva pero la fila se conserva, para
     * no romper la trazabilidad. Si nunca registro nada, se borra de verdad.
     */
    it('CON historial: baja logica, la fila se conserva', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuario() as never);
      prisma.sesionTrabajo.count.mockResolvedValue(5 as never);
      prisma.evidencia.count.mockResolvedValue(0 as never);
      prisma.registroAuditoria.count.mockResolvedValue(0 as never);
      prisma.jornada.count.mockResolvedValue(0 as never);
      prisma.actividad.count.mockResolvedValue(0 as never);
      prisma.proyecto.count.mockResolvedValue(0 as never);

      const resultado = await servicio.desactivar(ADMIN, 'usuario-9');

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'usuario-9' },
        data: { activo: false },
      });
      expect(prisma.usuario.delete).not.toHaveBeenCalled();
      expect(resultado).toEqual(
        expect.objectContaining({ eliminadoPermanente: false }),
      );
    });

    it('SIN historial: se borra la fila de verdad', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuario() as never);
      for (const contador of [
        prisma.sesionTrabajo.count,
        prisma.evidencia.count,
        prisma.registroAuditoria.count,
        prisma.jornada.count,
        prisma.actividad.count,
        prisma.proyecto.count,
      ]) {
        contador.mockResolvedValue(0 as never);
      }

      await servicio.desactivar(ADMIN, 'usuario-9');

      expect(prisma.usuario.delete).toHaveBeenCalledWith({
        where: { id: 'usuario-9' },
      });
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('revoca los tokens de refresco en ambos casos', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuario() as never);
      prisma.sesionTrabajo.count.mockResolvedValue(3 as never);

      await servicio.desactivar(ADMIN, 'usuario-9');

      expect(prisma.tokenRefresco.deleteMany).toHaveBeenCalledWith({
        where: { usuarioId: 'usuario-9' },
      });
    });
  });
});
