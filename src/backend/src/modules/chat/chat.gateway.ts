import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import {
  cargarUsuarioVigente,
  COOKIE_ACCESO,
  verificarToken,
} from '../../common/jwt-auth.guard';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Datos minimos del usuario que quedan pegados al socket tras autenticarse. */
interface UsuarioSocket {
  id: string;
  nombreCompleto: string;
  organizacionId: string;
}

/** Forma con que viaja un mensaje por el socket (misma que devuelve la API). */
export interface MensajeEmitido {
  id: string;
  emisorId: string;
  receptorId: string | null;
  cuerpo: string;
  creadoEn: Date;
  leidoEn: Date | null;
  emisor: { id: string; nombreCompleto: string };
}

/**
 * Canal en vivo del chat. Aqui vive la presencia: un usuario esta "en linea"
 * mientras tenga al menos una pestana conectada. Los mensajes se persisten
 * por HTTP (ChatService) y este gateway solo los difunde, de modo que enviar
 * sigue funcionando aunque el socket este reconectando.
 *
 * Multi-SaaS: cada socket entra a la sala de su organizacion y todo lo que
 * no es privado (canal general, presencia, "escribiendo") se difunde solo en
 * esa sala. Nunca se usa un emit global: cruzaria datos entre empresas.
 *
 * Eventos servidor -> cliente:
 *   presencia:lista   string[]                       ids en linea al conectar
 *   presencia:cambio  { usuarioId, enLinea }         alguien entro o salio
 *   mensaje:nuevo     MensajeEmitido                 privado o del canal general
 *   mensajes:leidos   { porUsuarioId }               la contraparte leyo lo tuyo
 *   escribiendo       { usuarioId, receptorId }      la contraparte esta tecleando
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly servidor: Namespace;

  private readonly registro = new Logger(ChatGateway.name);

  /** usuarioId -> organizacion e ids de socket abiertos (varias pestanas = varios sockets). */
  private readonly conexiones = new Map<string, { organizacionId: string; sockets: Set<string> }>();

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
    await cliente.join([this.sala(usuario.id), this.salaOrganizacion(usuario.organizacionId)]);

    let conexion = this.conexiones.get(usuario.id);
    const recienEntra = !conexion || conexion.sockets.size === 0;
    if (!conexion) {
      conexion = { organizacionId: usuario.organizacionId, sockets: new Set() };
      this.conexiones.set(usuario.id, conexion);
    }
    conexion.sockets.add(cliente.id);

    cliente.emit('presencia:lista', this.usuariosEnLinea(usuario.organizacionId));
    if (recienEntra) {
      this.servidor
        .to(this.salaOrganizacion(usuario.organizacionId))
        .emit('presencia:cambio', { usuarioId: usuario.id, enLinea: true });
    }
  }

  handleDisconnect(cliente: Socket) {
    const usuario = cliente.data.usuario as UsuarioSocket | undefined;
    if (!usuario) return;

    const conexion = this.conexiones.get(usuario.id);
    if (!conexion) return;
    conexion.sockets.delete(cliente.id);
    if (conexion.sockets.size === 0) {
      this.conexiones.delete(usuario.id);
      this.servidor
        .to(this.salaOrganizacion(usuario.organizacionId))
        .emit('presencia:cambio', { usuarioId: usuario.id, enLinea: false });
    }
  }

  /** Indicador "esta escribiendo…": se reenvia solo a la contraparte, sin persistir. */
  @SubscribeMessage('escribiendo')
  escribiendo(
    @ConnectedSocket() cliente: Socket,
    @MessageBody() cuerpo: { receptorId?: string | null } | undefined,
  ) {
    const usuario = cliente.data.usuario as UsuarioSocket | undefined;
    if (!usuario) return;
    const receptorId = cuerpo?.receptorId ?? null;
    const carga = { usuarioId: usuario.id, receptorId };
    if (receptorId) {
      // Solo se avisa a un receptor conectado de la misma organizacion.
      if (this.conexiones.get(receptorId)?.organizacionId !== usuario.organizacionId) return;
      this.servidor.to(this.sala(receptorId)).emit('escribiendo', carga);
    } else {
      cliente.to(this.salaOrganizacion(usuario.organizacionId)).emit('escribiendo', carga);
    }
  }

  // ------------------------------------------------ usados por ChatService

  emitirMensaje(mensaje: MensajeEmitido, organizacionId: string) {
    if (mensaje.receptorId) {
      this.servidor
        .to([this.sala(mensaje.receptorId), this.sala(mensaje.emisorId)])
        .emit('mensaje:nuevo', mensaje);
    } else {
      this.servidor.to(this.salaOrganizacion(organizacionId)).emit('mensaje:nuevo', mensaje);
    }
  }

  emitirLectura(emisorId: string, porUsuarioId: string) {
    this.servidor.to(this.sala(emisorId)).emit('mensajes:leidos', { porUsuarioId });
  }

  /** Ids en linea de una organizacion: la presencia de otras empresas no se expone. */
  usuariosEnLinea(organizacionId: string): string[] {
    return [...this.conexiones.entries()]
      .filter(([, c]) => c.organizacionId === organizacionId)
      .map(([id]) => id);
  }

  estaEnLinea(usuarioId: string): boolean {
    return this.conexiones.has(usuarioId);
  }

  // ------------------------------------------------------------- privados

  private sala(usuarioId: string) {
    return `usuario:${usuarioId}`;
  }

  private salaOrganizacion(organizacionId: string) {
    return `organizacion:${organizacionId}`;
  }

  /**
   * Misma cookie httpOnly que usa JwtAuthGuard: el navegador la adjunta al
   * handshake porque el socket se abre con `withCredentials`.
   */
  private async autenticar(cliente: Socket): Promise<UsuarioSocket | null> {
    const token = leerCookie(cliente.handshake.headers.cookie, COOKIE_ACCESO);
    if (!token) return null;
    const usuarioId = await verificarToken(this.jwt, token);
    if (!usuarioId) {
      this.registro.debug(`Socket ${cliente.id} rechazado: token invalido o expirado.`);
      return null;
    }
    try {
      // Mismas reglas que la API: cuenta activa y empresa no suspendida.
      const usuario = await cargarUsuarioVigente(this.prisma, usuarioId);
      if (!usuario.organizacionId) return null; // SUPER_ADMIN no participa del chat.
      return {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        organizacionId: usuario.organizacionId,
      };
    } catch {
      this.registro.debug(`Socket ${cliente.id} rechazado: cuenta u organizacion no vigente.`);
      return null;
    }
  }
}

function leerCookie(cabecera: string | undefined, nombre: string): string | null {
  if (!cabecera) return null;
  for (const par of cabecera.split(';')) {
    const [clave, ...resto] = par.trim().split('=');
    if (clave === nombre) return decodeURIComponent(resto.join('='));
  }
  return null;
}
