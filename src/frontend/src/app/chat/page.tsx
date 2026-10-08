'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Marco from '@/components/Marco';
import ListaContactos from '@/components/chat/ListaContactos';
import Conversacion from '@/components/chat/Conversacion';
import { api, ContactoChat, ContactosChat, ErrorApi, MensajeChat, ResumenMensaje } from '@/lib/api';
import { CANAL_GENERAL as GENERAL, useChat } from '@/lib/chat';
import { useSesion } from '@/lib/sesion';

/** Chat en vivo del equipo: canal general y conversaciones privadas. */
export default function Pagina() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400">
          Cargando…
        </main>
      }
    >
      <Marco activo="/chat" titulo="Chat del equipo" subtitulo="Conversa en vivo con tus companeros">
        <Chat />
      </Marco>
    </Suspense>
  );
}

function perteneceA(m: MensajeChat, seleccion: string, yoId: string): boolean {
  if (seleccion === GENERAL) return m.receptorId === null;
  return (
    (m.emisorId === seleccion && m.receptorId === yoId) ||
    (m.emisorId === yoId && m.receptorId === seleccion)
  );
}

function Chat() {
  const router = useRouter();
  const parametros = useSearchParams();
  const usuario = useSesion();
  const { socket, enLinea, conectado, refrescarNoLeidos } = useChat();
  const yoId = usuario?.id ?? '';

  const [contactos, setContactos] = useState<ContactoChat[]>([]);
  const [ultimoGeneral, setUltimoGeneral] = useState<ResumenMensaje | null>(null);
  const [seleccion, setSeleccion] = useState<string>(parametros.get('con') ?? GENERAL);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // En pantallas chicas solo cabe una columna: lista o conversacion.
  const [verListaMovil, setVerListaMovil] = useState(true);

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
    } catch (err) {
      manejarError(err, 'No se pudo cargar la lista de contactos.');
    }
  }, [manejarError]);

  useEffect(() => {
    cargarContactos();
  }, [cargarContactos]);

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
    let vigente = true;
    setMensajes([]);
    setHayMas(false);
    setEscribiendo(null);
    setCargando(true);
    (async () => {
      try {
        const d = await api.get<{ mensajes: MensajeChat[]; hayMas: boolean }>(
          `/chat/mensajes?con=${seleccion}`,
        );
        if (!vigente) return;
        setMensajes(d.mensajes);
        setHayMas(d.hayMas);
        if (seleccion !== GENERAL) marcarLeidos(seleccion);
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
      const esGeneral = sel === GENERAL && receptorId === null && usuarioId !== yoId;
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
    setAviso(null);
    try {
      const m = await api.post<MensajeChat>('/chat/mensajes', {
        receptorId: seleccion === GENERAL ? undefined : seleccion,
        cuerpo,
      });
      agregarMensaje(m);
      actualizarResumen(m);
    } catch (err) {
      manejarError(err, 'No se pudo enviar el mensaje.');
    }
  }

  async function cargarAnteriores() {
    if (mensajes.length === 0 || cargando) return;
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
    socket?.emit('escribiendo', { receptorId: seleccion === GENERAL ? null : seleccion });
  }

  function elegir(id: string) {
    setSeleccion(id);
    setVerListaMovil(false);
    const url = id === GENERAL ? '/chat' : `/chat?con=${id}`;
    window.history.replaceState(null, '', url);
  }

  // La presencia en vivo manda; si el socket esta caido se usa lo que dijo la API.
  const contactosConPresencia = useMemo(
    () => contactos.map((c) => ({ ...c, enLinea: conectado ? enLinea.has(c.id) : c.enLinea })),
    [contactos, enLinea, conectado],
  );
  const contactoActual = seleccion === GENERAL ? null : contactosConPresencia.find((c) => c.id === seleccion) ?? null;
  const nombreEscribiendo = escribiendo ? contactos.find((c) => c.id === escribiendo)?.nombreCompleto ?? null : null;
  const totalEnLinea = contactosConPresencia.filter((c) => c.enLinea).length;

  return (
    <div className="flex h-[calc(100vh-8.25rem)] min-h-[28rem] flex-col gap-3">
      {aviso && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300"
        >
          {aviso}
        </p>
      )}
      {!conectado && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          Reconectando con el chat en vivo… los mensajes que envies igual quedan guardados.
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-sm md:grid-cols-[19rem_1fr]">
        <div className={`min-h-0 border-white/10 md:border-r ${verListaMovil ? 'flex' : 'hidden md:flex'} flex-col`}>
          <ListaContactos
            contactos={contactosConPresencia}
            ultimoGeneral={ultimoGeneral}
            seleccion={seleccion}
            totalEnLinea={totalEnLinea}
            onElegir={elegir}
          />
        </div>
        <div className={`min-h-0 ${verListaMovil ? 'hidden md:flex' : 'flex'} flex-col`}>
          <Conversacion
            key={seleccion}
            yoId={yoId}
            contacto={contactoActual}
            totalEnLinea={totalEnLinea}
            mensajes={mensajes}
            hayMas={hayMas}
            cargando={cargando}
            nombreEscribiendo={nombreEscribiendo}
            onEnviar={enviar}
            onCargarAnteriores={cargarAnteriores}
            onEscribiendo={avisarEscribiendo}
            onVolver={() => setVerListaMovil(true)}
          />
        </div>
      </div>
    </div>
  );
}
