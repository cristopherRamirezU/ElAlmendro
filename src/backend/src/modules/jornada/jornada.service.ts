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

  async entrada(usuarioId: string, organizacionId?: string | null) {
    const abierta = await this.actual(usuarioId);
    if (abierta) {
      throw new BadRequestException('Ya tienes una jornada abierta.');
    }

    let orgId = organizacionId;
    if (!orgId) {
      const u = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { organizacionId: true },
      });
      orgId = u?.organizacionId ?? null;
      if (!orgId) {
        const primeraOrg = await this.prisma.organizacion.findFirst();
        orgId = primeraOrg?.id ?? null;
      }
    }

    if (!orgId) {
      throw new BadRequestException('No se encontró una organización asociada.');
    }

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
        accion: 'JORNADA_CERRADA',
        tipoEntidad: 'Jornada',
        entidadId: jornada.id,
      },
    });

    return jornada;
  }
}
