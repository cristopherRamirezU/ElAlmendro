'use client';

import { useEffect, useRef, useState } from 'react';
import { useReactFlow, type NodeProps, type Position } from '@xyflow/react';
import { ALTO_RAIZ, ANCHO_RAIZ, type Orientacion } from '@/lib/mapaMental';
import { api, PersonaRef } from '@/lib/api';
import { disposicionNodo } from './orientacion';
import Manillas from './Manillas';
import { fuenteTitulo } from '@/lib/fuentes';

export interface DatosNodoRaiz {
  nombre: string;
  /** Tareas del proyecto (todos los niveles) y cuantas estan completadas. */
  totalTareas: number;
  completadas: number;
  /** Durante la entrada al mapa la insignia aparece primero. */
  entrando?: boolean;
  /** Modo edicion: sus manillas reciben el extremo de una linea. */
  editando?: boolean;
  tieneHijos: boolean;
  expandido: boolean;
  orientacion: Orientacion;
  /** Bordes por donde salen sus lineas (los elige el mapa). */
  ladosSalida?: Position[];
  onAlternar: () => void;
  onAgregarHija?: (titulo: string) => void;
  /**
   * "Tarea para alguien": crea la tarea ya con responsable. Solo llega si
   * quien mira puede asignar tareas. Devuelve el motivo si el servidor la
   * rechaza, o null si se creo.
   */
  onAgregarParaAlguien?: (titulo: string, responsableId: string) => Promise<string | null>;
  /** Avisa al mapa que el menu esta abierto, para desenfocar el resto. */
  onEnfoque?: (activo: boolean) => void;
  [clave: string]: unknown;
}

type Modo = 'menu' | 'nueva' | 'para-alguien' | null;

/**
 * Insignia del proyecto: el nodo central del que cuelgan las tareas. Lleva la
 * etiqueta "PROYECTO", el nombre, cuantas tareas tiene y cuantas estan
 * completadas, y un anillo con el avance. Es mas grande que una tarea; el
 * mapa la dibuja centrada en el lugar que el acomodo reserva para ella.
 *
 * Al pasar el mouse, al enfocarla con el teclado o al tocarla se abre un menu
 * para agregar tareas ("Nueva tarea" y, a quien puede asignar, "Tarea para
 * alguien"); mientras esta abierto el resto del mapa se desenfoca. Se cierra
 * con Escape o al salir del nodo.
 */
