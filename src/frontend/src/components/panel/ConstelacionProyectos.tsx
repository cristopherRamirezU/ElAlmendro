'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Palette } from 'lucide-react';
import type { ProyectoItem } from '@/lib/api';
import { fuenteEscena, fuenteTitulo } from '@/lib/fuentes';
import { EscenaConstelacion, FONDOS, type Filtro, type Fondo, type ProyectoEscena } from './escenaConstelacion';

/** Un proyecto esta completado si se cerro o si todas sus tareas terminaron. */
export function proyectoCompletado(p: ProyectoItem) {
  return p.estado === 'CERRADO' || (p.totalTareas > 0 && p.tareasCompletadas >= p.totalTareas);
}

const avance = (p: ProyectoItem) => (p.totalTareas > 0 ? Math.round((p.tareasCompletadas / p.totalTareas) * 100) : 0);

/** Fondo elegido: se recuerda en este navegador para cada persona. */
const CLAVE_FONDO = 'tf_constelacion_fondo';

/** Nombre y muestra (un degradado que lo evoca) de cada fondo del selector. */
const DATOS_FONDO: Record<Fondo, { nombre: string; muestra: string }> = {
  nebulosa: {
    nombre: 'Nebulosa suave',
    muestra: 'radial-gradient(circle at 30% 35%,rgba(91,60,196,.7),transparent 60%),radial-gradient(circle at 75% 70%,rgba(26,127,168,.6),transparent 60%),#050914',
  },
  aurora: {
    nombre: 'Aurora boreal',
    muestra: 'linear-gradient(180deg,rgba(40,220,160,.55),rgba(30,170,200,.3) 35%,transparent 70%),#050914',
  },
  orion: {
    nombre: 'Nebulosa de Orión',
    muestra: 'radial-gradient(circle at 55% 45%,rgba(255,170,140,.7),rgba(214,83,126,.5) 30%,transparent 65%),radial-gradient(circle at 25% 75%,rgba(120,60,170,.5),transparent 55%),#050914',
  },
  oceano: {
    nombre: 'Océano profundo',
    muestra: 'radial-gradient(circle at 30% 75%,rgba(20,90,150,.75),transparent 60%),radial-gradient(circle at 75% 30%,rgba(20,160,170,.55),transparent 55%),#050914',
  },
  atardecer: {
    nombre: 'Atardecer cósmico',
    muestra: 'linear-gradient(180deg,rgba(150,40,140,.6),rgba(60,30,90,.3) 60%,rgba(240,120,60,.55)),#07060f',
  },
  esmeralda: {
    nombre: 'Nebulosa esmeralda',
    muestra: 'radial-gradient(circle at 35% 40%,rgba(16,110,86,.75),transparent 60%),radial-gradient(circle at 72% 68%,rgba(40,190,140,.5),transparent 55%),#050914',
  },
  galaxia: {
    nombre: 'Galaxia lejana',
    muestra: 'radial-gradient(ellipse 30% 14% at 78% 30%,rgba(220,205,255,.75),rgba(150,130,255,.3) 50%,transparent 75%),#050914',
  },
  meteoros: {
    nombre: 'Lluvia de meteoros',
    muestra: 'linear-gradient(30deg,transparent 46%,rgba(220,230,255,.6) 50%,transparent 52%),linear-gradient(30deg,transparent 70%,rgba(220,230,255,.45) 73%,transparent 75%),#050914',
  },
  medianoche: {
    nombre: 'Medianoche',
    muestra: 'radial-gradient(circle at 50% 45%,rgba(30,50,120,.65),rgba(0,0,0,.4) 85%),#050914',
  },
  'via-lactea': {
    nombre: 'Vía láctea',
    muestra: 'linear-gradient(135deg,transparent 30%,rgba(170,185,255,.45) 50%,transparent 70%),#04070f',
  },
  carta: {
    nombre: 'Carta estelar',
    muestra: 'repeating-linear-gradient(0deg,rgba(110,150,255,.25) 0 1px,transparent 1px 8px),repeating-linear-gradient(90deg,rgba(110,150,255,.25) 0 1px,transparent 1px 8px),#050914',
  },
  horizonte: {
    nombre: 'Horizonte',
    muestra: 'radial-gradient(ellipse at 50% 140%,#060a18 55%,rgba(120,150,255,.75) 58%,transparent 75%),#04070f',
  },
  estrellas: {
    nombre: 'Solo estrellas',
    muestra: 'radial-gradient(circle at 25% 30%,#cdd8ff 0 1px,transparent 1.5px),radial-gradient(circle at 70% 60%,#cdd8ff 0 1px,transparent 1.5px),radial-gradient(circle at 45% 80%,#cdd8ff 0 1px,transparent 1.5px),#050914',
  },
};

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'proceso', texto: 'En proceso' },
  { valor: 'completados', texto: 'Completados' },
];

