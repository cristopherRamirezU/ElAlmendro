import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * US-07 — agregacion de horas.
 *
 * Todas las consultas resuelven la suma dentro del motor y convierten a la zona
 * de cada trabajador (usuarios."zonaHoraria") en la propia consulta. Un dia
 * local no coincide con un dia en
 * UTC, de modo que agrupar por la fecha UTC repartiria mal las horas de las
 * primeras y ultimas horas de cada jornada.
 */
@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Horas trabajadas por dia local, para pintar el calendario. */
  async calendario(desde: Date, hasta: Date, usuarioId?: string, organizacionId?: string | null) {
    const filas = await this.prisma.$queryRaw<
      { dia: string; segundos: number; sesiones: number }[]
    >`
      SELECT to_char(
               (t."inicioEn" AT TIME ZONE u."zonaHoraria")::date, 'YYYY-MM-DD'
             ) AS dia,
             SUM(EXTRACT(EPOCH FROM (t."terminoEn" - t."inicioEn"))) AS segundos,
             COUNT(DISTINCT t."sesionId")::int AS sesiones
        FROM tramos_sesion t
        JOIN usuarios u ON u.id = t."usuarioId"
       WHERE t."terminoEn" IS NOT NULL
         AND t."inicioEn" >= ${desde}
         AND t."inicioEn" < ${hasta}
         AND (${usuarioId ?? null}::uuid IS NULL OR t."usuarioId" = ${usuarioId ?? null}::uuid)
         AND (${organizacionId ?? null}::uuid IS NULL OR u."organizacionId" = ${organizacionId ?? null}::uuid)
       GROUP BY dia
       ORDER BY dia
    `;

    return filas.map((f) => ({
      dia: f.dia,
      segundos: Math.round(Number(f.segundos)),
      sesiones: Number(f.sesiones),
    }));
  }

  /** Detalle de un dia local: la linea de tiempo de sus sesiones. */
  async dia(fecha: string, usuarioId?: string, organizacionId?: string | null) {
    return this.prisma.$queryRaw<any[]>`
      SELECT s.id,
             a.titulo                AS actividad,
             u."nombreCompleto"      AS trabajador,
             s."inicioEn",
             s."terminoEn",
             s.estado,
             s.desenlace,
             s."notaCierre",
             COALESCE(SUM(
               EXTRACT(EPOCH FROM (COALESCE(t."terminoEn", now()) - t."inicioEn"))
             ), 0)::int              AS segundos
        FROM sesiones_trabajo s
        JOIN actividades a ON a.id = s."actividadId"
        JOIN usuarios    u ON u.id = s."usuarioId"
        LEFT JOIN tramos_sesion t ON t."sesionId" = s.id
       WHERE (s."inicioEn" AT TIME ZONE u."zonaHoraria")::date = ${fecha}::date
         AND (${usuarioId ?? null}::uuid IS NULL OR s."usuarioId" = ${usuarioId ?? null}::uuid)
         AND (${organizacionId ?? null}::uuid IS NULL OR u."organizacionId" = ${organizacionId ?? null}::uuid)
       GROUP BY s.id, a.titulo, u."nombreCompleto"
       ORDER BY s."inicioEn"
    `;
  }

  /**
   * Horas por trabajador en un periodo.
   *
   * - marcajes: cuantas veces marco el inicio de su dia (jornadas abiertas en el periodo).
   * - nodos: en cuantos proyectos distintos trabajo.
   * - actividades: en cuantas tareas distintas trabajo.
   */
  async porTrabajador(desde: Date, hasta: Date, organizacionId?: string | null) {
    const filas = await this.prisma.$queryRaw<any[]>`
      SELECT u.id,
             u."nombreCompleto"                      AS trabajador,
             o.nombre                                AS "organizacionNombre",
             COALESCE(SUM(
               EXTRACT(EPOCH FROM (t."terminoEn" - t."inicioEn"))
             ), 0)::int                              AS segundos,
             COUNT(DISTINCT s.id)::int               AS sesiones,
             COUNT(DISTINCT s."actividadId")::int    AS actividades,
             COUNT(DISTINCT a."proyectoId")::int     AS nodos,
             (SELECT COUNT(*)
                FROM jornadas j
               WHERE j."usuarioId" = u.id
                 AND j."inicioEn" >= ${desde}
                 AND j."inicioEn" < ${hasta})::int   AS marcajes,
             COUNT(DISTINCT (t."inicioEn" AT TIME ZONE u."zonaHoraria")::date)::int AS dias
        FROM usuarios u
   LEFT JOIN organizaciones o ON o.id = u."organizacionId"
        JOIN sesiones_trabajo s ON s."usuarioId" = u.id
        JOIN actividades      a ON a.id = s."actividadId"
        JOIN tramos_sesion    t ON t."sesionId"  = s.id
       WHERE t."terminoEn" IS NOT NULL
         AND t."inicioEn" >= ${desde}
         AND t."inicioEn" < ${hasta}
         AND (${organizacionId ?? null}::uuid IS NULL OR u."organizacionId" = ${organizacionId ?? null}::uuid)
       GROUP BY u.id, u."nombreCompleto", o.nombre
       ORDER BY segundos DESC
    `;

    return filas.map((f) => ({
      ...f,
      segundos: Number(f.segundos),
      marcajes: Number(f.marcajes),
      nodos: Number(f.nodos),
      // Promedio por dia trabajado; lo usa tambien la exportacion.
      promedioDiario: Math.round(Number(f.segundos) / Math.max(1, Number(f.dias))),
    }));
  }

  /** Reparto de horas por actividad, para el grafico del reporte. */
  async porActividad(desde: Date, hasta: Date, organizacionId?: string | null) {
    const filas = await this.prisma.$queryRaw<any[]>`
      SELECT a.titulo                    AS actividad,
             a.estado,
             o.nombre                    AS "organizacionNombre",
             COALESCE(SUM(
               EXTRACT(EPOCH FROM (t."terminoEn" - t."inicioEn"))
             ), 0)::int                  AS segundos
        FROM actividades a
        JOIN proyectos   p ON p.id = a."proyectoId"
   LEFT JOIN organizaciones o ON o.id = p."organizacionId"
        JOIN sesiones_trabajo s ON s."actividadId" = a.id
        JOIN tramos_sesion    t ON t."sesionId"    = s.id
       WHERE t."terminoEn" IS NOT NULL
         AND t."inicioEn" >= ${desde}
         AND t."inicioEn" < ${hasta}
         AND (${organizacionId ?? null}::uuid IS NULL OR p."organizacionId" = ${organizacionId ?? null}::uuid)
       GROUP BY a.id, a.titulo, a.estado, o.nombre
       ORDER BY segundos DESC
       LIMIT 12
    `;

    return filas.map((f) => ({ ...f, segundos: Number(f.segundos) }));
  }

  /**
   * Carta Gantt con detalle diario por actividad dentro del periodo pedido.
   *
   * Combina la linea de vida de cada tarea (creacion, primer cronometro, fecha
   * limite y cierre) con los segundos imputados en cada dia local para pintar
   * actividad real sobre el calendario diario.
   */
  async ganttPorDia(desde: Date, hasta: Date, organizacionId?: string | null) {
    const actividades = await this.prisma.actividad.findMany({
      where: {
        eliminadoEn: null,
        proyecto: {
          eliminadoEn: null,
          ...(organizacionId ? { organizacionId } : {}),
        },
      },
      orderBy: [{ proyecto: { nombre: 'asc' } }, { creadoEn: 'asc' }],
      select: {
        id: true,
        titulo: true,
        estado: true,
        prioridad: true,
        actividadPadreId: true,
        creadoEn: true,
        fechaLimite: true,
        completadaEn: true,
        proyecto: {
          select: {
            id: true,
            nombre: true,
            organizacion: { select: { nombre: true } },
          },
        },
        responsable: { select: { nombreCompleto: true } },
      },
    });

    if (actividades.length === 0) return [];

    const ids = actividades.map((a) => a.id);

    const [filasDias, sesionesPorActividad] = await Promise.all([
      this.prisma.$queryRaw<{ actividadId: string; dia: string; segundos: number }[]>`
        SELECT s."actividadId" AS "actividadId",
               to_char((t."inicioEn" AT TIME ZONE u."zonaHoraria")::date, 'YYYY-MM-DD') AS dia,
               COALESCE(SUM(EXTRACT(EPOCH FROM (t."terminoEn" - t."inicioEn"))), 0)::int AS segundos
          FROM tramos_sesion t
          JOIN sesiones_trabajo s ON s.id = t."sesionId"
          JOIN usuarios u ON u.id = t."usuarioId"
         WHERE t."terminoEn" IS NOT NULL
           AND t."inicioEn" >= ${desde}
           AND t."inicioEn" < ${hasta}
           AND (${organizacionId ?? null}::uuid IS NULL OR u."organizacionId" = ${organizacionId ?? null}::uuid)
         GROUP BY s."actividadId", dia
         ORDER BY dia
      `,
      this.prisma.sesionTrabajo.groupBy({
        by: ['actividadId'],
        where: { actividadId: { in: ids } },
        _min: { inicioEn: true },
        _max: { terminoEn: true },
      }),
    ]);

    const diasPorActividad = new Map<string, { dia: string; segundos: number }[]>();
    const totalPorActividad = new Map<string, number>();
    for (const fila of filasDias) {
      const segundos = Number(fila.segundos);
      const lista = diasPorActividad.get(fila.actividadId) ?? [];
      lista.push({ dia: fila.dia, segundos });
      diasPorActividad.set(fila.actividadId, lista);
      totalPorActividad.set(fila.actividadId, (totalPorActividad.get(fila.actividadId) ?? 0) + segundos);
    }

    const rangoSesiones = new Map(
      sesionesPorActividad.map((s) => [
        s.actividadId,
        { inicio: s._min.inicioEn, termino: s._max.terminoEn },
      ]),
    );

    const padres = new Set(
      actividades.map((a) => a.actividadPadreId).filter((id): id is string => Boolean(id)),
    );
    const ahora = new Date();

    const resultado = actividades
      .filter((a) => {
        const dias = diasPorActividad.get(a.id) ?? [];
        const ses = rangoSesiones.get(a.id);
        // Excluir agrupadores puros que no tienen trabajo propio registrado.
        if (padres.has(a.id) && !ses?.inicio && dias.length === 0) return false;
        if (dias.length > 0) return true;

        const inicioRef = ses?.inicio ?? a.creadoEn;
        const finRef = a.completadaEn ?? a.fechaLimite ?? ses?.termino ?? ahora;
        return inicioRef < hasta && (finRef >= desde || a.creadoEn >= desde);
      })
      .map((a) => {
        const ses = rangoSesiones.get(a.id);
        return {
          id: a.id,
          titulo: a.titulo,
          estado: a.estado,
          prioridad: a.prioridad,
          proyectoId: a.proyecto.id,
          proyectoNombre: a.proyecto.nombre,
          organizacionNombre: a.proyecto.organizacion?.nombre ?? null,
          responsableNombre: a.responsable?.nombreCompleto ?? null,
          creadoEn: a.creadoEn,
          inicioTrabajoEn: ses?.inicio ?? null,
          ultimoTrabajoEn: ses?.termino ?? null,
          fechaLimite: a.fechaLimite,
          completadaEn: a.completadaEn,
          segundosPeriodo: totalPorActividad.get(a.id) ?? 0,
          diasTrabajados: diasPorActividad.get(a.id) ?? [],
        };
      });

    resultado.sort((a, b) => {
      const cmpProy = a.proyectoNombre.localeCompare(b.proyectoNombre, 'es');
      if (cmpProy !== 0) return cmpProy;
      const ia = (a.inicioTrabajoEn ?? a.creadoEn).getTime();
      const ib = (b.inicioTrabajoEn ?? b.creadoEn).getTime();
      if (ia !== ib) return ia - ib;
      return a.titulo.localeCompare(b.titulo, 'es');
    });

    return resultado.slice(0, 80);
  }
}
