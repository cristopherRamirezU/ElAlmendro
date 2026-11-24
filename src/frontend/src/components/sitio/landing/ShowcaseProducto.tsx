'use client';

import { useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  GanttChartSquare,
  GitBranch,
  Image as ImageIcon,
  Mic,
  Pause,
  Play,
} from 'lucide-react';
import RejillaMes from '@/components/calendario/RejillaMes';
import GraficoBarras from '@/components/reportes/GraficoBarras';
import InterruptorJornada from '@/components/ui/InterruptorJornada';
import { useToast } from '@/components/ui/Toast';
import type { DiaResumen } from '@/lib/calendario';
import { duracion, estadoDeActividad, ESTADOS } from '@/lib/formato';
import { fuenteTitulo } from '@/lib/fuentes';
import {
  PREFERENCIAS_CALENDARIO_DEFECTO,
  type EstiloCelda,
} from '@/lib/preferencias-calendario';
import DemoMapaNodos from './DemoMapaNodos';

type Pestana = 'mapa' | 'calendario' | 'gantt' | 'reportes';

const PESTANAS: { id: Pestana; etiqueta: string; icono: React.ReactNode }[] = [
  { id: 'mapa', etiqueta: 'Mapa de Nodos', icono: <GitBranch size={15} aria-hidden /> },
  { id: 'calendario', etiqueta: 'Jornada y Calendario', icono: <CalendarDays size={15} aria-hidden /> },
  { id: 'gantt', etiqueta: 'Carta Gantt y Tareas', icono: <GanttChartSquare size={15} aria-hidden /> },
  { id: 'reportes', etiqueta: 'Reportes y Roles', icono: <BarChart3 size={15} aria-hidden /> },
];

interface RegistroDia {
  persona: string;
  zona: string;
  proyecto: string;
  tarea: string;
  segundos: number;
  abierta?: boolean;
}

const REGISTROS_NOVIEMBRE: Record<string, RegistroDia[]> = {
  '2026-11-04': [
    { persona: 'Camila Rojas', zona: 'America/Santiago', proyecto: 'Portal Clientes', tarea: 'Arquitectura de datos', segundos: 27000 },
  ],
  '2026-11-05': [
    { persona: 'Mateo Silva', zona: 'America/Bogota', proyecto: 'Portal Clientes', tarea: 'Panel de cronómetro', segundos: 24480 },
  ],
  '2026-11-11': [
    { persona: 'Camila Rojas', zona: 'America/Santiago', proyecto: 'Portal Clientes', tarea: 'Mapa interactivo', segundos: 28800 },
    { persona: 'Valentina Díaz', zona: 'America/Mexico_City', proyecto: 'Sitio web', tarea: 'Textos y fotos', segundos: 22320 },
  ],
  '2026-11-12': [
    { persona: 'Mateo Silva', zona: 'America/Bogota', proyecto: 'Portal Clientes', tarea: 'Panel de cronómetro', segundos: 26640 },
  ],
  '2026-11-18': [
    { persona: 'Camila Rojas', zona: 'America/Santiago', proyecto: 'Portal Clientes', tarea: 'Revisión de accesos', segundos: 23400 },
    { persona: 'Mateo Silva', zona: 'America/Bogota', proyecto: 'Portal Clientes', tarea: 'Panel de cronómetro', segundos: 18720, abierta: true },
    { persona: 'Valentina Díaz', zona: 'America/Mexico_City', proyecto: 'Portal Clientes', tarea: 'Exportación Excel / PDF', segundos: 25560 },
  ],
  '2026-11-19': [
    { persona: 'Valentina Díaz', zona: 'America/Mexico_City', proyecto: 'Portal Clientes', tarea: 'Exportación Excel / PDF', segundos: 28080 },
  ],
  '2026-11-24': [
    { persona: 'Camila Rojas', zona: 'America/Santiago', proyecto: 'Sitio web', tarea: 'Diseño de inicio', segundos: 24840 },
    { persona: 'Mateo Silva', zona: 'America/Bogota', proyecto: 'Sitio web', tarea: 'Formulario de contacto', segundos: 16200 },
  ],
};

