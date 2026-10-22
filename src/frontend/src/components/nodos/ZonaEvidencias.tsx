'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { api, ErrorApi, Evidencia, URL_API } from '@/lib/api';

/** Debe calzar con el limite del servidor (evidencias/limites-subida.ts). */
const TAMANO_MAXIMO_MB = 25;
/** Cuanto de un archivo de texto se muestra en la vista previa. */
const LARGO_VISTA_TEXTO = 600;

function tamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Un archivo elegido y su vista previa, todavia sin subir. */
interface Elegido {
  archivo: File;
  /** URL local de la imagen (se libera al cambiarla o al salir). */
  imagen: string | null;
  /** Comienzo del texto, si es un archivo de texto. */
  texto: string | null;
  /** Dimensiones de la imagen, una vez cargada. */
  medidas: string | null;
}

/**
 * Evidencias de la tarea: una zona grande para arrastrar o elegir un archivo
 * y, antes de subirlo, su vista previa (miniatura si es imagen, el comienzo
 * si es texto, icono y tamano en lo demas) con subir, cambiar o quitar. Debajo,
 * los archivos ya subidos, que se abren o se eliminan (con confirmacion ahi
 * mismo). Con la tarea completada ya no se aceptan archivos.
 */
export default function ZonaEvidencias({
  actividadId,
  evidencias,
  terminada,
  onCambio,
  onRecargar,
}: {
  actividadId: string;
  evidencias: Evidencia[];
  terminada: boolean;
  /** La lista de archivos cambio (se subio o se elimino uno). */
  onCambio: (evidencias: Evidencia[]) => void;
  /** Algo fallo de forma que conviene poner al dia todo el panel. */
  onRecargar: () => Promise<void>;
}) {
  const [elegido, setElegido] = useState<Elegido | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Adjunto que se esta por eliminar: la fila pide confirmacion ahi mismo.
  const [porEliminar, setPorEliminar] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLParagraphElement>(null);

  // La URL local de la imagen se libera al cambiarla o al cerrar el panel.
  useEffect(() => {
    const url = elegido?.imagen;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [elegido?.imagen]);

  const recargarLista = () => api.get<Evidencia[]>(`/evidencias?actividadId=${actividadId}`);

  /** Prepara la vista previa del archivo elegido o soltado; todavia no se sube. */
  function elegir(archivo: File | undefined) {
    if (input.current) input.current.value = '';
    if (!archivo) return;
    setAviso(null);
    if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setAviso(`«${archivo.name}» pesa ${tamano(archivo.size)}: el límite es de ${TAMANO_MAXIMO_MB} MB.`);
      return;
    }
    const esImagen = archivo.type.startsWith('image/');
    const nuevo: Elegido = { archivo, imagen: esImagen ? URL.createObjectURL(archivo) : null, texto: null, medidas: null };
    setElegido(nuevo);
    if (!esImagen && (archivo.type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(archivo.name))) {
      archivo
        .slice(0, LARGO_VISTA_TEXTO)
        .text()
        .then((texto) => setElegido((e) => (e?.archivo === archivo ? { ...e, texto } : e)))
        .catch(() => undefined);
    }
  }

  async function subir() {
    if (!elegido) return;
    setAviso(null);
    setSubiendo(true);
    try {
      const formulario = new FormData();
      formulario.append('archivo', elegido.archivo);
      formulario.append('actividadId', actividadId);
      await api.subirArchivo('/evidencias', formulario);
      setElegido(null);
      onCambio(await recargarLista());
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  }

  /** Desiste de eliminar: el foco vuelve al boton de basurero de esa fila. */
  function cancelarEliminar(id: string) {
    setPorEliminar(null);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-eliminar-adjunto="${id}"]`)?.focus(),
    );
  }

  /** Elimina un adjunto ya confirmado; si el servidor lo rechaza, dice por que. */
  async function eliminar(id: string) {
    setAviso(null);
    setEliminando(true);
    try {
      await api.delete(`/evidencias/${id}`);
      setPorEliminar(null);
      onCambio(await recargarLista());
      // La fila desaparece: el foco pasa al titulo de la lista en vez de perderse.
      requestAnimationFrame(() => titulo.current?.focus());
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo eliminar el archivo.');
      // Si algo cambio mientras tanto (p. ej. la tarea se completo en otra
      // ventana), el panel completo se pone al dia y la fila vuelve a su estado.
      setPorEliminar(null);
      onRecargar().catch(() => undefined);
      requestAnimationFrame(() => titulo.current?.focus());
    } finally {
      setEliminando(false);
    }
  }

  return (
    <section aria-labelledby={`evidencias-${actividadId}`}>
      <div className="mb-2 flex items-center justify-between">
        <p
          id={`evidencias-${actividadId}`}
          ref={titulo}
          tabIndex={-1}
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8fa0d0] outline-none"
        >
          Evidencias
        </p>
        <span className="text-[11px] tabular-nums text-[#8fa0d0]">{evidencias.length}</span>
      </div>

      {aviso && (
        <p role="alert" className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {aviso}
        </p>
      )}

      <input
        ref={input}
        type="file"
        className="hidden"
        onChange={(e) => elegir(e.target.files?.[0])}
      />

      {!terminada &&
        (elegido ? (
          // ------------------------------- vista previa, antes de subir
          <div className="tf-vidrio overflow-hidden rounded-2xl">
            <div className="relative grid h-40 place-items-center overflow-hidden bg-[#0d1328]">
              {elegido.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={elegido.imagen}
                  alt={`Vista previa de ${elegido.archivo.name}`}
                  className="h-full w-full object-contain"
                  onLoad={(e) => {
                    const { naturalWidth: an, naturalHeight: al } = e.currentTarget;
                    setElegido((x) => (x && x.imagen === elegido.imagen ? { ...x, medidas: `${an} × ${al}` } : x));
                  }}
                />
              ) : elegido.texto !== null ? (
                <pre className="h-full w-full overflow-hidden whitespace-pre-wrap break-words p-3 text-left text-[10px] leading-relaxed text-slate-300">
                  {elegido.texto}
                </pre>
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#9fb4ff]">
                  <FileText size={34} aria-hidden />
                  <span className="text-[11px] uppercase tracking-[0.18em]">
                    {elegido.archivo.name.split('.').pop()?.slice(0, 6) || 'archivo'}
                  </span>
                </div>
              )}
              <span className="absolute left-2.5 top-2.5 rounded-full bg-[#0a0f22]/85 px-2.5 py-0.5 text-[10px] text-[#c9d4ff]">
                Vista previa
              </span>
            </div>
            <div className="px-4 py-3">
              <p className="truncate text-sm text-white" title={elegido.archivo.name}>
                {elegido.archivo.name}
              </p>
              <p className="mb-3 mt-0.5 text-[11px] text-slate-500">
                {tamano(elegido.archivo.size)}
                {elegido.medidas && ` · ${elegido.medidas}`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={subir}
                  disabled={subiendo}
                  className="tf-boton-vidrio flex-1 rounded-xl py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {subiendo ? 'Subiendo…' : 'Subir archivo'}
                </button>
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  disabled={subiendo}
                  className="rounded-xl border border-white/15 px-3.5 text-xs text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={() => setElegido(null)}
                  disabled={subiendo}
                  className="rounded-xl border border-white/15 px-3.5 text-xs text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        ) : (
          // ------------------------------- zona para arrastrar o elegir
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              elegir(e.dataTransfer.files?.[0]);
            }}
            className={`flex min-h-44 flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed p-5 text-center transition-colors ${
              arrastrando ? 'border-white/60 bg-white/10' : 'border-white/30 bg-white/[0.04]'
            }`}
          >
            <span className="tf-boton-vidrio grid h-12 w-12 place-items-center rounded-2xl text-white">
              <Upload size={20} aria-hidden />
            </span>
            <p className="text-[13px] text-white">{arrastrando ? 'Suelta el archivo aquí' : 'Arrastra un archivo aquí'}</p>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="tf-boton-vidrio rounded-xl px-5 py-2.5 text-xs font-semibold text-white"
            >
              Elegir archivo
            </button>
            <p className="text-[10px] text-slate-500">Imagen, PDF o documento · hasta {TAMANO_MAXIMO_MB} MB</p>
          </div>
        ))}

      {/* ------------------------------- archivos ya subidos */}
      {evidencias.length === 0 ? (
        terminada && (
          <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-slate-500">
            Tarea completada sin archivos adjuntos.
          </p>
        )
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {evidencias.map((ev) =>
            porEliminar === ev.id ? (
              <li
                key={ev.id}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs"
                onKeyDown={(e) => {
                  if (e.key !== 'Escape' || eliminando) return;
                  // Escape aqui cancela la confirmacion, no cierra la ventana.
                  e.preventDefault();
                  cancelarEliminar(ev.id);
                }}
              >
                <p className="mb-2 text-rose-200">
                  ¿Eliminar <span className="break-all font-semibold">{ev.nombreArchivo}</span>? No se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => eliminar(ev.id)}
                    disabled={eliminando}
                    className="flex-1 rounded-lg bg-rose-600 py-1.5 font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                  >
                    {eliminando ? 'Eliminando…' : 'Eliminar'}
                  </button>
                  <button
                    autoFocus
                    onClick={() => cancelarEliminar(ev.id)}
                    disabled={eliminando}
                    className="flex-1 rounded-lg border border-white/15 py-1.5 font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </li>
            ) : (
              <li key={ev.id} className="flex items-stretch gap-1.5">
                <a
                  href={`${URL_API}/evidencias/${ev.id}/descargar`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 transition hover:bg-white/[0.07]"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(127,157,255,0.14)] text-[#9fb4ff]">
                    {ev.tipoMime.startsWith('image/') ? (
                      <ImageIcon size={14} aria-hidden />
                    ) : ev.tipoMime === 'application/pdf' ? (
                      <FileText size={14} aria-hidden />
                    ) : (
                      <Paperclip size={14} aria-hidden />
                    )}
                  </span>
                  <span className="truncate">{ev.nombreArchivo}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-500">{tamano(ev.tamanoBytes)}</span>
                </a>
                {ev.puedeEliminar && !terminada && (
                  <button
                    onClick={() => {
                      setAviso(null);
                      setPorEliminar(ev.id);
                    }}
                    data-eliminar-adjunto={ev.id}
                    aria-label={`Eliminar ${ev.nombreArchivo}`}
                    title="Eliminar archivo"
                    className="grid w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
