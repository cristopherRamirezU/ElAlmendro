'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  GitBranch,
  Lock,
  Menu,
  Mic,
  Palette,
  ShieldCheck,
  X,
} from 'lucide-react';
import ListaPlan from '@/components/sitio/ListaPlan';
import MarcaTimeFlow, { Isotipo, NombreMarca } from '@/components/sitio/MarcaTimeFlow';
import { useToast } from '@/components/ui/Toast';
import { colorTextoSobre, luminanciaRelativa } from '@/lib/color';
import { estadoDeActividad } from '@/lib/formato';
import { fuenteEscena, fuenteTitulo } from '@/lib/fuentes';
import { TEMAS } from '@/lib/tema';
import { DATOS_LEGALES } from '@/lib/sitio';
import DemoMapaNodos from './DemoMapaNodos';
import FondoAuroraGrilla from './FondoAuroraGrilla';
import ShowcaseProducto from './ShowcaseProducto';

type RolClave = 'ADMINISTRADOR' | 'SUPERVISOR' | 'TRABAJADOR';

const ROLES_INFO: Record<
  RolClave,
  {
    titulo: string;
    subtitulo: string;
    etiqueta: string;
    resumen: string;
    capacidades: string[];
    flujo: string;
  }
> = {
  ADMINISTRADOR: {
    titulo: 'Administrador',
    subtitulo: 'Control total',
    etiqueta: 'Visibilidad completa, gobierno RBAC y marca propia',
    resumen:
      'Configura los temas (Oscuro Medianoche, Oscuro Grafito o Claro Nube) y el color corporativo de tu empresa, crea usuarios y otorga permisos extra puntuales a trabajadores.',
    capacidades: [
      'Gestión de usuarios y roles',
      'Permisos extra a trabajadores',
      'Tema y color corporativo WCAG',
      'Editar y eliminar tareas del mapa',
      'Calendario y reportes de todo el equipo',
      'Exportación Excel, CSV y PDF',
      'Chat del equipo y notas de voz',
    ],
    flujo:
      'Acceso completo a Configuración de apariencia, Usuarios, Mapa de nodos, Calendario del equipo, Carta Gantt, Historial y Exportaciones.',
  },
  SUPERVISOR: {
    titulo: 'Supervisor',
    subtitulo: 'Operación diaria',
    etiqueta: 'Supervisión operativa y seguimiento de entregas en vivo',
    resumen:
      'Ordena el mapa de nodos con bloqueos secuenciales, detecta jornadas abiertas en el calendario del equipo y exporta reportes operativos sin tocar configuración crítica.',
    capacidades: [
      'Ver todas las tareas del equipo',
      'Editar mapa de nodos',
      'Calendario del equipo y alertas',
      'Reportes operativos y Carta Gantt',
      'Historial de cambios',
      'Exportación Excel, CSV y PDF',
      'Chat del equipo y notas de voz',
    ],
    flujo:
      'Enfocado en coordinación: organiza dependencias del mapa, revisa avances diarios por persona y descarga reportes del período.',
  },
  TRABAJADOR: {
    titulo: 'Trabajador',
    subtitulo: 'Foco operativo',
    etiqueta: 'Jornada clara, cronómetro por tarea y zona horaria propia',
    resumen:
      'Activa su jornada con un clic, cronometra sus tareas asignadas con pausas, deja comentarios de texto o voz desde el micrófono y revisa su calendario personal.',
    capacidades: [
      'Interruptor de entrada y salida',
      'Cronómetro por tarea con pausas',
      'Ver mapa y tareas propias',
      'Calendario personal',
      'Zona horaria individual',
      'Chat del equipo y notas de voz',
      'Permiso extra opcional*',
    ],
    flujo:
      'Sin ruido administrativo: entra al mapa, registra sesiones reales en su hora local y colabora por chat o audio en segundos.',
  },
};

const PASOS = [
  {
    n: '1',
    color: 'text-[#38bdf8]',
    titulo: 'Crea tu empresa gratis',
    texto:
      'Registra tu espacio con el Plan Básico sin tarjeta. Tu cuenta queda como Administrador para personalizar tema, color y proyectos.',
  },
  {
    n: '2',
    color: 'text-[#a78bfa]',
    titulo: 'Suma a tu equipo con roles y zonas horarias',
    texto:
      'Crea cuentas de Supervisores y Trabajadores, define sus permisos y deja que cada persona trabaje con su zona horaria real.',
  },
  {
    n: '3',
    color: 'text-[#34d399]',
    titulo: 'Trabajen en el mapa y midan en calendario y reportes',
    texto:
      'Cada integrante marca su jornada, cronometra tareas y colabora con chat y notas de voz mientras ves el avance en calendario, Gantt y reportes.',
  },
];

