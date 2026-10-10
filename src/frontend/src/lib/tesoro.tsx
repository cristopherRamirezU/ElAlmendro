'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import RelojArena from '@/components/tesoro/RelojArena';

/** Tarea abierta en la ventana flotante. */
export interface BolsaAbierta {
  id: string;
  titulo: string;
}

interface EstadoTesoro {
  bolsa: BolsaAbierta | null;
  abrirBolsa: (bolsa: BolsaAbierta) => void;
  cerrarBolsa: () => void;
  /** El reloj del proyecto visible en pantalla, si la vista actual muestra uno. */
  registrarCofre: (el: HTMLElement | null) => void;
  /** Lanza el reloj de la tarea desde donde esta hacia el reloj del proyecto. */
  volarAlCofre: (origen: DOMRect) => void;
  /** Avisa a las vistas abiertas que el tesoro cambio (recargar datos). */
  notificarCambio: () => void;
  /** Contador que aumenta con cada cambio: usalo como dependencia. */
  version: number;
}

const ContextoTesoro = createContext<EstadoTesoro | null>(null);

const CANAL = 'tf_tesoro';
const CLAVE_BOLSA = 'tf_bolsa_abierta';

/**
 * Avisa a las demas ventanas de TimeFlow que el tesoro cambio. Lo usa la
 * pantalla suelta de una bolsa, que corre en otra ventana y no comparte el
 * contexto de React con la principal.
 */
/**
 * El proveedor vive en el layout raiz, fuera del arbol donde se cierra la
 * sesion. Deja aqui su forma de cerrar la bolsa para que `limpiarBolsaAbierta`
 * pueda alcanzarlo sin pasar por el contexto.
 */
let cerrarDesdeFuera: (() => void) | null = null;

/** Olvida la bolsa abierta (al cerrar sesion). */
export function limpiarBolsaAbierta() {
  try {
    window.sessionStorage.removeItem(CLAVE_BOLSA);
  } catch {
    /* nada que limpiar */
  }
  cerrarDesdeFuera?.();
}

export function avisarCambioDeTesoro() {
  try {
    const canal = new BroadcastChannel(CANAL);
    canal.postMessage('cambio');
    canal.close();
  } catch {
    /* navegador sin BroadcastChannel: la otra ventana se actualiza al recargar */
  }
}

export function useTesoro(): EstadoTesoro {
  const ctx = useContext(ContextoTesoro);
  if (!ctx) {
    throw new Error('useTesoro debe usarse dentro de <ProveedorTesoro>.');
  }
  return ctx;
}

interface Vuelo {
  id: number;
  desde: { x: number; y: number; tamano: number };
  hasta: { x: number; y: number };
}

let contadorVuelos = 0;

/**
 * Coordina la metafora del tesoro: que bolsa esta abierta en la ventana
 * flotante, donde esta el cofre de la vista actual y el vuelo de la bolsa
 * hacia el cofre cuando una tarea queda guardada.
 */
