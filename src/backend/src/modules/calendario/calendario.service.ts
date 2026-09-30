import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * US-07 — calendario del administrador.
 *
 * Dos consultas cubren las tres vistas de la pantalla: `resumen` alimenta la
 * rejilla mensual y la matriz trabajador x dia; `detalle` alimenta el panel de
 * un dia y la vista semanal por horas.
 *
 * Toda conversion de zona horaria ocurre dentro del motor. Un dia en Santiago
 * no coincide con un dia en UTC y el desfase cambia con el horario de verano:
 * calcular esos limites en JavaScript reintroduce el riesgo RA-02.
 *
 * Un tramo o una jornada se atribuyen enteros al dia local en que empiezan,
 * aunque crucen medianoche: en trabajo freelance las tandas nocturnas son
 * habituales y partirlas contaria mal las horas de ambos dias.
 *
 * Una jornada sin cerrar se cuenta hasta el ultimo rastro de actividad de sus
 * sesiones, no hasta ahora: de otro modo una jornada abandonada sumaria dias
 * enteros de presencia. Recortarla al fin del dia tampoco sirve, porque dejaria
 * la presencia por debajo de las horas imputadas cuando el trabajo cruza
 * medianoche, y nadie puede imputar mas tiempo del que estuvo presente.
 */
