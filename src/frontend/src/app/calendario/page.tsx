'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DateTime } from 'luxon';
import Marco from '@/components/Marco';
import Drawer from '@/components/ui/Drawer';
import RejillaMes from '@/components/calendario/RejillaMes';
import MatrizTrabajadores from '@/components/calendario/MatrizTrabajadores';
import SemanaHoras from '@/components/calendario/SemanaHoras';
import PanelDia from '@/components/calendario/PanelDia';
import { api, ErrorApi } from '@/lib/api';
import { esAdministrador, useSesion } from '@/lib/sesion';
import { duracion, fechaLarga } from '@/lib/formato';
import {
  Detalle,
  DiaDetalle,
  hoyLocal,
  rangoDelMes,
  rangoDeSemana,
  Resumen,
  TrabajadorRef,
  Vista,
  ZONA,
} from '@/lib/calendario';

const VISTAS: { valor: Vista; texto: string }[] = [
  { valor: 'rejilla', texto: 'Mes' },
  { valor: 'matriz', texto: 'Matriz' },
  { valor: 'semana', texto: 'Semana' },
];

export default function Pagina() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400">
          Cargando…
        </main>
      }
    >
      <Calendario />
    </Suspense>
  );
}

/**
 * US-07 — calendario del administrador.
 *
 * El estado vive en la URL —ancla, vista, dia y trabajador— y no en el
 * componente: asi un dia concreto se puede recargar, marcar o enviar a otra
 * persona, que es la forma natural de senalar "mira este dia".
 */
