'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTesoro } from '@/lib/tesoro';
import RelojArena from './RelojArena';
import ContenidoBolsa from './ContenidoBolsa';

/**
 * Lienzo de cada vista de la ventana aparte, en pixeles de contenido: entera
 * (reloj, objetivos y evidencia) o encogida a solo el reloj retro. El
 * contenido se dibuja siempre a este tamano y se escala para calzar en la
 * ventana: asi nunca aparece una barra de desplazamiento, aunque el navegador
 * la abra de otro tamano.
 */
const LIENZO = {
  completo: { width: 380, height: 640 },
  reloj: { width: 300, height: 220 },
} as const;

/** La API de ventana flotante del navegador (Chrome y Edge). */
interface ApiVentanaFlotante {
  requestWindow(opciones?: {
    width?: number;
    height?: number;
    /** Usar siempre este tamano, no el ultimo que tuvo la ventana (Chrome 130+). */
    preferInitialWindowPlacement?: boolean;
  }): Promise<Window>;
  window: Window | null;
}
function apiVentanaFlotante(): ApiVentanaFlotante | null {
  const api = (window as unknown as { documentPictureInPicture?: ApiVentanaFlotante })
    .documentPictureInPicture;
  return api && typeof api.requestWindow === 'function' ? api : null;
}

/**
 * El navegador solo deja abrir una ventana aparte justo despues de un clic
 * (o tecla) del usuario. Sin ese gesto —por ejemplo al recargar la pagina con
 * una tarea abierta— hay que pedir un clic antes de intentarlo.
 */
function hayGestoReciente() {
  const activacion = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return activacion ? activacion.isActive : true;
}

/**
 * Copia los estilos de la pagina a la ventana nueva: es otro documento y no
 * hereda nada, asi que sin esto llegaria sin formato.
 */
function copiarEstilos(destino: Window) {
  for (const hoja of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(hoja.cssRules)
        .map((r) => r.cssText)
        .join('\n');
      const estilo = destino.document.createElement('style');
      estilo.textContent = css;
      destino.document.head.appendChild(estilo);
    } catch {
      // Hoja de otro origen: no se puede leer, pero si enlazar.
      if (hoja.href) {
        const enlace = destino.document.createElement('link');
        enlace.rel = 'stylesheet';
        enlace.href = hoja.href;
        destino.document.head.appendChild(enlace);
      }
    }
  }
}

/**
 * Ventana de la tarea abierta: siempre fuera de la pagina, en una ventana
 * propia del navegador que queda por encima de todo y sobrevive al cambio de
 * pestana, como la ventanita de una videollamada. Se abre en cuanto se abre
 * la tarea; cerrarla cierra la tarea.
 *
 * Vive en el layout raiz, de modo que navegar entre pantallas no la cierra.
 * Si el navegador no deja abrirla (recarga sin clic, ventanas emergentes
 * bloqueadas) queda una pastilla en la pagina para abrirla con un clic.
 */
