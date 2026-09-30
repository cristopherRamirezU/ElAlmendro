import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { obtenerPermisosDeRol, Rol, ROLES_CATALOGO } from '../../common/rbac';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import {
  esViolacionUnica,
  exigirOrganizacion,
  filtroOrganizacion,
  normalizarCorreo,
} from '../../common/organizacion';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';

/**
 * El correo identifica a una persona en TODA la plataforma: un correo
 * registrado en una empresa no puede darse de alta en otra. Asi nadie termina
 * con dos cuentas iguales e ingresando por error a la empresa equivocada.
 * El mensaje no revela en que empresa esta registrado.
 */
const CORREO_EN_USO = (email: string) =>
  `El correo ${email} ya está registrado en la plataforma. Cada correo solo puede pertenecer a una cuenta.`;
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogo de roles del sistema con sus descripciones y permisos asignados. */
  listarRoles() {
    return ROLES_CATALOGO;
  }

  /**
   * Lista todos los usuarios con soporte de filtros por rol, estado y búsqueda por nombre o correo.
   */
  async listarTodos(actor: UsuarioActual, filtros?: { rol?: Rol; activo?: boolean; busqueda?: string }) {
    const where: any = { ...filtroOrganizacion(actor) };

    if (filtros?.rol) {
      where.rol = filtros.rol;
    }

    // Las cuentas de plataforma nunca aparecen en la nomina de una empresa.
    if (actor.rol !== 'SUPER_ADMIN') {
      where.AND = [{ rol: { not: 'SUPER_ADMIN' } }];
    }

    if (filtros?.activo !== undefined) {
      where.activo = filtros.activo;
    }

    if (filtros?.busqueda?.trim()) {
      const q = filtros.busqueda.trim();
      where.OR = [
        { nombreCompleto: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const usuarios = await this.prisma.usuario.findMany({
      where,
      select: {
        id: true,
        email: true,
        nombreCompleto: true,
        rol: true,
        zonaHoraria: true,
        activo: true,
        organizacionId: true,
        creadoEn: true,
        actualizadoEn: true,
        _count: {
          select: {
            sesiones: true,
            jornadas: true,
            actividades: true,
          },
        },
      },
      orderBy: [{ activo: 'desc' }, { nombreCompleto: 'asc' }],
    });

    return usuarios.map((u) => ({
      ...u,
      permisos: obtenerPermisosDeRol(u.rol),
    }));
  }

  /** Obtiene el detalle de un usuario por su ID. */
  async detalle(actor: UsuarioActual, id: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, ...filtroOrganizacion(actor) },
      select: {
        id: true,
        email: true,
        nombreCompleto: true,
        rol: true,
        zonaHoraria: true,
        activo: true,
        organizacionId: true,
        creadoEn: true,
        actualizadoEn: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('El usuario no existe o no pertenece a tu organización.');
    }

    return {
      ...usuario,
      permisos: obtenerPermisosDeRol(usuario.rol),
    };
  }

  /**
   * Crea un nuevo usuario en el sistema con su contraseña hasheada en Argon2id
   * y registra el evento en la auditoría inmutable.
   */
  async crear(actor: UsuarioActual, dto: CrearUsuarioDto) {
    if (actor.rol === 'SUPERVISOR' && dto.rol !== 'TRABAJADOR') {
      throw new ForbiddenException(
        'Un supervisor solo tiene autorización para dar de alta trabajadores a su cargo.',
      );
    }

    // Toda cuenta nace dentro de la empresa de quien la crea. Las cuentas de
    // una empresa nueva las crea SUPER_ADMIN desde /organizaciones.
    const organizacionId = exigirOrganizacion(actor);
    {
      const org = await this.prisma.organizacion.findUnique({
        where: { id: organizacionId },
        include: { _count: { select: { usuarios: { where: { activo: true } } } } },
      });

      if (org && org._count.usuarios >= org.maxUsuarios) {
        throw new BadRequestException(
          `Has alcanzado el límite máximo de ${org.maxUsuarios} usuarios permitidos en tu plan SaaS. Contacta al administrador para aumentar la capacidad.`,
        );
      }
    }

    const email = normalizarCorreo(dto.email);

    const existente = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (existente) {
      throw new ConflictException(CORREO_EN_USO(email));
    }

    const hashContrasena = await argon2.hash(dto.contrasena);

    const usuario = await this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.usuario.create({
        data: {
          email,
          nombreCompleto: dto.nombreCompleto.trim(),
          hashContrasena,
          rol: dto.rol as any,
          zonaHoraria: dto.zonaHoraria || 'America/Santiago',
          activo: true,
          organizacionId,
        },
        select: {
          id: true,
          email: true,
          nombreCompleto: true,
          rol: true,
          zonaHoraria: true,
          activo: true,
          organizacionId: true,
          creadoEn: true,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          actorId: actor.id,
          organizacionId,
          accion: 'USUARIO_CREADO',
          tipoEntidad: 'Usuario',
          entidadId: nuevo.id,
          valorNuevo: {
            email: nuevo.email,
            nombreCompleto: nuevo.nombreCompleto,
            rol: nuevo.rol,
          },
        },
      });

      return nuevo;
    }).catch((error) => {
      if (esViolacionUnica(error)) throw new ConflictException(CORREO_EN_USO(email));
      throw error;
    });

    return {
      ...usuario,
      permisos: obtenerPermisosDeRol(usuario.rol),
    };
  }

  /**
   * Actualiza los datos de un usuario existente. Si se incluye contraseña,
   * se hashea nuevamente. Protege contra despojar al único administrador activo.
   */
  async actualizar(actor: UsuarioActual, id: string, dto: ActualizarUsuarioDto) {
    const existente = await this.prisma.usuario.findFirst({
      where: { id, ...filtroOrganizacion(actor) },
    });
    if (!existente) {
      throw new NotFoundException('El usuario no existe o no pertenece a tu organización.');
    }

    // Regla de salvaguarda: supervisor solo gestiona trabajadores a su cargo
    if (actor.rol === 'SUPERVISOR') {
      if (existente.rol !== 'TRABAJADOR') {
        throw new ForbiddenException(
          'Un supervisor solo tiene autorización para gestionar trabajadores a su cargo.',
        );
      }
      if (dto.rol && dto.rol !== 'TRABAJADOR') {
        throw new ForbiddenException(
          'Un supervisor no puede promover cuentas a supervisor o administrador.',
        );
      }
    }

    // Regla de salvaguarda: no permitir desactivar o quitar rol al último administrador activo
    const cambiaraAdmin =
      existente.rol === 'ADMINISTRADOR' &&
      ((dto.activo === false && existente.activo) ||
        (dto.rol && dto.rol !== 'ADMINISTRADOR'));

    if (cambiaraAdmin) {
      // Se cuenta dentro de la misma empresa: que otra tenga administradores
      // no impide que esta se quede sin ninguno.
      const otrosAdmins = await this.prisma.usuario.count({
        where: {
          rol: 'ADMINISTRADOR',
          activo: true,
          id: { not: id },
          organizacionId: existente.organizacionId,
        },
      });

      if (otrosAdmins === 0) {
        throw new BadRequestException(
          'No es posible degradar o desactivar al único administrador activo de la organización.',
        );
      }
    }

    const data: any = {};

    if (dto.email?.trim()) {
      const nuevoEmail = normalizarCorreo(dto.email);
      if (nuevoEmail !== existente.email) {
        const enUso = await this.prisma.usuario.findUnique({
          where: { email: nuevoEmail },
        });
        if (enUso) {
          throw new ConflictException(CORREO_EN_USO(nuevoEmail));
        }
        data.email = nuevoEmail;
      }
    }

    if (dto.nombreCompleto?.trim()) {
      data.nombreCompleto = dto.nombreCompleto.trim();
    }

    if (dto.rol) {
      data.rol = dto.rol as any;
    }

    if (dto.activo !== undefined) {
      data.activo = dto.activo;
    }

    if (dto.zonaHoraria?.trim()) {
      data.zonaHoraria = dto.zonaHoraria.trim();
    }

    if (dto.contrasena && dto.contrasena.trim().length >= 8) {
      data.hashContrasena = await argon2.hash(dto.contrasena.trim());
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const u = await tx.usuario.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          nombreCompleto: true,
          rol: true,
          zonaHoraria: true,
          activo: true,
          actualizadoEn: true,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          actorId: actor.id,
          organizacionId: existente.organizacionId ?? undefined,
          accion: 'USUARIO_ACTUALIZADO',
          tipoEntidad: 'Usuario',
          entidadId: u.id,
          valorAnterior: {
            email: existente.email,
            rol: existente.rol,
            activo: existente.activo,
            nombreCompleto: existente.nombreCompleto,
          },
          valorNuevo: {
            email: u.email,
            rol: u.rol,
            activo: u.activo,
            nombreCompleto: u.nombreCompleto,
          },
        },
      });

      return u;
    }).catch((error) => {
      if (esViolacionUnica(error)) throw new ConflictException(CORREO_EN_USO(data.email));
      throw error;
    });

    return {
      ...actualizado,
      permisos: obtenerPermisosDeRol(actualizado.rol),
    };
  }

  /**
   * Elimina o desactiva un usuario.
   * Restringido de forma estricta a Administrador y Super Administrador.
   * Si el usuario no tiene historial laboral ni registros de auditoría, se elimina físicamente.
   * Si posee historial, se desactiva lógicamente (Soft Delete) revocando tokens.
   */
  async desactivar(actor: UsuarioActual, id: string) {
    if (actor.rol !== 'ADMINISTRADOR' && actor.rol !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo un administrador puede eliminar o desactivar usuarios.');
    }

    if (actor.id === id) {
      throw new BadRequestException('No puedes eliminar ni desactivar tu propia cuenta.');
    }

    const existente = await this.prisma.usuario.findFirst({
      where: { id, ...filtroOrganizacion(actor) },
    });
    if (!existente) {
      throw new NotFoundException('El usuario no existe o no pertenece a tu organización.');
    }

    if (existente.rol === 'ADMINISTRADOR') {
      const otrosAdmins = await this.prisma.usuario.count({
        where: {
          rol: 'ADMINISTRADOR',
          activo: true,
          id: { not: id },
          ...(existente.organizacionId ? { organizacionId: existente.organizacionId } : {}),
        },
      });

      if (otrosAdmins === 0) {
        throw new BadRequestException(
          'No puedes eliminar ni desactivar al único administrador activo de la organización.',
        );
      }
    }

    // Comprobar si tiene historial protegido
    const [tieneSesiones, tieneEvidencias, tieneAuditoria, tieneJornadas, tieneActividades, tieneProyectos] = await Promise.all([
      this.prisma.sesionTrabajo.count({ where: { usuarioId: id } }),
      this.prisma.evidencia.count({ where: { subidaPorId: id } }),
      this.prisma.registroAuditoria.count({ where: { actorId: id } }),
      this.prisma.jornada.count({ where: { usuarioId: id } }),
      this.prisma.actividad.count({ where: { responsableId: id, eliminadoEn: null } }),
      this.prisma.proyecto.count({ where: { propietarioId: id, eliminadoEn: null } }),
    ]);

    const tieneHistorial = tieneSesiones > 0 || tieneEvidencias > 0 || tieneAuditoria > 0 || tieneJornadas > 0 || tieneActividades > 0 || tieneProyectos > 0;

    if (tieneHistorial) {
      // Soft-delete
      await this.prisma.$transaction(async (tx) => {
        await tx.usuario.update({
          where: { id },
          data: { activo: false },
        });

        await tx.tokenRefresco.deleteMany({ where: { usuarioId: id } });

        await tx.registroAuditoria.create({
          data: {
            actorId: actor.id,
            organizacionId: existente.organizacionId ?? undefined,
            accion: 'USUARIO_ELIMINADO',
            tipoEntidad: 'Usuario',
            entidadId: id,
            valorAnterior: { activo: existente.activo, email: existente.email },
            valorNuevo: { activo: false, metodo: 'SOFT_DELETE' },
          },
        });
      });

      return {
        ok: true,
        id,
        eliminadoPermanente: false,
        mensaje: `Usuario ${existente.nombreCompleto} desactivado y accesos revocados (cuenta con historial registrado).`,
      };
    } else {
      // Hard-delete
      await this.prisma.$transaction(async (tx) => {
        await tx.tokenRefresco.deleteMany({ where: { usuarioId: id } });
        await tx.miembroProyecto.deleteMany({ where: { usuarioId: id } });
        await tx.mensajeChat.deleteMany({
          where: { OR: [{ emisorId: id }, { receptorId: id }] },
        });
        await tx.usuario.delete({ where: { id } });

        await tx.registroAuditoria.create({
          data: {
            actorId: actor.id,
            organizacionId: existente.organizacionId ?? undefined,
            accion: 'USUARIO_ELIMINADO',
            tipoEntidad: 'Usuario',
            entidadId: id,
            valorAnterior: { email: existente.email, nombre: existente.nombreCompleto },
            valorNuevo: { eliminado: true, metodo: 'HARD_DELETE' },
          },
        });
      });

      return {
        ok: true,
        id,
        eliminadoPermanente: true,
        mensaje: `Usuario ${existente.nombreCompleto} eliminado permanentemente del sistema.`,
      };
    }
  }

  /** Trabajadores activos, para poblar el selector del calendario y los reportes. */
  async trabajadores(actor: UsuarioActual, soloId?: string) {
    const filas = await this.prisma.usuario.findMany({
      where: {
        ...filtroOrganizacion(actor),
        rol: { in: ['TRABAJADOR', 'SUPERVISOR'] as any },
        activo: true,
        ...(soloId ? { id: soloId } : {}),
      },
      select: { id: true, nombreCompleto: true },
      orderBy: { nombreCompleto: 'asc' },
    });
    return filas.map((f) => ({ id: f.id, nombre: f.nombreCompleto }));
  }
}
