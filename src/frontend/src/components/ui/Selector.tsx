'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { colorConAlfa, luminanciaRelativa, useColorPrimario } from '@/lib/color';
import { useTemaFondo } from '@/lib/tema';

export interface OpcionSelector<T extends string = string> {
  valor: T;
  etiqueta: string;
  subtitulo?: string;
  badge?: string;
  grupo?: string;
  avatar?: React.ReactNode;
  /** Si se pasa texto, muestra un avatar circular con esas iniciales. */
  inicialesAvatar?: string;
  colorAvatar?: string;
  icono?: React.ReactNode;
  deshabilitado?: boolean;
}

export interface SelectorProps<T extends string = string> {
  valor: T;
  onChange: (valor: T) => void;
  opciones: OpcionSelector<T>[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  ariaLabel?: string;
  buscable?: boolean;
  placeholderBusqueda?: string;
  mensajeVacio?: string;
  /** 'defecto' (rounded-xl formularios), 'pildora' (rounded-full barra superior), 'compacto' (inline). */
  forma?: 'defecto' | 'pildora' | 'compacto';
  /** Fuerza paleta clara u oscura en contextos aislados (ej. NodoRaiz o modales oscuros). */
  forzarTema?: 'claro' | 'oscuro';
  /** Portal en document.body por defecto para evitar recorte en contenedores con overflow. */
  enPortal?: boolean;
  alineacionMenu?: 'izquierda' | 'derecha';
  minAnchoMenu?: number;
  className?: string;
}

interface PosicionMenu {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxAltoLista: number;
  abrirArriba: boolean;
}

function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Selector accesible reutilizable con estética TimeFlow, navegación por teclado,
 * soporte de avatares/subtítulos/grupos, buscador interno opcional y renderizado en portal.
 */
export default function Selector<T extends string = string>({
  valor,
  onChange,
  opciones,
  placeholder = 'Seleccionar…',
  disabled = false,
  id,
  name,
  ariaLabel,
  buscable = false,
  placeholderBusqueda = 'Buscar…',
  mensajeVacio = 'Sin coincidencias',
  forma = 'defecto',
  forzarTema,
  enPortal = true,
  alineacionMenu = 'izquierda',
  minAnchoMenu,
  className = '',
}: SelectorProps<T>) {
  const colorPrimario = useColorPrimario();
  const temaGlobalEsClaro = useTemaFondo() === 'claro-nube';
  const esClaro = forzarTema ? forzarTema === 'claro' : temaGlobalEsClaro;

  const listboxId = useId();
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resaltadoIdx, setResaltadoIdx] = useState(-1);
  const [posicion, setPosicion] = useState<PosicionMenu | null>(null);

  const opcionActiva = useMemo(
    () => opciones.find((o) => o.valor === valor) ?? null,
    [opciones, valor],
  );

  const opcionesFiltradas = useMemo(() => {
    if (!buscable) return opciones;
    const q = normalizarBusqueda(busqueda);
    if (!q) return opciones;
    return opciones.filter((o) => {
      const texto = [o.etiqueta, o.subtitulo, o.badge, o.grupo, o.valor]
        .filter(Boolean)
        .join(' ');
      return normalizarBusqueda(texto).includes(q);
    });
  }, [buscable, busqueda, opciones]);

  const cerrar = useCallback((devolverFoco = false) => {
    setAbierto(false);
    setBusqueda('');
    setResaltadoIdx(-1);
    if (devolverFoco) {
      requestAnimationFrame(() => botonRef.current?.focus());
    }
  }, []);

  const recalcularPosicion = useCallback(() => {
    if (!enPortal || !botonRef.current) return;
    const rect = botonRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ancho = Math.min(vw - 16, Math.max(rect.width, minAnchoMenu ?? 0));
    const espacioAbajo = vh - rect.bottom - 12;
    const espacioArriba = rect.top - 12;
    const abrirArriba = espacioAbajo < 240 && espacioArriba > espacioAbajo;
    const espacioDisponible = abrirArriba ? espacioArriba : espacioAbajo;
    const maxAltoLista = Math.min(280, Math.max(130, espacioDisponible - (buscable ? 56 : 16)));

    let left = alineacionMenu === 'derecha' ? rect.right - ancho : rect.left;
    left = Math.max(8, Math.min(left, vw - ancho - 8));

    setPosicion(
      abrirArriba
        ? {
            bottom: vh - rect.top + 6,
            left,
            width: ancho,
            maxAltoLista,
            abrirArriba: true,
          }
        : {
            top: rect.bottom + 6,
            left,
            width: ancho,
            maxAltoLista,
            abrirArriba: false,
          },
    );
  }, [alineacionMenu, buscable, enPortal, minAnchoMenu]);