interface TareaGanttDemo {
  id: string;
  titulo: string;
  proyecto: string;
  responsable: string;
  estado: 'COMPLETADA' | 'EN_PROGRESO' | 'PENDIENTE';
  inicioIdx: number;
  finIdx: number;
  diasTrabajados: number[];
  limiteIdx: number;
  creada: string;
  inicioReal: string;
  limiteTexto: string;
  segundos: number;
  subtareas: { texto: string; hecha: boolean }[];
}

const DIAS_GANTT = [
  { clave: '2026-11-11', num: '11/11', sem: 'M', finde: false, hoy: false },
  { clave: '2026-11-12', num: '12/11', sem: 'J', finde: false, hoy: false },
  { clave: '2026-11-13', num: '13/11', sem: 'V', finde: false, hoy: false },
  { clave: '2026-11-14', num: '14/11', sem: 'S', finde: true, hoy: false },
  { clave: '2026-11-15', num: '15/11', sem: 'D', finde: true, hoy: false },
  { clave: '2026-11-16', num: '16/11', sem: 'L', finde: false, hoy: false },
  { clave: '2026-11-17', num: '17/11', sem: 'M', finde: false, hoy: false },
  { clave: '2026-11-18', num: '18/11', sem: 'X', finde: false, hoy: false },
  { clave: '2026-11-19', num: '19/11', sem: 'J', finde: false, hoy: false },
  { clave: '2026-11-20', num: '20/11', sem: 'V', finde: false, hoy: true },
];

const TAREAS_GANTT_INICIALES: TareaGanttDemo[] = [
  {
    id: 'g1',
    titulo: 'Arquitectura de datos',
    proyecto: 'Portal Clientes',
    responsable: 'Camila Rojas',
    estado: 'COMPLETADA',
    inicioIdx: 0,
    finIdx: 2,
    diasTrabajados: [0, 1, 2],
    limiteIdx: 2,
    creada: '10/11/2026',
    inicioReal: '11/11/2026',
    limiteTexto: '13/11/2026',
    segundos: 11400,
    subtareas: [
      { texto: 'Definir entidades de proyectos y nodos', hecha: true },
      { texto: 'Configurar candados secuenciales', hecha: true },
    ],
  },
  {
    id: 'g2',
    titulo: 'Panel de cronómetro',
    proyecto: 'Portal Clientes',
    responsable: 'Mateo Silva',
    estado: 'EN_PROGRESO',
    inicioIdx: 2,
    finIdx: 7,
    diasTrabajados: [2, 5, 6, 7],
    limiteIdx: 8,
    creada: '12/11/2026',
    inicioReal: '13/11/2026',
    limiteTexto: '19/11/2026',
    segundos: 18720,
    subtareas: [
      { texto: 'Interruptor de jornada con pausas', hecha: true },
      { texto: 'Zona horaria individual por persona', hecha: false },
    ],
  },
  {
    id: 'g3',
    titulo: 'Exportación Excel / PDF',
    proyecto: 'Portal Clientes',
    responsable: 'Valentina Díaz',
    estado: 'COMPLETADA',
    inicioIdx: 5,
    finIdx: 8,
    diasTrabajados: [5, 7, 8],
    limiteIdx: 8,
    creada: '15/11/2026',
    inicioReal: '16/11/2026',
    limiteTexto: '19/11/2026',
    segundos: 14520,
    subtareas: [
      { texto: 'Exportación tabular Excel y CSV', hecha: true },
      { texto: 'Resumen ejecutivo PDF', hecha: true },
    ],
  },
  {
    id: 'g4',
    titulo: 'Validación y cierre',
    proyecto: 'Portal Clientes',
    responsable: 'Camila Rojas',
    estado: 'PENDIENTE',
    inicioIdx: 7,
    finIdx: 9,
    diasTrabajados: [],
    limiteIdx: 9,
    creada: '17/11/2026',
    inicioReal: 'Sin definir',
    limiteTexto: '20/11/2026',
    segundos: 0,
    subtareas: [
      { texto: 'Verificar permisos RBAC por rol', hecha: false },
      { texto: 'Aprobación final en el mapa', hecha: false },
    ],
  },
];

