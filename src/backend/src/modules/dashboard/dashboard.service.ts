import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import { organizacionDeAlcance } from '../../common/organizacion';

/** US-09 — indicadores del panel del administrador. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(u: UsuarioActual) {
    const orgId = organizacionDeAlcance(u);
    const whereUsuarioOrg = orgId ? { usuario: { organizacionId: orgId } } : {};
    const whereJornadaOrg = orgId ? { organizacionId: orgId } : {};
    const whereActividadOrg = orgId ? { proyecto: { organizacionId: orgId } } : {};

    const [trabajando, enJornada, porEstado, hoy, semana] = await Promise.all([
      // Quien esta cronometrando en este momento.
      this.prisma.sesionTrabajo.findMany({
        where: { estado: { in: ['ACTIVA', 'PAUSADA'] }, ...whereUsuarioOrg },
        select: {
          id: true,
          estado: true,
          inicioEn: true,
          usuario: { select: { nombreCompleto: true } },
          actividad: { select: { titulo: true } },
        },
      }),
      this.prisma.jornada.count({ where: { terminoEn: null, ...whereJornadaOrg } }),
      this.prisma.actividad.groupBy({
        by: ['estado'],
        where: { eliminadoEn: null, ...whereActividadOrg },
        _count: { _all: true },
      }),
      this.segundos('hoy', orgId),
      this.segundos('semana', orgId),
    ]);

    return {
      trabajandoAhora: trabajando,
      jornadasAbiertas: enJornada,
      actividadesPorEstado: porEstado.map((p) => ({
        estado: p.estado,
        total: p._count._all,
      })),
      segundosHoy: hoy,
      segundosSemana: semana,
    };
  }

  /** Segundos trabajados por todo el equipo en el periodo indicado. */
  private async segundos(periodo: 'hoy' | 'semana', orgId?: string | null): Promise<number> {
    const filas = orgId
      ? await this.prisma.$queryRaw<{ segundos: number }[]>`
          SELECT COALESCE(SUM(
                   EXTRACT(EPOCH FROM (COALESCE(t."terminoEn", now()) - t."inicioEn"))
                 ), 0)::int AS segundos
            FROM tramos_sesion t
            JOIN usuarios u ON u.id = t."usuarioId"
           WHERE u."organizacionId" = ${orgId}::uuid
             AND (t."inicioEn" AT TIME ZONE 'America/Santiago')::date
                 >= (CASE WHEN ${periodo} = 'hoy'
                          THEN (now() AT TIME ZONE 'America/Santiago')::date
                          ELSE (now() AT TIME ZONE 'America/Santiago')::date - 6
                     END)
        `
      : await this.prisma.$queryRaw<{ segundos: number }[]>`
          SELECT COALESCE(SUM(
                   EXTRACT(EPOCH FROM (COALESCE(t."terminoEn", now()) - t."inicioEn"))
                 ), 0)::int AS segundos
            FROM tramos_sesion t
           WHERE (t."inicioEn" AT TIME ZONE 'America/Santiago')::date
                 >= (CASE WHEN ${periodo} = 'hoy'
                          THEN (now() AT TIME ZONE 'America/Santiago')::date
                          ELSE (now() AT TIME ZONE 'America/Santiago')::date - 6
                     END)
        `;
    return Number(filas[0]?.segundos ?? 0);
  }

  /**
   * Métricas individuales de rendimiento para la vista de Trabajador ("Mis Avances / Mi Progreso").
   */
  async progresoPersonal(usuarioId: string) {
    const [semana, mes, dias, jornadas, tareas] = await Promise.all([
      this.prisma.$queryRaw<{ segundos: number }[]>`
        SELECT COALESCE(SUM(
                 EXTRACT(EPOCH FROM (COALESCE(t."terminoEn", now()) - t."inicioEn"))
               ), 0)::int AS segundos
          FROM tramos_sesion t
         WHERE t."usuarioId" = ${usuarioId}::uuid
           AND (t."inicioEn" AT TIME ZONE 'America/Santiago')::date >= date_trunc('week', now() AT TIME ZONE 'America/Santiago')::date
      `,
      this.prisma.$queryRaw<{ segundos: number }[]>`
        SELECT COALESCE(SUM(
                 EXTRACT(EPOCH FROM (COALESCE(t."terminoEn", now()) - t."inicioEn"))
               ), 0)::int AS segundos
          FROM tramos_sesion t
         WHERE t."usuarioId" = ${usuarioId}::uuid
           AND (t."inicioEn" AT TIME ZONE 'America/Santiago')::date >= date_trunc('month', now() AT TIME ZONE 'America/Santiago')::date
      `,
      this.prisma.$queryRaw<{ dias: number }[]>`
        SELECT COUNT(DISTINCT dia)::int AS dias
          FROM (
            SELECT (t."inicioEn" AT TIME ZONE 'America/Santiago')::date AS dia
              FROM tramos_sesion t
             WHERE t."usuarioId" = ${usuarioId}::uuid
               AND (t."inicioEn" AT TIME ZONE 'America/Santiago')::date >= date_trunc('month', now() AT TIME ZONE 'America/Santiago')::date
            UNION
            SELECT (j."inicioEn" AT TIME ZONE 'America/Santiago')::date AS dia
              FROM jornadas j
             WHERE j."usuarioId" = ${usuarioId}::uuid
               AND (j."inicioEn" AT TIME ZONE 'America/Santiago')::date >= date_trunc('month', now() AT TIME ZONE 'America/Santiago')::date
          ) sub
      `,
      this.prisma.jornada.count({
        where: {
          usuarioId,
          inicioEn: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.actividad.groupBy({
        by: ['estado'],
        where: {
          responsableId: usuarioId,
          eliminadoEn: null,
        },
        _count: { _all: true },
      }),
    ]);

    let tareasPendientes = 0;
    let tareasEnProgreso = 0;
    let tareasCompletadas = 0;

    for (const t of tareas) {
      if (t.estado === 'PENDIENTE') tareasPendientes += t._count._all;
      else if (t.estado === 'EN_PROGRESO') tareasEnProgreso += t._count._all;
      else if (t.estado === 'COMPLETADA') tareasCompletadas += t._count._all;
    }

    return {
      segundosSemana: Number(semana[0]?.segundos ?? 0),
      segundosMes: Number(mes[0]?.segundos ?? 0),
      diasLaborados: Number(dias[0]?.dias ?? 0),
      totalJornadas: jornadas,
      tareasPendientes,
      tareasEnProgreso,
      tareasCompletadas,
    };
  }
}