export function ProveedorTesoro({ children }: { children: React.ReactNode }) {
  const [bolsa, setBolsa] = useState<BolsaAbierta | null>(null);
  const [vuelos, setVuelos] = useState<Vuelo[]>([]);
  const [version, setVersion] = useState(0);
  const cofre = useRef<HTMLElement | null>(null);

  const registrarCofre = useCallback((el: HTMLElement | null) => {
    cofre.current = el;
  }, []);

  const notificarCambio = useCallback(() => setVersion((v) => v + 1), []);

  const volarAlCofre = useCallback((origen: DOMRect) => {
    const caja = cofre.current?.getBoundingClientRect();
    // Sin reloj del proyecto a la vista (otra pantalla), el de la tarea sube y se desvanece:
    // igual queda claro que el trabajo se guardo.
    const hasta = caja
      ? { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 }
      : { x: origen.left + origen.width / 2, y: -80 };

    contadorVuelos += 1;
    const vuelo: Vuelo = {
      id: contadorVuelos,
      desde: {
        x: origen.left + origen.width / 2,
        y: origen.top + origen.height / 2,
        tamano: Math.max(40, Math.min(100, origen.width)),
      },
      hasta,
    };
    setVuelos((v) => [...v, vuelo]);
  }, []);

  const abrirBolsa = useCallback((b: BolsaAbierta) => {
    setBolsa(b);
    try {
      window.sessionStorage.setItem(CLAVE_BOLSA, JSON.stringify(b));
    } catch {
      /* sin persistencia: la bolsa se cierra al recargar */
    }
  }, []);

  const cerrarBolsa = useCallback(() => {
    setBolsa(null);
    try {
      window.sessionStorage.removeItem(CLAVE_BOLSA);
    } catch {
      /* nada que limpiar */
    }
  }, []);

  useEffect(() => {
    cerrarDesdeFuera = () => setBolsa(null);
    return () => {
      cerrarDesdeFuera = null;
    };
  }, []);

  // La bolsa abierta sobrevive a un F5: se guarda en la pestana.
  useEffect(() => {
    try {
      const crudo = window.sessionStorage.getItem(CLAVE_BOLSA);
      if (crudo) setBolsa(JSON.parse(crudo) as BolsaAbierta);
    } catch {
      /* nada guardado */
    }
  }, []);

  // Cambios hechos desde otra ventana (la bolsa desprendida).
  useEffect(() => {
    let canal: BroadcastChannel;
    try {
      canal = new BroadcastChannel(CANAL);
    } catch {
      return;
    }
    canal.onmessage = () => setVersion((v) => v + 1);
    return () => canal.close();
  }, []);

  const valor = useMemo(
    () => ({
      bolsa,
      abrirBolsa,
      cerrarBolsa,
      registrarCofre,
      volarAlCofre,
      notificarCambio,
      version,
    }),
    [bolsa, abrirBolsa, cerrarBolsa, registrarCofre, volarAlCofre, notificarCambio, version],
  );

  return (
    <ContextoTesoro.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden>
        {vuelos.map((v) => (
          <RelojVolando
            key={v.id}
            vuelo={v}
            onTermino={() => setVuelos((lista) => lista.filter((x) => x.id !== v.id))}
          />
        ))}
      </div>
    </ContextoTesoro.Provider>
  );
}

/**
 * El reloj de una tarea terminada que viaja hasta el del proyecto describiendo un arco. Se anima con la
 * API del navegador y se borra sola al terminar; si el usuario tiene activada
 * la reduccion de movimiento, aparece y desaparece sin recorrido.
 */
function RelojVolando({ vuelo, onTermino }: { vuelo: Vuelo; onTermino: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const dx = vuelo.hasta.x - vuelo.desde.x;
    const dy = vuelo.hasta.y - vuelo.desde.y;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animacion = el.animate(
      reduce
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
            {
              // Punto alto del arco, a mitad de camino.
              transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(0.92) rotate(-12deg)`,
              opacity: 1,
              offset: 0.55,
            },
            {
              transform: `translate(${dx}px, ${dy}px) scale(0.25) rotate(8deg)`,
              opacity: 0,
            },
          ],
      { duration: reduce ? 400 : 950, easing: 'cubic-bezier(.4,.05,.6,1)', fill: 'forwards' },
    );

    animacion.onfinish = onTermino;
    animacion.oncancel = onTermino;
    return () => animacion.cancel();
  }, [vuelo, onTermino]);

  return (
    <div
      ref={ref}
      className="absolute"
      style={{
        left: vuelo.desde.x - vuelo.desde.tamano / 2,
        top: vuelo.desde.y - vuelo.desde.tamano / 2,
        width: vuelo.desde.tamano,
      }}
    >
      <RelojArena llenado={1} tamano={vuelo.desde.tamano} terminado animada={false} />
    </div>
  );
}
