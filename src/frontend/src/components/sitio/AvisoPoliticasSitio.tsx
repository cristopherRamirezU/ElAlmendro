'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, X } from 'lucide-react';
import { DATOS_LEGALES } from '@/lib/sitio';

/** Version aceptada en este navegador (se pide de nuevo si cambia). */
const CLAVE_ACEPTADA = 'tf_politicas_sitio';
/** Rechazo de esta visita: en la siguiente se vuelve a preguntar. */
const CLAVE_RECHAZO = 'tf_politicas_sitio_rechazo';

type Estado = 'oculto' | 'preguntar' | 'rechazado';

function leer(almacen: 'local' | 'session', clave: string): string | null {
  try {
    return (almacen === 'local' ? window.localStorage : window.sessionStorage).getItem(clave);
  } catch {
    return null;
  }
}

function escribir(almacen: 'local' | 'session', clave: string, valor: string | null) {
  try {
    const a = almacen === 'local' ? window.localStorage : window.sessionStorage;
    if (valor === null) a.removeItem(clave);
    else a.setItem(clave, valor);
  } catch {
    /* almacenamiento bloqueado: el aviso vuelve a salir, sin otro efecto */
  }
}

/**
 * Aviso de la pagina web: al entrar a timeflows.site se piden aceptar los
 * terminos de uso y la politica de privacidad.
 *
 * - Aceptar: se recuerda en este navegador para la version vigente.
 * - Rechazar: se puede seguir mirando la pagina, pero se avisa que para crear
 *   una cuenta o ingresar hay que aceptarlos; en la proxima visita se pregunta
 *   de nuevo.
 *
 * La constancia con valor (quien, cuando, IP) se registra dentro de la app al
 * iniciar sesion y en el formulario de registro.
 */
export default function AvisoPoliticasSitio() {
  // Se decide recien en el navegador: el HTML del servidor no sabe que eligio la persona.
  const [estado, setEstado] = useState<Estado>('oculto');

  useEffect(() => {
    if (leer('local', CLAVE_ACEPTADA) === DATOS_LEGALES.versionPoliticas) return;
    setEstado(leer('session', CLAVE_RECHAZO) ? 'rechazado' : 'preguntar');
  }, []);

  function aceptar() {
    escribir('local', CLAVE_ACEPTADA, DATOS_LEGALES.versionPoliticas);
    escribir('session', CLAVE_RECHAZO, null);
    setEstado('oculto');
  }

  function rechazar() {
    escribir('session', CLAVE_RECHAZO, '1');
    setEstado('rechazado');
  }

  if (estado === 'oculto') return null;

  const enlace = 'font-semibold text-[#7dd3fc] underline-offset-2 hover:text-[#bae6fd] hover:underline';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 sm:p-5">
      <section
        role="dialog"
        aria-labelledby="aviso-politicas-titulo"
        aria-describedby="aviso-politicas-texto"
        className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-[rgba(56,189,248,0.35)] bg-[#0a1328]/95 p-5 text-[#e6ecfa] shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
      >
        {estado === 'preguntar' ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[rgba(56,189,248,0.14)] text-[#7dd3fc]">
                <ShieldCheck size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id="aviso-politicas-titulo" className="m-0 text-[15px] font-semibold text-[#f1f5ff]">
                  Términos de uso y política de privacidad
                </h2>
                <p id="aviso-politicas-texto" className="m-0 mt-1 text-[13px] leading-relaxed text-[#b6c2e2]">
                  Para usar {DATOS_LEGALES.servicio} debes aceptar nuestros{' '}
                  <Link href="/terminos" className={enlace}>
                    términos de uso
                  </Link>{' '}
                  y nuestra{' '}
                  <Link href="/privacidad" className={enlace}>
                    política de privacidad
                  </Link>
                  . No usamos cookies de publicidad ni de seguimiento.
                </p>
              </div>
            </div>
            <div className="flex flex-none flex-wrap gap-2 sm:flex-nowrap">
              <button
                type="button"
                onClick={rechazar}
                className="min-h-11 flex-1 rounded-xl border border-[rgba(148,163,196,0.35)] px-4 text-sm font-semibold text-[#e6ecfa] transition hover:bg-white/5 sm:flex-none"
              >
                Rechazar
              </button>
              <button
                type="button"
                onClick={aceptar}
                className="min-h-11 flex-1 rounded-xl bg-[#38bdf8] px-5 text-sm font-bold text-[#04101f] transition hover:bg-[#7dd3fc] sm:flex-none"
              >
                Aceptar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p id="aviso-politicas-texto" className="m-0 min-w-0 flex-1 text-[13px] leading-relaxed text-[#d6deef]">
              <strong id="aviso-politicas-titulo" className="text-[#f1f5ff]">Rechazaste los términos.</strong> Puedes
              seguir viendo esta página, pero para crear una cuenta o ingresar a {DATOS_LEGALES.servicio} tendrás que
              aceptarlos.
            </p>
            <div className="flex flex-none items-center gap-2">
              <button
                type="button"
                onClick={aceptar}
                className="min-h-11 rounded-xl bg-[#38bdf8] px-4 text-sm font-bold text-[#04101f] transition hover:bg-[#7dd3fc]"
              >
                Aceptar ahora
              </button>
              <button
                type="button"
                onClick={() => setEstado('oculto')}
                aria-label="Cerrar aviso"
                className="grid h-11 w-11 place-items-center rounded-xl text-[#b6c2e2] transition hover:bg-white/5 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
