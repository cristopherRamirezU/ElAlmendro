'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Keyboard } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { PERMISOS } from '@/lib/rbac';
import { useSesion } from '@/lib/sesion';

export function abrirPanelAtajos() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tf:abrir-atajos'));
  }
}

function esElementoEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
}

/**
 * Atajos de teclado globales no invasivos:
 * - `?`: abre/cierra la guía rápida de atajos
 * - `G` seguido de `P` / `C` / `R` / `U` / `H`: navega entre módulos permitidos
 */
export default function AtajosTeclado({ activo }: { activo: string }) {
  const router = useRouter();
  const usuario = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [esperandoDestino, setEsperandoDestino] = useState(false);
  const timerRef = useRef<number | null>(null);

  const destinos = useMemo(() => {
    const permisos = usuario?.permisos ?? [];
    const lista: { tecla: string; ruta: string; nombre: string }[] = [];
    if (permisos.includes(PERMISOS.ACTIVIDADES_VER_PROPIAS)) {
      lista.push({ tecla: 'P', ruta: '/panel', nombre: 'Proyectos' });
    }
    if (permisos.includes(PERMISOS.CALENDARIO_VER_PROPIO)) {
      lista.push({ tecla: 'C', ruta: '/calendario', nombre: 'Calendario' });
    }
    if (permisos.includes(PERMISOS.REPORTES_VER_EQUIPO)) {
      lista.push({ tecla: 'R', ruta: '/reportes', nombre: 'Reportes' });
    }
    if (permisos.includes(PERMISOS.USUARIOS_GESTIONAR)) {
      lista.push({ tecla: 'U', ruta: '/usuarios', nombre: 'Usuarios y Roles' });
    }
    if (permisos.includes(PERMISOS.HISTORIAL_VER)) {
      lista.push({ tecla: 'H', ruta: '/historial', nombre: 'Historial' });
    }
    return lista;
  }, [usuario]);

  useEffect(() => {
    const alAbrir = () => setAbierto(true);
    window.addEventListener('tf:abrir-atajos', alAbrir);
    return () => window.removeEventListener('tf:abrir-atajos', alAbrir);
  }, []);

  useEffect(() => {
    const limpiarG = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setEsperandoDestino(false);
    };

    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (esElementoEditable(e.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]') && !abierto) return;

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        limpiarG();
        setAbierto((v) => !v);
        return;
      }

      if (abierto) return;

      const tecla = e.key.toUpperCase();
      if (esperandoDestino) {
        const encontrado = destinos.find((d) => d.tecla === tecla);
        limpiarG();
        if (encontrado) {
          e.preventDefault();
          if (activo !== encontrado.ruta) router.push(encontrado.ruta);
        }
        return;
      }

      if (tecla === 'G' && !e.shiftKey && destinos.length > 0) {
        setEsperandoDestino(true);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          setEsperandoDestino(false);
        }, 1200);
      }
    };

    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [abierto, activo, destinos, esperandoDestino, router]);

  return (
    <>
      {esperandoDestino && (
        <div
          role="status"
          className="tf-enter fixed bottom-4 left-1/2 z-[75] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] px-4 py-2 text-xs text-[var(--tf-texto)] shadow-2xl backdrop-blur"
        >
          <span className="font-semibold text-[var(--tf-acento-azul)]">Ir a:</span>
          {destinos.map((d) => (
            <span key={d.tecla} className="inline-flex items-center gap-1 text-[var(--tf-texto-tenue)]">
              <kbd className="rounded border border-[var(--tf-borde-fuerte)] bg-[var(--tf-hover)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--tf-texto)]">
                {d.tecla}
              </kbd>
              {d.nombre}
            </span>
          ))}
        </div>
      )}

      {abierto && (
        <Modal
          ancho="md"
          onCerrar={() => setAbierto(false)}
          titulo={
            <span className="flex items-center gap-2">
              <Keyboard size={18} aria-hidden className="text-[var(--tf-acento-azul)]" />
              Atajos de teclado
            </span>
          }
        >
          <div className="space-y-5 text-xs">
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-texto-suave)]">
                Navegación rápida
              </h3>
              <ul className="divide-y divide-[var(--tf-borde)] rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)]">
                <FilaAtajo teclas={['?']} descripcion="Mostrar u ocultar esta guía de atajos" />
                <FilaAtajo teclas={['Esc']} descripcion="Cerrar ventanas, paneles o menús abiertos" />
                {destinos.map((d) => (
                  <FilaAtajo
                    key={d.tecla}
                    teclas={['G', d.tecla]}
                    descripcion={`Ir a ${d.nombre}`}
                  />
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-texto-suave)]">
                Mapa de nodos (/nodos)
              </h3>
              <ul className="divide-y divide-[var(--tf-borde)] rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)]">
                <FilaAtajo teclas={['E']} descripcion="Alternar modo edición del mapa (si tienes permiso)" />
                <FilaAtajo teclas={['F']} descripcion="Encuadrar todo el mapa en pantalla" />
                <FilaAtajo teclas={['M']} descripcion="Mostrar u ocultar el minimapa" />
                <FilaAtajo teclas={['Ctrl', 'Z']} descripcion="Deshacer el último movimiento o borde (en edición)" />
                <FilaAtajo teclas={['Ctrl', 'Y']} descripcion="Rehacer el cambio deshecho (en edición)" />
                <FilaAtajo teclas={['Supr']} descripcion="Eliminar el nodo seleccionado (con confirmación)" />
              </ul>
            </section>

            <div className="flex justify-end border-t border-[var(--tf-borde)] pt-3">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-xl border border-[var(--tf-borde)] px-4 py-1.5 text-xs font-medium text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)]"
              >
                Cerrar (Esc)
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function FilaAtajo({ teclas, descripcion }: { teclas: string[]; descripcion: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span className="text-[var(--tf-texto-tenue)]">{descripcion}</span>
      <span className="flex shrink-0 items-center gap-1">
        {teclas.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-[10px] text-[var(--tf-texto-suave)]">+</span>}
            <kbd className="rounded-md border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--tf-texto)] shadow-xs">
              {t}
            </kbd>
          </span>
        ))}
      </span>
    </li>
  );
}