  const abrir = useCallback(() => {
    if (disabled) return;
    if (enPortal) recalcularPosicion();
    const idxActual = opciones.findIndex((o) => o.valor === valor && !o.deshabilitado);
    const primerValido = opciones.findIndex((o) => !o.deshabilitado);
    setResaltadoIdx(idxActual >= 0 ? idxActual : primerValido);
    setAbierto(true);
  }, [disabled, enPortal, opciones, recalcularPosicion, valor]);

  useEffect(() => {
    if (!abierto) return;
    if (buscable) {
      requestAnimationFrame(() => inputBusquedaRef.current?.focus());
    }
  }, [abierto, buscable]);

  // Al cambiar los resultados filtrados, garantiza que el índice resaltado apunte a uno válido.
  useEffect(() => {
    if (!abierto) return;
    setResaltadoIdx((prev) => {
      if (prev >= 0 && prev < opcionesFiltradas.length && !opcionesFiltradas[prev]?.deshabilitado) {
        return prev;
      }
      const seleccionado = opcionesFiltradas.findIndex(
        (o) => o.valor === valor && !o.deshabilitado,
      );
      if (seleccionado >= 0) return seleccionado;
      return opcionesFiltradas.findIndex((o) => !o.deshabilitado);
    });
  }, [abierto, opcionesFiltradas, valor]);

  // Reposiciona en scroll/resize cuando usa portal, y cierra con clic fuera o Escape en fase captura.
  useEffect(() => {
    if (!abierto) return;

    const alPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (botonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      cerrar(false);
    };

    const alKeyDownCaptura = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cerrar(true);
      }
    };

    const alResize = () => recalcularPosicion();
    const alScroll = (e: Event) => {
      if (!enPortal) return;
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      recalcularPosicion();
    };

    document.addEventListener('pointerdown', alPointerDown, true);
    window.addEventListener('keydown', alKeyDownCaptura, true);
    if (enPortal) {
      window.addEventListener('resize', alResize);
      window.addEventListener('scroll', alScroll, true);
    }

