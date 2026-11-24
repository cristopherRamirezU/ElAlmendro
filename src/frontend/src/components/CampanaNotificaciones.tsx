'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { diaRelativo, hora, tiempoRelativo } from '@/lib/formato';
import {
  NotificacionItem,
  RespuestaNotificaciones,
  socketNotificaciones,
} from '@/lib/notificaciones';

function puntoPorTipo(tipo: string): string {
  const t = tipo.toUpperCase();
  if (t.includes('COMPLET') || t.includes('DESBLOQ')) return 'bg-emerald-500';
  if (t.includes('BLOQUE') || t.includes('AUTOCIERR') || t.includes('ALERTA')) return 'bg-amber-500';
  if (t.includes('ERROR') || t.includes('ELIMIN')) return 'bg-rose-500';
  if (t.includes('DERIV') || t.includes('REASIG')) return 'bg-violet-500';
  return 'bg-sky-500';
}

const TTL_CACHE_NOTIFICACIONES_MS = 60_000;
interface CacheNotificaciones {
  items: NotificacionItem[];
  noLeidas: number;
  actualizadaEn: number;
}
let cacheNotificaciones: CacheNotificaciones | null = null;

function guardarCacheNotif(items: NotificacionItem[], noLeidas: number) {
  cacheNotificaciones = { items, noLeidas, actualizadaEn: Date.now() };
}

export function limpiarCacheNotificaciones() {
  cacheNotificaciones = null;
}

/**
 * Campana de notificaciones en tiempo real en la cabecera.
 * Recibe avisos sobre asignaciones, derivaciones, mensajes/audios en nodos
 * y autocierres mediante Socket.IO (`/notificaciones`).
 */
export default function CampanaNotificaciones({
  posicion = 'cabecera',
}: {
  posicion?: 'cabecera' | 'sidebar';
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<NotificacionItem[]>(() => cacheNotificaciones?.items ?? []);
  const [noLeidas, setNoLeidas] = useState(() => cacheNotificaciones?.noLeidas ?? 0);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => {
    api
      .get<RespuestaNotificaciones>('/notificaciones')
      .then((res) => {
        const nuevosItems = res.items ?? [];
        const nuevasNoLeidas = res.noLeidas ?? 0;
        setItems(nuevosItems);
        setNoLeidas(nuevasNoLeidas);
        guardarCacheNotif(nuevosItems, nuevasNoLeidas);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const fresca =
      cacheNotificaciones !== null &&
      Date.now() - cacheNotificaciones.actualizadaEn < TTL_CACHE_NOTIFICACIONES_MS;
    if (!fresca) cargar();
    const socket = socketNotificaciones();
    const alRecibir = (nueva: NotificacionItem) => {
      setItems((prev) => {
        if (prev.some((n) => n.id === nueva.id)) return prev;
        const siguientes = [nueva, ...prev].slice(0, 25);
        setNoLeidas((n) => {
          const total = n + 1;
          guardarCacheNotif(siguientes, total);
          return total;
        });
        return siguientes;
      });
    };
    socket.on('notificacion:nueva', alRecibir);
    return () => {
      socket.off('notificacion:nueva', alRecibir);
    };
  }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    const alClicFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', alClicFuera);
    window.addEventListener('keydown', alTeclado);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      window.removeEventListener('keydown', alTeclado);
    };
  }, [abierto]);

  async function abrirNotificacion(n: NotificacionItem) {
    if (!n.leidaEn) {
      const marca = new Date().toISOString();
      const siguientes = items.map((item) =>
        item.id === n.id ? { ...item, leidaEn: marca } : item,
      );
      const nuevasNoLeidas = Math.max(0, noLeidas - 1);
      setItems(siguientes);
      setNoLeidas(nuevasNoLeidas);
      guardarCacheNotif(siguientes, nuevasNoLeidas);
      api.patch(`/notificaciones/${n.id}/leer`).catch(() => undefined);
    }
    setAbierto(false);
    if (n.enlace) router.push(n.enlace);
  }

  async function marcarTodas() {
    if (noLeidas === 0) return;
    const ahora = new Date().toISOString();
    const siguientes = items.map((item) => ({ ...item, leidaEn: item.leidaEn ?? ahora }));
    setItems(siguientes);
    setNoLeidas(0);
    guardarCacheNotif(siguientes, 0);
    await api.post('/notificaciones/leer-todas').catch(() => undefined);
  }

  return (
    <div ref={contenedorRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={
          noLeidas > 0 ? `Notificaciones (${noLeidas} sin leer)` : 'Notificaciones'
        }
        aria-expanded={abierto}
        aria-haspopup="dialog"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
      >
        <Bell size={17} aria-hidden />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Centro de notificaciones"
          className={`absolute z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] text-[var(--tf-texto)] shadow-2xl backdrop-blur ${
            posicion === 'sidebar' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[var(--tf-borde)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tf-texto-tenue)]">
              Notificaciones
            </span>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--tf-acento-azul)] transition hover:opacity-80"
              >
                <CheckCheck size={13} aria-hidden />
                Marcar leídas
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="p-6 text-center text-xs text-[var(--tf-texto-suave)]">
              No tienes notificaciones recientes.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-[var(--tf-borde)] overflow-y-auto">
              {items.map((n) => {
                const sinLeer = !n.leidaEn;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => abrirNotificacion(n)}
                      className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition hover:bg-[var(--tf-hover)] ${
                        sinLeer ? 'bg-sky-500/[0.08]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--tf-texto)]">
                          {sinLeer && (
                            <span
                              aria-hidden
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${puntoPorTipo(n.tipo)}`}
                            />
                          )}
                          {n.titulo}
                        </span>
                        <span
                          title={`${diaRelativo(n.creadoEn)} · ${hora(n.creadoEn)}`}
                          className="shrink-0 text-[10px] text-[var(--tf-texto-suave)]"
                        >
                          {tiempoRelativo(n.creadoEn)}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-[var(--tf-texto-tenue)]">{n.mensaje}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
