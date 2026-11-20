import type { Metadata } from 'next';
import Link from 'next/link';
import MarcaTimeFlow, { NombreMarca } from '@/components/sitio/MarcaTimeFlow';
import ListaPlan from '@/components/sitio/ListaPlan';
import { fuenteTitulo } from '@/lib/fuentes';
import { DATOS_LEGALES } from '@/lib/sitio';

export const metadata: Metadata = {
  title: 'TimeFlow · El tiempo de tu equipo, en un mapa',
  description:
    'TimeFlow organiza cada proyecto como un mapa de tareas, registra la jornada y las sesiones de trabajo de cada persona y muestra quién trabajó en qué, cuándo y cuánto. Plan Básico gratis.',
};

/** Correo de contacto: se completa en lib/sitio.ts. */
const CORREO_CONTACTO = DATOS_LEGALES.correo;

const FUNCIONES = [
  {
    titulo: 'Mapa de tareas',
    texto: 'Cada proyecto es un nodo y sus tareas cuelgan de él, con estado, responsable y subtareas.',
    icono: 'M6 6h.01M18 6h.01M12 12h.01M6 18h.01M7 7l4 4M17 7l-4 4M7 17l4-4',
  },
  {
    titulo: 'Jornada y cronómetro',
    texto: 'Cada persona marca el inicio de su día y cronometra sus sesiones, con pausas incluidas.',
    icono: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z',
  },
  {
    titulo: 'Calendario del equipo',
    texto: 'Mira día a día quién trabajó, en qué tareas y cuántas horas, con avisos de jornadas abiertas.',
    icono: 'M4 7h16M8 3v4M16 3v4M5 5h14v15H5z',
  },
  {
    titulo: 'Reportes y exportación',
    texto: 'Horas, días, marcajes, proyectos y tareas por persona; descárgalos en Excel, CSV o PDF.',
    icono: 'M5 20V10M12 20V4M19 20v-7',
  },
  {
    titulo: 'Chat del equipo',
    texto: 'Conversaciones privadas y un canal general, con la foto de perfil de cada persona.',
    icono: 'M4 5h16v11H8l-4 4z',
  },
  {
    titulo: 'Comentarios de voz',
    texto: 'Graba un audio con el micrófono y déjalo en la tarea: más rápido que escribir.',
    icono: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  },
  {
    titulo: 'Zona horaria de cada uno',
    texto: 'Cada trabajador elige la suya: sus días y sus horas se cuentan donde realmente trabaja.',
    icono: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z',
  },
  {
    titulo: 'Roles y permisos',
    texto: 'Administrador, supervisor y trabajador: cada uno ve y hace solo lo que le corresponde.',
    icono: 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6z',
  },
];

const PASOS = [
  { n: '1', color: 'text-[#38bdf8]', titulo: 'Crea tu empresa', texto: 'Registra tu empresa con el plan Básico. Tu cuenta queda como administrador.' },
  { n: '2', color: 'text-[#a78bfa]', titulo: 'Suma a tu equipo', texto: 'Crea las cuentas de supervisores y trabajadores, con su rol y su zona horaria.' },
  { n: '3', color: 'text-[#34d399]', titulo: 'Trabajen y midan', texto: 'Cada uno marca su día y cronometra sus tareas; tú ves el calendario y los reportes.' },
];


const boton =
  'inline-flex min-h-11 items-center justify-center rounded-xl px-[18px] text-sm font-semibold no-underline transition';
const botonPrincipal = `${boton} bg-[#38bdf8] text-[#04101f] hover:bg-[#7dd3fc]`;
const botonSecundario = `${boton} border border-[rgba(148,163,196,0.3)] text-[#e6ecfa] hover:bg-white/5`;
const titulo2 = `${fuenteTitulo.className} m-0 text-[clamp(1.8rem,3.2vw,2.6rem)] font-bold leading-[1.15] tracking-[-0.02em] text-[#f6f8ff]`;
const antetitulo = 'm-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#7dd3fc]';

