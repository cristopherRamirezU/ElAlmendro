import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { cargarUsuarioVigente } from '../../common/jwt-auth.guard';
import { leerCookie, leerSesion, nombreCookieSesion } from '../../common/seguridad/sesion';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface UsuarioSocket {
  id: string;
  organizacionId: string | null;
}

/**
 * Canal en vivo de notificaciones por usuario.
 *
 * Cada cliente entra exclusivamente a su sala `usuario:<id>`, de modo que las
 * alertas nunca se difunden de forma global ni cruzan entre empresas o cuentas.
 */
@WebSocketGateway({
  namespace: '/notificaciones',
  cors: {
    origin: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificacionesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly servidor: Namespace;

  private readonly registro = new Logger(NotificacionesGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(cliente: Socket) {
    const usuario = await this.autenticar(cliente);
    if (!usuario) {
      cliente.disconnect(true);
      return;
    }
    cliente.data.usuario = usuario;
    await cliente.join(this.sala(usuario.id));
  }

  handleDisconnect(cliente: Socket) {
    const usuario = cliente.data.usuario as UsuarioSocket | undefined;
    if (usuario) {
      this.registro.debug(`Socket notificaciones desconectado: ${usuario.id}`);
    }
  }

  emitirAUsuario(usuarioId: string, notificacion: unknown) {
    if (!this.servidor) return;
    this.servidor.to(this.sala(usuarioId)).emit('notificacion:nueva', notificacion);
  }

  private sala(usuarioId: string) {
    return `usuario:${usuarioId}`;
  }

  private async autenticar(cliente: Socket): Promise<UsuarioSocket | null> {
    const token = leerCookie(cliente.handshake.headers.cookie, nombreCookieSesion());
    if (!token) return null;

    const sesion = await leerSesion(this.jwt, token);
    if (!sesion) return null;

    try {
      const vigente = await cargarUsuarioVigente(this.prisma, sesion.sub, sesion.ver);
      return { id: vigente.id, organizacionId: vigente.organizacionId ?? null };
    } catch {
      return null;
    }
  }
}
