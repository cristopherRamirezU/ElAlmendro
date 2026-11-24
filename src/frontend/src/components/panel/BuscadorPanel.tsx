'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, Loader2, Search, User, X } from 'lucide-react';
import { api, type ProyectoItem, type TareaBusquedaItem } from '@/lib/api';
import { colorConAlfa, useColorPrimario } from '@/lib/color';
import { ESTADOS } from '@/lib/formato';

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Buscador unificado para el Panel (/panel): filtra proyectos localmente en tiempo real
 * y consulta GET /actividades/buscar para saltar directo a cualquier tarea en /nodos.
 */
export default function BuscadorPanel({
  id,
  valor,
  onCambio,
  proyectos,
  onIrAlMapa,
  onElegirProyecto,
}: {
  id: string;
  valor: string;
  onCambio: (v: string) => void;
  proyectos: ProyectoItem[];
  onIrAlMapa: (p: ProyectoItem) => void;
  onElegirProyecto?: (id: string) => void;
}) {
  const router = useRouter();
  const colorPrimario = useColorPrimario();

  const contenedorRef = useRef<HTMLDivElement>(null);
  const peticionRef = useRef(0);

  const [abierto, setAbierto] = useState(false);
  const [tareas, setTareas] = useState<TareaBusquedaItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState(false);
  const [activoIdx, setActivoIdx] = useState(-1);

  const termino = valor.trim();
  const mostrarResultados = abierto && termino.length >= 2;

  const proyectosCoincidentes = useMemo(() => {
    const q = normalizarTexto(termino);
    if (q.length < 2) return [];
    return proyectos.filter(
      (p) =>
        normalizarTexto(p.nombre).includes(q) ||
        normalizarTexto(p.descripcion ?? '').includes(q),
    );
  }, [proyectos, termino]);

  const proyectosVisibles = useMemo(
    () => proyectosCoincidentes.slice(0, 6),
    [proyectosCoincidentes],
  );

  useEffect(() => {
    if (termino.length < 2) {
      peticionRef.current += 1;
      setTareas([]);
      setCargando(false);
      setErrorBusqueda(false);
      setActivoIdx(-1);
      return;
    }

    const idPeticion = ++peticionRef.current;
    setCargando(true);
    setErrorBusqueda(false);

    const timer = window.setTimeout(() => {
      api
        .get<TareaBusquedaItem[]>(`/actividades/buscar?q=${encodeURIComponent(termino)}`)
        .then((res) => {
          if (peticionRef.current !== idPeticion) return;
          setTareas(res ?? []);
          setErrorBusqueda(false);
        })
        .catch(() => {
          if (peticionRef.current !== idPeticion) return;
          setTareas([]);
          setErrorBusqueda(true);
        })
        .finally(() => {
          if (peticionRef.current === idPeticion) setCargando(false);
        });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [termino]);

  useEffect(() => {
    if (!mostrarResultados) return;
    const alPointerDown = (e: PointerEvent) => {
      if (!contenedorRef.current?.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('pointerdown', alPointerDown);
    return () => document.removeEventListener('pointerdown', alPointerDown);
  }, [mostrarResultados]);

  const totalOpciones = proyectosVisibles.length + tareas.length;

  useEffect(() => {
    if (activoIdx >= totalOpciones) setActivoIdx(-1);
  }, [activoIdx, totalOpciones]);

  const abrirProyectoEnMapa = (p: ProyectoItem) => {
    setAbierto(false);
    onIrAlMapa(p);
  };

  const abrirTareaEnMapa = (t: TareaBusquedaItem) => {
    setAbierto(false);
    router.push(
      `/nodos?proyectoId=${t.proyectoId}&nombre=${encodeURIComponent(t.proyectoNombre)}&tarea=${t.id}&abrir=${Date.now()}`,
    );
  };

  const manejarTecla = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (mostrarResultados) {
        e.preventDefault();
        setAbierto(false);
      } else if (valor) {
        onCambio('');
      }
      return;
    }

    if (!mostrarResultados || totalOpciones === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivoIdx((prev) => (prev + 1) % totalOpciones);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivoIdx((prev) => (prev <= 0 ? totalOpciones - 1 : prev - 1));
    } else if (e.key === 'Enter' && activoIdx >= 0) {
      e.preventDefault();
      if (activoIdx < proyectosVisibles.length) {
        abrirProyectoEnMapa(proyectosVisibles[activoIdx]);
      } else {
        const tarea = tareas[activoIdx - proyectosVisibles.length];
        if (tarea) abrirTareaEnMapa(tarea);
      }
    }
  };

  const sinResultados =
    !cargando && !errorBusqueda && proyectosVisibles.length === 0 && tareas.length === 0;

  return (
    <div ref={contenedorRef} role="search" className="relative min-w-[8rem] flex-1 sm:max-w-64">
      <label htmlFor={id} className="relative block">
        <span className="sr-only">Buscar proyecto o tarea</span>
        <Search
          size={14}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tf-texto-suave)]"
        />
        <input
          id={id}
          name="buscarProyectoOTarea"
          type="search"
          value={valor}
          onFocus={() => {
            if (valor.trim().length >= 2) setAbierto(true);
          }}
          onChange={(e) => {
            const nuevo = e.target.value;
            onCambio(nuevo);
            setAbierto(nuevo.trim().length >= 2);
            setActivoIdx(-1);
          }}
          onKeyDown={manejarTecla}
          placeholder="Buscar proyecto o tarea…"
          autoComplete="off"
          aria-expanded={mostrarResultados}
          aria-autocomplete="list"
          className="h-9 w-full rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] pl-8 pr-8 text-xs text-[var(--tf-texto)] outline-none transition placeholder:text-[var(--tf-texto-suave)] focus:border-[var(--color-primario)] [&::-webkit-search-cancel-button]:hidden"
        />
        {valor && (
          <button
            type="button"
            onClick={() => {
              onCambio('');
              setAbierto(false);
              setActivoIdx(-1);
            }}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--tf-texto-tenue)] transition-colors hover:text-[var(--tf-texto)]"
          >
            <X size={13} aria-hidden />
          </button>
        )}
      </label>

      {mostrarResultados && (
        <div
          role="region"
          aria-label="Resultados de búsqueda"
          className="tf-modal-entra absolute left-0 top-full z-50 mt-2 max-h-[min(28rem,70vh)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] p-2 shadow-2xl backdrop-blur-xl"
        >
          {/* Sección 1: Proyectos */}
          <div>
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-texto-suave)]">
                Proyectos
              </p>
              {proyectosCoincidentes.length > proyectosVisibles.length && (
                <span className="text-[10px] text-[var(--tf-texto-suave)]">
                  Mostrando {proyectosVisibles.length} de {proyectosCoincidentes.length}
                </span>
              )}
            </div>

            {proyectosVisibles.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-[var(--tf-texto-tenue)]">
                Sin proyectos coincidentes.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {proyectosVisibles.map((p, idx) => {
                  const pct =
                    p.totalTareas > 0
                      ? Math.round((p.tareasCompletadas / p.totalTareas) * 100)
                      : 0;
                  const resaltado = idx === activoIdx;
                  return (
                    <li key={p.id}>
                      <div
                        role="button"
                        tabIndex={-1}
                        onMouseEnter={() => setActivoIdx(idx)}
                        onClick={() => abrirProyectoEnMapa(p)}
                        style={
                          resaltado
                            ? { backgroundColor: colorConAlfa(colorPrimario, 0.14) }
                            : undefined
                        }
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-[var(--tf-hover)]"
                      >
                        <span
                          aria-hidden
                          style={{
                            backgroundColor: colorConAlfa(colorPrimario, 0.15),
                            color: colorPrimario,
                          }}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                        >
                          <FolderKanban size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[var(--tf-texto)]">
                            {p.nombre}
                          </p>
                          <p className="text-[11px] text-[var(--tf-texto-tenue)]">
                            {p.tareasCompletadas}/{p.totalTareas} tareas · {pct}%
                          </p>
                        </div>
                        {onElegirProyecto && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAbierto(false);
                              onElegirProyecto(p.id);
                            }}
                            className="shrink-0 rounded-full border border-[var(--tf-borde)] px-2 py-0.5 text-[10px] font-medium text-[var(--tf-texto-tenue)] transition hover:border-[var(--tf-borde-fuerte)] hover:text-[var(--tf-texto)]"
                          >
                            Ver ficha
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Sección 2: Tareas en proyectos */}
          <div className="mt-2 border-t border-[var(--tf-borde)] pt-2">
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-texto-suave)]">
                Tareas en proyectos
              </p>
              {cargando && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[var(--tf-texto-tenue)]">
                  <Loader2 size={11} className="animate-spin" aria-hidden />
                  Buscando…
                </span>
              )}
            </div>

            {errorBusqueda ? (
              <p className="px-2 py-2 text-xs text-[var(--tf-acento-rojo)]">
                No se pudo buscar en tareas. Intenta nuevamente.
              </p>
            ) : !cargando && tareas.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-[var(--tf-texto-tenue)]">
                {sinResultados
                  ? `Sin coincidencias para «${termino}».`
                  : 'Sin tareas coincidentes.'}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {tareas.map((t, tIdx) => {
                  const idxGlobal = proyectosVisibles.length + tIdx;
                  const resaltado = idxGlobal === activoIdx;
                  const est = ESTADOS[t.estado] ?? {
                    texto: t.estado,
                    clase:
                      'text-[var(--tf-texto-tenue)] bg-[var(--tf-hover)] border-[var(--tf-borde)]',
                    punto: 'bg-slate-400',
                  };
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setActivoIdx(idxGlobal)}
                        onClick={() => abrirTareaEnMapa(t)}
                        style={
                          resaltado
                            ? { backgroundColor: colorConAlfa(colorPrimario, 0.14) }
                            : undefined
                        }
                        className="flex w-full items-start justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--tf-hover)]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[var(--tf-texto)]">
                            {t.titulo}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--tf-texto-tenue)]">
                            <span className="inline-flex min-w-0 items-center gap-1 truncate">
                              <FolderKanban size={11} aria-hidden className="shrink-0 opacity-75" />
                              <span className="truncate">{t.proyectoNombre}</span>
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1 truncate">
                              <User size={11} aria-hidden className="shrink-0 opacity-75" />
                              <span className="truncate">{t.responsableNombre}</span>
                            </span>
                          </div>
                        </div>
                        <span
                          className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${est.clase}`}
                        >
                          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${est.punto}`} />
                          {est.texto}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
