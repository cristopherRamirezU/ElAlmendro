'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Maximize2, MessageCircle } from 'lucide-react';
import { CANAL_GENERAL, useChat } from '@/lib/chat';
import { useSalaChat } from '@/lib/useSalaChat';
import Conversacion from './Conversacion';
import ListaContactos from './ListaContactos';

interface EstadoFlotante {
  abierto: boolean;
  /** Conversacion a la vista; null muestra la lista de contactos. */
  seleccion: string | null;
}

const PLEGADO: EstadoFlotante = { abierto: false, seleccion: null };

/**
 * Cada pantalla monta su propio Marco, asi que este componente se desmonta al
 * navegar. Lo abierto se guarda por pestana (y por usuario) para que el chat
 * siga igual en la pantalla siguiente, y al volver otro dia parta plegado.
 */
const claveEstado = (usuarioId: string) => `tf_chat_flotante_${usuarioId}`;

function leerEstado(usuarioId: string): EstadoFlotante {
  try {
    const guardado = window.sessionStorage.getItem(claveEstado(usuarioId));
    return guardado ? { ...PLEGADO, ...(JSON.parse(guardado) as Partial<EstadoFlotante>) } : PLEGADO;
  } catch {
    return PLEGADO;
  }
}

/** Lo que se estaba escribiendo sobrevive a la navegacion, igual que lo abierto. */
const borradores = new Map<string, string>();

/**
 * Chat desplegable al pie de la pantalla, siempre a mano. No se muestra en
 * /chat: ahi la pantalla completa ya cumple esa funcion (lo decide Marco).
 */
export default function ChatFlotante({ yoId }: { yoId: string }) {
  const { noLeidos } = useChat();
  const [{ abierto, seleccion }, setEstado] = useState(() => leerEstado(yoId));

  useEffect(() => {
    try {
      window.sessionStorage.setItem(claveEstado(yoId), JSON.stringify({ abierto, seleccion }));
    } catch {
      /* sin persistencia: al navegar vuelve a partir plegado */
    }
  }, [yoId, abierto, seleccion]);

  const sala = useSalaChat({ yoId, activa: abierto, seleccion: abierto ? seleccion : null });
  const { contactoActual, contactosListos } = sala;

  // La conversacion recordada puede ser de alguien que ya no esta en la nomina.
  const contactoPerdido =
    abierto && seleccion !== null && seleccion !== CANAL_GENERAL && contactosListos && !contactoActual;
  useEffect(() => {
    if (contactoPerdido) setEstado((e) => ({ ...e, seleccion: null }));
  }, [contactoPerdido]);

  const elegir = (id: string | null) => setEstado((e) => ({ ...e, seleccion: id }));
  const claveBorrador = `${yoId}:${seleccion}`;
  const conversacionLista = seleccion === CANAL_GENERAL || contactoActual !== null;

  return (
    <section
      aria-label="Chat del equipo"
      className={`fixed bottom-0 right-4 z-30 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-t-xl border border-b-0 border-white/10 bg-slate-900 shadow-2xl ${
        abierto ? 'h-[min(32rem,calc(100dvh-5rem))] w-[22rem]' : 'w-64'
      }`}
    >
      <div className="flex shrink-0 items-center border-b border-white/10">
        <button
          type="button"
          onClick={() => setEstado((e) => ({ ...e, abierto: !e.abierto }))}
          aria-expanded={abierto}
          title={abierto ? 'Plegar el chat' : 'Desplegar el chat'}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition hover:bg-white/5"
        >
          <MessageCircle size={16} className="shrink-0 text-slate-300" aria-hidden />
          <span className="flex-1 truncate text-sm font-semibold text-white">Chat</span>
          {noLeidos > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
              {noLeidos > 99 ? '99+' : noLeidos}
            </span>
          )}
          {abierto ? (
            <ChevronDown size={16} className="shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronUp size={16} className="shrink-0 text-slate-400" aria-hidden />
          )}
        </button>
        {abierto && (
          <Link
            href={seleccion && seleccion !== CANAL_GENERAL ? `/chat?con=${seleccion}` : '/chat'}
            title="Abrir en Chat del equipo"
            aria-label="Abrir en Chat del equipo"
            className="grid h-10 w-10 shrink-0 place-items-center text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <Maximize2 size={14} aria-hidden />
          </Link>
        )}
      </div>

      {abierto && (
        <>
          {sala.aviso && (
            <p role="alert" className="shrink-0 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-300">
              {sala.aviso}
            </p>
          )}
          {!sala.conectado && (
            <p className="shrink-0 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
              Reconectando… los mensajes que envies igual quedan guardados.
            </p>
          )}
          <div className="flex min-h-0 flex-1 flex-col">
            {seleccion === null ? (
              <ListaContactos
                contactos={sala.contactos}
                ultimoGeneral={sala.ultimoGeneral}
                seleccion=""
                totalEnLinea={sala.totalEnLinea}
                onElegir={elegir}
              />
            ) : conversacionLista ? (
              <Conversacion
                key={seleccion}
                yoId={yoId}
                contacto={contactoActual}
                totalEnLinea={sala.totalEnLinea}
                mensajes={sala.mensajes}
                hayMas={sala.hayMas}
                cargando={sala.cargando}
                nombreEscribiendo={sala.nombreEscribiendo}
                onEnviar={sala.enviar}
                onCargarAnteriores={sala.cargarAnteriores}
                onEscribiendo={sala.avisarEscribiendo}
                onVolver={() => elegir(null)}
                siempreVolver
                borradorInicial={borradores.get(claveBorrador)}
                onBorrador={(texto) => borradores.set(claveBorrador, texto)}
              />
            ) : (
              <p className="grid flex-1 place-items-center text-xs text-slate-500">Cargando…</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
