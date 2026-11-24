'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, HelpCircle, Search, X } from 'lucide-react';
import Marco from '@/components/Marco';
import {
  PREGUNTAS_FRECUENTES,
  SECCIONES_MANUAL,
  SeccionManual,
} from '@/lib/manual';
import { Rol } from '@/lib/rbac';
import { useSesion } from '@/lib/sesion';

type FiltroRol = 'MI_ROL' | 'TODOS';

const FILTROS_ROL: { valor: FiltroRol; texto: string }[] = [
  { valor: 'MI_ROL', texto: 'Para mí' },
  { valor: 'TODOS', texto: 'Todo el manual' },
];

export default function PaginaManual() {
  return (
    <Marco
      activo="/manual"
      titulo="Manual de uso"
      subtitulo="Guía interactiva paso a paso de TimeFlow"
    >
      <ContenidoManual />
    </Marco>
  );
}

function ContenidoManual() {
  const usuario = useSesion();
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<FiltroRol>('MI_ROL');
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({
    [SECCIONES_MANUAL[0].id]: true,
  });
  const [faqsAbiertas, setFaqsAbiertas] = useState<Record<string, boolean>>({});

  const rolEfectivo: Rol | null = useMemo(() => {
    if (filtroRol === 'TODOS') return null;
    return usuario?.rol ?? null;
  }, [filtroRol, usuario?.rol]);

  const termino = busqueda.trim().toLowerCase();

  const seccionesVisibles = useMemo(() => {
    return SECCIONES_MANUAL.filter((s) => {
      if (rolEfectivo && !s.roles.includes(rolEfectivo)) return false;
      if (!termino) return true;
      const texto = [
        s.categoria,
        s.titulo,
        s.resumen,
        ...s.pasos.flatMap((p) => [p.titulo, p.detalle]),
        ...s.consejos,
      ]
        .join(' ')
        .toLowerCase();
      return texto.includes(termino);
    });
  }, [rolEfectivo, termino]);

  const faqsVisibles = useMemo(() => {
    return PREGUNTAS_FRECUENTES.filter((f) => {
      if (rolEfectivo && !f.roles.includes(rolEfectivo)) return false;
      if (!termino) return true;
      return `${f.pregunta} ${f.respuesta}`.toLowerCase().includes(termino);
    });
  }, [rolEfectivo, termino]);

  const todasAbiertas =
    seccionesVisibles.length > 0 &&
    seccionesVisibles.every((s) => Boolean(abiertas[s.id]));

  function alternarTodas() {
    const siguiente = !todasAbiertas;
    const mapa: Record<string, boolean> = {};
    for (const s of seccionesVisibles) mapa[s.id] = siguiente;
    setAbiertas(mapa);
  }

  function puedeAbrirRuta(seccion: SeccionManual): boolean {
    if (!seccion.rutaRelacionada) return false;
    const req = seccion.rutaRelacionada.permisoRequerido;
    if (!req) return true;
    return Boolean(usuario?.permisos?.includes(req));
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      {/* Buscador y filtro por rol */}
      <section className="tf-card-pro rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tf-texto-suave)]"
              aria-hidden
            />
            <input
              id="manual-busqueda"
              name="q"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar tema (ej. cronómetro, Gantt, evidencias, autocierre, calendario)…"
              aria-label="Buscar en el manual de uso"
              className="w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] py-2 pl-9 pr-9 text-sm text-[var(--tf-texto)] placeholder:text-[var(--tf-texto-suave)] outline-none focus:border-sky-400"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--tf-texto-tenue)] transition hover:text-[var(--tf-texto)]"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={alternarTodas}
            disabled={seccionesVisibles.length === 0}
            className="shrink-0 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)] px-3 py-2 text-xs font-medium text-[var(--tf-texto)] transition hover:border-[var(--tf-borde-fuerte)] disabled:opacity-40"
          >
            {todasAbiertas ? 'Colapsar todas' : 'Expandir todas'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {FILTROS_ROL.map((f) => {
            const activo = filtroRol === f.valor;
            return (
              <button
                key={f.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltroRol(f.valor)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activo
                    ? 'border-sky-500/40 bg-sky-500/15 text-[var(--tf-acento-azul)]'
                    : 'border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
                }`}
              >
                {f.texto}
              </button>
            );
          })}
        </div>
      </section>

      {/* Secciones del manual en formato acordeón */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--tf-texto)]">
            <BookOpen size={15} className="text-[var(--tf-acento-azul)]" aria-hidden />
            <span>Guías paso a paso ({seccionesVisibles.length})</span>
          </h2>
        </div>

        {seccionesVisibles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--tf-borde-fuerte)] p-8 text-center text-sm text-[var(--tf-texto-tenue)]">
            No encontramos guías que coincidan con «{busqueda}». Prueba con «Todo el manual» o
            limpia el buscador.
          </p>
        ) : (
          seccionesVisibles.map((s) => {
            const abierta = Boolean(abiertas[s.id]) || Boolean(termino);
            const mostrarEnlace = puedeAbrirRuta(s);

            return (
              <article
                key={s.id}
                className="tf-card-pro overflow-hidden rounded-2xl transition"
              >
                <button
                  type="button"
                  onClick={() =>
                    setAbiertas((prev) => ({ ...prev, [s.id]: !abierta }))
                  }
                  aria-expanded={abierta}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--tf-hover)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-acento-azul)]">
                        {s.categoria}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--tf-texto)]">{s.titulo}</h3>
                    <p className="mt-0.5 text-xs text-[var(--tf-texto-tenue)]">{s.resumen}</p>
                  </div>

                  <ChevronDown
                    size={18}
                    aria-hidden
                    className={`mt-1 shrink-0 text-[var(--tf-texto-tenue)] transition-transform duration-200 ${
                      abierta ? 'rotate-180 text-[var(--tf-acento-azul)]' : ''
                    }`}
                  />
                </button>

                {abierta && (
                  <div className="border-t border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] px-5 py-4">
                    <ol className="flex flex-col gap-3">
                      {s.pasos.map((p, idx) => (
                        <li key={p.titulo} className="flex items-start gap-3">
                          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-sky-500/35 bg-sky-500/15 font-mono text-xs font-bold text-[var(--tf-acento-azul)]">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--tf-texto)]">{p.titulo}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-[var(--tf-texto-tenue)]">
                              {p.detalle}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>

                    {s.consejos.length > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-acento-ambar)]">
                          Puntos clave
                        </p>
                        <ul className="flex flex-col gap-1 text-xs text-[var(--tf-texto)]">
                          {s.consejos.map((c) => (
                            <li key={c}>· {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {mostrarEnlace && s.rutaRelacionada && (
                      <div className="mt-4 flex justify-end">
                        <Link
                          href={s.rutaRelacionada.href}
                          className="rounded-xl border border-sky-500/35 bg-sky-500/15 px-3.5 py-1.5 text-xs font-semibold text-[var(--tf-acento-azul)] transition hover:bg-sky-500/25"
                        >
                          {s.rutaRelacionada.etiqueta} →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* Preguntas frecuentes */}
      {faqsVisibles.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-[var(--tf-texto)]">
            <HelpCircle size={15} className="text-[var(--tf-acento-azul)]" aria-hidden />
            <span>Preguntas frecuentes ({faqsVisibles.length})</span>
          </h2>

          <div className="tf-card-pro divide-y divide-[var(--tf-borde)] overflow-hidden rounded-2xl">
            {faqsVisibles.map((f) => {
              const abierta = Boolean(faqsAbiertas[f.id]) || Boolean(termino);
              return (
                <div key={f.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setFaqsAbiertas((prev) => ({ ...prev, [f.id]: !abierta }))
                    }
                    aria-expanded={abierta}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-medium text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)]"
                  >
                    <span>{f.pregunta}</span>
                    <ChevronDown
                      size={16}
                      aria-hidden
                      className={`shrink-0 text-[var(--tf-texto-tenue)] transition-transform ${
                        abierta ? 'rotate-180 text-[var(--tf-acento-azul)]' : ''
                      }`}
                    />
                  </button>
                  {abierta && (
                    <p className="border-t border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] px-5 py-3 text-xs leading-relaxed text-[var(--tf-texto-tenue)]">
                      {f.respuesta}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