const BARRAS_REPORTE = [
  { area: 'Producto', nombre: 'Arquitectura de datos · Camila', valor: 18.5, etiqueta: '18 h 30 min' },
  { area: 'Ingeniería', nombre: 'Panel de cronómetro · Mateo', valor: 15.2, etiqueta: '15 h 12 min' },
  { area: 'Producto', nombre: 'Exportación Excel / PDF · Valentina', valor: 12.8, etiqueta: '12 h 48 min' },
  { area: 'Producto', nombre: 'Diseño de inicio · Camila', valor: 9.4, etiqueta: '9 h 24 min' },
  { area: 'Ingeniería', nombre: 'Formulario de contacto · Mateo', valor: 7.2, etiqueta: '7 h 12 min' },
];

const ONDAS_VOZ = [8, 16, 12, 22, 18, 10, 20, 14, 24, 15, 11, 19, 13, 21, 9, 16];

/**
 * Product Showcase interactivo de 4 pestañas, construido con los componentes
 * reales de TimeFlow (DemoMapaNodos, InterruptorJornada, RejillaMes, CartaGantt, GraficoBarras).
 */
export default function ShowcaseProducto() {
  const { toast } = useToast();
  const [pestana, setPestana] = useState<Pestana>('mapa');
  const [montado, setMontado] = useState(false);

  // Estado Pestaña 2 (Jornada y Calendario con RejillaMes real)
  const [enJornadaCal, setEnJornadaCal] = useState(true);
  const [estiloCelda, setEstiloCelda] = useState<EstiloCelda>('limpio');
  const [filtroPersona, setFiltroPersona] = useState('all');
  const [diaSeleccionado, setDiaSeleccionado] = useState('2026-11-18');

  // Estado Pestaña 3 (Carta Gantt + Subtareas + Audio + Evidencia)
  const [ganttFiltroEstado, setGanttFiltroEstado] = useState('TODAS');
  const [soloActivasGantt, setSoloActivasGantt] = useState(false);
  const [tareasGantt, setTareasGantt] = useState<TareaGanttDemo[]>(TAREAS_GANTT_INICIALES);
  const [ganttSel, setGanttSel] = useState('g2');
  const [vozReproduciendo, setVozReproduciendo] = useState(false);
  const [vozSeg, setVozSeg] = useState(0);
  const [evidenciaActiva, setEvidenciaActiva] = useState<'pdf' | 'png'>('pdf');

  // Estado Pestaña 4 (Reportes y RBAC)
  const [areaReporte, setAreaReporte] = useState<'all' | 'Producto' | 'Ingeniería'>('all');
  const [menuExportar, setMenuExportar] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!vozReproduciendo) return;
    const id = setInterval(() => {
      setVozSeg((s) => {
        if (s >= 24) {
          setVozReproduciendo(false);
          return 24;
        }
        return s + 1;
      });
    }, 350);
    return () => clearInterval(id);
  }, [vozReproduciendo]);

  const mesNoviembre = useMemo(
    () => DateTime.fromISO('2026-11-01', { zone: 'America/Santiago' }),
    [],
  );

  const diasRejilla: DiaResumen[] = useMemo(() => {
    return Object.entries(REGISTROS_NOVIEMBRE).map(([fecha, regs]) => {
      const filtrados = regs.filter((r) => filtroPersona === 'all' || r.persona.startsWith(filtroPersona));
      const segundosImputados = filtrados.reduce((acc, r) => acc + r.segundos, 0);
      const abiertas = filtrados.filter((r) => r.abierta).length;
      return {
        fecha,
        segundosImputados,
        segundosPresencia: Math.round(segundosImputados * 1.08),
        sesiones: filtrados.length * 2,
        conRegistro: filtrados.length,
        alertas: {
          jornadasAbiertas: abiertas,
          autocerradas: 0,
          inconclusas: 0,
          presenciaExcesiva: 0,
          total: abiertas,
        },
      };
    });
  }, [filtroPersona]);

  const detalleDia = useMemo(() => {
    const lista = REGISTROS_NOVIEMBRE[diaSeleccionado] ?? [];
    return lista.filter((r) => filtroPersona === 'all' || r.persona.startsWith(filtroPersona));
  }, [diaSeleccionado, filtroPersona]);

  const tareasGanttFiltradas = useMemo(() => {
    return tareasGantt.filter((t) => {
      if (ganttFiltroEstado === 'EN_PROGRESO' && t.estado !== 'EN_PROGRESO') return false;
      if (ganttFiltroEstado === 'COMPLETADA' && t.estado !== 'COMPLETADA') return false;
      if (ganttFiltroEstado === 'PENDIENTES' && t.estado !== 'PENDIENTE') return false;
      if (soloActivasGantt && t.segundos <= 0) return false;
      return true;
    });
  }, [tareasGantt, ganttFiltroEstado, soloActivasGantt]);

  const tareaGanttActiva = tareasGantt.find((t) => t.id === ganttSel) ?? tareasGantt[0];

  const datosBarras = useMemo(
    () =>
      BARRAS_REPORTE.filter((b) => areaReporte === 'all' || b.area === areaReporte).map(
        ({ nombre, valor, etiqueta }) => ({ nombre, valor, etiqueta }),
      ),
    [areaReporte],
  );

  return (
    <div className="tf-card-pro overflow-hidden rounded-[26px]">
      {/* Pestañas superiores */}
      <div
        role="tablist"
        aria-label="Vistas reales de TimeFlow"
        className="flex flex-wrap gap-2 border-b border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] px-4 py-3.5"
      >
        {PESTANAS.map((tab, idx) => {
          const activa = pestana === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activa}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setPestana(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') setPestana(PESTANAS[(idx + 1) % PESTANAS.length].id);
                if (e.key === 'ArrowLeft')
                  setPestana(PESTANAS[(idx - 1 + PESTANAS.length) % PESTANAS.length].id);
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                activa
                  ? 'border-sky-400/40 bg-sky-500/15 text-[var(--tf-acento-azul)]'
                  : 'border-transparent text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
              }`}
            >
              {tab.icono}
              {tab.etiqueta}
            </button>
          );
        })}
      </div>

      {/* PANEL 1: MAPA DE NODOS REAL */}
      {pestana === 'mapa' && (
        <div id="panel-mapa" role="tabpanel" aria-labelledby="tab-mapa" className="tf-enter p-4 sm:p-5">
          <DemoMapaNodos variante="completo" />
        </div>
      )}

      {/* PANEL 2: JORNADA Y CALENDARIO REAL (InterruptorJornada + RejillaMes) */}
      {pestana === 'calendario' && (
        <div id="panel-calendario" role="tabpanel" aria-labelledby="tab-calendario" className="tf-enter p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <InterruptorJornada
              encendido={enJornadaCal}
              pendiente={null}
              desde={montado && enJornadaCal ? '2026-11-24T12:05:00.000Z' : null}
              onAlternar={() => setEnJornadaCal((v) => !v)}
            />

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)]">
                <button
                  type="button"
                  onClick={() => setEstiloCelda('limpio')}
                  aria-pressed={estiloCelda === 'limpio'}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${
                    estiloCelda === 'limpio'
                      ? 'bg-sky-500/15 text-[var(--tf-acento-azul)]'
                      : 'text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)]'
                  }`}
                >
                  Vista Limpia
                </button>
                <button
                  type="button"
                  onClick={() => setEstiloCelda('calor')}
                  aria-pressed={estiloCelda === 'calor'}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${
                    estiloCelda === 'calor'
                      ? 'bg-sky-500/15 text-[var(--tf-acento-azul)]'
                      : 'text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)]'
                  }`}
                >
                  Mapa de calor
                </button>
              </div>

              <select
                value={filtroPersona}
                onChange={(e) => setFiltroPersona(e.target.value)}
                aria-label="Filtrar calendario por persona"
                className="h-9 rounded-xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] px-3 text-xs font-semibold text-[var(--tf-texto)] outline-none"
              >
                <option value="all">Todo el equipo</option>
                <option value="Camila">Camila Rojas (Santiago)</option>
                <option value="Mateo">Mateo Silva (Bogotá)</option>
                <option value="Valentina">Valentina Díaz (CDMX)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.45fr_0.85fr]">
            <div className="rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className={`${fuenteTitulo.className} text-sm font-bold text-[var(--tf-texto)]`}>
                  Noviembre 2026 · Actividad por día
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  1 jornada abierta sin cierre · Mateo Silva
                </span>
              </div>

              {montado && (
                <RejillaMes
                  mes={mesNoviembre}
                  dias={diasRejilla}
                  seleccionado={diaSeleccionado}
                  onDia={setDiaSeleccionado}
                  prefs={{
                    ...PREFERENCIAS_CALENDARIO_DEFECTO,
                    estiloCelda,
                    mostrarPersonasSesiones: true,
                    mostrarBarraAvance: true,
                    mostrarAlertas: true,
                  }}
                />
              )}
            </div>

            <aside className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--tf-acento-azul)]">
                  Detalle del {diaSeleccionado.split('-').reverse().join('/')}
                </p>
                <h3 className={`${fuenteTitulo.className} mt-1 text-base font-bold text-[var(--tf-texto)]`}>
                  Sesiones por persona y zona horaria
                </h3>
                <div className="mt-3 flex flex-col gap-2.5">
                  {detalleDia.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--tf-borde)] p-3 text-xs text-[var(--tf-texto-suave)]">
                      Sin sesiones para el filtro elegido en este día.
                    </p>
                  ) : (
                    detalleDia.map((r) => (
                      <div
                        key={r.persona + r.tarea}
                        className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[var(--tf-texto)]">{r.persona}</span>
                          <span className="font-mono text-xs font-semibold text-[var(--tf-acento-azul)]">
                            {duracion(r.segundos)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--tf-texto-tenue)]">
                          {r.proyecto} · {r.tarea}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--tf-texto-suave)]">
                          <span className="font-mono">{r.zona}</span>
                          {r.abierta && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">
                              Jornada abierta
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)] p-3 text-[11px] leading-relaxed text-[var(--tf-texto-tenue)]">
                Cada persona registra su jornada en su zona horaria local; TimeFlow agrupa los marcajes y avisa jornadas sin cierre.
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* PANEL 3: CARTA GANTT REAL + SUBTAREAS + VOZ + PREVIEW */}
      {pestana === 'gantt' && (
        <div id="panel-gantt" role="tabpanel" aria-labelledby="tab-gantt" className="tf-enter p-4 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="flex flex-col gap-3">
              {/* Filtros exactos de CartaGantt.tsx */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={ganttFiltroEstado}
                    onChange={(e) => setGanttFiltroEstado(e.target.value)}
                    aria-label="Filtrar Carta Gantt por estado"
                    className="h-8 rounded-full border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] px-3 text-xs font-medium text-[var(--tf-texto)] outline-none"
                  >
                    <option value="TODAS">Todos los estados</option>
                    <option value="EN_PROGRESO">{ESTADOS.EN_PROGRESO.texto}</option>
                    <option value="COMPLETADA">Completadas</option>
                    <option value="PENDIENTES">Por hacer / Bloqueadas</option>
                  </select>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-hover)] px-3 py-1.5 text-xs text-[var(--tf-texto)]">
                    <input
                      type="checkbox"
                      checked={soloActivasGantt}
                      onChange={(e) => setSoloActivasGantt(e.target.checked)}
                      className="h-3.5 w-3.5 accent-sky-500"
                    />
                    Solo con actividad en el período
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)]">
                <div className="min-w-[600px]">
                  <div
                    className="grid border-b border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)]"
                    style={{ gridTemplateColumns: '205px repeat(10, minmax(36px, 1fr))' }}
                  >
                    <div className="sticky left-0 z-10 flex items-center border-r border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-texto-tenue)]">
                      Tarea ({tareasGanttFiltradas.length})
                    </div>
                    {DIAS_GANTT.map((d) => (
                      <div
                        key={d.clave}
                        className={`border-r border-[var(--tf-borde)] px-1 py-1.5 text-center last:border-r-0 ${
                          d.hoy
                            ? 'bg-sky-500/15 text-[var(--tf-acento-azul)]'
                            : d.finde
                              ? 'bg-[var(--tf-hover)] text-[var(--tf-texto-suave)]'
                              : 'text-[var(--tf-texto-tenue)]'
                        }`}
                      >
                        <span className="block font-mono text-[10px] font-semibold leading-tight">{d.num}</span>
                        <span className="block text-[9px] uppercase opacity-75">{d.sem}</span>
                      </div>
                    ))}
                  </div>

                  {tareasGanttFiltradas.map((t) => {
                    const est = estadoDeActividad(t.estado);
                    const abierta = ganttSel === t.id;
                    const leftPct = (t.inicioIdx / DIAS_GANTT.length) * 100;
                    const widthPct = ((t.finIdx - t.inicioIdx + 1) / DIAS_GANTT.length) * 100;

                    return (
                      <div key={t.id} className="border-b border-[var(--tf-borde)] last:border-b-0">
                        <div
                          className="grid items-stretch"
                          style={{ gridTemplateColumns: '205px repeat(10, minmax(36px, 1fr))' }}
                        >
                          <button
                            type="button"
                            onClick={() => setGanttSel(t.id)}
                            aria-expanded={abierta}
                            className={`sticky left-0 z-10 flex flex-col justify-center border-r border-[var(--tf-borde)] px-3 py-2 text-left transition ${
                              abierta
                                ? 'bg-[var(--tf-superficie-2)]'
                                : 'bg-[var(--tf-superficie-solida)] hover:bg-[var(--tf-hover)]'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${est.punto}`} />
                              <span className="truncate text-xs font-medium text-[var(--tf-texto)]">{t.titulo}</span>
                            </span>
                            <span className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-[var(--tf-texto-tenue)]">
                              <span className="truncate">{t.responsable}</span>
                              {t.segundos > 0 && (
                                <span className="shrink-0 font-mono font-semibold text-[var(--tf-acento-azul)]">
                                  {duracion(t.segundos)}
                                </span>
                              )}
                            </span>
                          </button>

                          <div
                            className="relative grid"
                            style={{
                              gridColumn: 'span 10 / span 10',
                              gridTemplateColumns: 'repeat(10, minmax(36px, 1fr))',
                            }}
                          >
                            <div
                              aria-hidden
                              className={`pointer-events-none absolute top-1/2 z-[1] h-5 -translate-y-1/2 rounded-md border ${est.barraGantt}`}
                              style={{ left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                            />
                            {DIAS_GANTT.map((d, i) => (
                              <div
                                key={d.clave}
                                className={`relative z-[2] flex h-11 items-center justify-center border-r border-[var(--tf-borde)] last:border-r-0 ${
                                  d.hoy ? 'bg-sky-500/10' : d.finde ? 'bg-[var(--tf-hover)]' : ''
                                }`}
                              >
                                {t.diasTrabajados.includes(i) && (
                                  <span className={`h-3 w-3 rounded-sm shadow-sm ${est.celdaGantt}`} />
                                )}
                                {t.limiteIdx === i && (
                                  <span className="absolute right-1 top-0.5 text-[10px] leading-none text-rose-500">
                                    ◆
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {abierta && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] px-3 py-2 text-[11px] text-[var(--tf-texto-tenue)]">
                            <span>
                              Estado:{' '}
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${est.clase}`}>
                                {est.texto}
                              </span>
                            </span>
                            <span>
                              Creada: <strong className="font-mono text-[var(--tf-texto)]">{t.creada}</strong>
                            </span>
                            <span>
                              Inicio real: <strong className="font-mono text-[var(--tf-texto)]">{t.inicioReal}</strong>
                            </span>
                            <span>
                              Límite: <strong className="font-mono text-[var(--tf-texto)]">{t.limiteTexto}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leyenda exacta de CartaGantt.tsx */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--tf-texto-tenue)]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-5 rounded border border-amber-400/60 bg-amber-500/35" />
                  Duración de tarea
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                  Día con sesiones registradas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-rose-400">◆</span>
                  Fecha límite
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-500/30 ring-1 ring-sky-400/50" />
                  Hoy
                </span>
              </div>
            </div>

            {/* Panel lateral fiel a PanelTarea + AudioComentario + ZonaEvidencias */}
            <aside className="tf-ventana-tarea flex flex-col gap-4 rounded-2xl border p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--tf-acento-azul)]">
                  Subtareas · {tareaGanttActiva.responsable}
                </p>
                <h3 className={`${fuenteTitulo.className} mt-0.5 text-base font-bold text-[var(--tf-texto)]`}>
                  {tareaGanttActiva.titulo}
                </h3>
                <div className="mt-2.5 flex flex-col gap-2">
                  {tareaGanttActiva.subtareas.map((sub, idx) => (
                    <label
                      key={sub.texto}
                      className="tf-vidrio flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-[var(--tf-texto)]"
                    >
                      <input
                        type="checkbox"
                        checked={sub.hecha}
                        onChange={() => {
                          setTareasGantt((prev) =>
                            prev.map((item) =>
                              item.id !== tareaGanttActiva.id
                                ? item
                                : {
                                    ...item,
                                    subtareas: item.subtareas.map((s, sIdx) =>
                                      sIdx === idx ? { ...s, hecha: !s.hecha } : s,
                                    ),
                                  },
                            ),
                          );
                        }}
                        className="h-3.5 w-3.5 accent-sky-500"
                      />
                      <span className={sub.hecha ? 'line-through text-[var(--tf-texto-suave)]' : ''}>
                        {sub.texto}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Bloque de comentario de voz estilo AudioComentario.tsx */}
              <div className="flex flex-col gap-2 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tf-acento-azul)]">
                  <Mic size={13} aria-hidden />
                  Comentario de voz
                  <span className="font-normal tabular-nums text-[var(--tf-texto-tenue)]">· 0:24</span>
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (vozSeg >= 24) setVozSeg(0);
                      setVozReproduciendo((v) => !v);
                    }}
                    aria-label={vozReproduciendo ? 'Pausar comentario de voz' : 'Reproducir comentario de voz'}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500 text-[#04101f] transition hover:bg-sky-400"
                  >
                    {vozReproduciendo ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <div className="flex h-6 flex-1 items-center gap-[3px]" aria-hidden>
                    {ONDAS_VOZ.map((h, i) => {
                      const encendida = vozSeg > 0 && i <= Math.floor((vozSeg / 24) * ONDAS_VOZ.length);
                      return (
                        <span
                          key={i}
                          className={`flex-1 rounded-full transition-opacity ${
                            encendida ? 'bg-sky-400 opacity-100' : 'bg-sky-400/35'
                          }`}
                          style={{ height: `${h}px` }}
                        />
                      );
                    })}
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--tf-texto-tenue)]">
                    0:{String(vozSeg).padStart(2, '0')} / 0:24
                  </span>
                </div>
              </div>

              {/* Evidencias con vista previa sin descarga */}
              <div>
                <p className="mb-2 text-[11px] font-semibold text-[var(--tf-texto-tenue)]">
                  Evidencias adjuntas (vista previa sin descarga)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEvidenciaActiva('pdf')}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      evidenciaActiva === 'pdf'
                        ? 'border-sky-400/45 bg-sky-500/15 text-[var(--tf-acento-azul)]'
                        : 'border-[var(--tf-borde)] bg-[var(--tf-hover)] text-[var(--tf-texto)]'
                    }`}
                  >
                    <FileText size={13} aria-hidden />
                    Arquitectura_v2.pdf
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenciaActiva('png')}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      evidenciaActiva === 'png'
                        ? 'border-sky-400/45 bg-sky-500/15 text-[var(--tf-acento-azul)]'
                        : 'border-[var(--tf-borde)] bg-[var(--tf-hover)] text-[var(--tf-texto)]'
                    }`}
                  >
                    <ImageIcon size={13} aria-hidden />
                    Flujo_nodos.png
                  </button>
                </div>
                <div className="tf-vidrio mt-2 rounded-xl p-3 text-xs text-[var(--tf-texto-tenue)]">
                  {evidenciaActiva === 'pdf'
                    ? 'Vista previa en línea: Arquitectura_v2.pdf — Diagrama de nodos, roles RBAC y reglas de bloqueo secuencial.'
                    : 'Vista previa en línea: Flujo_nodos.png — Captura del árbol horizontal con 4 nodos conectados y cronómetro activo.'}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* PANEL 4: REPORTES REALES (GraficoBarras + Exportar + RBAC) */}
      {pestana === 'reportes' && (
        <div id="panel-reportes" role="tabpanel" aria-labelledby="tab-reportes" className="tf-enter p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`${fuenteTitulo.className} text-sm font-bold text-[var(--tf-texto)]`}>
                Horas por actividad (muestra de ejemplo)
              </p>
              <select
                value={areaReporte}
                onChange={(e) => setAreaReporte(e.target.value as 'all' | 'Producto' | 'Ingeniería')}
                aria-label="Filtrar reporte por área"
                className="h-8 rounded-full border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] px-3 text-xs font-medium text-[var(--tf-texto)] outline-none"
              >
                <option value="all">Todo el equipo</option>
                <option value="Producto">Producto</option>
                <option value="Ingeniería">Ingeniería</option>
              </select>
            </div>

            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuExportar}
                onClick={() => setMenuExportar((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] px-3.5 py-2 text-xs font-medium text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)]"
              >
                <Download size={13} aria-hidden />
                <span>Exportar</span>
                <ChevronDown size={13} aria-hidden className={`transition-transform ${menuExportar ? 'rotate-180' : ''}`} />
              </button>
              {menuExportar && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-2 w-44 rounded-2xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] p-1.5 shadow-2xl"
                >
                  {[
                    { clave: 'CSV', desc: 'Valores separados' },
                    { clave: 'Excel', desc: 'Libro .xlsx por tabla' },
                    { clave: 'PDF', desc: 'Listo para imprimir' },
                  ].map((f) => (
                    <button
                      key={f.clave}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuExportar(false);
                        toast({
                          tipo: 'info',
                          titulo: `Exportación ${f.clave}`,
                          descripcion: 'En tu empresa descarga el período filtrado en un clic.',
                        });
                      }}
                      className="flex w-full flex-col rounded-xl px-3 py-2 text-left text-xs transition hover:bg-[var(--tf-hover)]"
                    >
                      <span className="font-semibold text-[var(--tf-texto)]">{f.clave}</span>
                      <span className="text-[10px] text-[var(--tf-texto-suave)]">{f.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.9fr]">
            <div className="rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] p-4">
              <GraficoBarras datos={datosBarras} unidad="h" />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] p-4">
              <p className={`${fuenteTitulo.className} mb-3 text-sm font-bold text-[var(--tf-texto)]`}>
                Control de acceso RBAC por rol
              </p>
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--tf-borde)] text-[10px] uppercase tracking-wider text-[var(--tf-texto-suave)]">
                    <th className="py-2 pr-2">Capacidad</th>
                    <th className="py-2 text-center">Admin</th>
                    <th className="py-2 text-center">Sup.</th>
                    <th className="py-2 text-center">Trab.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--tf-borde)] text-[var(--tf-texto-tenue)]">
                  <tr>
                    <td className="py-2 pr-2 text-[var(--tf-texto)]">Jornada y cronómetro propio</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 text-[var(--tf-texto)]">Ver todas las tareas y calendario equipo</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                    <td className="py-2 text-center">—</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 text-[var(--tf-texto)]">Editar mapa de nodos</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                    <td className="py-2 text-center text-sky-300">Extra*</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 text-[var(--tf-texto)]">Exportar Excel, CSV y PDF</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                    <td className="py-2 text-center">—</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 text-[var(--tf-texto)]">Gestionar usuarios, roles y marca</td>
                    <td className="py-2 text-center text-emerald-400">✓</td>
                    <td className="py-2 text-center">—</td>
                    <td className="py-2 text-center">—</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2.5 text-[11px] text-[var(--tf-texto-suave)]">
                *El Administrador puede habilitar permisos extra puntuales a un Trabajador (editar mapa o eliminar tareas).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
