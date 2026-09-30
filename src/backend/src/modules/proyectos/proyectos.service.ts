import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import { exigirOrganizacion, filtroOrganizacion } from '../../common/organizacion';

/**
 * Proyectos: la unidad que agrupa las tareas de un trabajador. Cada proyecto
 * es la raiz del mapa de nodos correspondiente (US-05).
 */
@Injectable()
export class ProyectosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Proyectos del trabajador de la sesion (propios, miembros o donde tiene tareas asignadas; o todos para admin). */
  async mios(u: UsuarioActual) {
    const esAdmin = u.rol === 'ADMINISTRADOR' || u.rol === 'SUPER_ADMIN';
    const whereOrg = filtroOrganizacion(u);

    const proyectos = await this.prisma.proyecto.findMany({
      where: {
        eliminadoEn: null,
        ...whereOrg,
        ...(esAdmin
          ? {}
          : {
              OR: [
                { propietarioId: u.id },
                { miembros: { some: { usuarioId: u.id } } },
                { actividades: { some: { responsableId: u.id, eliminadoEn: null } } },
              ],
            }),
      },
      orderBy: { creadoEn: 'asc' },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        creadoEn: true,
        actividades: {
          where: { eliminadoEn: null },
          select: { estado: true },
        },
      },
    });

    // El cofre se llena con las tareas ya guardadas: por eso ademas del total
    // viaja cuantas estan completadas.
    return proyectos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      estado: p.estado,
      creadoEn: p.creadoEn,
      totalTareas: p.actividades.length,
      tareasCompletadas: p.actividades.filter((a) => a.estado === 'COMPLETADA').length,
    }));
  }

  async crear(u: UsuarioActual, dto: CrearProyectoDto) {
    // Un proyecto siempre nace en la empresa de quien lo crea. SUPER_ADMIN no
    // tiene empresa y no crea proyectos: antes caia en "la primera" que hubiera.
    const orgId = exigirOrganizacion(u);

    const org = await this.prisma.organizacion.findUnique({
      where: { id: orgId },
      include: { _count: { select: { proyectos: { where: { eliminadoEn: null } } } } },
    });

    // Los proyectos eliminados ya no ocupan cupo del plan.
    if (org && org._count.proyectos >= org.maxProyectos) {
      throw new BadRequestException(
        `Has alcanzado el límite máximo de ${org.maxProyectos} proyectos permitidos en tu plan. Contacta al administrador para aumentar tu capacidad.`,
      );
    }

    const proyecto = await this.prisma.proyecto.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        propietarioId: u.id,
        organizacionId: orgId,
        miembros: {
          create: { usuarioId: u.id, rolEnProyecto: 'LIDER' },
        },
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        creadoEn: true,
      },
    });

    return { ...proyecto, totalTareas: 0, tareasCompletadas: 0 };
  }

  async actualizar(id: string, u: UsuarioActual, dto: ActualizarProyectoDto) {
    // Cualquier rol puede crear proyectos, pero modificarlos queda reservado a
    // administrador y supervisor: un trabajador que abrio un proyecto es su
    // propietario y aun asi no debe poder cambiarlo.
    if (u.rol === 'TRABAJADOR') {
      throw new ForbiddenException('Solo un administrador o supervisor puede modificar proyectos.');
    }
    const whereOrg = filtroOrganizacion(u);
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id, eliminadoEn: null, ...whereOrg },
      select: { id: true },
    });
    if (!proyecto) throw new NotFoundException('El proyecto no existe o no pertenece a tu organización.');

    const actualizado = await this.prisma.proyecto.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        creadoEn: true,
        _count: {
          select: { actividades: { where: { eliminadoEn: null } } },
        },
        actividades: {
          where: { eliminadoEn: null },
          select: { estado: true },
        },
      },
    });

    return {
      id: actualizado.id,
      nombre: actualizado.nombre,
      descripcion: actualizado.descripcion,
      estado: actualizado.estado,
      creadoEn: actualizado.creadoEn,
      totalTareas: actualizado._count.actividades,
      tareasCompletadas: actualizado.actividades.filter((a) => a.estado === 'COMPLETADA').length,
    };
  }

  /**
   * Equipo del proyecto. Lo ve cualquiera que pueda ver el proyecto: admin y
   * supervisor siempre; el resto solo si es miembro o tiene tareas en el.
   */
  async miembros(id: string, u: UsuarioActual) {
    const puedeVerTodo = u.rol !== 'TRABAJADOR';
    const whereOrg = filtroOrganizacion(u);
    const proyecto = await this.prisma.proyecto.findFirst({
      where: {
        id,
        eliminadoEn: null,
        ...whereOrg,
        ...(puedeVerTodo
          ? {}
          : {
              OR: [
                { propietarioId: u.id },
                { miembros: { some: { usuarioId: u.id } } },
                { actividades: { some: { responsableId: u.id, eliminadoEn: null } } },
              ],
            }),
      },
      select: { id: true },
    });
    if (!proyecto) throw new NotFoundException('El proyecto no existe.');
    return this.listarMiembros(id);
  }

  private async listarMiembros(proyectoId: string) {
    const filas = await this.prisma.miembroProyecto.findMany({
      where: { proyectoId },
      orderBy: { agregadoEn: 'asc' },
      select: {
        rolEnProyecto: true,
        agregadoEn: true,
        usuario: { select: { id: true, nombreCompleto: true, rol: true, activo: true } },
      },
    });
    return filas.map((m) => ({
      id: m.usuario.id,
      nombre: m.usuario.nombreCompleto,
      rol: m.usuario.rol,
      activo: m.usuario.activo,
      rolEnProyecto: m.rolEnProyecto,
      agregadoEn: m.agregadoEn,
    }));
  }

  /**
   * Asignar una persona al proyecto: con eso le aparece en "Mis proyectos".
   * Idempotente: agregar a quien ya es miembro no falla ni duplica.
   */
  async agregarMiembro(id: string, u: UsuarioActual, usuarioId: string) {
    const actorId = u.id;
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id, eliminadoEn: null, ...filtroOrganizacion(u) },
      select: { id: true, organizacionId: true },
    });
    if (!proyecto) throw new NotFoundException('El proyecto no existe o no pertenece a tu organización.');

    // Solo personas de la misma empresa que el proyecto pueden integrarlo.
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, organizacionId: proyecto.organizacionId },
      select: { id: true, activo: true },
    });
    if (!usuario) throw new NotFoundException('El usuario no existe o no pertenece a tu organización.');
    if (!usuario.activo) throw new BadRequestException('El usuario esta desactivado.');

    await this.prisma.$transaction(async (tx) => {
      const existente = await tx.miembroProyecto.findUnique({
        where: { proyectoId_usuarioId: { proyectoId: id, usuarioId } },
        select: { usuarioId: true },
      });
      if (existente) return;
      await tx.miembroProyecto.create({ data: { proyectoId: id, usuarioId } });
      await tx.registroAuditoria.create({
        data: {
          actorId,
          organizacionId: proyecto.organizacionId,
          accion: 'PROYECTO_MIEMBRO_AGREGADO',
          tipoEntidad: 'Proyecto',
          entidadId: id,
          valorNuevo: { usuarioId },
        },
      });
    });

    return this.listarMiembros(id);
  }

  /** Quitar a alguien del equipo. Sus tareas siguen a su nombre: eso se resuelve reasignando. */
  async quitarMiembro(id: string, u: UsuarioActual, usuarioId: string) {
    const actorId = u.id;
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id, eliminadoEn: null, ...filtroOrganizacion(u) },
      select: { id: true, organizacionId: true },
    });
    if (!proyecto) throw new NotFoundException('El proyecto no existe o no pertenece a tu organización.');

    const miembro = await this.prisma.miembroProyecto.findUnique({
      where: { proyectoId_usuarioId: { proyectoId: id, usuarioId } },
      select: { rolEnProyecto: true },
    });
    if (!miembro) throw new NotFoundException('Esa persona no es miembro del proyecto.');

    await this.prisma.$transaction([
      this.prisma.miembroProyecto.delete({
        where: { proyectoId_usuarioId: { proyectoId: id, usuarioId } },
      }),
      this.prisma.registroAuditoria.create({
        data: {
          actorId,
          organizacionId: proyecto.organizacionId,
          accion: 'PROYECTO_MIEMBRO_QUITADO',
          tipoEntidad: 'Proyecto',
          entidadId: id,
          valorAnterior: { usuarioId, rolEnProyecto: miembro.rolEnProyecto },
        },
      }),
    ]);

    return this.listarMiembros(id);
  }

  /** Elimina un proyecto y todos sus nodos. Exclusivo para Administrador y Super Admin. */
  async eliminar(id: string, u: UsuarioActual) {
    if (u.rol !== 'ADMINISTRADOR' && u.rol !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo un administrador puede eliminar proyectos.');
    }

    const whereOrg = filtroOrganizacion(u);
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id, eliminadoEn: null, ...whereOrg },
      include: {
        actividades: {
          where: { eliminadoEn: null },
          select: { id: true },
        },
      },
    });

    if (!proyecto) {
      throw new NotFoundException('El proyecto no existe o ya fue eliminado.');
    }

    const ahora = new Date();
    const actividadIds = proyecto.actividades.map((a) => a.id);

    await this.prisma.$transaction(async (tx) => {
      if (actividadIds.length > 0) {
        // Cerrar sesiones abiertas en las tareas del proyecto
        await tx.sesionTrabajo.updateMany({
          where: {
            actividadId: { in: actividadIds },
            estado: { in: ['ACTIVA', 'PAUSADA'] },
          },
          data: {
            estado: 'AUTOCERRADA',
            desenlace: 'INCONCLUSA',
            notaCierre: 'Sesión cerrada automáticamente por eliminación del proyecto.',
            terminoEn: ahora,
            actualizadoEn: ahora,
          },
        });

        await tx.tramoSesion.updateMany({
          where: {
            sesion: { actividadId: { in: actividadIds } },
            terminoEn: null,
          },
          data: { terminoEn: ahora },
        });

        // Soft-delete de todas las actividades del proyecto
        await tx.actividad.updateMany({
          where: { proyectoId: id, eliminadoEn: null },
          data: { eliminadoEn: ahora },
        });
      }

      // Marcar proyecto como eliminado
      await tx.proyecto.update({
        where: { id },
        data: {
          eliminadoEn: ahora,
          estado: 'CERRADO',
        },
      });

      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: proyecto.organizacionId,
          accion: 'PROYECTO_ELIMINADO',
          tipoEntidad: 'Proyecto',
          entidadId: id,
          valorAnterior: { nombre: proyecto.nombre },
          valorNuevo: { eliminadoEn: ahora, tareasAfectadas: actividadIds.length },
        },
      });
    });

    return { ok: true, id, mensaje: 'Proyecto y sus nodos eliminados exitosamente.' };
  }
}