    return () => {
      document.removeEventListener('pointerdown', alPointerDown, true);
      window.removeEventListener('keydown', alKeyDownCaptura, true);
      if (enPortal) {
        window.removeEventListener('resize', alResize);
        window.removeEventListener('scroll', alScroll, true);
      }
    };
  }, [abierto, cerrar, enPortal, recalcularPosicion]);

  const moverResaltado = useCallback(
    (direccion: 1 | -1) => {
      const total = opcionesFiltradas.length;
      if (total === 0) return;
      let idx = resaltadoIdx;
      for (let i = 0; i < total; i++) {
        idx = (idx + direccion + total) % total;
        if (!opcionesFiltradas[idx]?.deshabilitado) {
          setResaltadoIdx(idx);
          itemsRef.current[idx]?.scrollIntoView({ block: 'nearest' });
          return;
        }
      }
    },
    [opcionesFiltradas, resaltadoIdx],
  );

  const seleccionarOpcion = useCallback(
    (op: OpcionSelector<T>) => {
      if (op.deshabilitado) return;
      onChange(op.valor);
      cerrar(true);
    },
    [cerrar, onChange],
  );

  const manejarTecla = (e: React.KeyboardEvent, enBuscador = false) => {
    if (!abierto) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrir();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moverResaltado(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moverResaltado(-1);
    } else if (e.key === 'Home' && !enBuscador) {
      e.preventDefault();
      const primero = opcionesFiltradas.findIndex((o) => !o.deshabilitado);
      if (primero >= 0) {
        setResaltadoIdx(primero);
        itemsRef.current[primero]?.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'End' && !enBuscador) {
      e.preventDefault();
      for (let i = opcionesFiltradas.length - 1; i >= 0; i--) {
        if (!opcionesFiltradas[i]?.deshabilitado) {
          setResaltadoIdx(i);
          itemsRef.current[i]?.scrollIntoView({ block: 'nearest' });
          break;
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const objetivo = opcionesFiltradas[resaltadoIdx];
      if (objetivo && !objetivo.deshabilitado) {
        seleccionarOpcion(objetivo);
      }
    } else if (e.key === ' ' && !enBuscador) {
      e.preventDefault();
      const objetivo = opcionesFiltradas[resaltadoIdx];
      if (objetivo && !objetivo.deshabilitado) {
        seleccionarOpcion(objetivo);
      }
    } else if (e.key === 'Tab') {
      cerrar(false);
    }
  };

  const claseTemaBoton = forzarTema
    ? forzarTema === 'claro'
      ? 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 focus-visible:border-sky-500'
      : 'border-white/15 bg-slate-950 text-white hover:border-white/25 hover:bg-slate-900 focus-visible:border-sky-400'
    : forma === 'pildora'
    ? 'border-[var(--tf-borde)] bg-[var(--tf-superficie)] text-[var(--tf-texto)] hover:border-[var(--tf-borde-fuerte)] hover:bg-[var(--tf-hover)] focus-visible:border-[var(--color-primario)]'
    : 'border-[var(--tf-borde)] bg-[var(--tf-input)] text-[var(--tf-texto)] hover:border-[var(--tf-borde-fuerte)] hover:bg-[var(--tf-hover)] focus-visible:border-[var(--color-primario)]';

  const claseFormaBoton =
    forma === 'pildora'
      ? 'h-9 rounded-full pl-3.5 pr-3 text-xs font-medium'
      : forma === 'compacto'
      ? 'rounded-lg px-2.5 py-1.5 text-xs'
      : 'w-full rounded-xl px-3 py-2 text-sm';

  const claseTemaMenu = forzarTema
    ? forzarTema === 'claro'
      ? 'border-slate-200 bg-white text-slate-900 shadow-2xl'
      : 'border-white/15 bg-slate-900 text-slate-100 shadow-2xl'
    : 'border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] text-[var(--tf-texto)] shadow-2xl';

  const claseTextoTenue = forzarTema
    ? forzarTema === 'claro'
      ? 'text-slate-500'
      : 'text-slate-400'
    : 'text-[var(--tf-texto-tenue)]';

  const claseHoverOpcion = forzarTema
    ? forzarTema === 'claro'
      ? 'hover:bg-slate-100'
      : 'hover:bg-white/5'
    : 'hover:bg-[var(--tf-hover)]';

  const colorAcentoLegible =
    esClaro && luminanciaRelativa(colorPrimario) > 0.52 ? '#0f172a' : colorPrimario;

  const renderMini = (op: OpcionSelector<T>) => {
    if (op.avatar) return <span className="shrink-0">{op.avatar}</span>;
    if (op.inicialesAvatar) {
      return (
        <span
          aria-hidden
          style={{ backgroundColor: op.colorAvatar || colorPrimario }}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
        >
          {op.inicialesAvatar}
        </span>
      );
    }
    if (op.icono) return <span className="shrink-0">{op.icono}</span>;
    return null;
  };

  let grupoAnterior: string | undefined;

  const contenidoMenu = (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      data-tf-selector-menu="true"
      aria-label={ariaLabel || placeholder}
      style={
        enPortal && posicion
          ? {
              position: 'fixed',
              zIndex: 70,
              top: posicion.top,
              bottom: posicion.bottom,
              left: posicion.left,
              width: posicion.width,
            }
          : minAnchoMenu
          ? { minWidth: minAnchoMenu }
          : undefined
      }
      className={`${
        enPortal ? '' : `absolute ${alineacionMenu === 'derecha' ? 'right-0' : 'left-0'} top-full z-50 mt-1.5 min-w-full`
      } tf-modal-entra rounded-2xl border p-1.5 backdrop-blur-xl ${claseTemaMenu}`}
    >
      {buscable && (
        <div className="mb-1.5 px-0.5 pt-0.5">
          <div className="relative">
            <Search
              size={13}
              aria-hidden
              className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${claseTextoTenue}`}
            />
            <input
              ref={inputBusquedaRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => manejarTecla(e, true)}
              placeholder={placeholderBusqueda}
              aria-label={placeholderBusqueda}
              className={`w-full rounded-xl border py-1.5 pl-8 pr-7 text-xs outline-none transition ${
                forzarTema === 'claro'
                  ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-sky-500'
                  : forzarTema === 'oscuro'
                  ? 'border-white/10 bg-slate-950 text-white placeholder:text-slate-500 focus:border-sky-400'
                  : 'border-[var(--tf-borde)] bg-[var(--tf-input)] text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] focus:border-[var(--color-primario)]'
              }`}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  inputBusquedaRef.current?.focus();
                }}
                aria-label="Limpiar filtro"
                className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 ${claseTextoTenue} hover:opacity-100`}
              >
                <X size={12} aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      <div
        style={{ maxHeight: enPortal && posicion ? posicion.maxAltoLista : 240 }}
        className="overflow-y-auto overscroll-contain pr-0.5"
      >
        {opcionesFiltradas.length === 0 ? (
          <p className={`px-3 py-4 text-center text-xs ${claseTextoTenue}`}>{mensajeVacio}</p>
        ) : (
          opcionesFiltradas.map((op, idx) => {
            const seleccionado = op.valor === valor;
            const resaltado = idx === resaltadoIdx;
            const mostrarGrupo = Boolean(op.grupo && op.grupo !== grupoAnterior);
            if (op.grupo) grupoAnterior = op.grupo;

            return (
              <div key={`${op.valor}-${idx}`}>
                {mostrarGrupo && (
                  <p
                    className={`px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider ${
                      idx > 0
                        ? forzarTema === 'claro'
                          ? 'mt-1 border-t border-slate-100'
                          : forzarTema === 'oscuro'
                          ? 'mt-1 border-t border-white/10'
                          : 'mt-1 border-t border-[var(--tf-borde)]'
                        : ''
                    } ${claseTextoTenue}`}
                  >
                    {op.grupo}
                  </p>
                )}
                <button
                  ref={(el) => {
                    itemsRef.current[idx] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={seleccionado}
                  disabled={op.deshabilitado}
                  onMouseEnter={() => {
                    if (!op.deshabilitado) setResaltadoIdx(idx);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    seleccionarOpcion(op);
                  }}
                  style={
                    seleccionado
                      ? { backgroundColor: colorConAlfa(colorPrimario, esClaro ? 0.14 : 0.18) }
                      : resaltado
                      ? {
                          backgroundColor: forzarTema === 'claro'
                            ? 'rgba(15, 23, 42, 0.06)'
                            : forzarTema === 'oscuro'
                            ? 'rgba(255, 255, 255, 0.07)'
                            : 'var(--tf-hover)',
                        }
                      : undefined
                  }
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    !seleccionado ? claseHoverOpcion : 'font-semibold'
                  }`}
                >
                  {renderMini(op)}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate leading-tight">{op.etiqueta}</span>
                    {op.subtitulo && (
                      <span className={`mt-0.5 block truncate text-[11px] font-normal ${claseTextoTenue}`}>
                        {op.subtitulo}
                      </span>
                    )}
                  </span>
                  {op.badge && (
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        forzarTema === 'claro'
                          ? 'border-slate-200 bg-slate-100 text-slate-700'
                          : forzarTema === 'oscuro'
                          ? 'border-white/10 bg-white/5 text-slate-300'
                          : 'border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] text-[var(--tf-texto-tenue)]'
                      }`}
                    >
                      {op.badge}
                    </span>
                  )}
                  {seleccionado && (
                    <Check
                      size={14}
                      aria-hidden
                      className="shrink-0"
                      style={{ color: colorAcentoLegible }}
                    />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${forma === 'defecto' ? 'w-full' : 'inline-block'} ${className}`}>
      {name && <input type="hidden" name={name} value={valor} />}
      <button
        ref={botonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (abierto) cerrar(false);
          else abrir();
        }}
        onKeyDown={(e) => manejarTecla(e, false)}
        className={`flex w-full items-center justify-between gap-2 border outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${claseFormaBoton} ${claseTemaBoton}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {opcionActiva && renderMini(opcionActiva)}
          <span className={`truncate ${!opcionActiva ? claseTextoTenue : ''}`}>
            {opcionActiva ? opcionActiva.etiqueta : placeholder}
          </span>
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`shrink-0 transition-transform duration-200 ${claseTextoTenue} ${
            abierto ? 'rotate-180' : ''
          }`}
        />
      </button>

      {abierto &&
        (enPortal && typeof document !== 'undefined'
          ? createPortal(contenidoMenu, document.body)
          : contenidoMenu)}
    </div>
  );
}
