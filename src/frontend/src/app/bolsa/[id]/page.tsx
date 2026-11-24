'use client';

import { use, useEffect, useState } from 'react';
import { Actividad, api, ErrorApi, Usuario } from '@/lib/api';
import { guardarCacheSesion, leerCacheSesion } from '@/lib/cacheSesion';
import { aplicarColorMarcaEnDocumento, useColorPrimario } from '@/lib/color';
import { useAplicarTemaFondo, useTemaFondo } from '@/lib/tema';
import { avisarCambioDeTesoro } from '@/lib/tesoro';
import { EsqueletoPanelTarea } from '@/components/ui/Esqueleto';
import ContenidoBolsa from '@/components/tesoro/ContenidoBolsa';

/**
 * La tarea sola (su contador, objetivos y evidencias), sin el marco de la aplicacion.
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

  const colorPrimario = useColorPrimario();
  const temaFondo = useTemaFondo();
  useAplicarTemaFondo(temaFondo);

  useEffect(() => {
    aplicarColorMarcaEnDocumento(document, colorPrimario);
  }, [colorPrimario]);

  /** Encoge la ventana hasta dejar solo el cronometro, y al reves. */
  function cambiarTamano(reloj: boolean) {
    setSoloReloj(reloj);
    try {
      window.resizeTo(reloj ? 300 : 400, reloj ? 210 : 700);
    } catch {
      /* si el navegador no deja redimensionar, al menos cambia el contenido */
    }
  }

  useEffect(() => {
    if (!leerCacheSesion()?.usuario) {
      api
        .get<Usuario>('/auth/yo')
        .then((u) => {
          const actual = leerCacheSesion();
          guardarCacheSesion({ usuario: u, jornada: actual?.jornada ?? null });
        })
        .catch(() => undefined);
    }

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
      <main className="tf-ventana-aparte grid min-h-screen place-items-center p-6 text-center text-[var(--tf-texto)]">
        <p className="text-sm text-[var(--tf-texto-tenue)]">{error}</p>
      </main>
    );
  }

  if (!titulo) {
    return (
      <main className="tf-ventana-aparte grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-md">
          <EsqueletoPanelTarea />
        </div>
      </main>
    );
  }

  return (
    <main className="tf-ventana-aparte flex h-screen flex-col text-[var(--tf-texto)]">
      <ContenidoBolsa
        bolsaId={id}
        titulo={titulo}
        modo={soloReloj ? 'reloj' : 'completo'}
        acciones={
          <button
            onClick={() => cambiarTamano(!soloReloj)}
            title={soloReloj ? 'Ver la tarea completa' : 'Dejar solo el cronómetro'}
            aria-label={soloReloj ? 'Ver la tarea completa' : 'Dejar solo el cronómetro'}
            className="grid h-8 w-8 place-items-center rounded-full border border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
          >
            {soloReloj ? '⤢' : '—'}
          </button>
        }
        onCambio={avisarCambioDeTesoro}
      />
    </main>
  );
}
