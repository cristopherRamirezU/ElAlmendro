import { ConflictException, NotFoundException } from '@nestjs/common';
import { ActividadesService } from '../../src/modules/actividades/actividades.service';
import { ProyectosService } from '../../src/modules/proyectos/proyectos.service';
import { UsuariosService } from '../../src/modules/usuarios/usuarios.service';
import { CalendarioService } from '../../src/modules/calendario/calendario.service';
import { EvidenciasService } from '../../src/modules/evidencias/evidencias.service';
import { AlmacenamientoService } from '../../src/infra/almacenamiento/almacenamiento.service';
import { ChatGateway } from '../../src/modules/chat/chat.gateway';
import { UsuarioActual } from '../../src/common/usuario-actual.decorator';
import { obtenerPermisosDeRol } from '../../src/common/rbac';
import { montarServicio } from '../utilidades/modulo';
import { PrismaMock } from '../utilidades/prisma-mock';

/**
 * Dos empresas, A y B. Cada caso intenta tocar desde A algo de B y verifica
 * que la consulta viaje acotada a A y que el intento termine en 404.
 */
const ORG_A = 'a0000000-0000-0000-0000-00000000000a';
const ORG_B = 'b0000000-0000-0000-0000-00000000000b';
const ID = '11111111-1111-1111-1111-111111111111';
const AJENO = '22222222-2222-2222-2222-222222222222';

const admin: UsuarioActual = {
  id: 'admin-a',
  email: 'admin@a.cl',
  rol: 'ADMINISTRADOR',
  nombreCompleto: 'Admin A',
  permisos: obtenerPermisosDeRol('ADMINISTRADOR'),
  organizacionId: ORG_A,
};

/** Primer argumento de la ultima llamada a un metodo del mock. */
const argumento = (fn: jest.Mock | unknown) => (fn as jest.Mock).mock.calls.at(-1)?.[0];

