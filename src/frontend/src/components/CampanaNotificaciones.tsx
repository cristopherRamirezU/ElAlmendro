'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { diaRelativo, hora } from '@/lib/formato';
import {
  NotificacionItem,
  RespuestaNotificaciones,
  socketNotificaciones,
} from '@/lib/notificaciones';

/**
 * Campana de notificaciones en tiempo real en la cabecera.
 * Recibe avisos sobre asignaciones, derivaciones, mensajes/audios en nodos
 * y autocierres mediante Socket.IO (`/notificaciones`).
 */
export default function CampanaNotificaciones() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<NotificacionItem[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => {
    api
      .get<RespuestaNotificaciones>('/notificaciones')
      .then((res) => {
        setItems(res.items ?? []);
        setNoLeidas(res.noLeidas ?? 0);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    cargar();
    const socket = socketNotificaciones();
    const alRecibir = (nueva: NotificacionItem) => {
      setItems((prev) => {
        if (prev.some((n) => n.id === nueva.id)) return prev;
        return [nueva, ...prev].slice(0, 25);
      });
      setNoLeidas((n) => n + 1);
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
      setItems((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, leidaEn: new Date().toISOString() } : item,
        ),
      );
      setNoLeidas((v) => Math.max(0, v - 1));
      api.patch(`/notificaciones/${n.id}/leer`).catch(() => undefined);
    }
    setAbierto(false);
    if (n.enlace) router.push(n.enlace);
  }

  async function marcarTodas() {
    if (noLeidas === 0) return;
    const ahora = new Date().toISOString();
    setItems((prev) => prev.map((item) => ({ ...item, leidaEn: item.leidaEn ?? ahora })));
    setNoLeidas(0);
    await api.post('/notificaciones/leer-todas').catch(() => undefined);
  }

  return (
    <div ref={contenedorRef} className="relative">
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
          className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Notificaciones
            </span>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 transition hover:text-sky-300"
              >
                <CheckCheck size={13} aria-hidden />
                Marcar leídas
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">
              No tienes notificaciones recientes.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto">
              {items.map((n) => {
                const sinLeer = !n.leidaEn;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => abrirNotificacion(n)}
                      className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition hover:bg-white/5 ${
                        sinLeer ? 'bg-sky-500/[0.06]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                          {sinLeer && <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />}
                          {n.titulo}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {diaRelativo(n.creadoEn)} · {hora(n.creadoEn)}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">{n.mensaje}</p>
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
