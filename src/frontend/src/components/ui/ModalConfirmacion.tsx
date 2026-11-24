'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';

/**
 * Diálogo explícito de confirmación para acciones destructivas o sensibles,
 * en reemplazo de `window.confirm` nativo del navegador.
 */
export default function ModalConfirmacion({
  abierto,
  titulo,
  descripcion,
  detalles,
  etiquetaConfirmar = 'Confirmar',
  etiquetaCancelar = 'Cancelar',
  variante = 'peligro',
  ocupado = false,
  onConfirmar,
  onCancelar,
}: {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  detalles?: string[];
  etiquetaConfirmar?: string;
  etiquetaCancelar?: string;
  variante?: 'peligro' | 'advertencia' | 'primario';
  ocupado?: boolean;
  onConfirmar: () => Promise<void> | void;
  onCancelar: () => void;
}) {
  if (!abierto) return null;

  const esPeligro = variante === 'peligro';
  const esAdvertencia = variante === 'advertencia';

  const claseIcono = esPeligro
    ? 'bg-rose-500/15 text-[var(--tf-acento-rojo)] border-rose-500/30'
    : esAdvertencia
      ? 'bg-amber-500/15 text-[var(--tf-acento-ambar)] border-amber-500/30'
      : 'bg-sky-500/15 text-[var(--tf-acento-azul)] border-sky-500/30';

  const claseBoton = esPeligro
    ? 'bg-rose-600 text-white hover:bg-rose-500'
    : esAdvertencia
      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
      : 'bg-[var(--color-primario)] text-[var(--tf-texto-primario)] hover:brightness-110';

  return (
    <Modal
      ancho="md"
      bloqueado={ocupado}
      onCerrar={() => {
        if (!ocupado) onCancelar();
      }}
      titulo={
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${claseIcono}`}
          >
            {esPeligro ? <Trash2 size={15} /> : <AlertTriangle size={15} />}
          </span>
          <span className="truncate">{titulo}</span>
        </span>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--tf-texto-tenue)]">{descripcion}</p>

      {detalles && detalles.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-3 text-xs text-[var(--tf-texto)]">
          {detalles.map((d, i) => (
            <li key={i} className="flex items-start gap-2">
              <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--tf-texto-suave)]" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--tf-borde)] pt-4">
        <button
          type="button"
          onClick={onCancelar}
          disabled={ocupado}
          className="rounded-xl border border-[var(--tf-borde)] px-4 py-2 text-sm font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-50"
        >
          {etiquetaCancelar}
        </button>
        <button
          type="button"
          onClick={() => onConfirmar()}
          disabled={ocupado}
          className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${claseBoton}`}
        >
          {ocupado ? 'Procesando…' : etiquetaConfirmar}
        </button>
      </div>
    </Modal>
  );
}
