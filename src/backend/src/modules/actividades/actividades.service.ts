import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CrearActividadDto } from './dto/crear-actividad.dto';
import { ActualizarActividadDto } from './dto/actualizar-actividad.dto';
import { ReasignarActividadDto } from './dto/reasignar-actividad.dto';
import {
  ActualizarSubtareaDto,
  CambiarEstadoActividadDto,
  CrearSubtareaDto,
} from './dto/subtarea.dto';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import {
  exigirOrganizacion,
  filtroActividadOrganizacion,
} from '../../common/organizacion';

/** US-03 y US-04 — consulta de actividades y su tiempo acumulado. */
@Injectable()
export class ActividadesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Actividades del trabajador con el tiempo real acumulado.
   *
   * El tiempo no se almacena en ninguna columna: se calcula sumando los tramos
   * de todas las sesiones de la actividad. Es imposible que un total guardado
   * difiera del detalle, porque no hay total guardado.
   */
  async mias(u: UsuarioActual) {
    const actividades = await this.prisma.actividad.findMany({
      where: { responsableId: u.id, eliminadoEn: null, ...filtroActividadOrganizacion(u) },
      orderBy: [{ estado: 'asc' }, { orden: 'asc' }, { creadoEn: 'asc' }],
      include: {
        proyecto: { select: { nombre: true } },
        subtareas: { orderBy: { orden: 'asc' } },
        responsable: { select: { nombreCompleto: true } },
      },
    });

    const tiempos = await this.segundosPorActividad(
      actividades.map((a) => a.id),
    );

    return actividades.map((a) => ({
      ...a,
      segundosTrabajados: tiempos.get(a.id) ?? 0,
    }));
  }

  async detalle(id: string, u: UsuarioActual) {
    const actividad = await this.prisma.actividad.findFirst({
      where: { id, eliminadoEn: null, ...filtroActividadOrganizacion(u) },
      include: {
        proyecto: { select: { nombre: true } },
        subtareas: { orderBy: { orden: 'asc' } },
        responsable: { select: { id: true, nombreCompleto: true } },
        comentarios: {
          orderBy: { creadoEn: 'desc' },
          include: { autor: { select: { nombreCompleto: true } } },
        },
      },
    });
    if (!actividad) throw new NotFoundException('La actividad no existe.');

    const tiempos = await this.segundosPorActividad([actividad.id]);
    return { ...actividad, segundosTrabajados: tiempos.get(actividad.id) ?? 0 };
  }

  /**
   * Suma de los tramos de cada actividad, en segundos.
   *
   * Se devuelve en segundos y no en minutos redondeados porque una sesion
   * breve —frecuente al probar el sistema— se veria como cero minutos, y el
   * trabajador concluiria que su tiempo no quedo registrado.
   */
  private async segundosPorActividad(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();

    const filas = await this.prisma.$queryRaw<
      { actividadId: string; segundos: number }[]
    >`
      SELECT s."actividadId" AS "actividadId",
             COALESCE(SUM(
               EXTRACT(EPOCH FROM (COALESCE(t."terminoEn", now()) - t."inicioEn"))
             ), 0) AS segundos
        FROM sesiones_trabajo s
        JOIN tramos_sesion t ON t."sesionId" = s.id
       WHERE s."actividadId" = ANY(${ids}::uuid[])
       GROUP BY s."actividadId"
    `;

    return new Map(
      filas.map((f) => [f.actividadId, Math.round(Number(f.segundos))]),
    );
  }

  /** Crea una tarea del mapa de nodos, opcionalmente colgada de otra (US-05). */
  async crear(u: UsuarioActual, dto: CrearActividadDto) {
    // La tarea nace dentro de un proyecto de la propia empresa, nunca de otra.
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id: dto.proyectoId, eliminadoEn: null, organizacionId: exigirOrganizacion(u) },
      select: { id: true },
    });
    if (!proyecto) throw new NotFoundException('El proyecto no existe o no pertenece a tu organizacion.');

    if (dto.actividadPadreId) {
      const padre = await this.prisma.actividad.findFirst({
        where: { id: dto.actividadPadreId, proyectoId: dto.proyectoId, eliminadoEn: null },
        select: { id: true },
      });
      if (!padre) throw new BadRequestException('La tarea padre no pertenece a este proyecto.');
    }

    return this.prisma.actividad.create({
      data: {
        proyectoId: dto.proyectoId,
        titulo: dto.titulo,
        actividadPadreId: dto.actividadPadreId ?? null,
        responsableId: u.id,
      },
      select: {
        id: true,
        titulo: true,
        estado: true,
        prioridad: true,
        actividadPadreId: true,
        posicionNodo: true,
        responsable: { select: { nombreCompleto: true } },
      },
    });
  }

  /**
   * Reasigna el padre de una tarea en el arbol de nodos (o la vuelve raiz con
   * `null`). Rechaza el cambio si crea un ciclo: una tarea no puede terminar
   * colgando de su propio descendiente.
   */
  async actualizarPadre(id: string, u: UsuarioActual, dto: ActualizarActividadDto) {
    const actividad = await this.prisma.actividad.findFirst({
      where: { id, eliminadoEn: null, ...filtroActividadOrganizacion(u) },
      select: { id: true, proyectoId: true },
    });
    if (!actividad) throw new NotFoundException('La actividad no existe.');

    const nuevoPadreId = dto.actividadPadreId ?? null;

    if (nuevoPadreId) {
      if (nuevoPadreId === id) {
        throw new BadRequestException('Una tarea no puede ser padre de si misma.');
      }

      const padre = await this.prisma.actividad.findFirst({
        where: { id: nuevoPadreId, proyectoId: actividad.proyectoId, eliminadoEn: null },
        select: { id: true },
      });
      if (!padre) throw new BadRequestException('La tarea padre no pertenece a este proyecto.');

      // Camina hacia arriba desde el padre propuesto: si en el camino aparece
      // la propia tarea, el cambio la colgaria de su descendiente.
      let cursor: string | null = nuevoPadreId;
      for (let saltos = 0; cursor && saltos < 200; saltos++) {
        if (cursor === id) {
          throw new BadRequestException(
            'Ese cambio formaria un ciclo: la tarea no puede depender de su propia rama.',
          );
        }
        const fila: { actividadPadreId: string | null } | null =
          await this.prisma.actividad.findUnique({
            where: { id: cursor },
            select: { actividadPadreId: true },
          });
        cursor = fila?.actividadPadreId ?? null;
      }
    }

    return this.prisma.actividad.update({
      where: { id },
      data: { actividadPadreId: nuevoPadreId },
      select: {
        id: true,
        titulo: true,
        estado: true,
        prioridad: true,
        actividadPadreId: true,
        posicionNodo: true,
        responsable: { select: { nombreCompleto: true } },
      },
    });
  }

  /**
   * US-06 — derivar la tarea a otra persona. Queda el traspaso registrado
   * (quien, a quien, motivo) y la persona nueva pasa a ver la tarea en su
   * mapa y el proyecto en su panel. Si no era miembro del proyecto, se la
   * agrega, para que el equipo del proyecto refleje quien trabaja en el.
   */
  async reasignar(id: string, u: UsuarioActual, dto: ReasignarActividadDto) {
    const actorId = u.id;
    const actividad = await this.prisma.actividad.findFirst({
      where: { id, eliminadoEn: null, ...filtroActividadOrganizacion(u) },
      select: {
        id: true,
        proyectoId: true,
        responsableId: true,
        proyecto: { select: { organizacionId: true } },
      },
    });
    if (!actividad) throw new NotFoundException('La actividad no existe.');
    if (actividad.responsableId === dto.usuarioId) {
      throw new BadRequestException('Esa persona ya es responsable de la tarea.');
    }

    // El nuevo responsable debe ser de la misma empresa que el proyecto: si no,
    // se lo haria miembro y veria un proyecto ajeno en su panel.
    const organizacionId = actividad.proyecto.organizacionId;
    const nuevo = await this.prisma.usuario.findFirst({
      where: { id: dto.usuarioId, organizacionId },
      select: { id: true, activo: true },
    });
    if (!nuevo) throw new NotFoundException('El usuario no existe o no pertenece a tu organizacion.');
    if (!nuevo.activo) throw new BadRequestException('El usuario esta desactivado.');

    await this.prisma.$transaction(async (tx) => {
      await tx.actividad.update({
        where: { id },
        data: { responsableId: dto.usuarioId },
      });
      await tx.derivacion.create({
        data: {
          actividadId: id,
          deUsuarioId: actividad.responsableId,
          aUsuarioId: dto.usuarioId,
          motivo: dto.motivo.trim(),
        },
      });
      const yaMiembro = await tx.miembroProyecto.findUnique({
        where: { proyectoId_usuarioId: { proyectoId: actividad.proyectoId, usuarioId: dto.usuarioId } },
        select: { usuarioId: true },
      });
      if (!yaMiembro) {
        await tx.miembroProyecto.create({
          data: { proyectoId: actividad.proyectoId, usuarioId: dto.usuarioId },
        });
      }
      await tx.registroAuditoria.create({
        data: {
          actorId,
          organizacionId,
          accion: 'ACTIVIDAD_REASIGNADA',
          tipoEntidad: 'Actividad',
          entidadId: id,
          valorAnterior: { responsableId: actividad.responsableId },
          valorNuevo: { responsableId: dto.usuarioId, motivo: dto.motivo.trim() },
        },
      });
    });

    return this.detalle(id, u);
  }

  // ------------------------------------------------------------- monedas
  //
  // Las subtareas son las monedas de la bolsa: la tarea se ve llena en la
  // medida en que sus monedas estan marcadas. Sin monedas, el llenado lo da
  // el estado de la propia tarea.

  /**
   * Solo el responsable de la tarea o alguien con permiso de gestion pueden
   * tocar sus monedas: de otro modo cualquiera podria dar por terminado el
   * trabajo de otra persona.
   */
  private async asegurarPuedeEditar(actividadId: string, u: UsuarioActual) {
    const actividad = await this.prisma.actividad.findFirst({
      where: { id: actividadId, eliminadoEn: null, ...filtroActividadOrganizacion(u) },
      select: { id: true, responsableId: true, proyecto: { select: { organizacionId: true } } },
    });
    if (!actividad) throw new NotFoundException('La actividad no existe.');

    const puedeGestionar = u.permisos.includes('actividades:gestionar');
    if (actividad.responsableId !== u.id && !puedeGestionar) {
      throw new ForbiddenException('Esta tarea no esta asignada a ti.');
    }
    return actividad;
  }

  async crearSubtarea(actividadId: string, u: UsuarioActual, dto: CrearSubtareaDto) {
    await this.asegurarPuedeEditar(actividadId, u);

    const ultima = await this.prisma.subtarea.findFirst({
      where: { actividadId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    return this.prisma.subtarea.create({
      data: {
        actividadId,
        titulo: dto.titulo.trim(),
        orden: (ultima?.orden ?? -1) + 1,
      },
      select: { id: true, titulo: true, completada: true, orden: true },
    });
  }

  async actualizarSubtarea(subtareaId: string, u: UsuarioActual, dto: ActualizarSubtareaDto) {
    const subtarea = await this.prisma.subtarea.findUnique({
      where: { id: subtareaId },
      select: { id: true, actividadId: true },
    });
    if (!subtarea) throw new NotFoundException('La microtarea no existe.');
    await this.asegurarPuedeEditar(subtarea.actividadId, u);

    return this.prisma.subtarea.update({
      where: { id: subtareaId },
      data: {
        ...(dto.completada !== undefined ? { completada: dto.completada } : {}),
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
      },
      select: { id: true, titulo: true, completada: true, orden: true },
    });
  }

  async eliminarSubtarea(subtareaId: string, u: UsuarioActual) {
    const subtarea = await this.prisma.subtarea.findUnique({
      where: { id: subtareaId },
      select: { id: true, actividadId: true },
    });
    if (!subtarea) throw new NotFoundException('La microtarea no existe.');
    await this.asegurarPuedeEditar(subtarea.actividadId, u);

    await this.prisma.subtarea.delete({ where: { id: subtareaId } });
    return { ok: true };
  }

  /**
   * Comprueba que la tarea tenga con que respaldar el trabajo hecho.
   *
   * La evidencia solo puede adjuntarse mientras la tarea sigue abierta —el
   * modulo de evidencias rechaza los archivos de una tarea completada—, de
   * modo que si se permitiera cerrarla sin ninguna, el respaldo quedaria
   * imposible para siempre.
   */
  async exigirEvidencia(actividadId: string) {
    const adjuntos = await this.prisma.evidencia.count({ where: { actividadId } });
    if (adjuntos === 0) {
      throw new BadRequestException(
        'Adjunta al menos una evidencia del trabajo hecho antes de dar la tarea por terminada.',
      );
    }
  }

  /**
   * Guarda la bolsa en el cofre (COMPLETADA) o la saca de vuelta.
   *
   * No se puede dar por terminada una tarea con el cronometro corriendo: el
   * tiempo quedaria colgando en una sesion abierta de una tarea ya cerrada.
   */
  async cambiarEstado(id: string, u: UsuarioActual, dto: CambiarEstadoActividadDto) {
    const actividad = await this.asegurarPuedeEditar(id, u);

    if (dto.estado === 'COMPLETADA') {
      const sesionViva = await this.prisma.sesionTrabajo.findFirst({
        where: { actividadId: id, estado: { in: ['ACTIVA', 'PAUSADA'] } },
        select: { id: true },
      });
      if (sesionViva) {
        throw new BadRequestException(
          'Cierra primero el cronometro de esta tarea para guardarla en el cofre.',
        );
      }
      await this.exigirEvidencia(id);
    }

    await this.prisma.$transaction(async (tx) => {
      // Guardarla fija cuando termino; sacarla del cofre la reabre.
      await tx.actividad.update({
        where: { id },
        data: {
          estado: dto.estado,
          completadaEn: dto.estado === 'COMPLETADA' ? new Date() : null,
        },
      });
      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: actividad.proyecto.organizacionId,
          accion: 'ACTIVIDAD_CAMBIO_ESTADO',
          tipoEntidad: 'Actividad',
          entidadId: id,
          valorNuevo: { estado: dto.estado, responsableId: actividad.responsableId },
        },
      });
    });

    return this.detalle(id, u);
  }

  /**
   * Elimina un nodo (actividad) y todos sus subnodos descendientes.
   * Exclusivo para Administrador y Super Admin.
   */
  async eliminar(id: string, u: UsuarioActual) {
    if (u.rol !== 'ADMINISTRADOR' && u.rol !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo un administrador puede eliminar nodos o tareas.');
    }

    const actividad = await this.prisma.actividad.findFirst({
      where: { id, eliminadoEn: null, ...filtroActividadOrganizacion(u) },
      include: {
        proyecto: { select: { id: true, organizacionId: true } },
      },
    });

    if (!actividad) {
      throw new NotFoundException('La actividad no existe o ya fue eliminada.');
    }

    // Buscar recursivamente todas las ramas hijas descendientes
    const todosDescendientesIds: string[] = [id];
    let capaActual = [id];
    while (capaActual.length > 0) {
      const hijas: { id: string }[] = await this.prisma.actividad.findMany({
        where: { actividadPadreId: { in: capaActual }, eliminadoEn: null },
        select: { id: true },
      });
      if (hijas.length === 0) break;
      const idsHijas = hijas.map((h) => h.id);
      todosDescendientesIds.push(...idsHijas);
      capaActual = idsHijas;
    }

    const ahora = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Cerrar cualquier sesión activa o pausada en estos nodos
      await tx.sesionTrabajo.updateMany({
        where: {
          actividadId: { in: todosDescendientesIds },
          estado: { in: ['ACTIVA', 'PAUSADA'] },
        },
        data: {
          estado: 'AUTOCERRADA',
          desenlace: 'INCONCLUSA',
          notaCierre: 'Sesión cerrada automáticamente por eliminación de la tarea.',
          terminoEn: ahora,
          actualizadoEn: ahora,
        },
      });

      // 2. Cerrar tramos de cronómetro abiertos
      await tx.tramoSesion.updateMany({
        where: {
          sesion: { actividadId: { in: todosDescendientesIds } },
          terminoEn: null,
        },
        data: { terminoEn: ahora },
      });

      // 3. Marcar borrado lógico de todas las actividades descendientes y la principal
      await tx.actividad.updateMany({
        where: { id: { in: todosDescendientesIds } },
        data: { eliminadoEn: ahora },
      });

      // 4. Registro de auditoría
      await tx.registroAuditoria.create({
        data: {
          actorId: u.id,
          organizacionId: actividad.proyecto.organizacionId,
          accion: 'ACTIVIDAD_ELIMINADA',
          tipoEntidad: 'Actividad',
          entidadId: id,
          valorAnterior: { titulo: actividad.titulo },
          valorNuevo: { eliminadoEn: ahora, descendientesEliminados: todosDescendientesIds.length - 1 },
        },
      });
    });

    return {
      ok: true,
      id,
      totalEliminados: todosDescendientesIds.length,
      mensaje: `Nodo "${actividad.titulo}" y ${todosDescendientesIds.length - 1} subnodo(s) eliminados exitosamente.`,
    };
  }
}
