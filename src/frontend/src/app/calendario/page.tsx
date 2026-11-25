'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DateTime } from 'luxon';
import { Users } from 'lucide-react';
import Marco from '@/components/Marco';
import Drawer from '@/components/ui/Drawer';
import Selector from '@/components/ui/Selector';
import { EsqueletoCalendario, EsqueletoPagina } from '@/components/ui/Esqueleto';
import RejillaMes from '@/components/calendario/RejillaMes';
import MatrizTrabajadores from '@/components/calendario/MatrizTrabajadores';
import SemanaHoras from '@/components/calendario/SemanaHoras';
import PanelDia from '@/components/calendario/PanelDia';
import PersonalizarVista from '@/components/calendario/PersonalizarVista';
import { api, ErrorApi } from '@/lib/api';
import { esAdministrador, useSesion } from '@/lib/sesion';
import { colorAvatarDe, duracion, fechaLarga, iniciales } from '@/lib/formato';
import { nombreZona } from '@/lib/zona';
import {
  guardarPreferenciasCalendario,
  leerPreferenciasCalendario,
  PREFERENCIAS_CALENDARIO_DEFECTO,
  PreferenciasCalendario,
} from '@/lib/preferencias-calendario';
import {
  Detalle,
  DiaDetalle,
  hoyLocal,
  rangoDelMes,
  rangoDeSemana,
  Resumen,
  TrabajadorRef,
  Vista,
  zonaActual,
} from '@/lib/calendario';

const VISTAS: { valor: Vista; texto: string }[] = [
  { valor: 'rejilla', texto: 'Mes' },
  { valor: 'matriz', texto: 'Matriz' },
  { valor: 'semana', texto: 'Semana' },
];

