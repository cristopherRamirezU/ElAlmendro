import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CerrarSesionDto, IniciarSesionDto } from './dto/sesion.dto';
import { ActividadesService } from '../actividades/actividades.service';

/**
 * Cronometraje autoritativo del servidor.
 *
 * La interfaz nunca envia duraciones ni instantes: solo las senales de iniciar,
 * pausar, reanudar y cerrar. Todas las marcas las estampa este servicio con el
 * reloj del servidor, porque el reloj del navegador es modificable por el
 * usuario y el sistema perderia toda credibilidad.
 *
 * La duracion de una sesion es la suma de sus tramos, no la diferencia entre su
 * inicio y su termino: las pausas no son tiempo trabajado.
 */
@Injectable()
export class SesionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actividades: ActividadesService,
  ) {}

  /** Sesion viva del trabajador, con su actividad y sus tramos. */
  async activa(usuarioId: string) {
    const sesion = await this.prisma.sesionTrabajo.findFirst({
      where: { usuarioId, estado: { in: ['ACTIVA', 'PAUSADA'] } },
      include: {
        actividad: {
          select: {
            id: true,
            titulo: true,
            proyectoId: true,
            proyecto: { select: { id: true, nombre: true } },
          },
        },
        tramos: { orderBy: { inicioEn: 'asc' } },
      },
    });
    return sesion ? this.conSegundos(sesion) : null;
  }

  async iniciar(usuarioId: string, dto: IniciarSesionDto) {
    const jornada = await this.prisma.jornada.findFirst({
      where: { usuarioId, terminoEn: null },
    });
    if (!jornada) {
      throw new BadRequestException(
        'Debes marcar tu entrada antes de comenzar a trabajar.',
      );
    }

    const viva = await this.prisma.sesionTrabajo.findFirst({
      where: { usuarioId, estado: { in: ['ACTIVA', 'PAUSADA'] } },
    });
    if (viva) {
      throw new BadRequestException(
        'Ya tienes una sesion abierta. Cierrala antes de comenzar otra.',
      );
    }

    const actividad = await this.prisma.actividad.findFirst({
      where: { id: dto.actividadId, eliminadoEn: null },
      include: { proyecto: { select: { organizacionId: true } } },
    });
    if (!actividad) throw new NotFoundException('La actividad no existe.');
    if (actividad.responsableId !== usuarioId) {
      throw new BadRequestException('Esa actividad no esta asignada a ti.');
    }

    // Una sola transaccion: sesion, tramo, estado de la actividad y auditoria.
    const sesion = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.sesionTrabajo.create({
        data: {
          actividadId: actividad.id,
          usuarioId,
          jornadaId: jornada.id,
          estado: 'ACTIVA',
        },
      });

      await tx.tramoSesion.create({
        data: { sesionId: creada.id, usuarioId },
      });

      if (actividad.estado === 'PENDIENTE' || actividad.estado === 'INCONCLUSA') {
        await tx.actividad.update({
          where: { id: actividad.id },
          data: { estado: 'EN_PROGRESO' },
        });
      }

      await tx.registroAuditoria.create({
        data: {
          actorId: usuarioId,
          organizacionId: actividad.proyecto.organizacionId,
          accion: 'SESION_INICIADA',
          tipoEntidad: 'SesionTrabajo',
          entidadId: creada.id,
          valorNuevo: { actividadId: actividad.id },
        },
      });

      return creada;
    });

    return this.activa(usuarioId);
  }

  async pausar(usuarioId: string, sesionId: string) {
    const sesion = await this.exigirViva(usuarioId, sesionId);
    if (sesion.estado === 'PAUSADA') {
      throw new BadRequestException('La sesion ya esta en pausa.');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.cerrarTramoVigente(tx, sesionId);
      await tx.sesionTrabajo.update({
        where: { id: sesionId },
        data: { estado: 'PAUSADA' },
      });
      await tx.registroAuditoria.create({
        data: {
          actorId: usuarioId,
          accion: 'SESION_PAUSADA',
          tipoEntidad: 'SesionTrabajo',
          entidadId: sesionId,
        },
      });
    });

    return this.activa(usuarioId);
  }

  async reanudar(usuarioId: string, sesionId: string) {
    const sesion = await this.exigirViva(usuarioId, sesionId);
    if (sesion.estado === 'ACTIVA') {
      throw new BadRequestException('La sesion ya esta corriendo.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tramoSesion.create({ data: { sesionId, usuarioId } });
      await tx.sesionTrabajo.update({
        where: { id: sesionId },
        data: { estado: 'ACTIVA' },
      });
      await tx.registroAuditoria.create({
        data: {
          actorId: usuarioId,
          accion: 'SESION_REANUDADA',
          tipoEntidad: 'SesionTrabajo',
          entidadId: sesionId,
        },
      });
    });

    return this.activa(usuarioId);
  }

  async cerrar(usuarioId: string, sesionId: string, dto: CerrarSesionDto) {
    const sesion = await this.exigirViva(usuarioId, sesionId);

    // La nota es obligatoria si el trabajo queda inconcluso: el administrador
    // debe saber por que quedo pendiente. La base tambien lo exige.
    if (dto.desenlace === 'INCONCLUSA' && !dto.notaCierre?.trim()) {
      throw new BadRequestException(
        'Explica por que la dejas inconclusa antes de cerrarla.',
      );
    }

    // Dar el trabajo por terminado exige respaldo. Una sesion inconclusa no:
    // justamente lo que dice es que el trabajo todavia no esta hecho.
    if (dto.desenlace === 'COMPLETADA') {
      await this.actividades.exigirEvidencia(sesion.actividadId);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.cerrarTramoVigente(tx, sesionId);

      await tx.sesionTrabajo.update({
        where: { id: sesionId },
        data: {
          estado: 'CERRADA',
          terminoEn: new Date(),
          desenlace: dto.desenlace,
          notaCierre: dto.notaCierre?.trim() || null,
        },
      });

      await tx.actividad.update({
        where: { id: sesion.actividadId },
        data: {
          estado: dto.desenlace === 'COMPLETADA' ? 'COMPLETADA' : 'INCONCLUSA',
          completadaEn: dto.desenlace === 'COMPLETADA' ? new Date() : null,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          actorId: usuarioId,
          accion: 'SESION_CERRADA',
          tipoEntidad: 'SesionTrabajo',
          entidadId: sesionId,
          valorNuevo: { desenlace: dto.desenlace },
        },
      });
    });

    return { ok: true };
  }

  // ---------------------------------------------------------------- privados

  private async exigirViva(usuarioId: string, sesionId: string) {
    const sesion = await this.prisma.sesionTrabajo.findUnique({
      where: { id: sesionId },
    });
    if (!sesion) throw new NotFoundException('La sesion no existe.');
    if (sesion.usuarioId !== usuarioId) {
      throw new BadRequestException('Esa sesion no es tuya.');
    }
    if (sesion.estado !== 'ACTIVA' && sesion.estado !== 'PAUSADA') {
      throw new BadRequestException('La sesion ya esta cerrada.');
    }
    return sesion;
  }

  private async cerrarTramoVigente(tx: any, sesionId: string) {
    const tramo = await tx.tramoSesion.findFirst({
      where: { sesionId, terminoEn: null },
      orderBy: { inicioEn: 'desc' },
    });
    if (tramo) {
      await tx.tramoSesion.update({
        where: { id: tramo.id },
        data: { terminoEn: new Date() },
      });
    }
  }

  /**
   * Agrega los segundos acumulados. La interfaz sigue contando en pantalla a
   * partir de este valor, pero nunca lo devuelve al servidor.
   */
  private conSegundos(sesion: any) {
    const ahora = Date.now();
    const segundos = sesion.tramos.reduce((total: number, t: any) => {
      const fin = t.terminoEn ? new Date(t.terminoEn).getTime() : ahora;
      return total + (fin - new Date(t.inicioEn).getTime()) / 1000;
    }, 0);

    return { ...sesion, segundosAcumulados: Math.floor(segundos) };
  }
}
