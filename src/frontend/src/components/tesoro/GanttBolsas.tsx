'use client';

import { useEffect, useMemo, useState } from 'react';
import { ESTADOS } from '@/lib/formato';
import { NodoActividad } from '@/lib/tipos';
import BolsaOro from './BolsaOro';
import { llenadoDeBolsa } from './llenado';

type Escala = 'mes' | 'trimestre';

const DIA_MS = 86_400_000;
const ANCHO_ETIQUETA = 232;

/** Color de la barra segun el estado de la bolsa. */
const COLOR_BARRA: Record<string, { borde: string; fondo: string }> = {
  PENDIENTE: { borde: 'border-sky-400/60', fondo: 'bg-sky-500/15' },
  EN_PROGRESO: { borde: 'border-amber-400/70', fondo: 'bg-amber-500/15' },
  BLOQUEADA: { borde: 'border-rose-400/70', fondo: 'bg-rose-500/15' },
  INCONCLUSA: { borde: 'border-orange-400/70', fondo: 'bg-orange-500/15' },
  COMPLETADA: { borde: 'border-emerald-400/70', fondo: 'bg-emerald-500/15' },
  CANCELADA: { borde: 'border-slate-500/60', fondo: 'bg-white/5' },
};

const fechaCorta = (d: Date) =>
  d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

const inicioDeMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : null);

/**
 * Tramo de vida de una bolsa. Nace con la tarea, salvo que su cronometro
 * registre trabajo anterior (datos importados o cargados a mano): la barra
 * nunca empieza despues de lo que ya se trabajo en ella.
 */
function tramoDeBolsa(a: NodoActividad, ahora: number) {
  const trabajo = ms(a.inicioTrabajoEn);
  const guardada = ms(a.completadaEn);
  const nace = Math.min(ms(a.creadoEn) ?? ahora, trabajo ?? Infinity, guardada ?? Infinity);
  const termina = Math.max(guardada ?? ahora, nace);
  return { nace, trabajo, termina };
}

interface Fila {
  actividad: NodoActividad;
  nivel: number;
}

/**
 * Ordena como arbol: cada bolsa madre seguida de sus hijas, y entre hermanas
 * por fecha de creacion. Una hija cuya madre quedo fuera del filtro sube a
 * la raiz para no perderse.
 */
function ordenarComoArbol(actividades: NodoActividad[]): Fila[] {
  const ids = new Set(actividades.map((a) => a.id));
  const hijas = new Map<string | null, NodoActividad[]>();
  for (const a of actividades) {
    const madre = a.actividadPadreId && ids.has(a.actividadPadreId) ? a.actividadPadreId : null;
    hijas.set(madre, [...(hijas.get(madre) ?? []), a]);
  }
  const porFecha = (x: NodoActividad, y: NodoActividad) =>
    (x.creadoEn ?? '').localeCompare(y.creadoEn ?? '');

  const filas: Fila[] = [];
  const recorrer = (madre: string | null, nivel: number) => {
    for (const a of (hijas.get(madre) ?? []).sort(porFecha)) {
      filas.push({ actividad: a, nivel });
      recorrer(a.id, nivel + 1);
    }
  };
  recorrer(null, 0);
  return filas;
}

/**
 * Carta Gantt de las bolsas de un proyecto.
 *
 * Cada tarea es una barra que nace el dia en que se creo y termina el dia en
 * que se guardo en el cofre; si sigue abierta, llega hasta hoy y queda
 * abierta por la derecha. El tramo rayado es la espera antes de encender el
 * cronometro por primera vez, y el oro que llena la barra es el mismo de la
 * bolsa: sus monedas marcadas. Al final de la barra va la bolsa, y tocar la
 * fila la abre en la ventana flotante con todas sus funciones.
 */