/** Pagina publica de TimeFlow: puente hacia el acceso de clientes y el registro. */
export default function Inicio() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050916] text-[#e6ecfa]">
      <header className="relative z-[2] border-b border-[rgba(148,163,196,0.14)]">
        <nav
          aria-label="Principal"
          className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-[18px]"
        >
          <MarcaTimeFlow />
          <div className="flex flex-wrap items-center gap-x-[22px] gap-y-1.5 text-sm">
            <a href="#funciones" className="py-2.5 text-[#b6c2e2] no-underline hover:text-white">
              Funciones
            </a>
            <a href="#como-funciona" className="py-2.5 text-[#b6c2e2] no-underline hover:text-white">
              Cómo funciona
            </a>
            <a href="#plan" className="py-2.5 text-[#b6c2e2] no-underline hover:text-white">
              Plan Básico
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/login" className={botonSecundario}>
              Acceso clientes
            </Link>
            <Link href="/registro" className={botonPrincipal}>
              Crear cuenta gratis
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ------------------------------------------------------------ portada */}
        <section
          id="inicio"
          className="relative px-6 pb-[88px] pt-[72px] [background:radial-gradient(900px_560px_at_70%_30%,#0c1f47_0%,rgba(5,9,22,0)_70%)]"
        >
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14">
            <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-6">
              <p className="m-0 inline-flex items-center gap-2 self-start rounded-full border border-[rgba(56,189,248,0.35)] px-3 py-1.5 text-[13px] font-semibold text-[#7dd3fc]">
                <span className="h-[7px] w-[7px] rounded-full bg-[#34d399]" aria-hidden />
                Plan Básico gratis para tu equipo
              </p>
              <h1
                className={`${fuenteTitulo.className} m-0 text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#f6f8ff]`}
              >
                El tiempo de tu equipo, en un mapa.
              </h1>
              <p className="m-0 max-w-[34rem] text-lg leading-relaxed text-[#b6c2e2]">
                TimeFlow organiza cada proyecto como un mapa de tareas, registra la jornada y las sesiones de trabajo
                de cada persona, y te muestra quién trabajó en qué, cuándo y cuánto.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/registro" className={`${botonPrincipal} min-h-[52px] rounded-[14px] px-[26px] text-base font-bold`}>
                  Crear mi empresa gratis
                </Link>
                <Link href="/login" className={`${botonSecundario} min-h-[52px] rounded-[14px] px-[22px] text-base`}>
                  Ya tengo cuenta · Ingresar
                </Link>
              </div>
              <p className="m-0 text-[13px] text-[#8f9cc0]">Hasta 10 personas y 5 proyectos, sin tarjeta.</p>
            </div>

            <MapaEjemplo />
          </div>
        </section>

        {/* ---------------------------------------------------------- funciones */}
        <section id="funciones" className="border-t border-[rgba(148,163,196,0.1)] px-6 py-[88px]">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
            <div className="flex max-w-[40rem] flex-col gap-3">
              <p className={antetitulo}>Funciones</p>
              <h2 className={titulo2}>Todo lo que tu equipo necesita para medir su trabajo</h2>
            </div>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
              {FUNCIONES.map((f) => (
                <article
                  key={f.titulo}
                  className="flex flex-col gap-3 rounded-[18px] border border-[rgba(148,163,196,0.14)] bg-[#0a1328] p-6"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[rgba(56,189,248,0.12)] text-[#7dd3fc]">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={f.icono} />
                    </svg>
                  </span>
                  <h3 className={`${fuenteTitulo.className} m-0 text-[17px] font-semibold text-[#f1f5ff]`}>{f.titulo}</h3>
                  <p className="m-0 text-sm leading-relaxed text-[#a9b5d6]">{f.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ como funciona */}
        <section id="como-funciona" className="border-t border-[rgba(148,163,196,0.1)] bg-[#070d1f] px-6 py-[88px]">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
            <div className="flex max-w-[40rem] flex-col gap-3">
              <p className={antetitulo}>Cómo funciona</p>
              <h2 className={titulo2}>De la cuenta a tu primer reporte, en tres pasos</h2>
            </div>
            <ol className="m-0 grid list-none gap-4 p-0 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
              {PASOS.map((p) => (
                <li
                  key={p.n}
                  className="flex flex-col gap-2.5 rounded-[18px] border border-[rgba(148,163,196,0.14)] bg-[#0a1328] p-7"
                >
                  <span className={`${fuenteTitulo.className} text-[32px] font-extrabold ${p.color}`} aria-hidden>
                    {p.n}
                  </span>
                  <h3 className={`${fuenteTitulo.className} m-0 text-lg font-semibold text-[#f1f5ff]`}>{p.titulo}</h3>
                  <p className="m-0 text-sm leading-relaxed text-[#a9b5d6]">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --------------------------------------------------------------- plan */}
        <section id="plan" className="border-t border-[rgba(148,163,196,0.1)] px-6 py-[88px]">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-10">
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
              <p className={antetitulo}>Plan Básico</p>
              <h2 className={titulo2}>Empieza gratis, con todas las funciones</h2>
              <p className="m-0 text-base leading-relaxed text-[#b6c2e2]">
                El plan Básico trae la app completa para equipos pequeños. Si tu empresa crece, pasa a Pro o Empresa sin
                perder nada.
              </p>
              <p className="m-0 text-sm text-[#8f9cc0]">
                ¿Necesitas más usuarios o proyectos? Escríbenos a{' '}
                <a href={`mailto:${CORREO_CONTACTO}`} className="text-[#7dd3fc] hover:text-[#bae6fd]">
                  {CORREO_CONTACTO}
                </a>
                .
              </p>
            </div>
            <article className="flex min-w-0 flex-[1_1_400px] flex-col gap-5 rounded-3xl border border-[rgba(56,189,248,0.4)] bg-[#0a1328] p-8 shadow-[0_0_0_6px_rgba(56,189,248,0.06)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className={`${fuenteTitulo.className} m-0 text-[22px] font-bold text-[#f1f5ff]`}>Básico</h3>
                <p className={`${fuenteTitulo.className} m-0 text-[40px] font-extrabold text-[#f6f8ff]`}>Gratis</p>
              </div>
              <ListaPlan />
              <Link href="/registro" className={`${botonPrincipal} min-h-[52px] rounded-[14px] text-base font-bold`}>
                Crear cuenta con el plan Básico
              </Link>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-[rgba(148,163,196,0.14)] px-6 py-10">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 text-[13px] text-[#8f9cc0]">
          <p className="m-0">
            <NombreMarca className="text-[#e6ecfa]" /> · Ideas en movimiento
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
            <a href={`mailto:${CORREO_CONTACTO}`} className="text-[#b6c2e2] no-underline hover:text-white">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Ilustracion de un proyecto en el mapa: el nodo principal y cuatro tareas. */
function MapaEjemplo() {
  const tarjeta = 'absolute rounded-xl bg-[#0d1830] px-3 py-2.5';
  return (
    <figure className="m-0 min-w-0 flex-[1_1_460px]">
      <div
        role="img"
        aria-label="Ejemplo de mapa de un proyecto: un nodo principal con cuatro tareas en distintos estados"
        className="relative aspect-[1.2/1] w-full overflow-hidden rounded-3xl border border-[rgba(110,150,255,0.2)] [background:radial-gradient(rgba(148,163,184,0.14)_1px,rgba(0,0,0,0)_1px)_0_0/22px_22px,#070e22]"
      >
        <svg viewBox="0 0 120 100" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full">
          <path
            d="M60 50 L26 22 M60 50 L96 28 M60 50 L88 80 M60 50 L28 78"
            stroke="#2d5a9e"
            strokeWidth="0.6"
            strokeDasharray="2 1.6"
            fill="none"
          />
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[linear-gradient(135deg,#0ea5e9,#6366f1)] px-[18px] py-3.5 text-center text-white shadow-[0_0_0_6px_rgba(56,189,248,0.12)]">
          <p className={`${fuenteTitulo.className} m-0 text-[15px] font-bold`}>Sitio web</p>
          <p className="m-0 mt-0.5 text-xs opacity-90">3 de 4 tareas</p>
        </div>
        <div className={`${tarjeta} left-[6%] top-[10%] w-[36%] border border-[rgba(52,211,153,0.4)]`}>
          <p className="m-0 text-xs font-semibold">Diseño de inicio</p>
          <p className="m-0 mt-1 text-[11px] text-[#6ee7b7]">Completada</p>
        </div>
        <div className={`${tarjeta} right-[5%] top-[14%] w-[36%] border border-[rgba(251,191,36,0.45)]`}>
          <p className="m-0 text-xs font-semibold">Formulario de contacto</p>
          <p className="m-0 mt-1 text-[11px] text-[#fcd34d]">En progreso · 01:12:40</p>
        </div>
        <div className={`${tarjeta} bottom-[9%] right-[7%] w-[34%] border border-[rgba(56,189,248,0.4)]`}>
          <p className="m-0 text-xs font-semibold">Revisión final</p>
          <p className="m-0 mt-1 text-[11px] text-[#7dd3fc]">Por hacer</p>
        </div>
        <div className={`${tarjeta} bottom-[11%] left-[6%] w-[34%] border border-[rgba(52,211,153,0.4)]`}>
          <p className="m-0 text-xs font-semibold">Textos y fotos</p>
          <p className="m-0 mt-1 text-[11px] text-[#6ee7b7]">Completada</p>
        </div>
      </div>
      <figcaption className="mt-2.5 text-center text-xs text-[#8f9cc0]">
        Cada proyecto es un nodo; sus tareas cuelgan de él con su estado y su tiempo.
      </figcaption>
    </figure>
  );
}
