/**
 * TimeFlow - datos iniciales de desarrollo.
 *
 * Crea lo necesario para levantar el proyecto y ver el sistema funcionando:
 * usuarios, un proyecto con su sprint, un arbol de actividades y tres meses
 * de historial de trabajo.
 *
 * El historial existe porque el calendario, los reportes y el panel del
 * administrador carecen de sentido sobre una base vacia: mostrarian cero en
 * todas partes y seria imposible saber si funcionan.
 *
 * Es idempotente: se apoya en upsert por correo y en comprobaciones de
 * existencia, de modo que puede ejecutarse las veces que haga falta.
 */
import {
  EstadoActividad,
  EstadoSprint,
  PlanSaaS,
  Prioridad,
  PrismaClient,
  Rol,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Solo para desarrollo local. En cualquier otro ambiente las credenciales
// se crean a mano y nunca se versionan.
const CLAVE_DEMO = 'Timeflow2026!';
const CLAVE_ADMIN = '12345';
const CLAVE_SUPERADMIN = 'SuperAdmin2026!';

/**
 * Dias corridos hacia atras que se generan de historial.
 *
 * Tres meses y no tres semanas: el calendario permite retroceder de mes en mes
 * y la matriz trabajador x dia solo se puede evaluar con varios meses poblados.
 */
const DIAS_HISTORIAL = 90;

async function main() {
  const hash = await argon2.hash(CLAVE_DEMO);
  const hashAdmin = await argon2.hash(CLAVE_ADMIN);
  const hashSuperAdmin = await argon2.hash(CLAVE_SUPERADMIN);

  // ----------------------------------------------------------- organizacion
  const organizacion = await prisma.organizacion.upsert({
    where: { slug: 'el-almendro' },
    update: {},
    create: {
      id: 'a0000000-0000-0000-0000-000000000001',
      nombre: 'El Almendro',
      slug: 'el-almendro',
      plan: PlanSaaS.EMPRESA,
      maxUsuarios: 100,
      maxProyectos: 50,
      activo: true,
    },
  });

  // ----------------------------------------------------------- super admin
  await prisma.usuario.upsert({
    where: { email: 'superadmin@timeflow.cl' },
    update: {
      rol: Rol.SUPER_ADMIN,
    },
    create: {
      email: 'superadmin@timeflow.cl',
      hashContrasena: hashSuperAdmin,
      nombreCompleto: 'Super Administrador SaaS',
      rol: Rol.SUPER_ADMIN,
      organizacionId: null,
    },
  });

  // ----------------------------------------------------------- usuarios

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@admin.cl' },
    update: {
      organizacionId: organizacion.id,
    },
    create: {
      email: 'admin@admin.cl',
      hashContrasena: hashAdmin,
      nombreCompleto: 'Administrador TimeFlow',
      rol: Rol.ADMINISTRADOR,
      organizacionId: organizacion.id,
    },
  });

  const trabajador = await prisma.usuario.upsert({
    where: { email: 'trabajador@timeflow.cl' },
    update: {
      organizacionId: organizacion.id,
    },
    create: {
      email: 'trabajador@timeflow.cl',
      hashContrasena: hash,
      nombreCompleto: 'Camila Soto',
      rol: Rol.TRABAJADOR,
      organizacionId: organizacion.id,
    },
  });

  const segundo = await prisma.usuario.upsert({
    where: { email: 'trabajador2@timeflow.cl' },
    update: {
      organizacionId: organizacion.id,
    },
    create: {
      email: 'trabajador2@timeflow.cl',
      hashContrasena: hash,
      nombreCompleto: 'Diego Fuentes',
      rol: Rol.TRABAJADOR,
      organizacionId: organizacion.id,
    },
  });

  const supervisor = await prisma.usuario.upsert({
    where: { email: 'supervisor@timeflow.cl' },
    update: {
      organizacionId: organizacion.id,
    },
    create: {
      email: 'supervisor@timeflow.cl',
      hashContrasena: hash,
      nombreCompleto: 'Valeria Miranda',
      rol: (Rol as any).SUPERVISOR ?? 'SUPERVISOR',
      organizacionId: organizacion.id,
    },
  });

  // ----------------------------------------------------------- proyecto

  let proyecto = await prisma.proyecto.findFirst({
    where: { nombre: 'Plataforma El Almendro' },
  });
  if (!proyecto) {
    proyecto = await prisma.proyecto.create({
      data: {
        nombre: 'Plataforma El Almendro',
        descripcion: 'Proyecto de ejemplo para el entorno de desarrollo.',
        propietarioId: admin.id,
        organizacionId: organizacion.id,
        miembros: {
          create: [
            { usuarioId: admin.id, rolEnProyecto: 'LIDER' },
            { usuarioId: trabajador.id, rolEnProyecto: 'MIEMBRO' },
            { usuarioId: segundo.id, rolEnProyecto: 'MIEMBRO' },
          ],
        },
      },
    });
  }

  let sprint = await prisma.sprint.findFirst({
    where: { proyectoId: proyecto.id, nombre: 'Sprint 1' },
  });
  if (!sprint) {
    sprint = await prisma.sprint.create({
      data: {
        proyectoId: proyecto.id,
        nombre: 'Sprint 1',
        objetivo: 'Definicion funcional y tecnica.',
        fechaInicio: diasAtras(21),
        fechaTermino: diasAdelante(7),
        estado: EstadoSprint.EN_CURSO,
      },
    });
  }

  // --------------------------------------------------------- actividades
  //
  // Tres agrupaciones con sus hijas. La jerarquia padre-hija es la que
  // alimenta el mapa de nodos: un nodo es una actividad y una agrupacion es
  // una actividad con hijas.

  const yaHayActividades = await prisma.actividad.count({
    where: { proyectoId: proyecto.id },
  });

  if (yaHayActividades === 0) {
    const grupos: {
      titulo: string;
      x: number;
      hijas: {
        titulo: string;
        estado: EstadoActividad;
        responsable: string;
        estimadas: number;
        prioridad: Prioridad;
        subtareas?: string[];
      }[];
    }[] = [
      {
        titulo: 'Acceso y seguridad',
        x: 0,
        hijas: [
          {
            titulo: 'Pantalla de inicio de sesion',
            estado: EstadoActividad.COMPLETADA,
            responsable: trabajador.id,
            estimadas: 240,
            prioridad: Prioridad.ALTA,
            subtareas: ['Formulario y validaciones', 'Manejo de errores'],
          },
          {
            titulo: 'Emision y rotacion de tokens',
            estado: EstadoActividad.EN_PROGRESO,
            responsable: trabajador.id,
            estimadas: 300,
            prioridad: Prioridad.ALTA,
            subtareas: ['Token de acceso', 'Deteccion de reutilizacion'],
          },
          {
            titulo: 'Control de acceso por rol',
            estado: EstadoActividad.PENDIENTE,
            responsable: segundo.id,
            estimadas: 180,
            prioridad: Prioridad.MEDIA,
          },
        ],
      },
      {
        titulo: 'Registro de jornada',
        x: 1,
        hijas: [
          {
            titulo: 'Marca de entrada y salida',
            estado: EstadoActividad.COMPLETADA,
            responsable: trabajador.id,
            estimadas: 200,
            prioridad: Prioridad.ALTA,
          },
          {
            titulo: 'Cierre automatico de sesiones',
            estado: EstadoActividad.BLOQUEADA,
            responsable: segundo.id,
            estimadas: 240,
            prioridad: Prioridad.CRITICA,
          },
          {
            titulo: 'Cronometro de actividad',
            estado: EstadoActividad.EN_PROGRESO,
            responsable: trabajador.id,
            estimadas: 360,
            prioridad: Prioridad.ALTA,
            subtareas: ['Iniciar y pausar', 'Cerrar con desenlace'],
          },
        ],
      },
      {
        titulo: 'Seguimiento y reportes',
        x: 2,
        hijas: [
          {
            titulo: 'Calendario del administrador',
            estado: EstadoActividad.EN_PROGRESO,
            responsable: segundo.id,
            estimadas: 300,
            prioridad: Prioridad.MEDIA,
          },
          {
            titulo: 'Reporte de horas por periodo',
            estado: EstadoActividad.PENDIENTE,
            responsable: trabajador.id,
            estimadas: 240,
            prioridad: Prioridad.MEDIA,
          },
          {
            titulo: 'Mapa de nodos del flujo',
            estado: EstadoActividad.INCONCLUSA,
            responsable: segundo.id,
            estimadas: 420,
            prioridad: Prioridad.BAJA,
          },
        ],
      },
    ];

    for (const grupo of grupos) {
      const padre = await prisma.actividad.create({
        data: {
          proyectoId: proyecto.id,
          sprintId: sprint.id,
          titulo: grupo.titulo,
          descripcion: `Agrupacion de actividades de ${grupo.titulo.toLowerCase()}.`,
          responsableId: admin.id,
          prioridad: Prioridad.ALTA,
          posicionNodo: { x: grupo.x * 320, y: 0 },
        },
      });

      for (const [i, hija] of grupo.hijas.entries()) {
        await prisma.actividad.create({
          data: {
            proyectoId: proyecto.id,
            sprintId: sprint.id,
            actividadPadreId: padre.id,
            titulo: hija.titulo,
            descripcion:
              'Actividad de ejemplo cargada con los datos iniciales del proyecto.',
            estado: hija.estado,
            prioridad: hija.prioridad,
            responsableId: hija.responsable,
            minutosEstimados: hija.estimadas,
            orden: i,
            posicionNodo: { x: grupo.x * 320, y: 140 + i * 110 },
            subtareas: hija.subtareas
              ? {
                  create: hija.subtareas.map((titulo, orden) => ({
                    titulo,
                    orden,
                    completada: orden === 0,
                  })),
                }
              : undefined,
          },
        });
      }
    }

    // Una derivacion, para que el historial de US-06 no este vacio.
    const bloqueada = await prisma.actividad.findFirst({
      where: { titulo: 'Cierre automatico de sesiones' },
    });
    if (bloqueada) {
      await prisma.derivacion.create({
        data: {
          actividadId: bloqueada.id,
          deUsuarioId: trabajador.id,
          aUsuarioId: segundo.id,
          motivo: 'Requiere revisar la tarea programada de autocierre.',
          ocurridoEn: diasAtras(4),
        },
      });
    }
  }

  // ----------------------------------------------------------- historial

  await generarHistorial(trabajador.id, segundo.id, proyecto.id, organizacion.id);

  console.log('\n  Datos iniciales listos.\n');
  console.log(`    superadmin@timeflow.cl   / ${CLAVE_SUPERADMIN} (Super Administrador SaaS)`);
  console.log(`    admin@admin.cl           / ${CLAVE_ADMIN}       (administrador)`);
  console.log(`    supervisor@timeflow.cl   / ${CLAVE_DEMO}   (Valeria Miranda - supervisor)`);
  console.log(`    trabajador@timeflow.cl   / ${CLAVE_DEMO}   (Camila Soto)`);
  console.log(`    trabajador2@timeflow.cl  / ${CLAVE_DEMO}   (Diego Fuentes)\n`);
}