export default function Pagina() {
  return (
    <Suspense fallback={<EsqueletoPagina />}>
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
    const leida = bruto ? DateTime.fromISO(bruto, { zone: zonaActual() }) : null;
    return leida?.isValid ? leida : DateTime.now().setZone(zonaActual());
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
  const [recargaToken, setRecargaToken] = useState(0);
  const [prefs, setPrefs] = useState<PreferenciasCalendario>(PREFERENCIAS_CALENDARIO_DEFECTO);
  const [soloAlertas, setSoloAlertas] = useState(false);

  useEffect(() => {
    setPrefs(leerPreferenciasCalendario());
  }, []);

  const actualizarPrefs = useCallback((parcial: Partial<PreferenciasCalendario>) => {
    setPrefs((actual) => {
      const siguiente = { ...actual, ...parcial };
      guardarPreferenciasCalendario(siguiente);
      return siguiente;
    });
  }, []);

  const restablecerPrefs = useCallback(() => {
    setPrefs(PREFERENCIAS_CALENDARIO_DEFECTO);
    guardarPreferenciasCalendario(PREFERENCIAS_CALENDARIO_DEFECTO);
  }, []);

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
  }, [mes.desde, mes.hasta, filtro, recargaToken]);

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
  }, [vista, semana.desde, semana.hasta, filtro, recargaToken]);

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
      subtitulo="Actividad registrada por día"
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <SelectorTrabajador
            equipo={equipo}
            valor={trabajador}
            onCambio={(id) => navegar({ trabajador: id })}
          />

          <PersonalizarVista
            prefs={prefs}
            onCambio={actualizarPrefs}
            onRestablecer={restablecerPrefs}
          />

          <div className="flex overflow-hidden rounded-xl border border-[var(--tf-borde)]">
            {VISTAS.map((v) => (
              <button
                key={v.valor}
                onClick={() => navegar({ vista: v.valor })}
                aria-pressed={vista === v.valor}
                className={`px-3 py-1.5 text-sm transition ${
                  vista === v.valor
                    ? 'bg-sky-500/15 font-semibold text-[var(--tf-acento-azul)]'
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
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-[var(--tf-acento-rojo)]"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setRecargaToken((t) => t + 1);
            }}
            className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-xs font-semibold hover:bg-rose-500/25"
          >
            Reintentar
          </button>
        </div>
      )}

      <section className="tf-card-pro tf-enter rounded-2xl p-5">
        {prefs.mostrarResumenMes && (
          <div className="mb-4 flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)] px-3 py-1.5 text-[var(--tf-texto-tenue)]">
              <span>Total del mes</span>
              <strong className="tf-display font-mono text-sm font-bold text-[var(--tf-texto)]">
                {duracion(totalMes)}
              </strong>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)] px-3 py-1.5 text-[var(--tf-texto-tenue)]">
              <span>Días con trabajo</span>
              <strong className="tf-display font-mono text-sm font-bold text-[var(--tf-texto)]">
                {diasConTrabajo}
              </strong>
            </div>
            {alertasMes > 0 && (
              <button
                type="button"
                aria-pressed={soloAlertas}
                onClick={() => setSoloAlertas((v) => !v)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 font-medium transition ${
                  soloAlertas
                    ? 'border-amber-500/50 bg-amber-500/20 text-[var(--tf-acento-ambar)]'
                    : 'border-[var(--tf-borde)] bg-[var(--tf-hover)] text-[var(--tf-acento-ambar)] hover:border-amber-500/40'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span>
                  <strong>{alertasMes}</strong> por revisar
                </span>
                <span className="text-[10px] opacity-75">
                  {soloAlertas ? '(Filtro activo)' : '(Filtrar)'}
                </span>
              </button>
            )}
          </div>
        )}

        {vista === 'rejilla' &&
          (!resumen && !error ? (
            <EsqueletoCalendario tipo="mes" />
          ) : (
            <RejillaMes
              mes={ancla}
              dias={resumen?.dias ?? []}
              seleccionado={diaAbierto}
              onDia={(fecha) => navegar({ dia: fecha })}
              prefs={prefs}
              soloAlertas={soloAlertas}
            />
          ))}

        {vista === 'matriz' &&
          (!resumen && !error ? (
            <EsqueletoCalendario tipo="mes" />
          ) : (
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
          ))}

        {vista === 'semana' &&
          (semanal ? (
            <SemanaHoras
              detalle={semanal}
              seleccionado={diaAbierto}
              onDia={(fecha) => navegar({ dia: fecha })}
            />
          ) : (
            <EsqueletoCalendario tipo="semana" />
          ))}
      </section>

      <Drawer
        abierto={!!diaAbierto}
        titulo={diaAbierto ? fechaLarga(diaAbierto) : ''}
        onCerrar={() => {
          setFoco(null);
          navegar({ dia: null });
        }}
      >
        <PanelDia dia={detalle} cargando={cargandoDia} foco={foco} onFoco={setFoco} prefs={prefs} />
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
    <Selector
      id="filtro-trabajador-calendario"
      name="trabajadorId"
      ariaLabel="Filtrar por trabajador"
      forma="pildora"
      buscable={equipo.length > 6}
      placeholderBusqueda="Buscar persona…"
      minAnchoMenu={210}
      valor={valor ?? ''}
      onChange={(v) => onCambio(v || null)}
      opciones={[
        {
          valor: '',
          etiqueta: 'Todo el equipo',
          icono: <Users size={13} aria-hidden className="text-[var(--tf-texto-tenue)]" />,
        },
        ...equipo.map((w) => ({
          valor: w.id,
          etiqueta: w.nombre,
          subtitulo: w.zonaHoraria ? nombreZona(w.zonaHoraria) : undefined,
          inicialesAvatar: iniciales(w.nombre),
          colorAvatar: colorAvatarDe(w.id),
        })),
      ]}
    />
  );
}

function rotulo({ desde, hasta }: { desde: string; hasta: string }): string {
  const a = DateTime.fromISO(desde, { zone: zonaActual() });
  const b = DateTime.fromISO(hasta, { zone: zonaActual() });
  return a.month === b.month
    ? `${a.day} – ${b.day} ${b.toFormat('LLL yyyy', { locale: 'es' })}`
    : `${a.toFormat('d LLL', { locale: 'es' })} – ${b.toFormat('d LLL yyyy', { locale: 'es' })}`;
}

function mensaje(e: unknown): string {
  // El 401 lo resuelve Marco devolviendo al inicio de sesion; aqui no aporta.
  if (e instanceof ErrorApi && e.estado === 401) return '';
  return e instanceof Error ? e.message : 'No se pudo cargar el calendario.';
}