describe('Aislamiento entre organizaciones', () => {
  describe('ActividadesService', () => {
    let servicio: ActividadesService;
    let prisma: PrismaMock;

    beforeEach(async () => {
      ({ servicio, prisma } = await montarServicio(ActividadesService));
    });

    it('el detalle de una tarea se busca solo dentro de la empresa', async () => {
      prisma.actividad.findFirst.mockResolvedValue(null);

      await expect(servicio.detalle(ID, admin)).rejects.toThrow(NotFoundException);
      expect(argumento(prisma.actividad.findFirst).where).toMatchObject({
        proyecto: { organizacionId: ORG_A },
      });
    });

    it('no crea tareas en un proyecto de otra empresa', async () => {
      prisma.proyecto.findFirst.mockResolvedValue(null);

      await expect(
        servicio.crear(admin, { proyectoId: ID, titulo: 'x' } as never),
      ).rejects.toThrow(NotFoundException);
      expect(argumento(prisma.proyecto.findFirst).where).toMatchObject({ organizacionId: ORG_A });
      expect(prisma.actividad.create).not.toHaveBeenCalled();
    });

    it('no reasigna una tarea a una persona de otra empresa', async () => {
      prisma.actividad.findFirst.mockResolvedValue({
        id: ID,
        proyectoId: 'p1',
        responsableId: 'otro',
        proyecto: { organizacionId: ORG_A },
      } as never);
      prisma.usuario.findFirst.mockResolvedValue(null); // AJENO es de ORG_B

      await expect(
        servicio.reasignar(ID, admin, { usuarioId: AJENO, motivo: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(argumento(prisma.usuario.findFirst).where).toEqual({
        id: AJENO,
        organizacionId: ORG_A,
      });
      expect(prisma.miembroProyecto.create).not.toHaveBeenCalled();
    });
  });

  describe('ProyectosService', () => {
    let servicio: ProyectosService;
    let prisma: PrismaMock;

    beforeEach(async () => {
      ({ servicio, prisma } = await montarServicio(ProyectosService));
    });

    it('no agrega al equipo a una persona de otra empresa', async () => {
      prisma.proyecto.findFirst.mockResolvedValue({ id: ID, organizacionId: ORG_A } as never);
      prisma.usuario.findFirst.mockResolvedValue(null);

      await expect(servicio.agregarMiembro(ID, admin, AJENO)).rejects.toThrow(NotFoundException);
      expect(argumento(prisma.usuario.findFirst).where).toEqual({
        id: AJENO,
        organizacionId: ORG_A,
      });
      expect(prisma.miembroProyecto.create).not.toHaveBeenCalled();
    });

    it('no toca el equipo de un proyecto de otra empresa', async () => {
      prisma.proyecto.findFirst.mockResolvedValue(null);

      await expect(servicio.quitarMiembro(ID, admin, AJENO)).rejects.toThrow(NotFoundException);
      expect(argumento(prisma.proyecto.findFirst).where).toMatchObject({ organizacionId: ORG_A });
      expect(prisma.miembroProyecto.delete).not.toHaveBeenCalled();
    });

    it('los proyectos eliminados no ocupan cupo del plan', async () => {
      prisma.organizacion.findUnique.mockResolvedValue({
        id: ORG_A,
        maxProyectos: 5,
        _count: { proyectos: 4 },
      } as never);
      prisma.proyecto.create.mockResolvedValue({ id: 'nuevo' } as never);

      await servicio.crear(admin, { nombre: 'P' } as never);
      expect(argumento(prisma.organizacion.findUnique).include._count.select.proyectos).toEqual({
        where: { eliminadoEn: null },
      });
      expect(argumento(prisma.proyecto.create).data.organizacionId).toBe(ORG_A);
    });
  });

  describe('UsuariosService', () => {
    let servicio: UsuariosService;
    let prisma: PrismaMock;

    beforeEach(async () => {
      ({ servicio, prisma } = await montarServicio(UsuariosService));
    });

    it('un correo ya registrado en cualquier empresa no se da de alta de nuevo', async () => {
      prisma.organizacion.findUnique.mockResolvedValue({
        maxUsuarios: 10,
        _count: { usuarios: 1 },
      } as never);
      prisma.usuario.findUnique.mockResolvedValue({ id: 'de-otra-empresa' } as never);

      await expect(
        servicio.crear(admin, {
          email: '  Ana@Empresa.CL ',
          nombreCompleto: 'Ana',
          contrasena: '12345678',
          rol: 'TRABAJADOR',
        }),
      ).rejects.toThrow(ConflictException);
      // Se busca por la forma canonica del correo.
      expect(argumento(prisma.usuario.findUnique).where).toEqual({ email: 'ana@empresa.cl' });
    });

    it('no modifica usuarios de otra empresa', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null);

      await expect(servicio.actualizar(admin, AJENO, { nombreCompleto: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(argumento(prisma.usuario.findFirst).where).toEqual({ id: AJENO, organizacionId: ORG_A });
    });

    it('el "unico administrador" se cuenta dentro de la empresa', async () => {
      prisma.usuario.findFirst.mockResolvedValue({
        id: ID,
        rol: 'ADMINISTRADOR',
        activo: true,
        organizacionId: ORG_A,
      } as never);
      prisma.usuario.count.mockResolvedValue(0);

      await expect(servicio.actualizar(admin, ID, { activo: false })).rejects.toThrow(
        /único administrador/,
      );
      expect(argumento(prisma.usuario.count).where.organizacionId).toBe(ORG_A);
    });
  });

  describe('CalendarioService', () => {
    it('la nomina del calendario sale solo de la empresa pedida', async () => {
      const { servicio, prisma } = await montarServicio(CalendarioService);
      prisma.usuario.findMany.mockResolvedValue([]);
      (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValue([]);

      await servicio.resumen(ORG_A, '2026-09-01', '2026-09-07');
      expect(argumento(prisma.usuario.findMany).where.organizacionId).toBe(ORG_A);
    });
  });

  describe('EvidenciasService', () => {
    it('no descarga la evidencia de otra empresa', async () => {
      const almacenamiento = { descargar: jest.fn() };
      const { servicio, prisma } = await montarServicio(EvidenciasService, [
        { provide: AlmacenamientoService, useValue: almacenamiento },
      ]);
      prisma.evidencia.findUnique.mockResolvedValue({
        id: ID,
        actividad: { proyecto: { organizacionId: ORG_B } },
        sesion: null,
      } as never);

      await expect(servicio.obtenerParaDescarga(admin, ID)).rejects.toThrow(NotFoundException);
      expect(almacenamiento.descargar).not.toHaveBeenCalled();
    });
  });

  describe('ChatGateway', () => {
    it('el canal general se difunde solo en la sala de la empresa', () => {
      const gateway = new ChatGateway({} as never, {} as never);
      const emitSala = jest.fn();
      const servidor = { to: jest.fn(() => ({ emit: emitSala })), emit: jest.fn() };
      (gateway as unknown as { servidor: unknown }).servidor = servidor;

      gateway.emitirMensaje(
        {
          id: 'm1',
          emisorId: 'u1',
          receptorId: null,
          cuerpo: 'hola',
          creadoEn: new Date(),
          leidoEn: null,
          emisor: { id: 'u1', nombreCompleto: 'U1' },
        },
        ORG_A,
      );

      expect(servidor.to).toHaveBeenCalledWith(`organizacion:${ORG_A}`);
      expect(servidor.emit).not.toHaveBeenCalled();
    });
  });
});