/**
 * Panel de proyectos como constelacion: todos los proyectos a la vista, en
 * dos anillos alrededor de una mini esfera de tareas (en proceso adentro,
 * completados afuera). Pasar el mouse por un proyecto acerca la camara y
 * despliega su tarjetita con "Ir al mapa" y "Ver proyecto"; pasarlo por la
 * esfera despliega "Nuevo proyecto". Los filtros solo atenuan lo que no
 * corresponde, sin cambiar de pantalla.
 */
export default function ConstelacionProyectos({
  proyectos,
  esTrabajador,
  onElegir,
  onIrAlMapa,
  onCrear,
}: {
  proyectos: ProyectoItem[];
  /** El trabajador va al mapa a registrar avance: su boton lo dice asi. */
  esTrabajador: boolean;
  /** Abre el detalle del proyecto. */
  onElegir: (id: string) => void;
  /** Lleva al mapa de nodos del proyecto. */
  onIrAlMapa: (p: ProyectoItem) => void;
  /** Abre el modal de creacion; sin el, la esfera no ofrece "Nuevo proyecto". */
  onCrear?: () => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const filtros = useRef<HTMLDivElement>(null);
  const escena = useRef<EscenaConstelacion | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  // Proyecto de la tarjetita: lo elige el motor al enfocar uno y se queda
  // mientras la tarjetita se recoge.
  const [enfocado, setEnfocado] = useState<string | null>(null);

  // El motor se crea una vez; las funciones del padre cambian en cada
  // pintado, asi que llama siempre a la ultima.
  const crear = useRef(onCrear);
  useEffect(() => {
    crear.current = onCrear;
  });

  // Fondo de la escena: cada quien elige el suyo y queda guardado en su navegador.
  const [fondo, setFondo] = useState<Fondo>('nebulosa');
  const [eligiendoFondo, setEligiendoFondo] = useState(false);
  const selector = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_FONDO) as Fondo | null;
      if (guardado && FONDOS.includes(guardado)) setFondo(guardado);
    } catch {
      /* almacenamiento bloqueado: queda la nebulosa */
    }
  }, []);
  function elegirFondo(f: Fondo) {
    setFondo(f);
    setEligiendoFondo(false);
    try {
      window.localStorage.setItem(CLAVE_FONDO, f);
    } catch {
      /* sin persistencia, pero el cambio aplica igual */
    }
  }
  // El selector se cierra con un clic fuera o con Escape.
  useEffect(() => {
    if (!eligiendoFondo) return;
    const fuera = (e: PointerEvent) => {
      if (!selector.current?.contains(e.target as Node)) setEligiendoFondo(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEligiendoFondo(false);
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [eligiendoFondo]);

  const items = useMemo<ProyectoEscena[]>(
    () =>
      proyectos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        total: p.totalTareas,
        hechas: Math.min(p.tareasCompletadas, p.totalTareas),
        completado: proyectoCompletado(p),
      })),
    [proyectos],
  );

  useEffect(() => {
    if (!raiz.current || !lienzo.current || !tarjeta.current || !filtros.current) return;
    const motor = new EscenaConstelacion(raiz.current, lienzo.current, {
      tarjeta: tarjeta.current,
      filtros: filtros.current,
      fuente: fuenteEscena.style.fontFamily,
      alEnfocar: setEnfocado,
      alCrear: () => crear.current?.(),
    });
    escena.current = motor;
    return () => {
      motor.destruir();
      escena.current = null;
    };
  }, []);

  const puedeCrear = Boolean(onCrear);
  useEffect(() => {
    if (escena.current) escena.current.puedeCrear = puedeCrear;
  }, [puedeCrear]);

  useEffect(() => {
    escena.current?.setDatos(items);
  }, [items]);

  useEffect(() => {
    if (escena.current) escena.current.filtro = filtro;
  }, [filtro]);

  useEffect(() => {
    if (escena.current) escena.current.fondo = fondo;
  }, [fondo]);

  const proyecto = proyectos.find((p) => p.id === enfocado) ?? null;

  // Al usar un boton de la tarjetita se suelta el enfoque fijado (toque o teclado).
  const soltarFoco = () => escena.current?.fijar(null);
  // Con el teclado, el foco en un proyecto lo enfoca; salir hacia su tarjetita no lo suelta.
  const alSalirDeProyecto = (e: React.FocusEvent) => {
    if (!tarjeta.current?.contains(e.relatedTarget as Node | null)) soltarFoco();
  };

  // Alto: la pantalla menos la cabecera (68 px) y el margen del marco
  // (24 px arriba y abajo), para que el Panel no se desplace.
  return (
    <div
      ref={raiz}
      className={`${fuenteEscena.className} relative h-[max(30rem,calc(100vh-7.25rem))] select-none overflow-hidden rounded-[14px] border border-[rgba(110,150,255,0.18)] bg-[#050914] text-[#e6ebff]`}
    >
      <canvas ref={lienzo} aria-hidden className="absolute inset-0 block h-full w-full touch-manipulation" />

      {/* ------------------------------------------------------- filtros */}
      <div
        ref={filtros}
        role="group"
        aria-label="Filtrar proyectos"
        className="absolute inset-x-0 top-[18px] z-[2] flex justify-center gap-7 transition-opacity duration-300"
      >
        {FILTROS.map((f) => {
          const activo = filtro === f.valor;
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => setFiltro(f.valor)}
              className={`${fuenteTitulo.className} py-1 text-[13px] transition-colors duration-300 ${
                activo
                  ? 'bg-[linear-gradient(90deg,#7f9dff,#b49aff)] bg-clip-text font-medium text-transparent'
                  : 'font-light text-[#56618a] hover:text-[#8f9acb]'
              }`}
            >
              {f.texto}
            </button>
          );
        })}
      </div>

      {/* ------------- cajon del proyecto enfocado: solo sus dos accesos */}
      <div ref={tarjeta} data-visible="false" className="tf-constelacion-tarjeta absolute left-0 top-0 z-[3]">
        {proyecto && (
          <>
            <button
              type="button"
              onClick={() => {
                soltarFoco();
                onIrAlMapa(proyecto);
              }}
              className="tf-cajon-mapa"
            >
              {esTrabajador ? 'Registrar avance' : 'Ir al mapa'}
            </button>
            <button
              type="button"
              onClick={() => {
                soltarFoco();
                onElegir(proyecto.id);
              }}
              className="tf-cajon-ver"
            >
              Ver proyecto
            </button>
          </>
        )}
      </div>

      {/* ---------------- fondo del mapa: lista que se despliega hacia abajo */}
      <div ref={selector} className="absolute right-4 top-3.5 z-[4]">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={eligiendoFondo}
          onClick={() => setEligiendoFondo((v) => !v)}
          className={`${fuenteTitulo.className} flex items-center gap-2 rounded-full border border-[rgba(110,150,255,0.25)] bg-[rgba(10,15,34,0.6)] py-1.5 pl-3 pr-2.5 text-xs font-light text-[#8f9acb] transition-colors hover:text-[#c9d2f5]`}
        >
          <Palette size={14} aria-hidden />
          {DATOS_FONDO[fondo].nombre}
          <ChevronDown size={14} aria-hidden className={`transition-transform duration-200 ${eligiendoFondo ? 'rotate-180' : ''}`} />
        </button>
        {eligiendoFondo && (
          <div
            role="menu"
            aria-label="Fondo del mapa"
            className="absolute right-0 top-full mt-2 max-h-[min(26rem,60vh)] w-56 overflow-y-auto rounded-xl border border-[rgba(110,150,255,0.35)] bg-[rgba(10,15,34,0.97)] p-1.5"
          >
            {FONDOS.map((f) => (
              <button
                key={f}
                type="button"
                role="menuitemradio"
                aria-checked={fondo === f}
                onClick={() => elegirFondo(f)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                  fondo === f ? 'bg-[rgba(110,150,255,0.14)] text-white' : 'text-[#aab4d6] hover:bg-white/5'
                }`}
              >
                <span
                  aria-hidden
                  className="h-6 w-10 shrink-0 rounded-md border border-white/10"
                  style={{ background: DATOS_FONDO[f].muestra }}
                />
                {DATOS_FONDO[f].nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lo mismo para teclado y lectores de pantalla: el canvas no se enfoca. */}
      <ul className="sr-only">
        {proyectos.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onFocus={() => escena.current?.fijar(p.id)}
              onBlur={alSalirDeProyecto}
              onKeyDown={(e) => {
                if (e.key === 'Escape') soltarFoco();
              }}
              onClick={() => onElegir(p.id)}
            >
              {`Proyecto ${p.nombre}, ${avance(p)} % de avance`}
            </button>
          </li>
        ))}
        {onCrear && (
          <li>
            <button
              type="button"
              onFocus={() => escena.current?.abrirBoton(true)}
              onBlur={() => escena.current?.abrirBoton(false)}
              onClick={() => escena.current?.crear()}
            >
              Nuevo proyecto
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
