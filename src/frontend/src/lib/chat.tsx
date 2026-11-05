'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { api, MensajeChat } from '@/lib/api';
import { leerPresencia, leerPresenciaServidor, socketChat, suscribirPresencia } from '@/lib/socket';

/** Identificador del canal general en la URL y en la API (`?con=general`). */
export const CANAL_GENERAL = 'general';

interface EstadoChat {
  /** Ids de usuarios con al menos una pestana conectada. */
  enLinea: ReadonlySet<string>;
  /** Mensajes privados que me enviaron y aun no abro. */
  noLeidos: number;
  /** Si el socket esta conectado ahora mismo (para avisar "reconectando…"). */
  conectado: boolean;
  socket: Socket | null;
  refrescarNoLeidos: () => void;
}

const ContextoChat = createContext<EstadoChat>({
  enLinea: new Set(),
  noLeidos: 0,
  conectado: false,
  socket: null,
  refrescarNoLeidos: () => {},
});

export function useChat(): EstadoChat {
  return useContext(ContextoChat);
}

/**
 * Mantiene la presencia del equipo y el contador de no leidos para toda la
 * aplicacion (el menu lateral muestra la insignia en cualquier pantalla).
 * La pagina de chat se cuelga del mismo socket para recibir los mensajes.
 */
export function ProveedorChat({
  usuarioId,
  children,
}: {
  usuarioId: string;
  children: React.ReactNode;
}) {
  const enLinea = useSyncExternalStore(suscribirPresencia, leerPresencia, leerPresenciaServidor);
  const [noLeidos, setNoLeidos] = useState(0);
  const [conectado, setConectado] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  const refrescarNoLeidos = useCallback(() => {
    api
      .get<{ total: number }>('/chat/no-leidos')
      .then((r) => setNoLeidos(r.total))
      .catch(() => {
        /* sin permiso de chat o sin red: la insignia simplemente no cambia */
      });
  }, []);

  useEffect(() => {
    const s = socketChat();
    setSocket(s);
    setConectado(s.connected);
    refrescarNoLeidos();

    const alConectar = () => setConectado(true);
    const alDesconectar = () => setConectado(false);
    const alMensaje = (m: MensajeChat) => {
      if (m.receptorId === usuarioId) refrescarNoLeidos();
    };

    s.on('connect', alConectar);
    s.on('disconnect', alDesconectar);
    s.on('mensaje:nuevo', alMensaje);
    if (!s.connected) s.connect();

    return () => {
      s.off('connect', alConectar);
      s.off('disconnect', alDesconectar);
      s.off('mensaje:nuevo', alMensaje);
    };
  }, [usuarioId, refrescarNoLeidos]);

  const valor = useMemo(
    () => ({ enLinea, noLeidos, conectado, socket, refrescarNoLeidos }),
    [enLinea, noLeidos, conectado, socket, refrescarNoLeidos],
  );

  return <ContextoChat.Provider value={valor}>{children}</ContextoChat.Provider>;
}
