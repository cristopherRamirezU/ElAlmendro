'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderKanban,
} from 'lucide-react';
import { DiaDetalle, MARGEN_PRESENCIA, SesionDetalle, TrabajadorDia } from '@/lib/calendario';
import { colorConAlfa, colorTextoSobre, useColorPrimario } from '@/lib/color';
import { duracion, ESTADOS, hora, iniciales } from '@/lib/formato';
import { useTemaFondo } from '@/lib/tema';
import { desfase, zonaActual } from '@/lib/zona';
import {
  PREFERENCIAS_CALENDARIO_DEFECTO,
  PreferenciasCalendario,
} from '@/lib/preferencias-calendario';
import Insignia from '@/components/ui/Insignia';
import { EsqueletoCalendario } from '@/components/ui/Esqueleto';

/** Estados de una sesión de trabajo, con su lectura y su color. */
const ESTADO_SESION: Record<string, { texto: string; clase: string }> = {
  ACTIVA: { texto: 'En curso', clase: 'text-[var(--tf-acento-azul)] bg-sky-500/12 border-sky-500/30' },
  PAUSADA: { texto: 'En pausa', clase: 'text-[var(--tf-acento-azul)] bg-sky-500/12 border-sky-500/30' },
  CERRADA: { texto: 'Cerrada', clase: 'text-[var(--tf-texto-tenue)] bg-[var(--tf-hover)] border-[var(--tf-borde)]' },
  AUTOCERRADA: {
    texto: 'Autocerrada',
    clase: 'text-[var(--tf-acento-ambar)] bg-amber-500/12 border-amber-500/30',
  },
};

function tieneActividad(w: TrabajadorDia): boolean {
  return w.sesiones.length > 0 || !!w.jornada;
}

/**
 * Detalle de un día con diseño TimeFlow: acordeón por persona mostrando
 * exclusivamente su total de horas trabajadas en el día y sus tarjetas de
 * actividad con bloques horarios desplegables.
 */
export default function PanelDia({
  dia,
  cargando,
  foco,
  onFoco,
  prefs = PREFERENCIAS_CALENDARIO_DEFECTO,
}: {
  dia: DiaDetalle | null;
  cargando: boolean;
  foco: string | null;
  onFoco: (id: string | null) => void;
  prefs?: PreferenciasCalendario;
}) {
  if (cargando && !dia) {
    return <EsqueletoCalendario tipo="detalle" />;
  }
  if (!dia) {
    return <p className="text-sm text-[var(--tf-texto-tenue)]">No hay información para este día.</p>;
  }

  return <Contenido dia={dia} foco={foco} onFoco={onFoco} prefs={prefs} />;
}

