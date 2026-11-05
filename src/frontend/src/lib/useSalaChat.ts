'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ContactoChat, ContactosChat, ErrorApi, MensajeChat, ResumenMensaje } from '@/lib/api';
import { CANAL_GENERAL, useChat } from '@/lib/chat';

function perteneceA(m: MensajeChat, seleccion: string | null, yoId: string): boolean {
  if (seleccion === null) return false;
  if (seleccion === CANAL_GENERAL) return m.receptorId === null;
  return (
    (m.emisorId === seleccion && m.receptorId === yoId) ||
    (m.emisorId === yoId && m.receptorId === seleccion)
  );
}

/**
 * Estado de una sala de chat: contactos, conversacion abierta y eventos en
 * vivo. Lo comparten la pantalla /chat y el chat flotante.
 *
 * `activa` en false no pide nada a la API (chat flotante plegado). `seleccion`
 * en null significa que no hay conversacion a la vista: es lo que impide
 * marcar como leido un mensaje que nadie esta mirando.
 */
export function useSalaChat({
  yoId,
  seleccion,
  activa = true,
}: {
  yoId: string;
  seleccion: string | null;
  activa?: boolean;
}) {
  const router = useRouter();
  const { socket, enLinea, conectado, refrescarNoLeidos } = useChat();

  const [contactos, setContactos] = useState<ContactoChat[]>([]);
  const [contactosListos, setContactosListos] = useState(false);
  const [ultimoGeneral, setUltimoGeneral] = useState<ResumenMensaje | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Los manejadores del socket viven fuera del ciclo de render: con refs no
  // hay que resuscribirse cada vez que cambia la conversacion abierta.
  const seleccionRef = useRef(seleccion);
  seleccionRef.current = seleccion;
  const temporizadorEscribiendo = useRef<ReturnType<typeof setTimeout> | null>(null);

  const manejarError = useCallback(
    (err: unknown, porDefecto: string) => {
      if (err instanceof ErrorApi && err.estado === 401) router.replace('/login');
      else setAviso(err instanceof ErrorApi ? err.message : porDefecto);
    },
    [router],
  );

  const cargarContactos = useCallback(async () => {
    try {
      const d = await api.get<ContactosChat>('/chat/contactos');
      setContactos(d.contactos);
      setUltimoGeneral(d.general.ultimoMensaje);
      setContactosListos(true);
    } catch (err) {
      manejarError(err, 'No se pudo cargar la lista de contactos.');
    }
  }, [manejarError]);

  useEffect(() => {
    if (activa) cargarContactos();
  }, [activa, cargarContactos]);

  const marcarLeidos = useCallback(
    async (emisorId: string) => {
      setContactos((prev) => prev.map((c) => (c.id === emisorId ? { ...c, noLeidos: 0 } : c)));
      try {
        await api.post(`/chat/leidos/${emisorId}`);
      } finally {
        refrescarNoLeidos();
      }
    },
    [refrescarNoLeidos],
  );

  // Historial al abrir una conversacion.
  useEffect(() => {
    setMensajes([]);
    setHayMas(false);
    setEscribiendo(null);
    if (seleccion === null) {
      setCargando(false);
      return;
    }
    let vigente = true;
    setCargando(true);
    (async () => {
      try {
        const d = await api.get<{ mensajes: MensajeChat[]; hayMas: boolean }>(
          `/chat/mensajes?con=${seleccion}`,
        );
        if (!vigente) return;
        setMensajes(d.mensajes);
        setHayMas(d.hayMas);
        if (seleccion !== CANAL_GENERAL) marcarLeidos(seleccion);
      } catch (err) {
        if (vigente) manejarError(err, 'No se pudo cargar la conversacion.');
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [seleccion, marcarLeidos, manejarError]);

  const agregarMensaje = useCallback((m: MensajeChat) => {
    setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  const actualizarResumen = useCallback(
    (m: MensajeChat) => {
      const resumen: ResumenMensaje = { cuerpo: m.cuerpo, creadoEn: m.creadoEn, propio: m.emisorId === yoId };
      if (m.receptorId === null) {
        setUltimoGeneral(resumen);
        return;
      }
      const contraparte = m.emisorId === yoId ? m.receptorId : m.emisorId;
      setContactos((prev) =>
        prev.map((c) => (c.id === contraparte ? { ...c, ultimoMensaje: resumen } : c)),
      );
    },
    [yoId],
  );

  // Eventos en vivo.
  useEffect(() => {
    if (!socket || !yoId) return;

    const alMensaje = (m: MensajeChat) => {
      actualizarResumen(m);
      if (perteneceA(m, seleccionRef.current, yoId)) {
        agregarMensaje(m);
        if (m.emisorId !== yoId && m.receptorId === yoId) marcarLeidos(m.emisorId);
        if (m.emisorId === seleccionRef.current) setEscribiendo(null);
      } else if (m.receptorId === yoId) {
        setContactos((prev) =>
          prev.map((c) => (c.id === m.emisorId ? { ...c, noLeidos: c.noLeidos + 1 } : c)),
        );
      }
    };

    const alLeer = ({ porUsuarioId }: { porUsuarioId: string }) => {
      if (porUsuarioId !== seleccionRef.current) return;
      const ahora = new Date().toISOString();
      setMensajes((prev) =>
        prev.map((m) => (m.emisorId === yoId && !m.leidoEn ? { ...m, leidoEn: ahora } : m)),
      );
    };

    const alEscribir = ({ usuarioId, receptorId }: { usuarioId: string; receptorId: string | null }) => {
      const sel = seleccionRef.current;
      const esGeneral = sel === CANAL_GENERAL && receptorId === null && usuarioId !== yoId;
      const esPrivado = sel === usuarioId && receptorId === yoId;
      if (!esGeneral && !esPrivado) return;
      setEscribiendo(usuarioId);
      if (temporizadorEscribiendo.current) clearTimeout(temporizadorEscribiendo.current);
      temporizadorEscribiendo.current = setTimeout(() => setEscribiendo(null), 3000);
    };

    socket.on('mensaje:nuevo', alMensaje);
    socket.on('mensajes:leidos', alLeer);
    socket.on('escribiendo', alEscribir);
    return () => {
      socket.off('mensaje:nuevo', alMensaje);
      socket.off('mensajes:leidos', alLeer);
      socket.off('escribiendo', alEscribir);
    };
  }, [socket, yoId, agregarMensaje, actualizarResumen, marcarLeidos]);

  async function enviar(cuerpo: string) {
    if (seleccion === null) return;
    setAviso(null);
    try {
      const m = await api.post<MensajeChat>('/chat/mensajes', {
        receptorId: seleccion === CANAL_GENERAL ? undefined : seleccion,
        cuerpo,
      });
      agregarMensaje(m);
      actualizarResumen(m);
    } catch (err) {
      manejarError(err, 'No se pudo enviar el mensaje.');
    }
  }

  async function cargarAnteriores() {
    if (seleccion === null || mensajes.length === 0 || cargando) return;
    setCargando(true);
    try {
      const d = await api.get<{ mensajes: MensajeChat[]; hayMas: boolean }>(
        `/chat/mensajes?con=${seleccion}&antes=${encodeURIComponent(mensajes[0].creadoEn)}`,
      );
      setMensajes((prev) => [...d.mensajes, ...prev]);
      setHayMas(d.hayMas);
    } catch (err) {
      manejarError(err, 'No se pudieron cargar mensajes anteriores.');
    } finally {
      setCargando(false);
    }
  }

  function avisarEscribiendo() {
    if (seleccion === null) return;
    socket?.emit('escribiendo', { receptorId: seleccion === CANAL_GENERAL ? null : seleccion });
  }

  // La presencia en vivo manda; si el socket esta caido se usa lo que dijo la API.
  const contactosConPresencia = useMemo(
    () => contactos.map((c) => ({ ...c, enLinea: conectado ? enLinea.has(c.id) : c.enLinea })),
    [contactos, enLinea, conectado],
  );

  return {
    contactos: contactosConPresencia,
    contactosListos,
    contactoActual: contactosConPresencia.find((c) => c.id === seleccion) ?? null,
    totalEnLinea: contactosConPresencia.filter((c) => c.enLinea).length,
    ultimoGeneral,
    mensajes,
    hayMas,
    cargando,
    nombreEscribiendo: escribiendo
      ? contactos.find((c) => c.id === escribiendo)?.nombreCompleto ?? null
      : null,
    aviso,
    conectado,
    enviar,
    cargarAnteriores,
    avisarEscribiendo,
  };
}
