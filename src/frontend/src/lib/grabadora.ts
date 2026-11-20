'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Tope de una grabacion; debe coincidir con AUDIO_MAXIMO_SEGUNDOS de la API. */
export const GRABACION_MAXIMA_SEGUNDOS = 300;

/** Formatos en orden de preferencia: Opus en WebM (Chrome, Firefox) o AAC en MP4 (Safari). */
const FORMATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export interface Grabacion {
  blob: Blob;
  segundos: number;
  url: string;
}

type Estado = 'inactiva' | 'pidiendo' | 'grabando';

/** Por que no se puede grabar, en palabras de la persona. */
function explicar(error: unknown): string {
  const nombre = (error as { name?: string })?.name;
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return 'No hay permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones y vuelve a intentar.';
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    return 'No se encontró un micrófono en este dispositivo.';
  }
  if (nombre === 'NotReadableError') return 'El micrófono está siendo usado por otra aplicación.';
  return 'No se pudo iniciar la grabación.';
}

/**
 * Graba audio con el microfono del dispositivo (MediaRecorder). Entrega la
 * grabacion como Blob con su duracion y una URL local para escucharla antes
 * de guardarla. Corta sola al llegar al tope y suelta el microfono al
 * terminar o al desmontarse.
 */
export function useGrabadora() {
  const [estado, setEstado] = useState<Estado>('inactiva');
  const [segundos, setSegundos] = useState(0);
  const [grabacion, setGrabacion] = useState<Grabacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grabador = useRef<MediaRecorder | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const trozos = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const reloj = useRef<number | null>(null);
  const descartar = useRef(false);

  const soltarMicrofono = useCallback(() => {
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
    if (reloj.current !== null) window.clearInterval(reloj.current);
    reloj.current = null;
  }, []);

  const detener = useCallback(() => {
    if (grabador.current && grabador.current.state !== 'inactive') grabador.current.stop();
  }, []);

  const limpiar = useCallback(() => {
    setGrabacion((g) => {
      if (g) URL.revokeObjectURL(g.url);
      return null;
    });
    setSegundos(0);
  }, []);

  const iniciar = useCallback(async () => {
    setError(null);
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite grabar audio (o la página no está en HTTPS).');
      return;
    }
    limpiar();
    setEstado('pidiendo');
    try {
      const microfono = await navigator.mediaDevices.getUserMedia({ audio: true });
      flujo.current = microfono;
      const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
      const r = new MediaRecorder(microfono, formato ? { mimeType: formato } : undefined);
      trozos.current = [];
      descartar.current = false;
      r.ondataavailable = (e) => {
        if (e.data.size > 0) trozos.current.push(e.data);
      };
      r.onstop = () => {
        const duracion = Math.max(1, Math.round((Date.now() - inicio.current) / 1000));
        soltarMicrofono();
        setEstado('inactiva');
        if (descartar.current || trozos.current.length === 0) return;
        const blob = new Blob(trozos.current, { type: r.mimeType || formato || 'audio/webm' });
        setGrabacion({ blob, segundos: Math.min(duracion, GRABACION_MAXIMA_SEGUNDOS), url: URL.createObjectURL(blob) });
      };
      grabador.current = r;
      inicio.current = Date.now();
      setSegundos(0);
      r.start(1000);
      setEstado('grabando');
      reloj.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - inicio.current) / 1000);
        setSegundos(s);
        if (s >= GRABACION_MAXIMA_SEGUNDOS) r.stop();
      }, 250);
    } catch (e) {
      soltarMicrofono();
      setEstado('inactiva');
      setError(explicar(e));
    }
  }, [limpiar, soltarMicrofono]);

  /** Corta y tira lo grabado (por ejemplo, al cancelar la edicion). */
  const cancelar = useCallback(() => {
    descartar.current = true;
    detener();
    soltarMicrofono();
    setEstado('inactiva');
    limpiar();
  }, [detener, limpiar, soltarMicrofono]);

  // Al cerrar el panel en plena grabacion, el microfono se suelta.
  useEffect(
    () => () => {
      descartar.current = true;
      if (grabador.current && grabador.current.state !== 'inactive') grabador.current.stop();
      flujo.current?.getTracks().forEach((t) => t.stop());
      if (reloj.current !== null) window.clearInterval(reloj.current);
    },
    [],
  );

  return { estado, segundos, grabacion, error, iniciar, detener, cancelar, limpiar };
}

/** 75 -> "1:15". */
export function minutosSegundos(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
