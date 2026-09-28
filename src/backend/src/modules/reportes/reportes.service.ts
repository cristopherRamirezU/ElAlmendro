import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * US-07 — agregacion de horas.
 *
 * Todas las consultas resuelven la suma dentro del motor y convierten a la zona
 * local en la propia consulta. Un dia en Santiago no coincide con un dia en
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
               (t."inicioEn" AT TIME ZONE 'America/Santiago')::date, 'YYYY-MM-DD'
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
       WHERE (s."inicioEn" AT TIME ZONE 'America/Santiago')::date = ${fecha}::date
         AND (${usuarioId ?? null}::uuid IS NULL OR s."usuarioId" = ${usuarioId ?? null}::uuid)
         AND (${organizacionId ?? null}::uuid IS NULL OR u."organizacionId" = ${organizacionId ?? null}::uuid)
       GROUP BY s.id, a.titulo, u."nombreCompleto"
       ORDER BY s."inicioEn"
    `;
  }

  /** Horas por trabajador en un periodo. */
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
             COUNT(DISTINCT (t."inicioEn" AT TIME ZONE 'America/Santiago')::date)::int AS dias
        FROM usuarios u
   LEFT JOIN organizaciones o ON o.id = u."organizacionId"
        JOIN sesiones_trabajo s ON s."usuarioId" = u.id
        JOIN tramos_sesion    t ON t."sesionId"  = s.id
       WHERE t."terminoEn" IS NOT NULL
         AND t."inicioEn" >= ${desde}
         AND t."inicioEn" < ${hasta}
         AND (${organizacionId ?? null}::uuid IS NULL OR u."organizacionId" = ${organizacionId ?? null}::uuid)
       GROUP BY u.id, u."nombreCompleto", o.nombre
       ORDER BY segundos DESC
    `;

    return filas.map((f) => ({ ...f, segundos: Number(f.segundos) }));
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
}
