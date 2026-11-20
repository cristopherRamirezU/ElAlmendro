import Link from 'next/link';
import MarcaTimeFlow, { NombreMarca } from '@/components/sitio/MarcaTimeFlow';
import { DATOS_LEGALES } from '@/lib/sitio';
import { fuenteTitulo } from '@/lib/fuentes';

export interface SeccionLegal {
  id: string;
  titulo: string;
  contenido: React.ReactNode;
}

/**
 * Marco comun de los textos legales: cabecera del sitio, indice de
 * secciones y el texto en una columna comoda de leer.
 */
export default function PaginaLegal({
  titulo,
  resumen,
  secciones,
}: {
  titulo: string;
  resumen: string;
  secciones: SeccionLegal[];
}) {
  return (
    <div className="min-h-screen bg-[#050916] text-[#e6ecfa]">
      <header className="border-b border-[rgba(148,163,196,0.14)]">
        <nav
          aria-label="Principal"
          className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-[18px]"
        >
          <MarcaTimeFlow />
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-xl border border-[rgba(148,163,196,0.3)] px-[18px] text-sm font-semibold text-[#e6ecfa] no-underline transition hover:bg-white/5"
            >
              Acceso clientes
            </Link>
            <Link
              href="/registro"
              className="inline-flex min-h-11 items-center rounded-xl bg-[#38bdf8] px-[18px] text-sm font-semibold text-[#04101f] no-underline transition hover:bg-[#7dd3fc]"
            >
              Crear cuenta gratis
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-wrap gap-12 px-6 pb-20 pt-12">
        <nav aria-label="Secciones" className="min-w-0 flex-[1_1_220px] self-start lg:sticky lg:top-6">
          <p className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#7dd3fc]">Contenido</p>
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            {secciones.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[#a9b5d6] no-underline hover:text-white">
                  {i + 1}. {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 max-w-[46rem] flex-[999_1_520px]">
          <h1
            className={`${fuenteTitulo.className} m-0 text-[clamp(2rem,3.6vw,2.8rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#f6f8ff]`}
          >
            {titulo}
          </h1>
          <p className="mb-0 mt-3 text-sm text-[#8f9cc0]">Vigente desde el {DATOS_LEGALES.vigencia}</p>
          <p className="mb-0 mt-6 rounded-2xl border border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.06)] p-5 text-[15px] leading-relaxed text-[#d6deef]">
            {resumen}
          </p>

          <div className="mt-10 flex flex-col gap-10 text-[15px] leading-[1.75] text-[#c3cde6] [&_a]:text-[#7dd3fc] hover:[&_a]:text-[#bae6fd] [&_li]:mt-1.5 [&_p]:m-0 [&_p+p]:mt-3 [&_strong]:text-[#f1f5ff] [&_ul]:m-0 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
            {secciones.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`} className="scroll-mt-6">
                <h2
                  id={`${s.id}-titulo`}
                  className={`${fuenteTitulo.className} m-0 mb-3 text-xl font-semibold text-[#f1f5ff]`}
                >
                  {i + 1}. {s.titulo}
                </h2>
                {s.contenido}
              </section>
            ))}
          </div>
        </article>
      </main>

      <footer className="border-t border-[rgba(148,163,196,0.14)] px-6 py-10">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 text-[13px] text-[#8f9cc0]">
          <p className="m-0">
            <NombreMarca className="text-[#e6ecfa]" /> · {DATOS_LEGALES.razonSocial}
          </p>
          <div className="flex flex-wrap gap-5">
            <Link href="/terminos" className="text-[#b6c2e2] no-underline hover:text-white">
              Términos de uso
            </Link>
            <Link href="/privacidad" className="text-[#b6c2e2] no-underline hover:text-white">
              Privacidad
            </Link>
            <a href={`mailto:${DATOS_LEGALES.correo}`} className="text-[#b6c2e2] no-underline hover:text-white">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
