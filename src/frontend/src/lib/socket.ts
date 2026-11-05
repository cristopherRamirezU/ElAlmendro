import { io, Socket } from 'socket.io-client';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let socketChatActual: Socket | null = null;

/**
 * Presencia del equipo. Vive aqui y no en React porque el servidor manda la
 * lista solo al conectar: si la guardara el Marco de cada pantalla, despues de
 * navegar (socket ya conectado) quedaria vacia y todos se verian desconectados.
 */
const NADIE: ReadonlySet<string> = new Set();
let enLineaActual = NADIE;
const oyentesPresencia = new Set<() => void>();

function publicarPresencia(ids: ReadonlySet<string>) {
  enLineaActual = ids;
  oyentesPresencia.forEach((avisar) => avisar());
}

export function suscribirPresencia(oyente: () => void) {
  oyentesPresencia.add(oyente);
  return () => {
    oyentesPresencia.delete(oyente);
  };
}

export const leerPresencia = () => enLineaActual;
export const leerPresenciaServidor = () => NADIE;

/**
 * Un solo socket de chat por pestana, que sobrevive a la navegacion entre
 * paginas: cada pantalla monta su propio Marco, y si el socket viviera en el
 * componente se reconectaria (y parpadearia la presencia) en cada cambio de
 * ruta. Viaja con la misma cookie httpOnly que las peticiones HTTP.
 */
export function socketChat(): Socket {
  if (!socketChatActual) {
    socketChatActual = io(`${BASE}/chat`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketChatActual.on('presencia:lista', (ids: string[]) => publicarPresencia(new Set(ids)));
    socketChatActual.on(
      'presencia:cambio',
      ({ usuarioId, enLinea }: { usuarioId: string; enLinea: boolean }) => {
        const siguiente = new Set(enLineaActual);
        if (enLinea) siguiente.add(usuarioId);
        else siguiente.delete(usuarioId);
        publicarPresencia(siguiente);
      },
    );
    // Sin socket no sabemos quien sigue en linea: mejor no afirmar nada.
    socketChatActual.on('disconnect', () => publicarPresencia(NADIE));
  }
  return socketChatActual;
}

/** Al cerrar sesion: asi el servidor marca al usuario como desconectado. */
export function cerrarSocketChat() {
  socketChatActual?.disconnect();
  socketChatActual = null;
  publicarPresencia(NADIE);
}
