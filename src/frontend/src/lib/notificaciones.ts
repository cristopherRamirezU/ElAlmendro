import { io, Socket } from 'socket.io-client';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface NotificacionItem {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  entidadId: string | null;
  leidaEn: string | null;
  creadoEn: string;
}

export interface RespuestaNotificaciones {
  items: NotificacionItem[];
  noLeidas: number;
}

let socketActual: Socket | null = null;

/** Socket singleton de notificaciones en vivo autenticado via cookie httpOnly. */
export function socketNotificaciones(): Socket {
  if (!socketActual) {
    socketActual = io(`${BASE}/notificaciones`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socketActual;
}

export function cerrarSocketNotificaciones() {
  socketActual?.disconnect();
  socketActual = null;
}