@Injectable()
export class CalendarioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Diferencia a partir de la cual la presencia sin imputar deja de ser ruido y
   * pasa a ser una anomalia que el administrador deberia mirar. Hora y media es
   * el margen razonable de un almuerzo mas interrupciones sueltas.
   */
  private static readonly MARGEN_PRESENCIA = 90 * 60;

  /** Tope de dias por consulta, para que un rango absurdo no castigue al motor. */
  private static readonly MAXIMO_DIAS = 366;

  // ------------------------------------------------------------------ resumen

  /**
   * Matriz completa dia x trabajador del rango, con la serie de dias entera
   * —incluidos los que no tienen registro— y el acumulado por dia ya resuelto.
   */
  async resumen(organizacionId: string, desde: string, hasta: string, trabajadorId?: string) {
    const dias = this.serieDeDias(desde, hasta);
    const filtro = trabajadorId ?? null;

    const [trabajadores, celdas] = await Promise.all([
      this.trabajadores(organizacionId, filtro),
      this.prisma.$queryRaw<FilaCelda[]>`
        WITH dias AS (
          SELECT generate_series(${desde}::date, ${hasta}::date, interval '1 day')::date AS dia
        ),
        equipo AS (
          SELECT u.id, u."nombreCompleto"
            FROM usuarios u
           WHERE u.rol = 'TRABAJADOR'
             AND u.activo = true
             AND u."organizacionId" = ${organizacionId}::uuid
             AND (${filtro}::uuid IS NULL OR u.id = ${filtro}::uuid)
        ),
        imputado AS (
          SELECT (t."inicioEn" AT TIME ZONE 'America/Santiago')::date AS dia,
                 t."usuarioId",
                 SUM(EXTRACT(EPOCH FROM (
                   COALESCE(t."terminoEn", now()) - t."inicioEn"
                 )))::int                          AS segundos,
                 COUNT(DISTINCT t."sesionId")::int AS sesiones
            FROM tramos_sesion t
           WHERE t."inicioEn" >= ((${desde}::date)::timestamp AT TIME ZONE 'America/Santiago')
             AND t."inicioEn" <  (((${hasta}::date) + 1)::timestamp AT TIME ZONE 'America/Santiago')
           GROUP BY 1, 2
        ),
        presencia AS (
          SELECT (j."inicioEn" AT TIME ZONE 'America/Santiago')::date AS dia,
                 j."usuarioId",
                 SUM(EXTRACT(EPOCH FROM (
                   COALESCE(
                     j."terminoEn",
                     (SELECT MAX(COALESCE(t2."terminoEn", now()))
                        FROM tramos_sesion t2
                        JOIN sesiones_trabajo s2 ON s2.id = t2."sesionId"
                       WHERE s2."jornadaId" = j.id),
                     j."inicioEn"
                   ) - j."inicioEn"
                 )))::int                                          AS segundos,
                 COUNT(*) FILTER (WHERE j."terminoEn" IS NULL)::int AS abiertas
            FROM jornadas j
           WHERE j."inicioEn" >= ((${desde}::date)::timestamp AT TIME ZONE 'America/Santiago')
             AND j."inicioEn" <  (((${hasta}::date) + 1)::timestamp AT TIME ZONE 'America/Santiago')
           GROUP BY 1, 2
        ),
        banderas AS (
          SELECT (s."inicioEn" AT TIME ZONE 'America/Santiago')::date AS dia,
                 s."usuarioId",
                 COUNT(*) FILTER (WHERE s.estado = 'AUTOCERRADA')::int   AS autocerradas,
                 COUNT(*) FILTER (WHERE s.desenlace = 'INCONCLUSA')::int AS inconclusas
            FROM sesiones_trabajo s
           WHERE s."inicioEn" >= ((${desde}::date)::timestamp AT TIME ZONE 'America/Santiago')
             AND s."inicioEn" <  (((${hasta}::date) + 1)::timestamp AT TIME ZONE 'America/Santiago')
           GROUP BY 1, 2
        )
        SELECT to_char(d.dia, 'YYYY-MM-DD') AS fecha,
               w.id                         AS "trabajadorId",
               w."nombreCompleto"           AS trabajador,
               COALESCE(i.segundos, 0)      AS "segundosImputados",
               COALESCE(i.sesiones, 0)      AS sesiones,
               COALESCE(p.segundos, 0)      AS "segundosPresencia",
               COALESCE(p.abiertas, 0)      AS "jornadasAbiertas",
               COALESCE(b.autocerradas, 0)  AS autocerradas,
               COALESCE(b.inconclusas, 0)   AS inconclusas
          FROM dias d
         CROSS JOIN equipo w
          LEFT JOIN imputado  i ON i.dia = d.dia AND i."usuarioId" = w.id
          LEFT JOIN presencia p ON p.dia = d.dia AND p."usuarioId" = w.id
          LEFT JOIN banderas  b ON b.dia = d.dia AND b."usuarioId" = w.id
         ORDER BY d.dia, w."nombreCompleto"
      `,
    ]);

    return {
      desde,
      hasta,
      trabajadores,
      celdas: celdas.map((c) => this.celda(c)),
      dias: this.acumularPorDia(dias, celdas),
    };
  }

  // ------------------------------------------------------------------ detalle

  /**
   * Sesiones, tramos y jornadas del rango, agrupados por dia y por trabajador.
   * Con `desde === hasta` sirve al panel de un dia; con lunes a domingo, a la
   * vista semanal. Es la misma forma de datos en ambos casos.
   */
  async detalle(organizacionId: string, desde: string, hasta: string, trabajadorId?: string) {
    const dias = this.serieDeDias(desde, hasta);
    const filtro = trabajadorId ?? null;

    const [trabajadores, sesiones, jornadas] = await Promise.all([
      this.trabajadores(organizacionId, filtro),
      this.prisma.$queryRaw<FilaSesion[]>`
        SELECT s.id,
               to_char((s."inicioEn" AT TIME ZONE 'America/Santiago')::date, 'YYYY-MM-DD') AS fecha,
               s."usuarioId",
               s."inicioEn",
               s."terminoEn",
               s.estado,
               s.desenlace,
               s."notaCierre",
               s."cerradaAutomaticamente",
               a.titulo AS actividad,
               p.nombre AS proyecto
          FROM sesiones_trabajo s
          JOIN actividades a ON a.id = s."actividadId"
          JOIN proyectos   p ON p.id = a."proyectoId"
         WHERE p."organizacionId" = ${organizacionId}::uuid
           AND s."inicioEn" >= ((${desde}::date)::timestamp AT TIME ZONE 'America/Santiago')
           AND s."inicioEn" <  (((${hasta}::date) + 1)::timestamp AT TIME ZONE 'America/Santiago')
           AND (${filtro}::uuid IS NULL OR s."usuarioId" = ${filtro}::uuid)
         ORDER BY s."inicioEn"
      `,
      this.prisma.$queryRaw<FilaJornada[]>`
        SELECT j.id,
               to_char((j."inicioEn" AT TIME ZONE 'America/Santiago')::date, 'YYYY-MM-DD') AS fecha,
               j."usuarioId",
               j."inicioEn",
               j."terminoEn",
               j.estado,
               j."cerradaAutomaticamente",
               EXTRACT(EPOCH FROM (
                 COALESCE(
                   j."terminoEn",
                   (SELECT MAX(COALESCE(t2."terminoEn", now()))
                      FROM tramos_sesion t2
                      JOIN sesiones_trabajo s2 ON s2.id = t2."sesionId"
                     WHERE s2."jornadaId" = j.id),
                   j."inicioEn"
                 ) - j."inicioEn"
               ))::int AS segundos
          FROM jornadas j
         WHERE j."organizacionId" = ${organizacionId}::uuid
           AND j."inicioEn" >= ((${desde}::date)::timestamp AT TIME ZONE 'America/Santiago')
           AND j."inicioEn" <  (((${hasta}::date) + 1)::timestamp AT TIME ZONE 'America/Santiago')
           AND (${filtro}::uuid IS NULL OR j."usuarioId" = ${filtro}::uuid)
         ORDER BY j."inicioEn"
      `,
    ]);

    // Los tramos son lo que dibuja las barras de la linea de tiempo: sin ellos
    // una sesion con pausas se veria como un bloque continuo que nunca existio.
    const tramos = sesiones.length
      ? await this.prisma.tramoSesion.findMany({
          where: { sesionId: { in: sesiones.map((s) => s.id) } },
          select: { sesionId: true, inicioEn: true, terminoEn: true },
          orderBy: { inicioEn: 'asc' },
        })
      : [];

    const porSesion = new Map<string, Tramo[]>();
    for (const t of tramos) {
      const lista = porSesion.get(t.sesionId) ?? [];
      lista.push({ inicioEn: t.inicioEn, terminoEn: t.terminoEn });
      porSesion.set(t.sesionId, lista);
    }

    return {
      desde,
      hasta,
      trabajadores,
      dias: dias.map((fecha) => {
        const filas = trabajadores.map((w) => {
          const suyas = sesiones
            .filter((s) => s.fecha === fecha && s.usuarioId === w.id)
            .map((s) => {
              const propios = porSesion.get(s.id) ?? [];
              return {
                id: s.id,
                actividad: s.actividad,
                proyecto: s.proyecto,
                estado: s.estado,
                desenlace: s.desenlace,
                notaCierre: s.notaCierre,
                cerradaAutomaticamente: s.cerradaAutomaticamente,
                inicioEn: s.inicioEn,
                terminoEn: s.terminoEn,
                segundos: this.segundosDe(propios),
                tramos: propios,
              };
            });

          const j = jornadas.find((x) => x.fecha === fecha && x.usuarioId === w.id) ?? null;

          return {
            id: w.id,
            nombre: w.nombre,
            jornada: j
              ? {
                  id: j.id,
                  inicioEn: j.inicioEn,
                  terminoEn: j.terminoEn,
                  estado: j.estado,
                  cerradaAutomaticamente: j.cerradaAutomaticamente,
                  segundos: Number(j.segundos),
                }
              : null,
            segundosImputados: suyas.reduce((t, s) => t + s.segundos, 0),
            segundosPresencia: j ? Number(j.segundos) : 0,
            sesiones: suyas,
          };
        });

        return {
          fecha,
          resumen: {
            segundosImputados: filas.reduce((t, f) => t + f.segundosImputados, 0),
            segundosPresencia: filas.reduce((t, f) => t + f.segundosPresencia, 0),
            sesiones: filas.reduce((t, f) => t + f.sesiones.length, 0),
            conRegistro: filas.filter((f) => f.sesiones.length > 0 || f.jornada).length,
          },
          trabajadores: filas,
        };
      }),
    };
  }

  // ----------------------------------------------------------------- privados

  /** Trabajadores dentro del alcance, en el orden en que se listan en pantalla. */
  private async trabajadores(organizacionId: string, filtro: string | null) {
    const filas = await this.prisma.usuario.findMany({
      where: {
        organizacionId,
        rol: 'TRABAJADOR',
        activo: true,
        ...(filtro ? { id: filtro } : {}),
      },
      select: { id: true, nombreCompleto: true },
      orderBy: { nombreCompleto: 'asc' },
    });
    return filas.map((f) => ({ id: f.id, nombre: f.nombreCompleto }));
  }

  /**
   * Serie de dias del rango. Es aritmetica de calendario pura sobre cadenas
   * AAAA-MM-DD, sin zona horaria de por medio, de modo que un cambio de horario
   * no puede saltarse ni duplicar un dia.
   */
  private serieDeDias(desde: string, hasta: string): string[] {
    const primero = Date.parse(`${desde}T00:00:00Z`);
    const ultimo = Date.parse(`${hasta}T00:00:00Z`);

    if (Number.isNaN(primero) || Number.isNaN(ultimo)) {
      throw new BadRequestException('El rango de fechas no es valido.');
    }
    if (ultimo < primero) {
      throw new BadRequestException('La fecha "hasta" no puede ser anterior a "desde".');
    }
    if ((ultimo - primero) / 86_400_000 + 1 > CalendarioService.MAXIMO_DIAS) {
      throw new BadRequestException(
        `El rango no puede superar ${CalendarioService.MAXIMO_DIAS} dias.`,
      );
    }

    const dias: string[] = [];
    for (let t = primero; t <= ultimo; t += 86_400_000) {
      dias.push(new Date(t).toISOString().slice(0, 10));
    }
    return dias;
  }

  /** Normaliza una fila cruda y decide si la presencia sin imputar es anomala. */
  private celda(c: FilaCelda) {
    const imputados = Number(c.segundosImputados);
    const presencia = Number(c.segundosPresencia);

    return {
      fecha: c.fecha,
      trabajadorId: c.trabajadorId,
      trabajador: c.trabajador,
      segundosImputados: imputados,
      segundosPresencia: presencia,
      sesiones: Number(c.sesiones),
      jornadasAbiertas: Number(c.jornadasAbiertas),
      autocerradas: Number(c.autocerradas),
      inconclusas: Number(c.inconclusas),
      // DOC-ARQ-01 2.1: el administrador observa la diferencia entre horas de
      // jornada y horas imputadas. Aqui esa diferencia se vuelve visible.
      presenciaExcesiva:
        presencia > 0 && presencia - imputados > CalendarioService.MARGEN_PRESENCIA,
    };
  }

  /** Acumulado por dia que consume la rejilla mensual. */
  private acumularPorDia(dias: string[], celdas: FilaCelda[]) {
    const mapa = new Map(
      dias.map((d) => [
        d,
        {
          segundosImputados: 0,
          segundosPresencia: 0,
          sesiones: 0,
          conRegistro: 0,
          alertas: {
            jornadasAbiertas: 0,
            autocerradas: 0,
            inconclusas: 0,
            presenciaExcesiva: 0,
            total: 0,
          },
        },
      ]),
    );

    for (const cruda of celdas) {
      const acumulado = mapa.get(cruda.fecha);
      if (!acumulado) continue;

      const c = this.celda(cruda);
      acumulado.segundosImputados += c.segundosImputados;
      acumulado.segundosPresencia += c.segundosPresencia;
      acumulado.sesiones += c.sesiones;
      if (c.segundosImputados > 0 || c.segundosPresencia > 0) acumulado.conRegistro += 1;

      acumulado.alertas.jornadasAbiertas += c.jornadasAbiertas;
      acumulado.alertas.autocerradas += c.autocerradas;
      acumulado.alertas.inconclusas += c.inconclusas;
      if (c.presenciaExcesiva) acumulado.alertas.presenciaExcesiva += 1;
    }

    return dias.map((fecha) => {
      const a = mapa.get(fecha)!;
      a.alertas.total =
        a.alertas.jornadasAbiertas +
        a.alertas.autocerradas +
        a.alertas.inconclusas +
        a.alertas.presenciaExcesiva;
      return { fecha, ...a };
    });
  }

  /** Duracion real de una sesion: la suma de sus tramos, nunca inicio a termino. */
  private segundosDe(tramos: Tramo[]): number {
    const ahora = Date.now();
    return Math.round(
      tramos.reduce((total, t) => {
        const fin = t.terminoEn ? t.terminoEn.getTime() : ahora;
        return total + Math.max(0, (fin - t.inicioEn.getTime()) / 1000);
      }, 0),
    );
  }
}

export interface Tramo {
  inicioEn: Date;
  terminoEn: Date | null;
}

interface FilaCelda {
  fecha: string;
  trabajadorId: string;
  trabajador: string;
  segundosImputados: number;
  segundosPresencia: number;
  sesiones: number;
  jornadasAbiertas: number;
  autocerradas: number;
  inconclusas: number;
}

interface FilaSesion {
  id: string;
  fecha: string;
  usuarioId: string;
  inicioEn: Date;
  terminoEn: Date | null;
  estado: string;
  desenlace: string | null;
  notaCierre: string | null;
  cerradaAutomaticamente: boolean;
  actividad: string;
  proyecto: string;
}

interface FilaJornada {
  id: string;
  fecha: string;
  usuarioId: string;
  inicioEn: Date;
  terminoEn: Date | null;
  estado: string;
  cerradaAutomaticamente: boolean;
  segundos: number;
}
