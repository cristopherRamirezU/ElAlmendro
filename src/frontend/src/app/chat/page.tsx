'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Marco from '@/components/Marco';
import ListaContactos from '@/components/chat/ListaContactos';
import Conversacion from '@/components/chat/Conversacion';
import { CANAL_GENERAL as GENERAL } from '@/lib/chat';
import { useSesion } from '@/lib/sesion';
import { useSalaChat } from '@/lib/useSalaChat';

/** Chat en vivo del equipo: canal general y conversaciones privadas. */
export default function Pagina() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[var(--tf-fondo)] text-sm text-[var(--tf-texto-tenue)]">
          Cargando…
        </main>
      }
    >
      <Marco activo="/chat" titulo="Chat del equipo" subtitulo="Conversa en vivo con tus compañeros">
        <Chat />
      </Marco>
    </Suspense>
  );
}

function Chat() {
  const parametros = useSearchParams();
  const usuario = useSesion();
  const yoId = usuario?.id ?? '';

  const [seleccion, setSeleccion] = useState<string>(parametros.get('con') ?? GENERAL);
  // En pantallas chicas solo cabe una columna: lista o conversacion.
  const [verListaMovil, setVerListaMovil] = useState(true);

  const {
    contactos,
    contactoActual,
    totalEnLinea,
    ultimoGeneral,
    mensajes,
    hayMas,
    cargando,
    nombreEscribiendo,
    aviso,
    conectado,
    enviar,
    cargarAnteriores,
    avisarEscribiendo,
  } = useSalaChat({ yoId, seleccion });

  function elegir(id: string) {
    setSeleccion(id);
    setVerListaMovil(false);
    const url = id === GENERAL ? '/chat' : `/chat?con=${id}`;
    window.history.replaceState(null, '', url);
  }

  return (
    <div className="flex h-[calc(100vh-8.25rem)] min-h-[28rem] flex-col gap-3">
      {aviso && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-[var(--tf-acento-rojo)]"
        >
          {aviso}
        </p>
      )}
      {!conectado && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-[var(--tf-acento-ambar)]">
          Reconectando con el chat en vivo… los mensajes que envies igual quedan guardados.
        </p>
      )}

      <div className="tf-card-pro tf-enter grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl md:grid-cols-[19rem_1fr]">
        <div className={`min-h-0 border-[var(--tf-borde)] md:border-r ${verListaMovil ? 'flex' : 'hidden md:flex'} flex-col`}>
          <ListaContactos
            contactos={contactos}
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