function Calendario() {
  const router = useRouter();
  const parametros = useSearchParams();

  const pedida = parametros.get('vista');
  const vista: Vista = VISTAS.some((v) => v.valor === pedida) ? (pedida as Vista) : 'rejilla';
  const diaAbierto = parametros.get('dia');
  const trabajador = parametros.get('trabajador');

  const ancla = useMemo(() => {
    const bruto = parametros.get('ancla');
    const leida = bruto ? DateTime.fromISO(bruto, { zone: ZONA }) : null;
    return leida?.isValid ? leida : DateTime.now().setZone(ZONA);
  }, [parametros]);

  const mes = useMemo(() => rangoDelMes(ancla), [ancla]);
  const semana = useMemo(() => rangoDeSemana(ancla.toFormat('yyyy-MM-dd')), [ancla]);

  const [equipo, setEquipo] = useState<TrabajadorRef[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [semanal, setSemanal] = useState<Detalle | null>(null);
  const [detalle, setDetalle] = useState<DiaDetalle | null>(null);
  const [cargandoDia, setCargandoDia] = useState(false);
  const [foco, setFoco] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Reescribe la URL conservando lo que no cambia. */
  const navegar = useCallback(
    (cambios: Record<string, string | null>) => {
      const siguientes = new URLSearchParams(parametros.toString());
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null) siguientes.delete(clave);
        else siguientes.set(clave, valor);
      }
      router.replace(`/calendario?${siguientes.toString()}`, { scroll: false });
    },
    [parametros, router],
  );

  const filtro = trabajador ? `&trabajadorId=${trabajador}` : '';

  // El selector solo tiene sentido con la nomina completa, asi que se pide una
  // vez y sin el filtro aplicado.
  useEffect(() => {
    api
      .get<TrabajadorRef[]>('/usuarios/trabajadores')
      .then(setEquipo)
      .catch(() => setEquipo([]));
  }, []);

  useEffect(() => {
    let vigente = true;
    api
      .get<Resumen>(`/calendario/resumen?desde=${mes.desde}&hasta=${mes.hasta}${filtro}`)
      .then((r) => {
        if (!vigente) return;
        setResumen(r);
        setError(null);
      })
      .catch((e) => {
        if (vigente) setError(mensaje(e));
      });
    return () => {
      vigente = false;
    };
  }, [mes.desde, mes.hasta, filtro]);

  useEffect(() => {
    if (vista !== 'semana') return;
    let vigente = true;
    api
      .get<Detalle>(`/calendario/detalle?desde=${semana.desde}&hasta=${semana.hasta}${filtro}`)
      .then((d) => {
        if (!vigente) return;
        setSemanal(d);
        setError(null);
      })
      .catch((e) => {
        if (vigente) setError(mensaje(e));
      });
    return () => {
      vigente = false;
    };
  }, [vista, semana.desde, semana.hasta, filtro]);

  useEffect(() => {
    if (!diaAbierto) {
      setDetalle(null);
      return;
    }
    let vigente = true;
    setCargandoDia(true);
    api
      .get<Detalle>(`/calendario/detalle?desde=${diaAbierto}&hasta=${diaAbierto}${filtro}`)
      .then((d) => {
        if (vigente) setDetalle(d.dias[0] ?? null);
      })
      .catch((e) => {
        if (vigente) setError(mensaje(e));
      })
      .finally(() => {
        if (vigente) setCargandoDia(false);
      });
    return () => {
      vigente = false;
    };
  }, [diaAbierto, filtro]);

  /** En mes y matriz el paso es un mes; en la vista semanal, una semana. */
  function mover(signo: 1 | -1) {
    const movida =
      vista === 'semana' ? ancla.plus({ weeks: signo }) : ancla.plus({ months: signo });
    navegar({ ancla: movida.toFormat('yyyy-MM-dd') });
  }

  const totalMes = resumen?.dias.reduce((t, d) => t + d.segundosImputados, 0) ?? 0;
  const diasConTrabajo = resumen?.dias.filter((d) => d.conRegistro > 0).length ?? 0;
  const alertasMes = resumen?.dias.reduce((t, d) => t + d.alertas.total, 0) ?? 0;

  return (
    <Marco
      activo="/calendario"
      titulo="Calendario"
      subtitulo="Actividad registrada por dia"
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <SelectorTrabajador
            equipo={equipo}
            valor={trabajador}
            onCambio={(id) => navegar({ trabajador: id })}
          />

          <div className="flex overflow-hidden rounded-xl border border-[var(--tf-borde)]">
            {VISTAS.map((v) => (
              <button
                key={v.valor}
                onClick={() => navegar({ vista: v.valor })}
                aria-pressed={vista === v.valor}
                className={`px-3 py-1.5 text-sm transition ${
                  vista === v.valor
                    ? 'bg-sky-500/15 font-semibold text-sky-300'
                    : 'text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)]'
                }`}
              >
                {v.texto}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => mover(-1)}
              aria-label={vista === 'semana' ? 'Semana anterior' : 'Mes anterior'}
              className="rounded-lg border border-[var(--tf-borde)] px-2.5 py-1 text-sm text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)]"
            >
              ‹
            </button>
            <span className="min-w-44 text-center text-sm font-semibold text-[var(--tf-texto)] first-letter:uppercase">
              {vista === 'semana' ? rotulo(semana) : ancla.toFormat('LLLL yyyy', { locale: 'es' })}
            </span>
            <button
              onClick={() => mover(1)}
              aria-label={vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}
              className="rounded-lg border border-[var(--tf-borde)] px-2.5 py-1 text-sm text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)]"
            >
              ›
            </button>
            <button
              onClick={() => navegar({ ancla: hoyLocal() })}
              className="rounded-lg border border-[var(--tf-borde)] px-2.5 py-1 text-sm text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)]"
            >
              Hoy
            </button>
          </div>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 backdrop-blur">
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-400">
          <span>
            Total del mes: <strong className="font-mono text-white">{duracion(totalMes)}</strong>
          </span>
          <span>
            Dias con trabajo: <strong className="text-white">{diasConTrabajo}</strong>
          </span>
          {alertasMes > 0 && (
            <span className="text-amber-400">
              ▲ <strong>{alertasMes}</strong> punto(s) por revisar
            </span>
          )}
        </div>

        {vista === 'rejilla' && (
          <RejillaMes
            mes={ancla}
            dias={resumen?.dias ?? []}
            seleccionado={diaAbierto}
            onDia={(fecha) => navegar({ dia: fecha })}
          />
        )}

        {vista === 'matriz' && (
          <MatrizTrabajadores
            mes={ancla}
            trabajadores={resumen?.trabajadores ?? []}
            celdas={resumen?.celdas ?? []}
            seleccionado={diaAbierto}
            onCelda={(fecha, id) => {
              setFoco(id);
              navegar({ dia: fecha });
            }}
          />
        )}

        {vista === 'semana' &&
          (semanal ? (
            <SemanaHoras
              detalle={semanal}
              seleccionado={diaAbierto}
              onDia={(fecha) => navegar({ dia: fecha })}
            />
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">Cargando la semana…</p>
          ))}
      </section>

      <Drawer
        abierto={!!diaAbierto}
        titulo={diaAbierto ? fechaLarga(diaAbierto) : ''}
        subtitulo={
          detalle
            ? `${detalle.resumen.sesiones} sesion(es) · ${detalle.resumen.conRegistro} trabajador(es) con registro`
            : undefined
        }
        onCerrar={() => {
          setFoco(null);
          navegar({ dia: null });
        }}
      >
        <PanelDia dia={detalle} cargando={cargandoDia} foco={foco} onFoco={setFoco} />
      </Drawer>
    </Marco>
  );
}

/**
 * Selector de trabajador, solo para el administrador.
 *
 * Va en un componente aparte porque `useSesion` necesita estar por debajo del
 * proveedor que instala `Marco`, y quien renderiza `Marco` esta por encima.
 * Ocultarlo no protege nada: el alcance real lo impone la API.
 */
function SelectorTrabajador({
  equipo,
  valor,
  onCambio,
}: {
  equipo: TrabajadorRef[];
  valor: string | null;
  onCambio: (id: string | null) => void;
}) {
  const usuario = useSesion();
  if (!esAdministrador(usuario) || equipo.length < 2) return null;

  return (
    <select
      value={valor ?? ''}
      onChange={(e) => onCambio(e.target.value || null)}
      aria-label="Filtrar por trabajador"
      className="rounded-xl border border-white/15 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-sky-400"
    >
      <option value="">Todo el equipo</option>
      {equipo.map((w) => (
        <option key={w.id} value={w.id}>
          {w.nombre}
        </option>
      ))}
    </select>
  );
}

function rotulo({ desde, hasta }: { desde: string; hasta: string }): string {
  const a = DateTime.fromISO(desde, { zone: ZONA });
  const b = DateTime.fromISO(hasta, { zone: ZONA });
  return a.month === b.month
    ? `${a.day} – ${b.day} ${b.toFormat('LLL yyyy', { locale: 'es' })}`
    : `${a.toFormat('d LLL', { locale: 'es' })} – ${b.toFormat('d LLL yyyy', { locale: 'es' })}`;
}

function mensaje(e: unknown): string {
  // El 401 lo resuelve Marco devolviendo al inicio de sesion; aqui no aporta.
  if (e instanceof ErrorApi && e.estado === 401) return '';
  return e instanceof Error ? e.message : 'No se pudo cargar el calendario.';
}