export default function GanttBolsas({
  actividades,
  activaId,
  onAbrir,
}: {
  actividades: NodoActividad[];
  activaId?: string | null;
  onAbrir: (a: NodoActividad) => void;
}) {
  const [escala, setEscala] = useState<Escala>('mes');
  const [desde, setDesde] = useState(() => inicioDeMes(new Date()));
  const [ahora, setAhora] = useState(() => Date.now());

  // "Hoy" avanza solo: las barras abiertas crecen sin recargar.
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const meses = escala === 'mes' ? 1 : 3;
  const inicio = desde.getTime();
  const fin = new Date(desde.getFullYear(), desde.getMonth() + meses, 1).getTime();
  const total = fin - inicio;
  const pct = (t: number) => ((t - inicio) / total) * 100;

  const dias = useMemo(() => {
    const lista: Date[] = [];
    for (let d = new Date(desde); d.getTime() < fin; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      lista.push(d);
    }
    return lista;
  }, [desde, fin]);

  const filas = useMemo(() => ordenarComoArbol(actividades), [actividades]);

  // Solo se dibujan las bolsas vivas dentro del periodo; las demas se cuentan.
  const { enPeriodo, antes, despues } = useMemo(() => {
    const enPeriodo: Fila[] = [];
    let antes = 0;
    let despues = 0;
    for (const f of filas) {
      const { nace, termina } = tramoDeBolsa(f.actividad, ahora);
      if (termina < inicio) antes += 1;
      else if (nace >= fin) despues += 1;
      else enPeriodo.push(f);
    }
    return { enPeriodo, antes, despues };
  }, [filas, inicio, fin, ahora]);

  const mover = (paso: number) =>
    setDesde((d) => new Date(d.getFullYear(), d.getMonth() + paso * meses, 1));

  const hoyVisible = ahora >= inicio && ahora < fin;
  const tituloCrudo =
    escala === 'mes'
      ? desde.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
      : `${desde.toLocaleDateString('es-CL', { month: 'short' })} – ${mayuscula(new Date(fin - DIA_MS).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }))}`;
  // Solo la primera letra: "Septiembre de 2026", no "Septiembre De 2026".
  const titulo = mayuscula(tituloCrudo);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 backdrop-blur">
      {/* ------------------------------ Barra de control ------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => mover(-1)}
            aria-label="Periodo anterior"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/5"
          >
            ‹
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-white">
            {titulo}
          </span>
          <button
            onClick={() => mover(1)}
            aria-label="Periodo siguiente"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/5"
          >
            ›
          </button>
          <button
            onClick={() => setDesde(inicioDeMes(new Date()))}
            className="ml-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Hoy
          </button>
        </div>
        <div className="flex rounded-lg border border-white/10 p-0.5 text-xs">
          {(['mes', 'trimestre'] as Escala[]).map((e) => (
            <button
              key={e}
              onClick={() => setEscala(e)}
              className={`rounded-md px-2.5 py-1 transition ${
                escala === e ? 'bg-amber-500/20 font-semibold text-amber-200' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {e === 'mes' ? 'Mes' : '3 meses'}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------------------------- Rejilla ---------------------------------- */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: escala === 'mes' ? 760 : 980 }}>
          {/* Encabezado de dias */}
          <div className="flex border-b border-white/10">
            <div
              className="sticky left-0 z-20 shrink-0 bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              style={{ width: ANCHO_ETIQUETA }}
            >
              Bolsa
            </div>
            <div className="relative h-9 flex-1">
              {dias.map((d) => {
                const izquierda = pct(d.getTime());
                const esPrimero = d.getDate() === 1;
                const finDeSemana = d.getDay() === 0 || d.getDay() === 6;
                // En 3 meses: el inicio de cada mes y los lunes, salvo los que
                // caen pegados a un cambio de mes y se encimarian con su nombre.
                const diasAlFinDeMes =
                  new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
                const mostrar =
                  escala === 'mes' ||
                  esPrimero ||
                  (d.getDay() === 1 && d.getDate() > 3 && diasAlFinDeMes >= 2);
                if (!mostrar) return null;
                return (
                  <span
                    key={d.getTime()}
                    className={`absolute top-0 flex h-full flex-col justify-center text-[10px] leading-tight ${
                      finDeSemana ? 'text-slate-500' : 'text-slate-400'
                    }`}
                    style={{ left: `${izquierda}%`, width: `${100 / dias.length}%`, minWidth: 14 }}
                  >
                    {escala === 'mes' ? (
                      <span className="text-center">
                        <span className="block uppercase">
                          {d.toLocaleDateString('es-CL', { weekday: 'narrow' })}
                        </span>
                        {d.getDate()}
                      </span>
                    ) : (
                      <span className={`whitespace-nowrap pl-1 ${esPrimero ? 'font-semibold capitalize text-slate-200' : ''}`}>
                        {esPrimero ? d.toLocaleDateString('es-CL', { month: 'short' }) : d.getDate()}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Filas */}
          <div className="relative">
            {/* Fondo: fines de semana, cambios de mes y la linea de hoy */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0"
              style={{ left: ANCHO_ETIQUETA }}
              aria-hidden
            >
              {dias.map((d) =>
                d.getDay() === 0 || d.getDay() === 6 ? (
                  <div
                    key={d.getTime()}
                    className="absolute inset-y-0 bg-white/[0.025]"
                    style={{ left: `${pct(d.getTime())}%`, width: `${100 / dias.length}%` }}
                  />
                ) : d.getDate() === 1 && d.getTime() !== inicio ? (
                  <div
                    key={d.getTime()}
                    className="absolute inset-y-0 border-l border-white/10"
                    style={{ left: `${pct(d.getTime())}%` }}
                  />
                ) : null,
              )}
              {hoyVisible && (
                <div
                  className="absolute inset-y-0 z-10 border-l-2 border-sky-400/70"
                  style={{ left: `${pct(ahora)}%` }}
                >
                  <span className="absolute top-0 -translate-x-[calc(100%+3px)] rounded bg-sky-500/20 px-1 text-[9px] font-semibold text-sky-200">
                    hoy
                  </span>
                </div>
              )}
            </div>

            {enPeriodo.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">
                Ninguna bolsa estuvo abierta en este periodo.
              </p>
            ) : (
              enPeriodo.map(({ actividad: a, nivel }) => (
                <FilaGantt
                  key={a.id}
                  actividad={a}
                  nivel={nivel}
                  activa={activaId === a.id}
                  ahora={ahora}
                  inicio={inicio}
                  fin={fin}
                  pct={pct}
                  onAbrir={() => onAbrir(a)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---------------------------------- Pie ---------------------------------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-3 py-2.5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm border border-slate-500/60 bg-[repeating-linear-gradient(135deg,rgba(148,163,184,.25)_0_3px,transparent_3px_6px)]" />
          En espera
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-gradient-to-r from-amber-500 to-amber-300" />
          Oro (monedas listas)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rotate-45 bg-rose-400" />
          Fecha límite
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 border-l-2 border-sky-400/70" />
          Hoy
        </span>
        {(antes > 0 || despues > 0) && (
          <span className="ml-auto text-slate-500">
            {antes > 0 && `${antes} ${antes === 1 ? 'bolsa terminó' : 'bolsas terminaron'} antes`}
            {antes > 0 && despues > 0 && ' · '}
            {despues > 0 && `${despues} ${despues === 1 ? 'nace' : 'nacen'} después`}
          </span>
        )}
      </div>
    </div>
  );
}

function FilaGantt({
  actividad: a,
  nivel,
  activa,
  ahora,
  inicio,
  fin,
  pct,
  onAbrir,
}: {
  actividad: NodoActividad;
  nivel: number;
  activa: boolean;
  ahora: number;
  inicio: number;
  fin: number;
  pct: (t: number) => number;
  onAbrir: () => void;
}) {
  const llenado = llenadoDeBolsa(a);
  const guardada = a.estado === 'COMPLETADA';
  const estado = ESTADOS[a.estado] ?? ESTADOS.PENDIENTE;
  const color = COLOR_BARRA[a.estado] ?? COLOR_BARRA.PENDIENTE;

  const { nace, termina, trabajo } = tramoDeBolsa(a, ahora);
  const limite = a.fechaLimite ? new Date(a.fechaLimite).getTime() : null;
  const atrasada = limite !== null && termina > limite;

  // La barra se recorta al periodo; los bordes cortados se dejan rectos.
  const desde = Math.max(nace, inicio);
  const hasta = Math.min(termina, fin);
  const cortadaIzq = nace < inicio;
  const cortadaDer = termina > fin || (!guardada && hasta >= fin);
  const izquierda = pct(desde);
  const ancho = Math.max(pct(hasta) - izquierda, 0);

  // Parte rayada: desde que nace hasta el primer cronometro (o todo, si nunca se trabajo).
  const finEspera = trabajo ?? (guardada ? nace : termina);
  const espera =
    hasta > desde ? Math.min(Math.max((Math.min(finEspera, hasta) - desde) / (hasta - desde), 0), 1) : 0;

  const detalle = [
    a.titulo,
    `Creada: ${fechaCorta(new Date(ms(a.creadoEn) ?? nace))}`,
    trabajo ? `Primer cronómetro: ${fechaCorta(new Date(trabajo))}` : 'Sin cronómetro aún',
    guardada && a.completadaEn ? `Guardada en el cofre: ${fechaCorta(new Date(termina))}` : `Estado: ${estado.texto}`,
    limite ? `Fecha límite: ${fechaCorta(new Date(limite))}${atrasada ? ' (atrasada)' : ''}` : null,
    a.monedas > 0 ? `${a.monedasListas}/${a.monedas} monedas` : null,
    `Responsable: ${a.responsable.nombreCompleto}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      onClick={onAbrir}
      title={detalle}
      className={`group relative flex h-14 w-full items-center border-b border-white/5 text-left transition ${
        activa ? 'bg-amber-500/[0.07]' : 'hover:bg-white/[0.03]'
      }`}
    >
      {/* Etiqueta: la bolsa con su nombre */}
      <span
        className={`sticky left-0 z-20 flex h-full shrink-0 items-center gap-2 border-r border-white/5 bg-slate-900 pr-2 ${
          activa ? 'shadow-[inset_3px_0_0] shadow-amber-400' : ''
        }`}
        style={{ width: ANCHO_ETIQUETA, paddingLeft: 10 + nivel * 14 }}
      >
        {nivel > 0 && <span className="text-[10px] text-slate-600">└</span>}
        <BolsaOro llenado={llenado} tamano={30} guardada={guardada} animada={false} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-white group-hover:text-amber-100">
            {a.titulo}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${estado.punto}`} />
            <span className="truncate">{a.responsable.nombreCompleto}</span>
            <span className="ml-auto shrink-0 font-semibold text-amber-300">{Math.round(llenado * 100)}%</span>
          </span>
        </span>
      </span>

      {/* Linea de tiempo */}
      <span className="relative h-full flex-1">
        {ancho > 0 && (
          <span
            className={`absolute top-1/2 flex h-6 -translate-y-1/2 items-center border ${color.borde} ${color.fondo} ${
              cortadaIzq ? 'rounded-l-none border-l-0' : 'rounded-l-md'
            } ${cortadaDer ? 'rounded-r-none border-r-0' : 'rounded-r-md'}`}
            style={{ left: `${izquierda}%`, width: `${ancho}%`, minWidth: 8 }}
          >
            {/* Espera antes del primer cronometro */}
            {espera > 0 && (
              <span
                className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,rgba(148,163,184,.22)_0_3px,transparent_3px_6px)]"
                style={{ width: `${espera * 100}%` }}
              />
            )}
            {/* El oro de la bolsa */}
            <span
              className="absolute inset-y-[5px] left-0 rounded-sm bg-gradient-to-r from-amber-500/80 to-amber-300/80 transition-[width] duration-500"
              style={{ width: `${llenado * 100}%` }}
            />
            {/* Barra abierta: se desvanece hacia hoy */}
            {!guardada && !cortadaDer && (
              <span className="absolute inset-y-0 right-0 w-4 bg-gradient-to-r from-transparent to-slate-900/60" />
            )}
          </span>
        )}

        {/* La bolsa al final de su barra */}
        {ancho > 0 && !cortadaDer && (
          <span
            className="absolute top-1/2 z-10 -translate-y-1/2 transition group-hover:scale-110"
            style={{ left: `calc(${izquierda + ancho}% - 12px)` }}
          >
            <BolsaOro llenado={llenado} tamano={26} guardada={guardada} animada={activa} />
          </span>
        )}

        {/* Fecha limite */}
        {limite !== null && limite >= inicio && limite < fin && (
          <span
            className={`absolute top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-slate-950 ${
              atrasada ? 'bg-rose-400' : 'bg-slate-300'
            }`}
            style={{ left: `${pct(limite)}%` }}
          />
        )}
      </span>
    </button>
  );
}
