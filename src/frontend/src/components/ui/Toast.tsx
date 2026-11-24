'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, RotateCcw, X, XCircle } from 'lucide-react';

export type TipoToast = 'exito' | 'info' | 'advertencia' | 'error';

export interface OpcionesToast {
  tipo?: TipoToast;
  titulo: string;
  descripcion?: string;
  /** Duración en ms. Por defecto 4500 ms (7000 ms si incluye `accion`). */
  duracionMs?: number;
  accion?: {
    etiqueta: string;
    alHacer: () => void | Promise<void>;
  };
}

interface ItemToast extends OpcionesToast {
  id: string;
  tipo: TipoToast;
  duracionMs: number;
}

interface ContextoToastValor {
  toast: (opciones: OpcionesToast) => string;
  descartar: (id: string) => void;
}

const ContextoToast = createContext<ContextoToastValor>({
  toast: () => '',
  descartar: () => undefined,
});

const ESTILOS_TIPO: Record<
  TipoToast,
  { borde: string; iconoColor: string; Icono: typeof CheckCircle2 }
> = {
  exito: {
    borde: 'border-emerald-500/35',
    iconoColor: 'text-[var(--tf-acento-verde)]',
    Icono: CheckCircle2,
  },
  info: {
    borde: 'border-sky-500/35',
    iconoColor: 'text-[var(--tf-acento-azul)]',
    Icono: Info,
  },
  advertencia: {
    borde: 'border-amber-500/40',
    iconoColor: 'text-[var(--tf-acento-ambar)]',
    Icono: AlertTriangle,
  },
  error: {
    borde: 'border-rose-500/40',
    iconoColor: 'text-[var(--tf-acento-rojo)]',
    Icono: XCircle,
  },
};

export function ProveedorToast({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemToast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const [ejecutandoId, setEjecutandoId] = useState<string | null>(null);

  const descartar = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (opciones: OpcionesToast) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duracionMs = opciones.duracionMs ?? (opciones.accion ? 7000 : 4500);
      const nuevo: ItemToast = {
        ...opciones,
        id,
        tipo: opciones.tipo ?? 'info',
        duracionMs,
      };
      setItems((prev) => [...prev.slice(-3), nuevo]);
      if (duracionMs > 0) {
        const timer = window.setTimeout(() => descartar(id), duracionMs);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [descartar],
  );

  useEffect(() => {
    const alExpirar = () => {
      toast({
        tipo: 'advertencia',
        titulo: 'Sesión expirada',
        descripcion: 'Tu sesión dejó de ser válida. Redirigiendo al inicio de sesión…',
        duracionMs: 5500,
      });
    };
    window.addEventListener('tf:sesion-expirada', alExpirar);
    return () => {
      window.removeEventListener('tf:sesion-expirada', alExpirar);
      for (const timer of timersRef.current.values()) window.clearTimeout(timer);
      timersRef.current.clear();
    };
  }, [toast]);

  async function ejecutarAccion(item: ItemToast) {
    if (!item.accion || ejecutandoId === item.id) return;
    setEjecutandoId(item.id);
    try {
      await item.accion.alHacer();
      descartar(item.id);
    } finally {
      setEjecutandoId((actual) => (actual === item.id ? null : actual));
    }
  }

  return (
    <ContextoToast.Provider value={{ toast, descartar }}>
      {children}
      {items.length > 0 && (
        <div
          aria-live="polite"
          aria-label="Avisos del sistema"
          className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        >
          {items.map((item) => {
            const estilo = ESTILOS_TIPO[item.tipo];
            const Icono = estilo.Icono;
            return (
              <div
                key={item.id}
                role={item.tipo === 'error' ? 'alert' : 'status'}
                className={`tf-enter pointer-events-auto flex items-start gap-3 rounded-2xl border ${estilo.borde} bg-[var(--tf-superficie-solida)] p-3.5 text-[var(--tf-texto)] shadow-2xl backdrop-blur-xl`}
              >
                <Icono size={18} aria-hidden className={`mt-0.5 shrink-0 ${estilo.iconoColor}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-[var(--tf-texto)]">
                    {item.titulo}
                  </p>
                  {item.descripcion && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--tf-texto-tenue)]">
                      {item.descripcion}
                    </p>
                  )}
                  {item.accion && (
                    <button
                      type="button"
                      disabled={ejecutandoId === item.id}
                      onClick={() => ejecutarAccion(item)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[var(--tf-borde-fuerte)] bg-[var(--tf-hover)] px-2.5 py-1 text-[11px] font-semibold text-[var(--tf-acento-azul)] transition hover:bg-[var(--tf-borde)] disabled:opacity-50"
                    >
                      <RotateCcw size={11} aria-hidden />
                      {ejecutandoId === item.id ? 'Aplicando…' : item.accion.etiqueta}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => descartar(item.id)}
                  aria-label="Cerrar notificación"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--tf-texto-suave)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
                >
                  <X size={13} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ContextoToast.Provider>
  );
}

export function useToast() {
  return useContext(ContextoToast);
}
