'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api, ErrorApi, type Usuario } from '@/lib/api';
import { guardarCacheSesion, leerCacheSesion } from '@/lib/cacheSesion';
import { DATOS_LEGALES } from '@/lib/sitio';

/**
 * Ventana que pide aceptar los terminos de uso y la politica de privacidad
 * vigentes. No se puede cerrar sin elegir: aceptar deja la constancia (con
 * version, fecha e IP) y libera la app; rechazar tambien queda registrado y
 * cierra la sesion, porque sin aceptarlas no se puede usar TimeFlow.
 */
export default function ConsentimientoPoliticas({
  usuario,
  onRechazada,
}: {
  usuario: Usuario;
  /** Cierra la sesion en este navegador (limpia cache, sockets y cookie). */
  onRechazada: () => Promise<void> | void;
}) {
  const [confirmandoRechazo, setConfirmandoRechazo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const botonAceptar = useRef<HTMLButtonElement>(null);
  const botonConfirmar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (confirmandoRechazo ? botonConfirmar : botonAceptar).current?.focus();
  }, [confirmandoRechazo]);

  async function aceptar() {
    setError(null);
    setEnviando(true);
    try {
      await api.post('/auth/yo/politicas', { version: usuario.versionPoliticas });
      const cache = leerCacheSesion();
      if (cache?.usuario) guardarCacheSesion({ ...cache, usuario: { ...cache.usuario, politicasPendientes: false } });
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo registrar tu aceptación. Intenta de nuevo.');
      setEnviando(false);
    }
  }

  async function rechazar() {
    setError(null);
    setEnviando(true);
    try {
      await api.post('/auth/yo/politicas/rechazo');
    } catch {
      /* aunque no quede la constancia, la sesion igual se cierra */
    }
    await onRechazada();
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="politicas-titulo"
        aria-describedby="politicas-texto"
        className="w-full max-w-lg rounded-3xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-6 text-[var(--tf-texto)] shadow-2xl"
      >
        {confirmandoRechazo ? (
          <>
            <h2 id="politicas-titulo" className="m-0 text-lg font-bold">
              ¿Rechazar los términos y salir?
            </h2>
            <div id="politicas-texto" className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--tf-texto-tenue)]">
              <p className="m-0">
                Sin aceptarlos no puedes usar {DATOS_LEGALES.servicio}: se cerrará tu sesión y tu rechazo quedará
                registrado. No se borra nada de tu cuenta.
              </p>
              <p className="m-0">
                Si cambias de opinión, vuelve a ingresar y podrás aceptarlos. Si tienes dudas, escríbenos a{' '}
                <a href={`mailto:${DATOS_LEGALES.correo}`} className="text-[var(--color-primario)] underline-offset-2 hover:underline">
                  {DATOS_LEGALES.correo}
                </a>
                .
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoRechazo(false)}
                disabled={enviando}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-50"
              >
                Volver
              </button>
              <button
                ref={botonConfirmar}
                type="button"
                onClick={rechazar}
                disabled={enviando}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {enviando ? 'Saliendo…' : 'Rechazar y salir'}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-primario)]/15 text-[var(--color-primario)]">
              <ShieldCheck size={24} aria-hidden />
            </span>
            <h2 id="politicas-titulo" className="m-0 mt-4 text-lg font-bold">
              Términos de uso y política de privacidad
            </h2>
            <div id="politicas-texto" className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--tf-texto-tenue)]">
              <p className="m-0">
                Hola, {usuario.nombreCompleto.split(' ')[0]}. Para usar {DATOS_LEGALES.servicio} necesitamos que leas y
                aceptes cómo funciona el servicio y cómo se tratan tus datos.
              </p>
              <ul className="m-0 list-disc space-y-1 pl-5">
                <li>Se registran tus jornadas, sesiones de trabajo y las tareas en que participas.</li>
                <li>Tu empresa ve esos registros según el rol de cada persona; los datos son de tu empresa.</li>
                <li>No vendemos datos ni mostramos publicidad. El micrófono solo se usa cuando pulsas grabar.</li>
              </ul>
              <p className="m-0">
                Lee los textos completos:{' '}
                <a href="/terminos" target="_blank" rel="noopener" className="font-semibold text-[var(--color-primario)] underline-offset-2 hover:underline">
                  Términos de uso
                </a>{' '}
                y{' '}
                <a href="/privacidad" target="_blank" rel="noopener" className="font-semibold text-[var(--color-primario)] underline-offset-2 hover:underline">
                  Política de privacidad
                </a>
                <span className="sr-only"> (se abren en una pestaña nueva)</span>.
              </p>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap-reverse justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoRechazo(true)}
                disabled={enviando}
                className="rounded-xl border border-[var(--tf-borde)] px-4 py-2.5 text-sm font-medium text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)] disabled:opacity-50"
              >
                Rechazar
              </button>
              <button
                ref={botonAceptar}
                type="button"
                onClick={aceptar}
                disabled={enviando}
                className="rounded-xl bg-[var(--color-primario)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {enviando ? 'Guardando…' : 'Acepto los términos y la política'}
              </button>
            </div>
            <p className="m-0 mt-3 text-right text-[11px] text-[var(--tf-texto-tenue)]">
              Versión vigente desde el {DATOS_LEGALES.vigencia}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
