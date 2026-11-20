'use client';

import { useMemo, useState } from 'react';
import {
  DiaDetalle,
  MARGEN_PRESENCIA,
  SesionDetalle,
  TrabajadorDia,
  ventanaHoraria,
} from '@/lib/calendario';
import { duracion, hora } from '@/lib/formato';
import { desfase, zonaActual } from '@/lib/zona';
import Indicador from '@/components/ui/Indicador';
import Insignia from '@/components/ui/Insignia';
import LineaTiempo, { EjeHoras } from './LineaTiempo';

/** Estados de una sesion de trabajo, con su lectura y su color. */
const ESTADO_SESION: Record<string, { texto: string; clase: string }> = {
  ACTIVA: { texto: 'En curso', clase: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  PAUSADA: { texto: 'En pausa', clase: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  CERRADA: { texto: 'Cerrada', clase: 'text-slate-400 bg-white/5 border-white/10' },
  AUTOCERRADA: {
    texto: 'Autocerrada',
    clase: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  },
};

/**
 * Detalle de un dia.
 *
 * Muestra a la vez las horas imputadas y las de presencia. El documento de
 * arquitectura describe esa diferencia como algo que el administrador deberia
 * poder observar —tiempo disponible no imputado a ninguna actividad— y hasta
 * ahora no aparecia en ninguna pantalla.
 */
export default function PanelDia({
  dia,
  cargando,
  foco,
  onFoco,
}: {
  dia: DiaDetalle | null;
  cargando: boolean;
  foco: string | null;
  onFoco: (id: string | null) => void;
}) {
  if (cargando && !dia) {
    return <p className="text-sm text-slate-400">Cargando el detalle…</p>;
  }
  if (!dia) {
    return <p className="text-sm text-slate-400">No hay informacion para este dia.</p>;
  }

  return <Contenido dia={dia} foco={foco} onFoco={onFoco} />;
}

function Contenido({
  dia,
  foco,
  onFoco,
}: {
  dia: DiaDetalle;
  foco: string | null;
  onFoco: (id: string | null) => void;
}) {
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  const visibles = useMemo(
    () => (foco ? dia.trabajadores.filter((w) => w.id === foco) : dia.trabajadores),
    [dia, foco],
  );

  const ventana = useMemo(() => ventanaHoraria([dia]), [dia]);
  const alertas = useMemo(() => reunirAlertas(visibles), [visibles]);

  const imputadas = visibles.reduce((t, w) => t + w.segundosImputados, 0);
  const presencia = visibles.reduce((t, w) => t + w.segundosPresencia, 0);
  const sesiones = visibles.reduce((t, w) => t + w.sesiones.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2">
        <Indicador titulo="Imputadas" valor={duracion(imputadas)} detalle="cronometradas" />
        <Indicador
          titulo="Presencia"
          valor={presencia > 0 ? duracion(presencia) : '—'}
          detalle={
            presencia > imputadas
              ? `${duracion(presencia - imputadas)} sin imputar`
              : 'jornada registrada'
          }
        />
        <Indicador titulo="Sesiones" valor={String(sesiones)} />
        <Indicador
          titulo="Trabajadores"
          valor={`${visibles.filter((w) => w.sesiones.length > 0 || w.jornada).length}/${
            visibles.length
          }`}
          detalle="con registro"
        />
      </div>

      {/* El conmutador de equipo o persona: filtra todo lo que hay debajo. */}
      {dia.trabajadores.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip activo={!foco} onClick={() => onFoco(null)}>
            Todo el equipo
          </Chip>
          {dia.trabajadores.map((w) => (
            <Chip key={w.id} activo={foco === w.id} onClick={() => onFoco(w.id)}>
              {w.nombre}
            </Chip>
          ))}
        </div>
      )}

      {alertas.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="mb-1 text-xs font-semibold text-amber-300">
            ▲ {alertas.length} punto(s) por revisar
          </p>
          <ul className="flex flex-col gap-0.5 text-[11px] text-amber-200/80">
            {alertas.map((a, i) => (
              <li key={i}>· {a}</li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Linea de tiempo
        </h3>
        <div className="pl-8">
          <EjeHoras ventana={ventana} />
        </div>
        <LineaTiempo fecha={dia.fecha} trabajadores={visibles} ventana={ventana} />
      </section>

      <section className="flex flex-col gap-4">
        {visibles.map((w) => (
          <div key={w.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-sm font-bold text-white">{w.nombre}</h3>
              <span className="font-mono text-[11px] text-slate-500">
                {duracion(w.segundosImputados)}
                {w.jornada && ` · jornada ${duracion(w.segundosPresencia)}`}
              </span>
              {/* Si trabaja en otra zona, se avisa: sus horas van en la suya. */}
              {w.zonaHoraria !== zonaActual() && (
                <span
                  className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300"
                  title={`Horas en la zona de ${w.nombre}: ${w.zonaHoraria}`}
                >
                  Hora local {desfase(w.zonaHoraria)}
                </span>
              )}
            </div>

            {w.jornada && !w.jornada.terminoEn && (
              <p className="mb-2 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
                Jornada abierta desde las {hora(w.jornada.inicioEn, w.zonaHoraria)}: nunca se marco la salida.
              </p>
            )}

            {w.sesiones.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-xs text-slate-500">
                {w.jornada ? 'Jornada sin sesiones cronometradas.' : 'Sin registro este dia.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {w.sesiones.map((s) => (
                  <Tarjeta
                    key={s.id}
                    sesion={s}
                    zona={w.zonaHoraria}
                    abierta={!!expandidas[s.id]}
                    onAlternar={() =>
                      setExpandidas((e) => ({ ...e, [s.id]: !e[s.id] }))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function Tarjeta({
  sesion,
  zona,
  abierta,
  onAlternar,
}: {
  sesion: SesionDetalle;
  /** Zona del trabajador: sus horas se muestran en ella. */
  zona: string;
  abierta: boolean;
  onAlternar: () => void;
}) {
  const estado = ESTADO_SESION[sesion.estado] ?? {
    texto: sesion.estado,
    clase: 'text-slate-400 bg-white/5 border-white/10',
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-white">{sesion.actividad}</p>
        <span className="shrink-0 font-mono text-xs text-slate-400">
          {duracion(sesion.segundos)}
        </span>
      </div>

      <p className="text-[11px] text-slate-500">{sesion.proyecto}</p>

      <p className="mt-1 font-mono text-xs text-slate-400">
        {hora(sesion.inicioEn, zona)}
        {sesion.terminoEn ? ` – ${hora(sesion.terminoEn, zona)}` : ' – en curso'}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Insignia clase={estado.clase}>{estado.texto}</Insignia>
        {sesion.desenlace === 'COMPLETADA' && (
          <Insignia clase="text-emerald-300 bg-emerald-500/10 border-emerald-500/30">Completada</Insignia>
        )}
        {sesion.desenlace === 'INCONCLUSA' && (
          <Insignia clase="text-orange-300 bg-orange-500/10 border-orange-500/30">Inconclusa</Insignia>
        )}
        {sesion.tramos.length > 1 && (
          <button
            onClick={onAlternar}
            aria-expanded={abierta}
            className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400 transition hover:bg-white/5"
          >
            {sesion.tramos.length} tramos {abierta ? '▴' : '▾'}
          </button>
        )}
      </div>

      {abierta && (
        <ul className="mt-2 flex flex-col gap-0.5 border-t border-white/10 pt-2 font-mono text-[11px] text-slate-400">
          {sesion.tramos.map((t, i) => (
            <li key={i}>
              {hora(t.inicioEn, zona)}
              {t.terminoEn ? ` – ${hora(t.terminoEn, zona)}` : ' – en curso'}
            </li>
          ))}
        </ul>
      )}

      {sesion.notaCierre && (
        <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
          {sesion.notaCierre}
        </p>
      )}
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
        activo
          ? 'border-sky-400/40 bg-sky-500/15 text-sky-300'
          : 'border-white/15 text-slate-400 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}

/** Las cuatro anomalias que el calendario senala, explicadas en texto. */
function reunirAlertas(trabajadores: TrabajadorDia[]): string[] {
  const avisos: string[] = [];

  for (const w of trabajadores) {
    if (w.jornada && !w.jornada.terminoEn) {
      avisos.push(`${w.nombre}: jornada sin cerrar.`);
    }

    const autocerradas = w.sesiones.filter((s) => s.estado === 'AUTOCERRADA');
    if (autocerradas.length > 0) {
      avisos.push(
        `${w.nombre}: ${autocerradas.length} sesion(es) autocerradas por superar el umbral.`,
      );
    }

    const inconclusas = w.sesiones.filter((s) => s.desenlace === 'INCONCLUSA');
    if (inconclusas.length > 0) {
      avisos.push(`${w.nombre}: ${inconclusas.length} sesion(es) declaradas inconclusas.`);
    }

    const sinImputar = w.segundosPresencia - w.segundosImputados;
    if (w.segundosPresencia > 0 && sinImputar > MARGEN_PRESENCIA) {
      avisos.push(
        `${w.nombre}: ${duracion(sinImputar)} de jornada sin imputar a ninguna actividad.`,
      );
    }
  }

  return avisos;
}