export default function NodoRaiz({ data }: NodeProps) {
  const d = data as DatosNodoRaiz;
  const disposicion = disposicionNodo(d.orientacion);
  const [modo, setModo] = useState<Modo>(null);
  const [texto, setTexto] = useState('');
  const [personas, setPersonas] = useState<PersonaRef[] | null>(null);
  const [responsableId, setResponsableId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const botonNodo = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { getViewport, setViewport } = useReactFlow();
  // Al devolver el foco al nodo tras cerrar, ese foco no debe reabrir el menu.
  const sinReabrir = useRef(false);
  // Tras Enter o Escape el campo desaparece; si el navegador igual avisa su
  // blur, no debe crear la tarea otra vez (ni crearla al cancelar).
  const campoResuelto = useRef(false);
  const puedeAgregar = Boolean(d.onAgregarHija || d.onAgregarParaAlguien);
  const abierto = modo !== null;
  const avance = d.totalTareas > 0 ? Math.round((d.completadas / d.totalTareas) * 100) : 0;
  // Un nombre corto va grande como en el diseno; uno largo baja de tamano y
  // usa hasta dos lineas antes de cortarse.
  const nombreCorto = d.nombre.length <= 10;
  const tamanoNombre = nombreCorto ? 28 : d.nombre.length <= 22 ? 19 : 16;

  // El mapa se desenfoca mientras el menu (o uno de sus formularios) esta abierto.
  const { onEnfoque } = d;
  useEffect(() => {
    onEnfoque?.(abierto);
  }, [abierto, onEnfoque]);
  useEffect(() => () => onEnfoque?.(false), [onEnfoque]);

  // Un formulario abierto cerca del borde inferior del mapa quedaria cortado:
  // se desplaza el mapa lo justo para verlo entero. (El menu no: moverlo bajo
  // el mouse haria salir del nodo y lo cerraria.)
  useEffect(() => {
    if (modo !== 'nueva' && modo !== 'para-alguien') return;
    const id = requestAnimationFrame(() => {
      const caja = panel.current?.getBoundingClientRect();
      const lienzo = panel.current?.closest('.react-flow')?.getBoundingClientRect();
      if (!caja || !lienzo) return;
      const sobra = caja.bottom + 12 - lienzo.bottom;
      if (sobra <= 0) return;
      const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const vista = getViewport();
      setViewport({ ...vista, y: vista.y - sobra }, { duration: quieto ? 0 : 200 });
    });
    return () => cancelAnimationFrame(id);
  }, [modo, getViewport, setViewport]);

  // Las personas a quien asignar se cargan la primera vez que se pide.
  useEffect(() => {
    if (modo !== 'para-alguien' || personas) return;
    api
      .get<PersonaRef[]>('/usuarios/trabajadores')
      .then(setPersonas)
      .catch(() => setAviso('No se pudo cargar el equipo.'));
  }, [modo, personas]);

  function cerrar(devolverFoco = false) {
    campoResuelto.current = true;
    setModo(null);
    setTexto('');
    setResponsableId('');
    setAviso(null);
    if (devolverFoco) {
      sinReabrir.current = true;
      requestAnimationFrame(() => botonNodo.current?.focus());
    }
  }

  function abrirMenu() {
    if (puedeAgregar && modo === null) setModo('menu');
  }

  function elegir(siguiente: Exclude<Modo, null | 'menu'>) {
    campoResuelto.current = false;
    setModo(siguiente);
  }

  /** Crea la tarea con lo escrito. Con Enter el foco vuelve al nodo. */
  function confirmarNueva(devolverFoco = false) {
    if (campoResuelto.current) return;
    const limpio = texto.trim();
    if (limpio && d.onAgregarHija) d.onAgregarHija(limpio);
    cerrar(devolverFoco);
  }

  async function crearParaAlguien(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || !responsableId || !d.onAgregarParaAlguien) return;
    setAviso(null);
    setEnviando(true);
    const motivo = await d.onAgregarParaAlguien(limpio, responsableId);
    setEnviando(false);
    if (motivo) setAviso(motivo);
    else cerrar(true);
  }

  return (
    <div
      ref={contenedor}
      className={`relative ${d.entrando ? 'tf-entra-raiz' : ''}`}
      style={{ width: ANCHO_RAIZ, height: ALTO_RAIZ }}
      onMouseEnter={abrirMenu}
      // Con el mouse, salir del nodo cierra el menu; un formulario a medio
      // escribir se queda hasta que se envie, se cancele o se salga con el foco.
      onMouseLeave={() => {
        if (modo === 'menu') cerrar();
      }}
      onFocus={() => {
        if (sinReabrir.current) {
          sinReabrir.current = false;
          return;
        }
        abrirMenu();
      }}
      // Se revisa un cuadro despues: al elegir una opcion, su boton desaparece y
      // el navegador avisa un blur sin destino justo antes de que el campo nuevo
      // tome el foco. Solo se cierra si el foco de verdad quedo fuera del nodo.
      onBlur={() => {
        requestAnimationFrame(() => {
          if (!contenedor.current?.contains(document.activeElement)) cerrar();
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && abierto) {
          e.stopPropagation();
          cerrar(true);
        }
      }}
    >
      <div
        className="tf-insignia-marco h-full w-full"
        style={abierto ? { boxShadow: '0 0 0 3px rgba(56,189,248,.35), 0 20px 50px -14px rgba(56,189,248,.7)' } : undefined}
      >
        <div className="tf-insignia-cuerpo flex h-full items-center gap-3.5 px-[18px]">
          <AnilloAvance porcentaje={avance} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300">Proyecto</p>
            <p
              className={`${fuenteTitulo.className} mt-0.5 font-bold leading-[1.05] tracking-[-0.03em] text-white ${
                nombreCorto ? 'truncate' : 'line-clamp-2 break-words'
              }`}
              style={{ fontSize: tamanoNombre }}
              title={d.nombre}
            >
              {d.nombre}
            </p>
            <p className="mt-1.5 truncate text-[11px] font-medium text-[#93a3c4]">
              {d.totalTareas === 0
                ? 'Sin tareas todavía'
                : `${d.totalTareas} ${d.totalTareas === 1 ? 'tarea' : 'tareas'} · ${d.completadas} ${
                    d.completadas === 1 ? 'completada' : 'completadas'
                  }`}
            </p>
          </div>
        </div>
      </div>

      {/* La insignia completa es el boton que abre el menu: con Tab, Enter o un toque. */}
      <button
        ref={botonNodo}
        type="button"
        aria-haspopup={puedeAgregar ? 'true' : undefined}
        aria-expanded={puedeAgregar ? abierto : undefined}
        aria-label={puedeAgregar ? `Proyecto ${d.nombre}: agregar tareas` : `Proyecto ${d.nombre}`}
        // Abre (con un toque en pantallas sin mouse); cerrar es con Escape o al salir.
        onClick={(e) => {
          e.stopPropagation();
          abrirMenu();
        }}
        className="absolute inset-0 rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      />
      <Manillas
        tipo="salida"
        principal={disposicion.salida}
        enUso={d.ladosSalida}
        editable={d.editando}
        className="!h-3 !w-3 !border-2 !border-sky-300 !bg-slate-950"
      />

      {d.tieneHijos && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            d.onAlternar();
          }}
          title={d.expandido ? 'Contraer' : 'Desplegar'}
          aria-label={d.expandido ? 'Contraer las tareas del proyecto' : 'Desplegar las tareas del proyecto'}
          className={`absolute ${disposicion.claseBoton} z-10 grid h-6 w-6 place-items-center rounded-full bg-slate-800 text-white ring-1 ring-white/25 hover:bg-slate-700`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${d.expandido ? disposicion.claseFlechaExpandida : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={disposicion.trazoFlecha} />
          </svg>
        </button>
      )}

      {/* pt-2 (y no mt-2): el espacio entre el nodo y el menu sigue siendo parte
          del nodo, asi el mouse puede bajar al menu sin que se cierre. */}
      {modo === 'menu' && (
        <div
          role="group"
          aria-label="Agregar al proyecto"
          className="tf-menu-raiz nodrag absolute left-0 top-full flex flex-col items-start gap-2 pt-2"
        >
          {d.onAgregarHija && (
            <OpcionMenu
              color="#38bdf8"
              titulo="Nueva tarea"
              detalle="Una tarea suelta del proyecto"
              onElegir={() => elegir('nueva')}
            />
          )}
          {d.onAgregarParaAlguien && (
            <OpcionMenu
              color="#f59e0b"
              titulo="Tarea para alguien"
              detalle="Créala ya con responsable"
              onElegir={() => elegir('para-alguien')}
            />
          )}
        </div>
      )}

      {modo === 'nueva' && (
        <div ref={panel} className="nodrag absolute left-0 top-full pt-2">
          <input
            autoFocus
            value={texto}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmarNueva(true);
            }}
            onBlur={(e) => {
              // Al salir del campo se crea con lo escrito, como siempre; salvo
              // si el foco se fue con Escape (lo maneja el contenedor).
              if (contenedor.current?.contains(e.relatedTarget as Node | null)) return;
              confirmarNueva();
            }}
            aria-label="Título de la nueva tarea"
            placeholder="Nueva tarea…"
            maxLength={160}
            className="w-56 rounded-lg border border-white/20 bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-xl outline-none focus:border-sky-400"
          />
        </div>
      )}

      {modo === 'para-alguien' && (
        <form
          onSubmit={crearParaAlguien}
          onClick={(e) => e.stopPropagation()}
          className="nodrag absolute left-0 top-full z-10 pt-2"
        >
          <div ref={panel} className="w-64 rounded-xl border border-amber-400/30 bg-slate-900/95 p-3 shadow-2xl">
            <p className="mb-2 text-[11px] font-semibold text-amber-200">Tarea para alguien</p>
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label="Título de la tarea"
              placeholder="Qué hay que hacer…"
              maxLength={160}
              className="mb-2 w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] text-white placeholder-slate-500 outline-none focus:border-amber-400"
            />
            <select
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              aria-label="Responsable de la tarea"
              disabled={!personas}
              className="mb-2 w-full rounded-lg border border-white/15 bg-slate-950 px-2 py-1.5 text-[11px] text-white outline-none focus:border-amber-400 disabled:opacity-50"
            >
              <option value="">{personas ? 'Elige a la persona…' : 'Cargando equipo…'}</option>
              {personas?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {aviso && (
              <p role="alert" className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
                {aviso}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={enviando || !texto.trim() || !responsableId}
                className="flex-1 rounded-lg bg-amber-500 py-1.5 text-[11px] font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              >
                {enviando ? 'Creando…' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => cerrar(true)}
                disabled={enviando}
                className="flex-1 rounded-lg border border-white/15 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-40 motion-reduce:transition-none"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

/** Anillo verde con el porcentaje de tareas completadas del proyecto. */
function AnilloAvance({ porcentaje }: { porcentaje: number }) {
  const circunferencia = 2 * Math.PI * 18;
  return (
    <svg
      viewBox="0 0 44 44"
      width="44"
      height="44"
      className="shrink-0"
      role="img"
      aria-label={`Avance del proyecto: ${porcentaje}%`}
    >
      <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(148,163,184,.25)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r="18"
        fill="none"
        stroke="#34d399"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(porcentaje / 100) * circunferencia} ${circunferencia}`}
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
        {porcentaje}%
      </text>
    </svg>
  );
}

/** Una opcion del menu del nodo principal, con el estilo del diseño. */
function OpcionMenu({
  color,
  titulo,
  detalle,
  onElegir,
}: {
  color: string;
  titulo: string;
  detalle: string;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onElegir();
      }}
      className="flex items-center gap-2 whitespace-nowrap rounded-full bg-slate-900/95 py-2 pl-2 pr-3.5 text-left text-xs font-bold text-slate-100 shadow-[inset_0_0_0_1px_rgba(148,163,184,.25),0_10px_24px_-10px_rgba(0,0,0,.8)] outline-none transition hover:bg-[#10213f] hover:shadow-[inset_0_0_0_1px_rgba(56,189,248,.7),0_10px_24px_-10px_rgba(56,189,248,.5)] focus-visible:bg-[#10213f] focus-visible:shadow-[inset_0_0_0_1px_rgba(56,189,248,.7),0_10px_24px_-10px_rgba(56,189,248,.5)] motion-reduce:transition-none"
    >
      <span
        aria-hidden
        className="grid h-[22px] w-[22px] place-items-center rounded-full text-[15px] font-extrabold leading-none text-[#04121f]"
        style={{ background: color }}
      >
        +
      </span>
      <span>
        {titulo}
        <small className="block text-[10px] font-medium text-slate-400">{detalle}</small>
      </span>
    </button>
  );
}
