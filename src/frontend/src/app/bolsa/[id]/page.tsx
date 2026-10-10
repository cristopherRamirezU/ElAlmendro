'use client';

import { use, useEffect, useState } from 'react';
import { Actividad, api, ErrorApi } from '@/lib/api';
import { avisarCambioDeTesoro } from '@/lib/tesoro';
import ContenidoBolsa from '@/components/tesoro/ContenidoBolsa';

/**
 * La tarea sola (su reloj y su cronometro), sin el marco de la aplicacion.
 *
 * Es lo que se abre en la ventana aparte cuando el navegador no admite la
 * ventana flotante (Firefox, Safari), y sirve igualmente como enlace directo
 * a una tarea. Los cambios se avisan a la ventana principal para que su cofre
 * se actualice al momento.
 */
export default function PaginaBolsa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [titulo, setTitulo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soloReloj, setSoloReloj] = useState(false);

  /** Encoge la ventana hasta dejar solo el cronometro, y al reves. */
  function cambiarTamano(reloj: boolean) {
    setSoloReloj(reloj);
    try {
      window.resizeTo(reloj ? 300 : 400, reloj ? 270 : 700);
    } catch {
      /* si el navegador no deja redimensionar, al menos cambia el contenido */
    }
  }

  useEffect(() => {
    api
      .get<Actividad>(`/actividades/${id}`)
      .then((a) => setTitulo(a.titulo))
      .catch((err) => {
        if (err instanceof ErrorApi && err.estado === 401) {
          setError('Inicia sesión en TimeFlow para ver esta tarea.');
        } else {
          setError('No se pudo cargar la tarea.');
        }
      });
  }, [id]);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center">
        <p className="text-sm text-slate-400">{error}</p>
      </main>
    );
  }

  if (!titulo) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-500">
        Cargando tarea…
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-white/5 px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-orange-200/70">
          {soloReloj ? 'Cronómetro' : 'Tarea'}
        </span>
        <button
          onClick={() => cambiarTamano(!soloReloj)}
          title={soloReloj ? 'Ver la tarea completa' : 'Dejar solo el cronómetro'}
          className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          {soloReloj ? '⤢' : '—'}
        </button>
      </div>
      <ContenidoBolsa
        bolsaId={id}
        titulo={titulo}
        modo={soloReloj ? 'reloj' : 'completo'}
        onCambio={avisarCambioDeTesoro}
      />
    </main>
  );
}
