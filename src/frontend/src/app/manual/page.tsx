'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, HelpCircle, Search, X } from 'lucide-react';
import Marco from '@/components/Marco';
import {
  ETIQUETAS_ROL,
  PREGUNTAS_FRECUENTES,
  SECCIONES_MANUAL,
  SeccionManual,
} from '@/lib/manual';
import { Rol } from '@/lib/rbac';
import { useSesion } from '@/lib/sesion';

type FiltroRol = 'MI_ROL' | 'TODOS' | Rol;

const FILTROS_ROL: { valor: FiltroRol; texto: string }[] = [
  { valor: 'MI_ROL', texto: 'Para mi rol' },
  { valor: 'TODOS', texto: 'Todo el manual' },
  { valor: 'TRABAJADOR', texto: 'Trabajador' },
  { valor: 'SUPERVISOR', texto: 'Supervisor' },
  { valor: 'ADMINISTRADOR', texto: 'Administrador' },
  { valor: 'SUPER_ADMIN', texto: 'SuperAdmin' },
];

export default function PaginaManual() {
  return (
    <Marco
      activo="/manual"
      titulo="Manual de uso"
      subtitulo="Guía interactiva de TimeFlow adaptada a tu rol"
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
    if (filtroRol === 'MI_ROL') return usuario?.rol ?? null;
    return filtroRol;
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
      <section className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
              className="w-full rounded-xl border border-white/15 bg-slate-950 py-2 pl-9 pr-9 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-white"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={alternarTodas}
            disabled={seccionesVisibles.length === 0}
            className="shrink-0 rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
          >
            {todasAbiertas ? 'Colapsar todas' : 'Expandir todas'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {FILTROS_ROL.map((f) => {
            const activo = filtroRol === f.valor;
            const etiquetaExtra =
              f.valor === 'MI_ROL' && usuario?.rol
                ? ` (${ETIQUETAS_ROL[usuario.rol].nombre})`
                : '';
            return (
              <button
                key={f.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltroRol(f.valor)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activo
                    ? 'border-sky-400/40 bg-sky-500/15 text-sky-200'
                    : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {f.texto}
                {etiquetaExtra}
              </button>
            );
          })}
        </div>
      </section>

      {/* Secciones del manual en formato acordeón */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <BookOpen size={15} className="text-sky-400" aria-hidden />
            <span>Guías paso a paso ({seccionesVisibles.length})</span>
          </h2>
        </div>

        {seccionesVisibles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
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
                className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 transition"
              >
                <button
                  type="button"
                  onClick={() =>
                    setAbiertas((prev) => ({ ...prev, [s.id]: !abierta }))
                  }
                  aria-expanded={abierta}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                        {s.categoria}
                      </span>
                      {s.roles.map((r) => (
                        <span
                          key={r}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ETIQUETAS_ROL[r].clase}`}
                        >
                          {ETIQUETAS_ROL[r].nombre}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-base font-semibold text-white">{s.titulo}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">{s.resumen}</p>
                  </div>

                  <ChevronDown
                    size={18}
                    aria-hidden
                    className={`mt-1 shrink-0 text-slate-400 transition-transform duration-200 ${
                      abierta ? 'rotate-180 text-sky-300' : ''
                    }`}
                  />
                </button>

                {abierta && (
                  <div className="border-t border-white/10 bg-slate-950/40 px-5 py-4">
                    <ol className="flex flex-col gap-3">
                      {s.pasos.map((p, idx) => (
                        <li key={p.titulo} className="flex items-start gap-3">
                          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-sky-400/30 bg-sky-500/15 font-mono text-xs font-bold text-sky-300">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{p.titulo}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                              {p.detalle}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>

                    {s.consejos.length > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                          Puntos clave
                        </p>
                        <ul className="flex flex-col gap-1 text-xs text-amber-100/85">
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
                          className="rounded-xl border border-sky-400/35 bg-sky-500/15 px-3.5 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25"
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
          <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-200">
            <HelpCircle size={15} className="text-sky-400" aria-hidden />
            <span>Preguntas frecuentes ({faqsVisibles.length})</span>
          </h2>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 divide-y divide-white/10">
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
                    className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-medium text-white transition hover:bg-white/[0.03]"
                  >
                    <span>{f.pregunta}</span>
                    <ChevronDown
                      size={16}
                      aria-hidden
                      className={`shrink-0 text-slate-400 transition-transform ${
                        abierta ? 'rotate-180 text-sky-300' : ''
                      }`}
                    />
                  </button>
                  {abierta && (
                    <p className="border-t border-white/5 bg-slate-950/35 px-5 py-3 text-xs leading-relaxed text-slate-300">
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
