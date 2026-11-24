'use client';

import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { URL_API } from '@/lib/api';
import { minutosSegundos } from '@/lib/grabadora';

/**
 * Reproductor del comentario de voz de una tarea.
 *
 * El audio se descarga con la cookie de sesion y se reproduce desde memoria:
 * Safari no reproduce un audio servido sin respuestas por rangos, y asi
 * funciona igual en todos los navegadores (los audios pesan pocos MB).
 */
export function ReproductorComentarioVoz({
  actividadId,
  audioId,
  segundos,
  etiqueta,
}: {
  actividadId: string;
  audioId: string;
  segundos?: number | null;
  etiqueta?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    let local: string | null = null;
    setUrl(null);
    setFallo(false);
    fetch(`${URL_API}/actividades/${actividadId}/audios/${audioId}`, {
      credentials: 'include',
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        if (!vigente) return;
        local = URL.createObjectURL(blob);
        setUrl(local);
      })
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
      if (local) URL.revokeObjectURL(local);
    };
  }, [actividadId, audioId]);

  return <ReproductorLocal url={url} segundos={segundos} fallo={fallo} etiqueta={etiqueta} />;
}

/** Reproductor sobre una URL local (grabacion recien hecha o audio ya descargado). */
export function ReproductorLocal({
  url,
  segundos,
  fallo = false,
  etiqueta = 'Comentario de voz',
}: {
  url: string | null;
  segundos?: number | null;
  fallo?: boolean;
  etiqueta?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tf-acento-azul)]">
        <Mic size={13} aria-hidden />
        {etiqueta}
        {segundos ? <span className="font-normal tabular-nums text-[var(--tf-texto-tenue)]">· {minutosSegundos(segundos)}</span> : null}
      </p>
      {fallo ? (
        <p className="text-[11px] text-[var(--tf-acento-rojo)]">No se pudo cargar el audio.</p>
      ) : url ? (
        <audio controls preload="metadata" src={url} className="h-9 w-full" aria-label={etiqueta} />
      ) : (
        <div className="h-9 w-full animate-pulse rounded-full bg-[var(--tf-hover)]" aria-label="Cargando audio" />
      )}
    </div>
  );
}