const COLORES_EJEMPLO = ['#38bdf8', '#10b981', '#6366f1', '#f59e0b', '#f43f5e'];

/**
 * Portada pública de TimeFlow:
 * Fondo B (Aurora + Grilla) · Hero 2 (Centrado + Stage Panorámico) · Oscuro Medianoche · #38bdf8
 */
export default function LandingTimeFlow() {
  const { toast } = useToast();
  const [navScroll, setNavScroll] = useState(false);
  const [menuMovil, setMenuMovil] = useState(false);
  const [rolActivo, setRolActivo] = useState<RolClave>('ADMINISTRADOR');
  const [colorPreview, setColorPreview] = useState('#38bdf8');
  const [anguloStage, setAnguloStage] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const actualizar = () => {
      setNavScroll(window.scrollY > 18);
      if (motion.matches || window.innerWidth < 768 || !stageRef.current) {
        setAnguloStage(0);
        return;
      }
      const rect = stageRef.current.getBoundingClientRect();
      const prog = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight * 0.72)));
      setAnguloStage(Number(((1 - prog) * 6.5).toFixed(2)));
    };
    actualizar();
    window.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    return () => {
      window.removeEventListener('scroll', actualizar);
      window.removeEventListener('resize', actualizar);
    };
  }, []);

  function moverSpotlight(e: React.PointerEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }

  async function copiarCorreo() {
    try {
      await navigator.clipboard.writeText(DATOS_LEGALES.correo);
      toast({
        tipo: 'exito',
        titulo: 'Correo copiado',
        descripcion: DATOS_LEGALES.correo,
      });
    } catch {
      toast({
        tipo: 'info',
        titulo: 'Correo de contacto',
        descripcion: DATOS_LEGALES.correo,
      });
    }
  }

  const estadoOk = estadoDeActividad('COMPLETADA');
  const estadoBloq = estadoDeActividad('BLOQUEADA');
  const rolInfo = ROLES_INFO[rolActivo];
  const textoSobreColor = colorTextoSobre(colorPreview);
  const ratioContraste = (() => {
    const l1 = luminanciaRelativa(colorPreview);
    const l2 = luminanciaRelativa(textoSobreColor);
    return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(1);
  })();

  return (
    <div className="relative min-h-screen bg-[#040814] text-[#f8fafc]">
      <FondoAuroraGrilla />

      <div className="relative z-10">
        {/* ==================================================================
            NAVBAR FLOTANTE GLASSMORPHISM
            ================================================================== */}
        <header
          className={`sticky top-0 z-40 border-b transition duration-200 ${
            navScroll
              ? 'border-white/10 bg-[#040814]/80 backdrop-blur-xl'
              : 'border-transparent bg-transparent'
          }`}
        >
          <nav
            aria-label="Principal"
            className="mx-auto flex min-h-[74px] max-w-[1220px] items-center justify-between gap-4 px-6"
          >
            <MarcaTimeFlow />

            <div className="hidden items-center gap-6 text-sm font-medium text-[#b6c2e2] md:flex">
              <a href="#producto" className="py-2 no-underline transition hover:text-white">
                Producto
              </a>
              <a href="#funciones" className="py-2 no-underline transition hover:text-white">
                Funciones
              </a>
              <a href="#como-funciona" className="py-2 no-underline transition hover:text-white">
                Cómo funciona
              </a>
              <a href="#roles" className="py-2 no-underline transition hover:text-white">
                Roles
              </a>
              <a href="#plan" className="py-2 no-underline transition hover:text-white">
                Plan Básico
              </a>
            </div>

            <div className="hidden items-center gap-2.5 md:flex">
              <Link
                href="/login"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-[#e6ecfa] no-underline transition hover:bg-white/10"
              >
                Acceso clientes
              </Link>
              <Link
                href="/registro"
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#38bdf8] px-4 text-sm font-bold text-[#04101f] no-underline shadow-[0_10px_28px_-10px_rgba(56,189,248,0.65)] transition hover:bg-[#7dd3fc]"
              >
                Crear cuenta gratis
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setMenuMovil((v) => !v)}
              aria-expanded={menuMovil}
              aria-label="Abrir menú de navegación"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/5 text-white md:hidden"
            >
              {menuMovil ? <X size={18} /> : <Menu size={18} />}
            </button>
          </nav>

          {menuMovil && (
            <div className="border-t border-white/10 bg-[#080f22] px-6 py-4 md:hidden">
              <div className="flex flex-col gap-2 text-sm text-[#b6c2e2]">
                {[
                  ['#producto', 'Producto'],
                  ['#funciones', 'Funciones'],
                  ['#como-funciona', 'Cómo funciona'],
                  ['#roles', 'Roles'],
                  ['#plan', 'Plan Básico'],
                ].map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMenuMovil(false)}
                    className="rounded-lg px-2 py-2 no-underline hover:bg-white/5 hover:text-white"
                  >
                    {label}
                  </a>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <Link
                  href="/login"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/20 text-sm font-semibold text-white no-underline"
                >
                  Acceso clientes
                </Link>
                <Link
                  href="/registro"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#38bdf8] text-sm font-bold text-[#04101f] no-underline"
                >
                  Crear cuenta
                </Link>
              </div>
            </div>
          )}
        </header>

        <main>
          {/* ================================================================
              HERO 2 — CENTRADO CINEMATOGRAFICO + STAGE PANORAMICO
              ================================================================ */}
          <section id="inicio" className="overflow-x-clip px-6 pb-20 pt-12 sm:pt-16">
            <div className="mx-auto flex max-w-[1140px] flex-col items-center text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-sky-400/35 bg-sky-500/12 px-3.5 py-1.5 text-[13px] font-semibold text-[#7dd3fc]">
                <span className="h-2 w-2 rounded-full bg-[#34d399]" aria-hidden />
                Plan Básico gratis · Hasta 10 personas y 5 proyectos · Sin tarjeta
              </p>

              <h1
                className={`${fuenteTitulo.className} mt-6 max-w-[880px] text-[clamp(2.55rem,5.4vw,4.45rem)] font-extrabold leading-[1.05] tracking-[-0.032em] text-[#f6f8ff]`}
              >
                El tiempo de tu equipo,{' '}
                <span className="bg-[linear-gradient(110deg,#7dd3fc_10%,#38bdf8_55%,#c4b5fd_98%)] bg-clip-text text-transparent">
                  en un mapa.
                </span>
              </h1>

              <p className="mt-5 max-w-[660px] text-base leading-relaxed text-[#b6c2e2] sm:text-lg">
                TimeFlow organiza cada proyecto como un mapa visual de tareas con bloqueo secuencial, registra la jornada y las sesiones con cronómetro en vivo, y te muestra quién trabajó en qué, cuándo y cuánto.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href="/registro"
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#38bdf8] px-7 text-base font-bold text-[#04101f] no-underline shadow-[0_14px_34px_-12px_rgba(56,189,248,0.7)] transition hover:bg-[#7dd3fc]"
                >
                  Crear mi empresa gratis
                  <ArrowRight size={17} aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] border border-white/20 bg-white/5 px-6 text-base font-semibold text-[#e6ecfa] no-underline backdrop-blur transition hover:bg-white/10"
                >
                  Ya tengo cuenta · Ingresar
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-[#94a3b8]">
                {[
                  'Mapa interactivo de nodos',
                  'Jornada y zona horaria propia',
                  'Calendario, Gantt y reportes',
                  'Chat y notas de voz',
                ].map((cap) => (
                  <span key={cap} className="inline-flex items-center gap-1.5">
                    <Check size={14} className="text-[#34d399]" aria-hidden />
                    {cap}
                  </span>
                ))}
              </div>

              {/* Browser Frame Panorámico con DemoMapaNodos REAL */}
              <div
                ref={stageRef}
                className="mt-11 w-full max-w-[1060px] [perspective:1400px]"
              >
                <div
                  className="overflow-hidden rounded-[26px] border border-white/15 bg-[#080f22]/90 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.85),0_0_0_1px_rgba(56,189,248,0.14)] backdrop-blur-xl transition-transform duration-150 ease-out"
                  style={
                    anguloStage > 0
                      ? { transform: `rotateX(${anguloStage}deg) scale(${0.97 + (1 - anguloStage / 6.5) * 0.03})` }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between border-b border-white/10 bg-[#0b1329] px-4 py-2.5">
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]/80" />
                    </div>
                    <span className="rounded-lg border border-white/10 bg-[#040814] px-3 py-1 font-mono text-[11px] text-[#94a3b8]">
                      app.timeflows.site/nodos
                    </span>
                    <span className="text-[11px] font-semibold text-[#7dd3fc]">Vista en vivo</span>
                  </div>

                  <div className="p-2 sm:p-3">
                    <DemoMapaNodos variante="hero" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================
              PRODUCT SHOWCASE INTERACTIVO POR PESTAÑAS
              ================================================================ */}
          <section id="producto" className="overflow-x-clip border-t border-white/10 px-6 py-24">
            <div className="mx-auto max-w-[1220px]">
              <div className="mb-10 max-w-[680px]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7dd3fc]">
                  Producto en vivo
                </p>
                <h2
                  className={`${fuenteTitulo.className} mt-2.5 text-[clamp(1.85rem,3.3vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.025em] text-[#f6f8ff]`}
                >
                  Las pantallas reales de TimeFlow, listas para probar
                </h2>
                <p className="mt-3 text-base leading-relaxed text-[#b6c2e2]">
                  Cambia de pestaña para recorrer el mapa de nodos con subtareas, el calendario con el interruptor de jornada, la Carta Gantt con notas de voz y los reportes exportables.
                </p>
              </div>

              <ShowcaseProducto />
            </div>
          </section>

          {/* ================================================================
              BENTO GRID DE FUNCIONALIDADES REALES (CON PREVIEWS EXACTOS)
              ================================================================ */}
          <section id="funciones" className="overflow-x-clip border-t border-white/10 px-6 py-24">
            <div className="mx-auto max-w-[1220px]">
              <div className="mb-11 max-w-[680px]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7dd3fc]">
                  Funciones reales
                </p>
                <h2
                  className={`${fuenteTitulo.className} mt-2.5 text-[clamp(1.85rem,3.3vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.025em] text-[#f6f8ff]`}
                >
                  Todo lo que tu equipo necesita para medir y coordinar su trabajo
                </h2>
              </div>

              <div className="grid grid-cols-12 gap-5">
                {/* 1. Mapa de nodos y bloqueo secuencial (7 cols) */}
                <article
                  onPointerMove={moverSpotlight}
                  className="tf-card-pro tf-spot col-span-12 flex flex-col justify-between gap-5 rounded-[22px] p-6 lg:col-span-7"
                >
                  <div>
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-400/30 bg-sky-500/12 text-[#7dd3fc]">
                      <GitBranch size={20} aria-hidden />
                    </span>
                    <h3 className={`${fuenteTitulo.className} mt-4 text-xl font-bold text-white`}>
                      Mapa de nodos y bloqueo secuencial
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#b6c2e2]">
                      Vista Horizontal o Vertical, candado de bloqueo secuencial, autoguardado en vivo, deshacer/rehacer (<span className="font-mono text-xs">Ctrl+Z</span> / <span className="font-mono text-xs">Ctrl+Y</span>), minimapa y buscador global.
                    </p>
                  </div>

                  {/* Mini réplica exacta de 2 NodoTarea reales conectados */}
                  <div
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 p-4"
                    style={{
                      background:
                        'radial-gradient(rgba(148,163,184,0.14) 1px, transparent 1px) 0 0 / 16px 16px, #060b18',
                    }}
                  >
                    <div
                      className="tf-tarea relative flex h-[64px] w-[220px] items-center overflow-hidden rounded-xl pb-[3px] pl-2 pr-3"
                      style={{ '--c': estadoOk.rgb } as React.CSSProperties}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                            #1
                          </span>
                          <span className="truncate text-xs font-bold text-white">Diseño de inicio</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 text-[10px]">
                          <span className="rounded-[5px] border border-white/10 bg-slate-800/80 px-[7px] py-0.5 font-bold text-slate-300">
                            Camila
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: `rgb(${estadoOk.rgb})` }}>
                            <CheckCircle2 size={10} />
                            {estadoOk.texto}
                          </span>
                          <span className="font-extrabold tabular-nums" style={{ color: estadoOk.color }}>
                            100%
                          </span>
                        </div>
                      </div>
                      <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: estadoOk.color }} />
                    </div>

                    <span className="hidden text-sky-400/70 sm:inline" aria-hidden>
                      ──▶
                    </span>

                    <div
                      className="tf-tarea relative flex h-[64px] w-[220px] items-center overflow-hidden rounded-xl pb-[3px] pl-2 pr-3 opacity-85"
                      style={{ '--c': estadoBloq.rgb } as React.CSSProperties}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                            #2
                          </span>
                          <Lock size={11} className="shrink-0 text-rose-400" />
                          <span className="truncate text-xs font-bold text-white">Revisión final</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 text-[10px]">
                          <span className="rounded-[5px] border border-sky-300/40 bg-sky-400/30 px-[7px] py-0.5 font-bold text-sky-200">
                            Tú
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: `rgb(${estadoBloq.rgb})` }}>
                            <Lock size={10} />
                            {estadoBloq.texto}
                          </span>
                          <span className="font-extrabold tabular-nums" style={{ color: estadoBloq.color }}>
                            0%
                          </span>
                        </div>
                      </div>
                      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[.08]" />
                    </div>
                  </div>
                </article>

                {/* 2. Jornada, cronómetro y zona horaria (5 cols) */}
                <article
                  onPointerMove={moverSpotlight}
                  className="tf-card-pro tf-spot col-span-12 flex flex-col justify-between gap-5 rounded-[22px] p-6 lg:col-span-5"
                >
                  <div>
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-400/30 bg-sky-500/12 text-[#7dd3fc]">
                      <Clock size={20} aria-hidden />
                    </span>
                    <h3 className={`${fuenteTitulo.className} mt-4 text-xl font-bold text-white`}>
                      Cronómetro y zona horaria propia
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#b6c2e2]">
                      Interruptor de jornada, cronómetro por tarea con pausas y notas de sesión. Cada persona mide sus días en su propia zona horaria.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className={`${fuenteEscena.className} tf-contador flex items-center justify-between px-4 py-3`}>
                      <div>
                        <p className="text-[26px] font-light leading-none text-white tabular-nums">01:12:40</p>
                        <p className="mt-1 text-[11px] text-[#94a3b8]">Corriendo · sesión con pausas</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                        En jornada
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 rounded-xl border border-white/10 bg-[#070d1f] px-3 py-2 font-mono text-[11px] text-[#b6c2e2]">
                      <span>Santiago · 12:35</span>
                      <span>Bogotá · 10:35</span>
                      <span>CDMX · 09:35</span>
                    </div>
                  </div>
                </article>

                {/* 3. Notas de voz y Chat del equipo (5 cols) */}
                <article
                  onPointerMove={moverSpotlight}
                  className="tf-card-pro tf-spot col-span-12 flex flex-col justify-between gap-5 rounded-[22px] p-6 lg:col-span-5"
                >
                  <div>
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-400/30 bg-sky-500/12 text-[#7dd3fc]">
                      <Mic size={20} aria-hidden />
                    </span>
                    <h3 className={`${fuenteTitulo.className} mt-4 text-xl font-bold text-white`}>
                      Notas de voz y Chat del equipo
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#b6c2e2]">
                      Canal general y mensajes directos en vivo, audios grabados desde el micrófono en cada tarea, historial completo de cambios y notificaciones.
                    </p>
                  </div>

                  {/* Mini réplica exacta de Conversacion.tsx + AudioComentario.tsx */}
                  <div className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-[#0b1329] p-3">
                    <div className="flex items-center gap-2.5 border-b border-white/10 pb-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0ea5e9] text-xs font-bold text-white">
                        #
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-white">Canal general</p>
                        <p className="text-[10px] text-[#94a3b8]">3 compañeros en línea</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-[#7dd3fc]">
                      <Mic size={12} aria-hidden />
                      <span className="font-semibold">Comentario de voz</span>
                      <span className="ml-auto font-mono text-[#94a3b8]">· 0:24</span>
                    </div>
                  </div>
                </article>

                {/* 4. Calendario y Carta Gantt (7 cols) */}
                <article
                  onPointerMove={moverSpotlight}
                  className="tf-card-pro tf-spot col-span-12 flex flex-col justify-between gap-5 rounded-[22px] p-6 lg:col-span-7"
                >
                  <div>
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-400/30 bg-sky-500/12 text-[#7dd3fc]">
                      <CalendarDays size={20} aria-hidden />
                    </span>
                    <h3 className={`${fuenteTitulo.className} mt-4 text-xl font-bold text-white`}>
                      Calendario del equipo y Carta Gantt
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#b6c2e2]">
                      Grilla mensual en vista Limpia o Mapa de calor, alertas de jornadas abiertas, detalle por persona o proyecto y Carta Gantt con vista previa de adjuntos sin descarga.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[0.9fr_1.3fr]">
                    {/* Mini celda exacta de RejillaMes.tsx en modo limpio */}
                    <div className="rounded-xl border border-[var(--tf-borde)] border-l-[3px] border-l-teal-400 bg-[var(--tf-superficie-2)] p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-white">18</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />1
                        </span>
                      </div>
                      <span className="mt-1.5 block font-mono text-sm font-bold text-white">18,8 h</span>
                      <span className="block text-[10px] text-[#94a3b8]">3 pers · 6 ses</span>
                    </div>

                    {/* Mini fila exacta de CartaGantt.tsx */}
                    <div className="flex flex-col justify-center gap-2 rounded-xl border border-white/10 bg-[#0b1329] p-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 font-medium text-white">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Panel de cronómetro
                        </span>
                        <span className="font-mono text-[#7dd3fc]">5 h 12 min</span>
                      </div>
                      <div className="relative grid h-7 grid-cols-6 items-center rounded-lg border border-white/10 bg-white/[0.03] px-1">
                        <div className="col-span-4 col-start-2 h-4 rounded border border-amber-400/60 bg-amber-500/35" />
                        <span className="absolute left-[36%] h-2.5 w-2.5 rounded-sm bg-amber-400" />
                        <span className="absolute left-[64%] h-2.5 w-2.5 rounded-sm bg-amber-400" />
                        <span className="absolute right-2 top-0.5 text-[10px] text-rose-400">◆</span>
                      </div>
                    </div>
                  </div>
                </article>

                {/* 5. 3 Temas y Personalización de marca WCAG (6 cols) */}
                <article
                  onPointerMove={moverSpotlight}
                  className="tf-card-pro tf-spot col-span-12 flex flex-col justify-between gap-5 rounded-[22px] p-6 lg:col-span-6"
                >
                  <div>
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-400/30 bg-sky-500/12 text-[#7dd3fc]">
                      <Palette size={20} aria-hidden />
                    </span>
                    <h3 className={`${fuenteTitulo.className} mt-4 text-xl font-bold text-white`}>
                      3 temas reales y color corporativo WCAG
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#b6c2e2]">
                      Cada empresa elige entre {TEMAS.map((t) => t.nombre).join(', ')} y personaliza su color de marca con cálculo automático de contraste legible.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b1329] p-3">
                    <div className="flex items-center gap-2">
                      {COLORES_EJEMPLO.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setColorPreview(hex)}
                          aria-label={`Probar color ${hex}`}
                          className={`h-6 w-6 rounded-full transition ${
                            colorPreview === hex ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0b1329]' : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{ background: hex }}
                        />
                      ))}
                    </div>
                    <span
                      className="rounded-lg px-3 py-1 font-mono text-xs font-bold"
                      style={{ background: colorPreview, color: textoSobreColor }}
                    >
                      {colorPreview} · {ratioContraste}:1 WCAG
                    </span>
                  </div>
                </article>

                {/* 6. Control RBAC y exportación (6 cols) */}
                <article
                  onPointerMove={moverSpotlight}
                  className="tf-card-pro tf-spot col-span-12 flex flex-col justify-between gap-5 rounded-[22px] p-6 lg:col-span-6"
                >
                  <div>
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-400/30 bg-sky-500/12 text-[#7dd3fc]">
                      <ShieldCheck size={20} aria-hidden />
                    </span>
                    <h3 className={`${fuenteTitulo.className} mt-4 text-xl font-bold text-white`}>
                      Control RBAC y exportación directa
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#b6c2e2]">
                      Roles Administrador, Supervisor y Trabajador con permisos granulares, y descarga directa de horas, marcajes y tareas en Excel, CSV y PDF.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0b1329] px-3.5 py-2.5 text-xs">
                    <span className="text-[#b6c2e2]">Administrador · Supervisor · Trabajador</span>
                    <span className="font-mono font-bold text-[#6ee7b7]">Excel · CSV · PDF</span>
                  </div>
                </article>
              </div>
            </div>
          </section>

          {/* ================================================================
              COMO FUNCIONA (3 PASOS)
              ================================================================ */}
          <section id="como-funciona" className="overflow-x-clip border-t border-white/10 px-6 py-24">
            <div className="mx-auto max-w-[1220px]">
              <div className="mb-11 max-w-[680px]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7dd3fc]">
                  Cómo funciona
                </p>
                <h2
                  className={`${fuenteTitulo.className} mt-2.5 text-[clamp(1.85rem,3.3vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.025em] text-[#f6f8ff]`}
                >
                  De crear tu empresa a tu primer reporte, en tres pasos
                </h2>
              </div>

              <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
                {PASOS.map((p) => (
                  <li
                    key={p.n}
                    onPointerMove={moverSpotlight}
                    className="tf-card-pro tf-spot flex flex-col gap-3 rounded-[22px] p-7"
                  >
                    <span className={`${fuenteTitulo.className} text-[32px] font-extrabold ${p.color}`} aria-hidden>
                      {p.n}
                    </span>
                    <h3 className={`${fuenteTitulo.className} m-0 text-lg font-bold text-white`}>{p.titulo}</h3>
                    <p className="m-0 text-sm leading-relaxed text-[#b6c2e2]">{p.texto}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ================================================================
              DISENADO PARA CADA ROL DEL EQUIPO
              ================================================================ */}
          <section id="roles" className="overflow-x-clip border-t border-white/10 px-6 py-24">
            <div className="mx-auto max-w-[1220px]">
              <div className="mb-11 max-w-[680px]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7dd3fc]">
                  Control RBAC real
                </p>
                <h2
                  className={`${fuenteTitulo.className} mt-2.5 text-[clamp(1.85rem,3.3vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.025em] text-[#f6f8ff]`}
                >
                  Diseñado para cada rol del equipo
                </h2>
              </div>

              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.15fr]">
                <div role="tablist" aria-label="Roles de TimeFlow" className="flex flex-col gap-3">
                  {(['ADMINISTRADOR', 'SUPERVISOR', 'TRABAJADOR'] as RolClave[]).map((clave) => {
                    const info = ROLES_INFO[clave];
                    const activo = rolActivo === clave;
                    return (
                      <button
                        key={clave}
                        type="button"
                        role="tab"
                        aria-selected={activo}
                        onClick={() => setRolActivo(clave)}
                        className={`rounded-[18px] border p-5 text-left transition ${
                          activo
                            ? 'border-sky-400/60 bg-[#0b152d] shadow-[0_0_0_3px_rgba(56,189,248,0.14)]'
                            : 'border-white/10 bg-[#070d1f]/80 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`${fuenteTitulo.className} text-lg font-bold text-white`}>
                            {info.titulo}
                          </span>
                          <span className="text-xs font-bold text-[#7dd3fc]">{info.subtitulo}</span>
                        </div>
                        <p className="mt-1.5 text-sm text-[#b6c2e2]">{info.etiqueta}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="tf-card-pro flex flex-col justify-between gap-5 rounded-[22px] p-7">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7dd3fc]">
                      Rol · {rolInfo.titulo}
                    </p>
                    <h3 className={`${fuenteTitulo.className} mt-2 text-2xl font-bold text-white`}>
                      {rolInfo.etiqueta}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#b6c2e2]">{rolInfo.resumen}</p>
                  </div>

                  <div>
                    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">
                      Qué gana en su día a día
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {rolInfo.capacidades.map((cap) => (
                        <span
                          key={cap}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#e2e8f0]"
                        >
                          <Check size={12} className="text-[#34d399]" aria-hidden />
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#070d1f] p-3.5 text-xs leading-relaxed text-[#b6c2e2]">
                    {rolInfo.flujo}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================
              PLAN BASICO + ESCALABILIDAD TRANSPARENTE
              ================================================================ */}
          <section id="plan" className="overflow-x-clip border-t border-white/10 px-6 py-24">
            <div className="mx-auto max-w-[1220px]">
              <div className="mb-11 max-w-[680px]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7dd3fc]">
                  Plan Básico
                </p>
                <h2
                  className={`${fuenteTitulo.className} mt-2.5 text-[clamp(1.85rem,3.3vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.025em] text-[#f6f8ff]`}
                >
                  Empieza gratis, con todas las funciones
                </h2>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
                <div className="tf-glow-ring">
                  <article className="tf-glow-inner flex h-full flex-col justify-between gap-6 p-8">
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#7dd3fc]">
                            Incluido desde el día 1
                          </span>
                          <h3 className={`${fuenteTitulo.className} mt-1 text-2xl font-bold text-white`}>
                            Plan Básico
                          </h3>
                        </div>
                        <p className={`${fuenteTitulo.className} m-0 text-[40px] font-extrabold text-white`}>
                          Gratis
                        </p>
                      </div>
                      <p className="mb-5 mt-3 text-sm text-[#b6c2e2]">
                        La plataforma completa para equipos pequeños, sin tarjeta ni límites artificiales de funciones.
                      </p>
                      <ListaPlan />
                    </div>

                    <Link
                      href="/registro"
                      className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#38bdf8] px-6 text-base font-bold text-[#04101f] no-underline shadow-[0_12px_30px_-10px_rgba(56,189,248,0.65)] transition hover:bg-[#7dd3fc]"
                    >
                      Crear cuenta con el plan Básico
                    </Link>
                  </article>
                </div>

                <aside className="tf-card-pro flex flex-col justify-between gap-6 rounded-[24px] p-8">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                      Escalabilidad transparente
                    </span>
                    <h3 className={`${fuenteTitulo.className} mt-1.5 text-2xl font-bold text-white`}>
                      Equipos en crecimiento · Pro / Empresa
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#b6c2e2]">
                      Si tu empresa supera las 10 personas o los 5 proyectos activos, pasa a <strong>Pro</strong> o <strong>Empresa</strong> conservando intactos todos tus proyectos, sesiones y reportes.
                    </p>
                    <div className="mt-4 rounded-xl border border-white/10 bg-[#070d1f] p-4 text-xs leading-relaxed text-[#b6c2e2]">
                      Escríbenos directamente para habilitar los cupos que tu equipo necesite según el tamaño real de tu operación.
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <a
                      href={`mailto:${DATOS_LEGALES.correo}`}
                      className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white no-underline transition hover:bg-white/10"
                    >
                      Escribir a {DATOS_LEGALES.correo}
                    </a>
                    <button
                      type="button"
                      onClick={copiarCorreo}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-4 text-xs font-semibold text-[#b6c2e2] transition hover:bg-white/5 hover:text-white"
                    >
                      <Copy size={13} aria-hidden />
                      Copiar correo: {DATOS_LEGALES.correo}
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </section>

          {/* ================================================================
              CTA FINAL DE CIERRE
              ================================================================ */}
          <section className="overflow-x-clip px-6 pb-20 pt-6">
            <div
              className="mx-auto max-w-[1220px] rounded-[28px] border border-sky-400/35 px-6 py-14 text-center shadow-[0_24px_64px_-24px_rgba(0,0,0,0.85)] sm:px-10"
              style={{
                background:
                  'radial-gradient(620px 320px at 50% 0%, rgba(56, 189, 248, 0.20), transparent 72%), #0b1329',
              }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7dd3fc]">
                Ideas en movimiento
              </p>
              <h2
                className={`${fuenteTitulo.className} mx-auto mt-3 max-w-[660px] text-[clamp(1.85rem,3.3vw,2.7rem)] font-bold leading-[1.12] text-white`}
              >
                Pon tu primer proyecto en el mapa hoy mismo
              </h2>
              <p className="mx-auto mt-3 max-w-[540px] text-base text-[#b6c2e2]">
                Crea tu empresa gratis con el Plan Básico: hasta 10 personas, hasta 5 proyectos activos y todas las funciones desde el primer minuto.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href="/registro"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#38bdf8] px-7 text-base font-bold text-[#04101f] no-underline transition hover:bg-[#7dd3fc]"
                >
                  Crear cuenta gratis
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] border border-white/20 bg-white/5 px-6 text-base font-semibold text-white no-underline transition hover:bg-white/10"
                >
                  Acceso clientes
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* ==================================================================
            FOOTER COMPLETO
            ================================================================== */}
        <footer className="border-t border-white/10 px-6 py-10">
          <div className="mx-auto flex max-w-[1220px] flex-wrap items-center justify-between gap-4 text-[13px] text-[#8f9cc0]">
            <p className="m-0 flex items-center gap-2.5">
              <Isotipo tamano={24} />
              <span>
                <NombreMarca className="text-[#e6ecfa]" /> · Ideas en movimiento
              </span>
            </p>
            <div className="flex flex-wrap gap-5">
              <Link href="/login" className="text-[#b6c2e2] no-underline hover:text-white">
                Acceso clientes
              </Link>
              <Link href="/registro" className="text-[#b6c2e2] no-underline hover:text-white">
                Crear cuenta
              </Link>
              <Link href="/terminos" className="text-[#b6c2e2] no-underline hover:text-white">
                Términos de uso
              </Link>
              <Link href="/privacidad" className="text-[#b6c2e2] no-underline hover:text-white">
                Privacidad
              </Link>
              <a href={`mailto:${DATOS_LEGALES.correo}`} className="text-[#b6c2e2] no-underline hover:text-white">
                {DATOS_LEGALES.correo}
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