function Contenido({
  dia,
  foco,
  onFoco,
  prefs,
}: {
  dia: DiaDetalle;
  foco: string | null;
  onFoco: (id: string | null) => void;
  prefs: PreferenciasCalendario;
}) {
  const colorPrimario = useColorPrimario();
  const temaEsClaro = useTemaFondo() === 'claro-nube';
  const tonoSobreSuperficie =
    temaEsClaro && colorTextoSobre(colorPrimario) === '#0f172a' ? '#0f172a' : colorPrimario;

  const [alertasAbiertas, setAlertasAbiertas] = useState(false);
  const [trabajadoresAbiertos, setTrabajadoresAbiertos] = useState<Record<string, boolean>>({});
  const [sesionesExpandidas, setSesionesExpandidas] = useState<Record<string, boolean>>({});
  const [verSinRegistroLocal, setVerSinRegistroLocal] = useState(false);

  const visibles = useMemo(
    () => (foco ? dia.trabajadores.filter((w) => w.id === foco) : dia.trabajadores),
    [dia, foco],
  );

  const conActividad = useMemo(() => visibles.filter(tieneActividad), [visibles]);
  const sinActividad = useMemo(() => visibles.filter((w) => !tieneActividad(w)), [visibles]);

  const chipsDisponibles = useMemo(() => {
    if (prefs.mostrarSinRegistroEnDetalle || verSinRegistroLocal) return dia.trabajadores;
    return dia.trabajadores.filter((w) => tieneActividad(w) || w.id === foco);
  }, [dia.trabajadores, foco, prefs.mostrarSinRegistroEnDetalle, verSinRegistroLocal]);

  const alertas = useMemo(() => reunirAlertas(visibles), [visibles]);

  const aperturaPorDefecto = conActividad.length === 1 || !!foco;

  function estaAbierto(id: string): boolean {
    return trabajadoresAbiertos[id] ?? aperturaPorDefecto;
  }

  const todosAbiertos =
    conActividad.length > 0 && conActividad.every((w) => estaAbierto(w.id));

  function alternarTodos() {
    const siguiente = !todosAbiertos;
    const mapa: Record<string, boolean> = {};
    for (const w of conActividad) mapa[w.id] = siguiente;
    setTrabajadoresAbiertos(mapa);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro rápido de equipo */}
      {chipsDisponibles.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip activo={!foco} onClick={() => onFoco(null)} colorPrimario={colorPrimario} tonoSobreSuperficie={tonoSobreSuperficie}>
            Todo el equipo
          </Chip>
          {chipsDisponibles.map((w) => (
            <Chip
              key={w.id}
              activo={foco === w.id}
              onClick={() => onFoco(w.id)}
              colorPrimario={colorPrimario}
              tonoSobreSuperficie={tonoSobreSuperficie}
            >
              {w.nombre}
            </Chip>
          ))}
        </div>
      )}

      {/* Alertas del día en barra colapsable */}
      {alertas.length > 0 && (
        <div role="alert" className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <button
            type="button"
            onClick={() => setAlertasAbiertas((v) => !v)}
            aria-expanded={alertasAbiertas}
            className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--tf-acento-ambar)] transition hover:bg-amber-500/10"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle size={14} aria-hidden />
              <span>{alertas.length} punto(s) por revisar</span>
            </span>
            <ChevronDown
              size={14}
              aria-hidden
              className={`transition-transform duration-200 ${alertasAbiertas ? 'rotate-180' : ''}`}
            />
          </button>
          {alertasAbiertas && (
            <ul className="flex flex-col gap-1.5 border-t border-amber-500/20 px-3.5 py-3 text-[11px] text-[var(--tf-texto)]">
              {alertas.map((a, i) => (
                <li key={i} className="leading-relaxed">
                  · {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Acción rápida para expandir/colapsar cuando hay varias personas */}
      {conActividad.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={alternarTodos}
            style={{ color: tonoSobreSuperficie }}
            className="text-xs font-semibold transition hover:opacity-80"
          >
            {todosAbiertos ? 'Colapsar todo' : 'Expandir todo'}
          </button>
        </div>
      )}

      {/* Acordeón por persona con actividad */}
      {conActividad.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-2)] p-6 text-center text-xs text-[var(--tf-texto-suave)]">
          Sin actividad registrada para este filtro.
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          {conActividad.map((w) => {
            const abierto = estaAbierto(w.id);
            const avisosPersona = reunirAlertas([w]).length;
            const pctDia = Math.min(100, Math.round((w.segundosImputados / (8 * 3600)) * 100));
            const totalTexto =
              w.segundosImputados > 0
                ? `${duracion(w.segundosImputados)} trabajadas`
                : 'Sin horas trabajadas';

            return (
              <div
                key={w.id}
                className="tf-card-pro overflow-hidden rounded-2xl border border-[var(--tf-borde)]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setTrabajadoresAbiertos((prev) => ({ ...prev, [w.id]: !abierto }))
                  }
                  aria-expanded={abierto}
                  style={{
                    background: `linear-gradient(135deg, ${colorConAlfa(colorPrimario, 0.1)}, transparent 65%)`,
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--tf-hover)]"
                >
                  <span
                    style={{
                      backgroundColor: colorConAlfa(colorPrimario, 0.16),
                      color: tonoSobreSuperficie,
                      borderColor: colorConAlfa(colorPrimario, 0.35),
                    }}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border text-xs font-bold"
                  >
                    {iniciales(w.nombre)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="tf-display block truncate text-[15px] font-bold text-[var(--tf-texto)]">
                      {w.nombre}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--tf-texto-tenue)]">
                      <Clock size={12} aria-hidden style={{ color: tonoSobreSuperficie }} />
                      <span className="tabular-nums">{totalTexto}</span>
                    </span>
                    {w.segundosImputados > 0 && (
                      <span className="mt-2 block h-1 w-full max-w-[14rem] overflow-hidden rounded-full bg-[var(--tf-borde)]">
                        <span
                          className="block h-full rounded-full transition-all duration-300"
                          style={{ width: `${pctDia}%`, backgroundColor: colorPrimario }}
                        />
                      </span>
                    )}
                  </span>

                  {w.zonaHoraria !== zonaActual() && (
                    <span
                      className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-[var(--tf-acento-azul)]"
                      title={`Horas en la zona de ${w.nombre}: ${w.zonaHoraria}`}
                    >
                      {desfase(w.zonaHoraria)}
                    </span>
                  )}

                  {avisosPersona > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-[var(--tf-acento-ambar)]"
                      title={`${avisosPersona} punto(s) por revisar`}
                    >
                      <AlertTriangle size={10} aria-hidden />
                      {avisosPersona}
                    </span>
                  )}

                  <ChevronDown
                    size={16}
                    aria-hidden
                    className={`shrink-0 text-[var(--tf-texto-tenue)] transition-transform duration-200 ${
                      abierto ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {abierto && (
                  <div className="flex flex-col gap-2.5 border-t border-[var(--tf-borde)] bg-[var(--tf-fondo)]/55 p-3.5">
                    {w.jornada && !w.jornada.terminoEn && (
                      <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-[var(--tf-acento-ambar)]">
                        Jornada abierta desde las {hora(w.jornada.inicioEn, w.zonaHoraria)} sin registro de salida.
                      </p>
                    )}

                    {w.sesiones.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[var(--tf-borde)] p-3.5 text-center text-xs text-[var(--tf-texto-suave)]">
                        No hay actividades cronometradas en este día.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {w.sesiones.map((s) => (
                          <Tarjeta
                            key={s.id}
                            sesion={s}
                            zona={w.zonaHoraria}
                            colorPrimario={colorPrimario}
                            tonoSobreSuperficie={tonoSobreSuperficie}
                            mostrarProyecto={prefs.mostrarProyectoEnSesion}
                            abierta={!!sesionesExpandidas[s.id]}
                            onAlternar={() =>
                              setSesionesExpandidas((e) => ({ ...e, [s.id]: !e[s.id] }))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Personas sin registro: ocultas por defecto salvo preferencia o clic explícito */}
      {sinActividad.length > 0 && (
        <div className="border-t border-[var(--tf-borde)] pt-3">
          {!prefs.mostrarSinRegistroEnDetalle && (
            <button
              type="button"
              onClick={() => setVerSinRegistroLocal((v) => !v)}
              aria-expanded={verSinRegistroLocal}
              className="w-full rounded-xl border border-[var(--tf-borde)] px-3 py-2 text-center text-[11px] font-medium text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
            >
              {verSinRegistroLocal
                ? `Ocultar ${sinActividad.length} persona(s) sin registro`
                : `Mostrar ${sinActividad.length} persona(s) sin registro`}
            </button>
          )}

          {(prefs.mostrarSinRegistroEnDetalle || verSinRegistroLocal) && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {sinActividad.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-xl border border-dashed border-[var(--tf-borde)] px-3 py-2 text-xs text-[var(--tf-texto-tenue)]"
                >
                  <span>{w.nombre}</span>
                  <span className="text-[11px] text-[var(--tf-texto-suave)]">Sin registro este día</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Tarjeta({
  sesion,
  zona,
  colorPrimario,
  tonoSobreSuperficie,
  mostrarProyecto,
  abierta,
  onAlternar,
}: {
  sesion: SesionDetalle;
  /** Zona del trabajador: sus horas se muestran en ella. */
  zona: string;
  colorPrimario: string;
  tonoSobreSuperficie: string;
  mostrarProyecto: boolean;
  abierta: boolean;
  onAlternar: () => void;
}) {
  const estado = ESTADO_SESION[sesion.estado] ?? {
    texto: sesion.estado,
    clase: 'text-[var(--tf-texto-tenue)] bg-[var(--tf-hover)] border-[var(--tf-borde)]',
  };
  const cerradaCompletada = sesion.estado === 'CERRADA' && sesion.desenlace === 'COMPLETADA';
  const esAlerta = sesion.estado === 'AUTOCERRADA' || sesion.desenlace === 'INCONCLUSA';
  const enCurso = sesion.estado === 'ACTIVA' || sesion.estado === 'PAUSADA';

  const colorAcento = cerradaCompletada
    ? '#10b981'
    : esAlerta
    ? '#f59e0b'
    : enCurso
    ? colorPrimario
    : 'var(--tf-borde-fuerte)';

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] shadow-sm transition hover:border-[var(--tf-borde-fuerte)]">
      <span
        aria-hidden
        className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-full"
        style={{ backgroundColor: colorAcento }}
      />

      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className="flex w-full items-start justify-between gap-3 py-3 pl-4 pr-3.5 text-left transition hover:bg-[var(--tf-hover)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {cerradaCompletada && (
              <CheckCircle2 size={14} className="shrink-0 text-[var(--tf-acento-verde)]" aria-hidden />
            )}
            <p className="tf-display truncate text-sm font-semibold text-[var(--tf-texto)]">
              {sesion.actividad}
            </p>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[var(--tf-texto-tenue)]">
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Clock size={11} aria-hidden className="opacity-70" />
              {hora(sesion.inicioEn, zona)}
              {sesion.terminoEn ? ` – ${hora(sesion.terminoEn, zona)}` : ' – en curso'}
            </span>
            {mostrarProyecto && (
              <span className="inline-flex items-center gap-1 truncate rounded-md bg-[var(--tf-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--tf-texto-tenue)]">
                <FolderKanban size={10} aria-hidden style={{ color: tonoSobreSuperficie }} />
                {sesion.proyecto}
              </span>
            )}
          </div>

          {!cerradaCompletada && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {sesion.estado !== 'CERRADA' && (
                <Insignia clase={estado.clase}>{estado.texto}</Insignia>
              )}
              {sesion.desenlace === 'INCONCLUSA' && (
                <Insignia clase={ESTADOS.INCONCLUSA.clase}>Inconclusa</Insignia>
              )}
              {sesion.desenlace === 'COMPLETADA' && (
                <Insignia clase={ESTADOS.COMPLETADA.clase}>Completada</Insignia>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            style={{
              backgroundColor: colorConAlfa(colorPrimario, 0.12),
              color: tonoSobreSuperficie,
            }}
            className="rounded-lg px-2 py-0.5 font-mono text-xs font-bold tabular-nums"
          >
            {duracion(sesion.segundos)}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--tf-texto-suave)]">
            <span>{abierta ? 'Ocultar' : 'Detalles'}</span>
            <ChevronDown
              size={11}
              aria-hidden
              className={`transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`}
            />
          </span>
        </div>
      </button>

      {abierta && (
        <div className="flex flex-col gap-2.5 border-t border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] px-4 py-3 text-xs text-[var(--tf-texto-tenue)]">
          {!mostrarProyecto && (
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--tf-texto-tenue)]">
              <FolderKanban size={12} aria-hidden style={{ color: tonoSobreSuperficie }} />
              <span>Proyecto:</span>
              <span className="font-semibold text-[var(--tf-texto)]">{sesion.proyecto}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <Insignia clase={estado.clase}>{estado.texto}</Insignia>
            {sesion.desenlace === 'COMPLETADA' && (
              <Insignia clase={ESTADOS.COMPLETADA.clase}>Completada</Insignia>
            )}
            {sesion.desenlace === 'INCONCLUSA' && (
              <Insignia clase={ESTADOS.INCONCLUSA.clase}>Inconclusa</Insignia>
            )}
          </div>

          {sesion.tramos.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-[var(--tf-texto)]">
                Bloques horarios ({sesion.tramos.length})
              </p>
              <ul className="ml-1.5 space-y-1.5 border-l border-[var(--tf-borde-fuerte)] pl-3 font-mono text-[11px] tabular-nums text-[var(--tf-texto-tenue)]">
                {sesion.tramos.map((t, i) => (
                  <li key={i} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[16px] top-1.5 h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: colorAcento }}
                    />
                    {hora(t.inicioEn, zona)}
                    {t.terminoEn ? ` – ${hora(t.terminoEn, zona)}` : ' – en curso'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sesion.notaCierre && (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-[var(--tf-acento-ambar)]">
              {sesion.notaCierre}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({
  activo,
  onClick,
  colorPrimario,
  tonoSobreSuperficie,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  colorPrimario: string;
  tonoSobreSuperficie: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={
        activo
          ? {
              borderColor: colorConAlfa(colorPrimario, 0.45),
              backgroundColor: colorConAlfa(colorPrimario, 0.14),
              color: tonoSobreSuperficie,
            }
          : undefined
      }
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
        activo
          ? 'font-semibold'
          : 'border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
      }`}
    >
      {children}
    </button>
  );
}

/** Las anomalías que el calendario señala, explicadas en texto. */
function reunirAlertas(trabajadores: TrabajadorDia[]): string[] {
  const avisos: string[] = [];

  for (const w of trabajadores) {
    if (w.jornada && !w.jornada.terminoEn) {
      avisos.push(`${w.nombre}: jornada sin cerrar.`);
    }

    const autocerradas = w.sesiones.filter((s) => s.estado === 'AUTOCERRADA');
    if (autocerradas.length > 0) {
      avisos.push(
        `${w.nombre}: ${autocerradas.length} sesión(es) autocerradas por superar el umbral.`,
      );
    }

    const inconclusas = w.sesiones.filter((s) => s.desenlace === 'INCONCLUSA');
    if (inconclusas.length > 0) {
      avisos.push(`${w.nombre}: ${inconclusas.length} sesión(es) declaradas inconclusas.`);
    }

    const sinImputar = w.segundosPresencia - w.segundosImputados;
    if (w.segundosPresencia > 0 && sinImputar > MARGEN_PRESENCIA) {
      avisos.push(
        `${w.nombre}: ${duracion(sinImputar)} de jornada sin imputar a ninguna actividad.`,
      );
    }
    if (w.segundosImputados > 12 * 3600) {
      avisos.push(
        `${w.nombre}: ${duracion(w.segundosImputados)} imputadas en un día (supera el umbral de 12 h).`,
      );
    }
  }

  return avisos;
}
