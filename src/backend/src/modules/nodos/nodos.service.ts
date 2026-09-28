import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UsuarioActual } from '../../common/usuario-actual.decorator';

/**
 * US-05 y US-06 — mapa de nodos y derivaciones.
 *
 * El arbol expresa composicion: que actividad forma parte de que agrupacion.
 * La derivacion es un hecho historico distinto: que actividad paso de un
 * responsable a otro, cuando y por que motivo.
 */
@Injectable()
export class NodosService {
  constructor(private readonly prisma: PrismaService) {}

  async arbol(u: UsuarioActual, proyectoId?: string) {
    const esTrabajador = u.rol === 'TRABAJADOR';

    // Si se consulta un proyecto especifico, validar organizacion y que el trabajador este asignado
    if (proyectoId) {
      const proyecto = await this.prisma.proyecto.findFirst({
        where: {
          id: proyectoId,
          eliminadoEn: null,
          ...(u.rol === 'SUPER_ADMIN' ? {} : u.organizacionId ? { organizacionId: u.organizacionId } : {}),
        },
        select: {
          id: true,
          propietarioId: true,
          miembros: { select: { usuarioId: true } },
        },
      });

      if (!proyecto) {
        throw new NotFoundException('El proyecto no existe o no tienes acceso.');
      }

      if (esTrabajador) {
        const tieneTarea = await this.prisma.actividad.findFirst({
          where: { proyectoId, responsableId: u.id, eliminadoEn: null },
          select: { id: true },
        });

        const estaAsignado =
          proyecto.propietarioId === u.id ||
          proyecto.miembros.some((m) => m.usuarioId === u.id) ||
          Boolean(tieneTarea);

        if (!estaAsignado) {
          throw new ForbiddenException('No estás asignado a este proyecto.');
        }
      }
    }

    const actividades = await this.prisma.actividad.findMany({
      where: {
        eliminadoEn: null,
        ...(proyectoId
          ? { proyectoId }
          : {
              proyecto: {
                eliminadoEn: null,
                ...(u.rol === 'SUPER_ADMIN' ? {} : u.organizacionId ? { organizacionId: u.organizacionId } : {}),
                ...(esTrabajador
                  ? {
                      OR: [
                        { propietarioId: u.id },
                        { miembros: { some: { usuarioId: u.id } } },
                        { actividades: { some: { responsableId: u.id, eliminadoEn: null } } },
                      ],
                    }
                  : {}),
              },
            }),
      },
      orderBy: [{ actividadPadreId: 'asc' }, { orden: 'asc' }],
      select: {
        id: true,
        titulo: true,
        estado: true,
        prioridad: true,
        actividadPadreId: true,
        posicionNodo: true,
        responsableId: true,
        responsable: { select: { id: true, nombreCompleto: true } },
        // Monedas de cada bolsa: con ellas la vista dibuja cuanto lleva
        // llena la tarea sin pedir el detalle de una en una.
        subtareas: { select: { completada: true } },
      },
    });

    const derivaciones = await this.prisma.derivacion.findMany({
      where: {
        actividad: {
          eliminadoEn: null,
          ...(proyectoId
            ? { proyectoId }
            : {
                proyecto: {
                  ...(u.rol === 'SUPER_ADMIN' ? {} : u.organizacionId ? { organizacionId: u.organizacionId } : {}),
                  ...(esTrabajador
                    ? {
                        OR: [
                          { propietarioId: u.id },
                          { miembros: { some: { usuarioId: u.id } } },
                          { actividades: { some: { responsableId: u.id, eliminadoEn: null } } },
                        ],
                      }
                    : {}),
                },
              }),
        },
      },
      orderBy: { ocurridoEn: 'desc' },
      take: 20,
      select: {
        id: true,
        motivo: true,
        ocurridoEn: true,
        actividad: { select: { titulo: true } },
        deUsuario: { select: { nombreCompleto: true } },
        aUsuario: { select: { nombreCompleto: true } },
      },
    });

    return {
      actividades: actividades.map(({ subtareas, ...a }) => ({
        ...a,
        monedas: subtareas.length,
        monedasListas: subtareas.filter((m) => m.completada).length,
      })),
      derivaciones,
    };
  }
}
