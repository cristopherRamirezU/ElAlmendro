'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Evidencia, URL_API } from '@/lib/api';

type TipoVista = 'imagen' | 'pdf' | 'audio' | 'video' | 'texto' | 'otro';

const LIMITE_TEXTO_BYTES = 512 * 1024;

function clasificarEvidencia(ev: Evidencia): TipoVista {
  const mime = ev.tipoMime.toLowerCase();
  if (mime.startsWith('image/') && mime !== 'image/svg+xml') return 'imagen';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (
    ev.tamanoBytes <= LIMITE_TEXTO_BYTES &&
    (mime === 'text/plain' ||
      mime === 'text/csv' ||
      mime === 'text/markdown' ||
      mime === 'application/json' ||
      /\.(txt|md|csv|json|log)$/i.test(ev.nombreArchivo))
  ) {
    return 'texto';
  }
  return 'otro';
}

function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Visor modal para previsualizar evidencias ya subidas sin forzar su descarga.
 * Usa el endpoint `/evidencias/:id/vista` con cookies httpOnly y convierte a
 * Blob URL en memoria (liberado al cerrar).
 */
export default function VisorEvidencia({
  evidencia,
  onCerrar,
}: {
  evidencia: Evidencia;
  onCerrar: () => void;
}) {
  const tipo = clasificarEvidencia(evidencia);
  const urlDescarga = `${URL_API}/evidencias/${evidencia.id}/descargar`;
  const [cargando, setCargando] = useState(tipo !== 'otro');
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [medidas, setMedidas] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  const cargar = useCallback(() => {
    setError(null);
    setIntento((n) => n + 1);
  }, []);

  useEffect(() => {
    if (tipo === 'otro') {
      setCargando(false);
      return;
    }

    const controlador = new AbortController();
    let urlGenerada: string | null = null;

    setCargando(true);
    setError(null);
    setBlobUrl(null);
    setTexto(null);
    setMedidas(null);

    fetch(`${URL_API}/evidencias/${evidencia.id}/vista`, {
      credentials: 'include',
      signal: controlador.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('No se pudo cargar la vista previa del archivo.');
        }
        const blob = await res.blob();
        if (controlador.signal.aborted) return;

        if (tipo === 'texto') {
          const contenido = await blob.text();
          if (!controlador.signal.aborted) {
            setTexto(contenido);
          }
          return;
        }

        urlGenerada = URL.createObjectURL(blob);
        setBlobUrl(urlGenerada);
      })
      .catch((err) => {
        if (controlador.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la previsualización.',
        );
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false);
      });

    return () => {
      controlador.abort();
      if (urlGenerada) URL.revokeObjectURL(urlGenerada);
    };
  }, [evidencia.id, tipo, intento]);

  return (
    <Modal
      titulo={<span className="block truncate">{evidencia.nombreArchivo}</span>}
      ancho="lg"
      onCerrar={onCerrar}
      acciones={
        <a
          href={urlDescarga}
          download
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25"
        >
          <Download size={13} aria-hidden />
          <span>Descargar</span>
        </a>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>Subido por: {evidencia.subidaPor.nombreCompleto}</span>
        <span>Tamaño: {tamanoLegible(evidencia.tamanoBytes)}</span>
        {medidas && <span>Resolución: {medidas}</span>}
      </div>

      {cargando ? (
        <div className="grid h-64 place-items-center rounded-2xl border border-white/10 bg-slate-950/60 text-sm text-slate-400">
          Cargando previsualización…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-8 text-center">
          <p className="text-sm text-rose-200">{error}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cargar}
              className="rounded-xl border border-white/15 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              Reintentar
            </button>
            <a
              href={urlDescarga}
              download
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
            >
              <Download size={13} aria-hidden />
              Descargar archivo
            </a>
          </div>
        </div>
      ) : tipo === 'imagen' && blobUrl ? (
        <div className="grid max-h-[65vh] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt={evidencia.nombreArchivo}
            className="max-h-[62vh] w-auto rounded-lg object-contain"
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              setMedidas(`${naturalWidth} × ${naturalHeight}`);
            }}
          />
        </div>
      ) : tipo === 'pdf' && blobUrl ? (
        <iframe
          src={blobUrl}
          title={evidencia.nombreArchivo}
          className="h-[65vh] w-full rounded-2xl border border-white/10 bg-white"
        />
      ) : tipo === 'audio' && blobUrl ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-8">
          <p className="text-xs text-slate-400">Reproducción directa de audio</p>
          <audio src={blobUrl} controls className="w-full max-w-md" />
        </div>
      ) : tipo === 'video' && blobUrl ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <video src={blobUrl} controls className="max-h-[65vh] w-full" />
        </div>
      ) : tipo === 'texto' && texto !== null ? (
        <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
          {texto}
        </pre>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-10 text-center">
          <FileText size={36} className="text-slate-400" aria-hidden />
          <p className="text-sm font-medium text-white">
            Este formato no admite vista previa en el navegador
          </p>
          <p className="text-xs text-slate-400">
            Tipo: <span className="font-mono">{evidencia.tipoMime}</span> ·{' '}
            {tamanoLegible(evidencia.tamanoBytes)}
          </p>
          <a
            href={urlDescarga}
            download
            className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500"
          >
            <Download size={14} aria-hidden />
            Descargar para abrir
          </a>
        </div>
      )}
    </Modal>
  );
}