/**
 * Genera jornadas y sesiones de trabajo de los ultimos tres meses.
 *
 * El trabajador es freelance: no tiene horario que cumplir, de modo que el
 * historial no separa dias habiles de fines de semana ni supone una jornada
 * fija. Hay dias largos, dias cortos y dias sin registro, y las tandas
 * arrancan a horas distintas, incluida alguna nocturna que cruza medianoche.
 *
 * Los tramos de un mismo trabajador no pueden solaparse —la base lo impide con
 * una restriccion de exclusion—, de modo que las sesiones de cada dia se
 * encadenan una despues de otra dentro de la jornada.
 *
 * Siembra ademas las tres anomalias que el calendario senala como alertas: una
 * jornada que quedo abierta, una sesion autocerrada y una sesion inconclusa.
 */
async function generarHistorial(
  trabajadorId: string,
  segundoId: string,
  proyectoId: string,
  organizacionId: string,
) {
  const yaHayHistorial = await prisma.sesionTrabajo.count();
  if (yaHayHistorial > 0) return;

  const actividades = await prisma.actividad.findMany({
    where: { proyectoId, actividadPadreId: { not: null } },
    select: { id: true, responsableId: true },
  });

  const porTrabajador = new Map<string, string[]>([
    [trabajadorId, actividades.filter((a) => a.responsableId === trabajadorId).map((a) => a.id)],
    [segundoId, actividades.filter((a) => a.responsableId === segundoId).map((a) => a.id)],
  ]);

  // Ciclo de dedicacion. Cada entrada es un dia: la hora local a la que arranca
  // la primera sesion y los minutos de cada una. Los dias vacios no son
  // ausencias —no hay horario que incumplir— sino dias en que simplemente no se
  // trabajo en este proyecto. El ciclo mide 11 dias, primo con 7, para que el
  // patron no quede pegado siempre a los mismos dias de la semana.
  const patron: { hora: number; sesiones: number[] }[] = [
    { hora: 9, sesiones: [95, 140, 60] },
    { hora: 14, sesiones: [180, 75] },
    { hora: 0, sesiones: [] },
    { hora: 8, sesiones: [120, 90, 45] },
    { hora: 21, sesiones: [200] },
    { hora: 10, sesiones: [60, 160, 80] },
    { hora: 0, sesiones: [] },
    { hora: 16, sesiones: [110] },
    { hora: 7, sesiones: [240, 130] },
    { hora: 0, sesiones: [] },
    { hora: 11, sesiones: [45] },
  ];

  // Minutos de jornada que quedan fuera de toda sesion. Los valores altos
  // producen a proposito la anomalia de presencia muy superior a lo imputado.
  const holgura = [10, 25, 140, 15, 200, 30];

  // Dias en los que se siembra cada anomalia. Solo puede haber una jornada
  // abierta por trabajador —indice unico parcial—, asi que es un unico dia.
  const DIA_JORNADA_ABIERTA = 4;
  const DIA_AUTOCERRADA = 12;
  const DIA_INCONCLUSA = 7;

  for (const [usuarioId, ids] of porTrabajador) {
    if (ids.length === 0) continue;

    for (let dia = DIAS_HISTORIAL; dia >= 1; dia--) {
      const { hora, sesiones } = patron[dia % patron.length];
      if (sesiones.length === 0) continue;

      const fecha = diasAtras(dia);

      // La agenda se calcula antes de escribir nada: la jornada necesita su
      // hora de termino en el mismo insert, porque el indice unico parcial solo
      // admite una jornada abierta por trabajador y aqui se deja una adrede.
      const agenda: { inicio: Date; termino: Date; minutos: number; pausa: number }[] = [];
      let cursor = instanteLocal(fecha, hora);

      for (const minutos of sesiones) {
        // Las sesiones largas se registran en dos tramos con una pausa en
        // medio: es lo que ocurre en el uso real del cronometro.
        const pausa = minutos > 120 ? 15 : 0;
        const inicio = new Date(cursor);
        const termino = new Date(inicio.getTime() + (minutos + pausa) * 60_000);
        agenda.push({ inicio, termino, minutos, pausa });
        cursor = new Date(termino.getTime() + 20 * 60_000);
      }

      const abierta = dia === DIA_JORNADA_ABIERTA;
      const inicioJornada = instanteLocal(fecha, hora, -10);
      const finJornada = new Date(
        agenda[agenda.length - 1].termino.getTime() + holgura[dia % holgura.length] * 60_000,
      );

      const jornada = await prisma.jornada.create({
        data: {
          usuarioId,
          organizacionId,
          inicioEn: inicioJornada,
          estado: abierta ? 'ABIERTA' : 'CERRADA',
          terminoEn: abierta ? null : finJornada,
        },
      });

      for (const [i, tanda] of agenda.entries()) {
        const actividadId = ids[(dia + i) % ids.length];
        const ultima = i === agenda.length - 1;

        // La sesion autocerrada conserva la actividad en su estado previo: el
        // sistema no puede declarar completado algo que nadie cerro (DOC-ARQ-01 5.4).
        const autocerrada = ultima && dia === DIA_AUTOCERRADA;
        const inconclusa = ultima && dia === DIA_INCONCLUSA;

        const sesion = await prisma.sesionTrabajo.create({
          data: {
            actividadId,
            usuarioId,
            jornadaId: jornada.id,
            inicioEn: tanda.inicio,
            terminoEn: tanda.termino,
            estado: autocerrada ? 'AUTOCERRADA' : 'CERRADA',
            desenlace: autocerrada ? null : inconclusa ? 'INCONCLUSA' : 'COMPLETADA',
            notaCierre: inconclusa
              ? 'Quedo a la espera de la respuesta del cliente sobre el alcance.'
              : null,
            cerradaAutomaticamente: autocerrada,
            creadoEn: tanda.inicio,
          },
        });

        if (tanda.pausa > 0) {
          const mitad = Math.floor(tanda.minutos / 2);
          const corte = new Date(tanda.inicio.getTime() + mitad * 60_000);
          const reanuda = new Date(corte.getTime() + tanda.pausa * 60_000);
          await prisma.tramoSesion.createMany({
            data: [
              { sesionId: sesion.id, usuarioId, inicioEn: tanda.inicio, terminoEn: corte },
              { sesionId: sesion.id, usuarioId, inicioEn: reanuda, terminoEn: tanda.termino },
            ],
          });
        } else {
          await prisma.tramoSesion.create({
            data: {
              sesionId: sesion.id,
              usuarioId,
              inicioEn: tanda.inicio,
              terminoEn: tanda.termino,
            },
          });
        }
      }

      if (!abierta) {
        await prisma.registroAuditoria.create({
          data: {
            actorId: usuarioId,
            accion: 'JORNADA_CERRADA',
            tipoEntidad: 'Jornada',
            entidadId: jornada.id,
            ocurridoEn: finJornada,
          },
        });
      }
    }
  }
}

function diasAtras(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

/**
 * Instante UTC correspondiente a una hora local del dia indicado.
 *
 * Aproxima el desfase de Chile a UTC-4. Es dato de desarrollo y no pretende ser
 * exacto en los bordes del horario de verano; la aplicacion si resuelve la zona
 * con precision, y lo hace dentro del motor de base de datos.
 */
function instanteLocal(base: Date, horaLocal: number, minutos = 0): Date {
  const d = new Date(base);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() + (horaLocal + 4) * 3_600_000 + minutos * 60_000);
}

function diasAdelante(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
