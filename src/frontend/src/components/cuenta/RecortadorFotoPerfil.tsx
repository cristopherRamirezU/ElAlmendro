'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { colorTextoSobre } from '@/lib/color';

const TAMANO_VISOR = 260;
const TAMANO_PREVIEW = 56;
const LADO_SALIDA = 256;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

interface InfoImagen {
  url: string;
  ancho: number;
  alto: number;
}

function limitarDesplazamiento(
  x: number,
  y: number,
  zoom: number,
  info: InfoImagen,
): { x: number; y: number } {
  const baseScale = TAMANO_VISOR / Math.min(info.ancho, info.alto);
  const displayW = info.ancho * baseScale * zoom;
  const displayH = info.alto * baseScale * zoom;
  const maxX = Math.max(0, (displayW - TAMANO_VISOR) / 2);
  const maxY = Math.max(0, (displayH - TAMANO_VISOR) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

/**
 * Recortador visual de foto de perfil disponible para todos los roles.
 * Permite arrastrar, hacer zoom y centrar el rostro dentro de un círculo
 * antes de generar el cuadrado de 256×256 que se envía a la API.
 */
export default function RecortadorFotoPerfil({
  archivo,
  colorPrimario,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  archivo: File;
  colorPrimario: string;
  enviando: boolean;
  onCancelar: () => void;
  onConfirmar: (blob: Blob) => Promise<void> | void;
}) {
  const [info, setInfo] = useState<InfoImagen | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [arrastrando, setArrastrando] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const arrastreRef = useRef<{
    pointerId: number;
    inicioX: number;
    inicioY: number;
    origenX: number;
    origenY: number;
  } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    let activo = true;

    img.onload = () => {
      if (!activo) return;
      if (!img.naturalWidth || !img.naturalHeight) {
        setErrorCarga('No se pudo leer las dimensiones de la imagen.');
        return;
      }
      imgRef.current = img;
      setInfo({ url, ancho: img.naturalWidth, alto: img.naturalHeight });
      setZoom(1);
      setPos({ x: 0, y: 0 });
      setErrorCarga(null);
    };
    img.onerror = () => {
      if (activo) setErrorCarga('No se pudo abrir esta imagen. Prueba con JPG, PNG o WebP.');
    };
    img.src = url;

    return () => {
      activo = false;
      imgRef.current = null;
      URL.revokeObjectURL(url);
    };
  }, [archivo]);

  const aplicarZoom = useCallback(
    (nuevoZoom: number) => {
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(nuevoZoom.toFixed(2))));
      setZoom(z);
      if (info) {
        setPos((prev) => limitarDesplazamiento(prev.x, prev.y, z, info));
      }
    },
    [info],
  );

  function centrar() {
    setZoom(1);
    setPos({ x: 0, y: 0 });
  }

  function alBajarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    if (!info || enviando) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastreRef.current = {
      pointerId: e.pointerId,
      inicioX: e.clientX,
      inicioY: e.clientY,
      origenX: pos.x,
      origenY: pos.y,
    };
    setArrastrando(true);
  }

  function alMoverPuntero(e: React.PointerEvent<HTMLDivElement>) {
    if (!info || !arrastreRef.current || arrastreRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - arrastreRef.current.inicioX;
    const dy = e.clientY - arrastreRef.current.inicioY;
    setPos(
      limitarDesplazamiento(
        arrastreRef.current.origenX + dx,
        arrastreRef.current.origenY + dy,
        zoom,
        info,
      ),
    );
  }

  function alSoltarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    if (arrastreRef.current?.pointerId === e.pointerId) {
      arrastreRef.current = null;
      setArrastrando(false);
    }
  }

  function alRueda(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!info || enviando) return;
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    aplicarZoom(zoom + delta);
  }

  async function guardarRecorte() {
    const imagen = imgRef.current;
    if (!info || !imagen) return;

    const baseScale = TAMANO_VISOR / Math.min(info.ancho, info.alto);
    const escalaTotal = baseScale * zoom;
    const displayW = info.ancho * escalaTotal;
    const displayH = info.alto * escalaTotal;

    const sx = (displayW / 2 - TAMANO_VISOR / 2 - pos.x) / escalaTotal;
    const sy = (displayH / 2 - TAMANO_VISOR / 2 - pos.y) / escalaTotal;
    const sLado = TAMANO_VISOR / escalaTotal;

    const lienzo = document.createElement('canvas');
    lienzo.width = LADO_SALIDA;
    lienzo.height = LADO_SALIDA;
    const g = lienzo.getContext('2d');
    if (!g) {
      setErrorCarga('Tu navegador no pudo preparar el recorte de la imagen.');
      return;
    }
    g.imageSmoothingQuality = 'high';
    g.drawImage(imagen, sx, sy, sLado, sLado, 0, 0, LADO_SALIDA, LADO_SALIDA);

    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/webp', 0.88));
    if (!blob) {
      setErrorCarga('No se pudo exportar el recorte. Intenta nuevamente.');
      return;
    }
    await onConfirmar(blob);
  }

  const baseScale = info ? TAMANO_VISOR / Math.min(info.ancho, info.alto) : 1;
  const displayW = info ? info.ancho * baseScale * zoom : TAMANO_VISOR;
  const displayH = info ? info.alto * baseScale * zoom : TAMANO_VISOR;
  const factorMini = TAMANO_PREVIEW / TAMANO_VISOR;

  return (
    <Modal
      titulo="Encuadrar foto de perfil"
      ancho="md"
      bloqueado={enviando}
      onCerrar={onCancelar}
    >
      {errorCarga ? (
        <div className="space-y-4 text-center">
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-[var(--tf-acento-rojo)]">
            {errorCarga}
          </p>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl border border-[var(--tf-borde)] px-4 py-2 text-xs font-semibold text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)]"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="flex items-center gap-1.5 text-xs text-[var(--tf-texto-tenue)]">
            <Move size={13} aria-hidden />
            <span>Arrastra la foto para moverla y ajusta el acercamiento dentro del círculo.</span>
          </p>

          {/* Visor circular interactivo */}
          <div
            onPointerDown={alBajarPuntero}
            onPointerMove={alMoverPuntero}
            onPointerUp={alSoltarPuntero}
            onPointerCancel={alSoltarPuntero}
            onWheel={alRueda}
            style={{ width: TAMANO_VISOR, height: TAMANO_VISOR }}
            className={`relative select-none overflow-hidden rounded-2xl border border-[var(--tf-borde-fuerte)] bg-slate-950 touch-none ${
              arrastrando ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {info && (
              // eslint-disable-next-line @next/next/no-img-element -- previsualización local del Blob recién seleccionado
              <img
                src={info.url}
                alt="Previsualización para recortar"
                draggable={false}
                style={{
                  width: displayW,
                  height: displayH,
                  left: TAMANO_VISOR / 2 + pos.x - displayW / 2,
                  top: TAMANO_VISOR / 2 + pos.y - displayH / 2,
                }}
                className="pointer-events-none absolute max-w-none select-none"
              />
            )}

            {/* Máscara circular y guía con el color de marca */}
            <div
              aria-hidden
              style={{
                boxShadow: '0 0 0 999px rgba(4, 8, 20, 0.68)',
                borderColor: colorPrimario,
              }}
              className="pointer-events-none absolute inset-0 rounded-full border-2"
            />
          </div>

          {/* Controles de zoom y centrar + vista previa circular real */}
          <div className="flex w-full items-center gap-3 rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-3">
            <div
              style={{ width: TAMANO_PREVIEW, height: TAMANO_PREVIEW }}
              title="Así se verá tu avatar"
              className="relative shrink-0 overflow-hidden rounded-full border border-[var(--tf-borde-fuerte)] bg-slate-950"
            >
              {info && (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura sincronizada en vivo
                <img
                  src={info.url}
                  alt=""
                  aria-hidden
                  draggable={false}
                  style={{
                    width: displayW * factorMini,
                    height: displayH * factorMini,
                    left: (TAMANO_VISOR / 2 + pos.x - displayW / 2) * factorMini,
                    top: (TAMANO_VISOR / 2 + pos.y - displayH / 2) * factorMini,
                  }}
                  className="pointer-events-none absolute max-w-none select-none"
                />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => aplicarZoom(zoom - 0.15)}
                  disabled={zoom <= ZOOM_MIN || enviando}
                  aria-label="Alejar foto"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-40"
                >
                  <ZoomOut size={14} aria-hidden />
                </button>
                <input
                  type="range"
                  min={ZOOM_MIN}
                  max={ZOOM_MAX}
                  step={0.02}
                  value={zoom}
                  onChange={(e) => aplicarZoom(Number(e.target.value))}
                  aria-label="Acercamiento de la foto"
                  style={{ accentColor: colorPrimario }}
                  className="h-1.5 w-full cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => aplicarZoom(zoom + 0.15)}
                  disabled={zoom >= ZOOM_MAX || enviando}
                  aria-label="Acercar foto"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-40"
                >
                  <ZoomIn size={14} aria-hidden />
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--tf-texto-suave)]">
                <span className="font-mono tabular-nums">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={centrar}
                  disabled={enviando}
                  className="inline-flex items-center gap-1 font-medium text-[var(--tf-texto-tenue)] transition hover:text-[var(--tf-texto)]"
                >
                  <RotateCcw size={11} aria-hidden />
                  Centrar
                </button>
              </div>
            </div>
          </div>

          <div className="flex w-full justify-end gap-2 border-t border-[var(--tf-borde)] pt-3">
            <button
              type="button"
              onClick={onCancelar}
              disabled={enviando}
              className="rounded-xl border border-[var(--tf-borde)] px-4 py-2 text-xs font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarRecorte}
              disabled={enviando || !info}
              style={{
                backgroundColor: colorPrimario,
                color: colorTextoSobre(colorPrimario),
              }}
              className="rounded-xl px-5 py-2 text-xs font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {enviando ? 'Guardando…' : 'Guardar foto'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