export default function VentanaBolsa() {
  const { bolsa, cerrarBolsa, volarAlCofre, notificarCambio } = useTesoro();

  const [ventanaAparte, setVentanaAparte] = useState<Window | null>(null);
  const [contenedorAparte, setContenedorAparte] = useState<HTMLElement | null>(null);
  const [soloReloj, setSoloReloj] = useState(false);
  // Escala del lienzo para que calce justo en la ventana.
  const [escala, setEscala] = useState(1);
  // No se pudo abrir sola: la pastilla de la pagina ofrece abrirla.
  const [pendiente, setPendiente] = useState(false);
  const abriendo = useRef(false);

  async function abrirAparte() {
    if (!bolsa || abriendo.current) return;
    const api = apiVentanaFlotante();

    // Sin soporte para la ventana flotante (Firefox, Safari): se abre una
    // ventana normal con la pantalla suelta de la tarea.
    if (!api) {
      const emergente = window.open(
        `/bolsa/${bolsa.id}`,
        `bolsa-${bolsa.id}`,
        `popup=yes,width=400,height=700,noopener=no`,
      );
      if (emergente) {
        setPendiente(false);
        cerrarBolsa();
      } else {
        setPendiente(true);
      }
      return;
    }

    abriendo.current = true;
    try {
      // El navegador recuerda el ultimo tamano de la ventana (por ejemplo,
      // encogida al reloj); se le pide abrirla siempre en su tamano completo.
      const nueva = await api.requestWindow({ ...LIENZO.completo, preferInitialWindowPlacement: true });
      copiarEstilos(nueva);
      nueva.document.title = `Tarea · ${bolsa.titulo}`;
      nueva.document.body.style.margin = '0';
      nueva.document.body.style.overflow = 'hidden';
      nueva.document.body.style.background = '#0f172a';

      const caja = nueva.document.createElement('div');
      caja.className = 'flex h-screen justify-center overflow-hidden bg-slate-950 text-slate-100';
      nueva.document.body.appendChild(caja);

      // Cerrar la ventana es cerrar la tarea: no hay otra forma de verla.
      nueva.addEventListener('pagehide', () => {
        setVentanaAparte(null);
        setContenedorAparte(null);
        setSoloReloj(false);
        cerrarBolsa();
      });

      setSoloReloj(false);
      setPendiente(false);
      setVentanaAparte(nueva);
      setContenedorAparte(caja);
    } catch {
      // El navegador la rechazo (sin gesto del usuario, por ejemplo).
      setPendiente(true);
    } finally {
      abriendo.current = false;
    }
  }

  // Al abrir una tarea se abre su ventana aparte, sin pasos intermedios. Si ya
  // hay una abierta, la tarea nueva simplemente se muestra en ella.
  useEffect(() => {
    if (!bolsa || ventanaAparte) return;
    if (hayGestoReciente()) abrirAparte();
    else setPendiente(true);
    // Solo al cambiar de tarea: abrirAparte lee la tarea actual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bolsa?.id]);

  // El lienzo de la vista actual se escala al tamano real de la ventana, y
  // vuelve a escalarse si el navegador o el usuario la cambian de tamano.
  useEffect(() => {
    if (!ventanaAparte) return;
    const lienzo = soloReloj ? LIENZO.reloj : LIENZO.completo;
    const medir = () =>
      setEscala(Math.min(ventanaAparte.innerWidth / lienzo.width, ventanaAparte.innerHeight / lienzo.height));
    medir();
    ventanaAparte.addEventListener('resize', medir);
    return () => ventanaAparte.removeEventListener('resize', medir);
  }, [ventanaAparte, soloReloj]);

  useEffect(() => {
    if (ventanaAparte && bolsa) ventanaAparte.document.title = `Tarea · ${bolsa.titulo}`;
  }, [ventanaAparte, bolsa]);

  useEffect(() => {
    // Si se cierra la tarea (por ejemplo al cerrar sesion), tambien su ventana.
    if (!bolsa) {
      setPendiente(false);
      if (ventanaAparte) {
        ventanaAparte.close();
        setVentanaAparte(null);
        setContenedorAparte(null);
      }
    }
  }, [bolsa, ventanaAparte]);

  /**
   * Encoge o devuelve su tamano a la ventana. Se redimensiona la ventana de
   * verdad, no solo su contenido: encogida ocupa lo justo para el reloj y
   * estorba menos sobre cualquier otra aplicacion.
   */
  function cambiarTamano(reloj: boolean) {
    setSoloReloj(reloj);
    const lienzo = reloj ? LIENZO.reloj : LIENZO.completo;
    try {
      if (ventanaAparte) {
        // resizeTo mide la ventana por fuera: se suma lo que ocupa su marco.
        const marcoAncho = ventanaAparte.outerWidth - ventanaAparte.innerWidth;
        const marcoAlto = ventanaAparte.outerHeight - ventanaAparte.innerHeight;
        ventanaAparte.resizeTo(lienzo.width + marcoAncho, lienzo.height + marcoAlto);
      }
    } catch {
      /* el navegador no deja redimensionarla: al menos cambia el contenido */
    }
  }

  if (!bolsa) return null;

  // ------------------------------------------ abierta en su ventana aparte
  if (contenedorAparte) {
    const lienzo = soloReloj ? LIENZO.reloj : LIENZO.completo;
    return createPortal(
      <div className="flex shrink-0 flex-col overflow-hidden" style={{ ...lienzo, zoom: escala }}>
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
          <button
            onClick={() => ventanaAparte?.close()}
            title="Cerrar la tarea"
            aria-label="Cerrar la tarea"
            className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>
        <ContenidoBolsa
          bolsaId={bolsa.id}
          titulo={bolsa.titulo}
          modo={soloReloj ? 'reloj' : 'completo'}
          onCambio={notificarCambio}
          // El reloj de la ventana aparte pertenece a otro documento: el vuelo
          // hacia el reloj del proyecto sale del centro de la pagina principal.
          onGuardada={() =>
            volarAlCofre(new DOMRect(window.innerWidth / 2 - 40, window.innerHeight / 2 - 40, 80, 80))
          }
        />
      </div>,
      contenedorAparte,
    );
  }

  // ------------------- no se pudo abrir sola: se pide un clic para abrirla
  if (!pendiente) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-xl border border-orange-400/25 bg-slate-900/95 py-2 pl-3 pr-2 shadow-xl backdrop-blur"
    >
      <RelojArena llenado={0.5} tamano={18} animada={false} />
      <span className="max-w-[12rem] truncate text-xs text-slate-300">{bolsa.titulo}</span>
      <button
        onClick={abrirAparte}
        className="rounded-lg bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 transition hover:bg-orange-400"
      >
        Abrir ventana
      </button>
      <button
        onClick={cerrarBolsa}
        title="Cerrar la tarea"
        aria-label="Cerrar la tarea"
        className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
