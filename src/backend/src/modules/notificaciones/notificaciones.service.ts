import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UsuarioActual } from '../../common/usuario-actual.decorator';
import { NotificacionesGateway } from './notificaciones.gateway';

export interface NuevaNotificacion {
  usuarioId: string;
  organizacionId?: string | null;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace?: string;
  entidadId?: string;
}

@Injectable()
export class NotificacionesService {
  private readonly registro = new Logger(NotificacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway?: NotificacionesGateway,
  ) {}

  /**
   * Crea y emite una notificacion en tiempo real. Nunca lanza excepciones
   * hacia el flujo principal de negocio si falla un aviso secundario.
   */
  async crear(entrada: NuevaNotificacion) {
    try {
      const creada = await this.prisma.notificacion.create({
        data: {
          usuarioId: entrada.usuarioId,
          organizacionId: entrada.organizacionId ?? null,
          tipo: entrada.tipo,
          titulo: entrada.titulo,
          mensaje: entrada.mensaje,
          enlace: entrada.enlace ?? null,
          entidadId: entrada.entidadId ?? null,
        },
        select: {
          id: true,
          tipo: true,
          titulo: true,
          mensaje: true,
          enlace: true,
          entidadId: true,
          leidaEn: true,
          creadoEn: true,
        },
      });
      this.gateway?.emitirAUsuario(entrada.usuarioId, creada);
      return creada;
    } catch (error) {
      this.registro.warn(
        `No se pudo crear notificacion ${entrada.tipo}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async listar(u: UsuarioActual, limite = 25) {
    const tope = Math.min(50, Math.max(1, limite));
    const [items, noLeidas] = await Promise.all([
      this.prisma.notificacion.findMany({
        where: { usuarioId: u.id },
        orderBy: { creadoEn: 'desc' },
        take: tope,
        select: {
          id: true,
          tipo: true,
          titulo: true,
          mensaje: true,
          enlace: true,
          entidadId: true,
          leidaEn: true,
          creadoEn: true,
        },
      }),
      this.prisma.notificacion.count({
        where: { usuarioId: u.id, leidaEn: null },
      }),
    ]);

    return { items, noLeidas };
  }

  async marcarLeida(u: UsuarioActual, id: string) {
    await this.prisma.notificacion.updateMany({
      where: { id, usuarioId: u.id, leidaEn: null },
      data: { leidaEn: new Date() },
    });
    return { ok: true };
  }

  async marcarTodasLeidas(u: UsuarioActual) {
    await this.prisma.notificacion.updateMany({
      where: { usuarioId: u.id, leidaEn: null },
      data: { leidaEn: new Date() },
    });
    return { ok: true };
  }
}
