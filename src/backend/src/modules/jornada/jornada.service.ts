import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * US-02 — presencia laboral del trabajador.
 *
 * Las marcas las genera el reloj del servidor. La interfaz solo envia la senal
 * de entrada o de salida, nunca un instante.
 */
@Injectable()
export class JornadaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Jornada abierta del trabajador, si la tiene. */
  actual(usuarioId: string) {
    return this.prisma.jornada.findFirst({
      where: { usuarioId, terminoEn: null },
      orderBy: { inicioEn: 'desc' },
    });
  }

  /**
   * La jornada queda en la organizacion del usuario de la sesion. Nunca se
   * elige una "por defecto": sin organizacion no hay jornada.
   */
  async entrada(usuarioId: string, organizacionId: string) {
    const abierta = await this.actual(usuarioId);
    if (abierta) {
      throw new BadRequestException('Ya tienes una jornada abierta.');
    }
    const orgId = organizacionId;

    const jornada = await this.prisma.jornada.create({
      data: { usuarioId, organizacionId: orgId, estado: 'ABIERTA' },
    });

    await this.prisma.registroAuditoria.create({
      data: {
        actorId: usuarioId,
        organizacionId: orgId,
        accion: 'JORNADA_ABIERTA',
        tipoEntidad: 'Jornada',
        entidadId: jornada.id,
      },
    });

    return jornada;
  }

  async salida(usuarioId: string) {
    const abierta = await this.actual(usuarioId);
    if (!abierta) {
      throw new BadRequestException('No tienes ninguna jornada abierta.');
    }

    // No se puede cerrar la jornada dejando tiempo corriendo.
    const sesionViva = await this.prisma.sesionTrabajo.findFirst({
      where: { usuarioId, estado: { in: ['ACTIVA', 'PAUSADA'] } },
    });
    if (sesionViva) {
      throw new BadRequestException(
        'Cierra primero la sesion de trabajo que tienes abierta.',
      );
    }

    const jornada = await this.prisma.jornada.update({
      where: { id: abierta.id },
      data: { terminoEn: new Date(), estado: 'CERRADA' },
    });

    await this.prisma.registroAuditoria.create({
      data: {
        actorId: usuarioId,
        organizacionId: jornada.organizacionId,
        accion: 'JORNADA_CERRADA',
        tipoEntidad: 'Jornada',
        entidadId: jornada.id,
      },
    });

    return jornada;
  }
}
