'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import MarcaTimeFlow from '@/components/sitio/MarcaTimeFlow';
import ListaPlan, { INCLUYE_PLAN_BASICO } from '@/components/sitio/ListaPlan';
import { api, ErrorApi } from '@/lib/api';
import { CONTRASENA_MAXIMO, contrasenaValida, reglasContrasena } from '@/lib/contrasena';
import { fuenteTitulo } from '@/lib/fuentes';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const campo =
  'min-h-[46px] w-full rounded-xl border border-[rgba(148,163,196,0.3)] bg-[#050916] px-3.5 text-[15px] text-[#f1f5ff] outline-none transition focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/30 aria-[invalid=true]:border-rose-400/70';
const etiqueta = 'text-[13px] font-semibold text-[#b6c2e2]';
const leyenda = `${fuenteTitulo.className} pb-3 text-[15px] font-semibold text-[#f1f5ff]`;

/** Alta publica de una empresa con el plan Basico; luego se entra por /login. */
export default function Registro() {
  const [empresa, setEmpresa] = useState('');
  const [rut, setRut] = useState('');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [acepto, setAcepto] = useState(false);
  // Campo trampa para programas que rellenan formularios.
  const [sitioWeb, setSitioWeb] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<{ empresa: string; correo: string } | null>(null);

  const reglas = reglasContrasena(clave);
  const empresaOk = empresa.trim().length > 0;
  const nombreOk = nombre.trim().length > 0;
  const correoOk = CORREO_VALIDO.test(correo.trim());
  const claveOk = contrasenaValida(clave);
  const coincide = clave2.length > 0 && clave2 === clave;
  const valido = empresaOk && nombreOk && correoOk && claveOk && coincide && acepto;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!valido) {
      setIntentado(true);
      return;
    }
    setEnviando(true);
    try {
      const r = await api.post<{ empresa: string; correo: string }>('/registro', {
        empresa: empresa.trim(),
        rut: rut.trim() || undefined,
        nombre: nombre.trim(),
        correo: correo.trim(),
        contrasena: clave,
        aceptaTerminos: acepto,
        sitioWeb: sitioWeb || undefined,
      });
      setCreada(r);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo crear la cuenta. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050916] text-[#e6ecfa] [background:radial-gradient(900px_560px_at_20%_0%,#0c1f47_0%,rgba(5,9,22,0)_70%),#050916]">
      <header className="border-b border-[rgba(148,163,196,0.14)]">
        <nav
          aria-label="Principal"
          className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-[18px]"
        >
          <MarcaTimeFlow />
          <p className="m-0 text-sm text-[#a9b5d6]">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold text-[#7dd3fc] hover:text-[#bae6fd]">
              Acceso clientes
            </Link>
          </p>
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 pb-[72px] pt-12">
        {creada ? (
          <section
            aria-live="polite"
            className="mx-auto mt-10 flex max-w-[560px] flex-col items-center gap-4 rounded-3xl border border-[rgba(52,211,153,0.4)] bg-[#0a1328] px-8 py-10 text-center"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[rgba(52,211,153,0.14)]">
              <Check size={30} strokeWidth={2.4} className="text-[#34d399]" aria-hidden />
            </span>
            <h1 className={`${fuenteTitulo.className} m-0 text-[28px] font-bold text-[#f6f8ff]`}>Tu empresa está lista</h1>
            <p className="m-0 text-base leading-relaxed text-[#b6c2e2]">
              Creamos <strong className="text-[#f1f5ff]">{creada.empresa}</strong> con el plan Básico. Ingresa con{' '}
              <strong className="text-[#f1f5ff]">{creada.correo}</strong> y suma a tu equipo desde Usuarios.
            </p>
            <Link
              href={`/login?correo=${encodeURIComponent(creada.correo)}`}
              className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#38bdf8] px-7 text-base font-bold text-[#04101f] no-underline transition hover:bg-[#7dd3fc]"
            >
              Ir a ingresar
            </Link>
          </section>
        ) : (
          <div className="flex flex-wrap items-start gap-10">
            <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
              <div className="flex flex-col gap-2.5">
                <h1
                  className={`${fuenteTitulo.className} m-0 text-[clamp(2rem,3.6vw,2.8rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#f6f8ff]`}
                >
                  Crea tu empresa en TimeFlow
                </h1>
                <p className="m-0 text-base leading-relaxed text-[#b6c2e2]">
                  Empiezas con el plan Básico, gratis. Tu cuenta queda como administrador de la empresa.
                </p>
              </div>

              <form
                onSubmit={enviar}
                noValidate
                className="relative flex flex-col gap-[22px] rounded-[22px] border border-[rgba(148,163,196,0.16)] bg-[#0a1328] p-7"
              >
                {/* Campo trampa: invisible para las personas. */}
                <div aria-hidden className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
                  <label htmlFor="sitio-web">Sitio web</label>
                  <input
                    id="sitio-web"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={sitioWeb}
                    onChange={(e) => setSitioWeb(e.target.value)}
                  />
                </div>

                <fieldset className="m-0 grid gap-4 border-0 p-0 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                  <legend className={leyenda}>Tu empresa</legend>
                  <Campo id="empresa" texto="Nombre de la empresa" error={intentado && !empresaOk ? 'Escribe el nombre de tu empresa.' : null}>
                    <input
                      id="empresa"
                      type="text"
                      autoComplete="organization"
                      maxLength={120}
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      aria-invalid={intentado && !empresaOk}
                      className={campo}
                    />
                  </Campo>
                  <Campo id="rut" texto="RUT de la empresa" opcional>
                    <input
                      id="rut"
                      type="text"
                      maxLength={20}
                      placeholder="76.123.456-7"
                      value={rut}
                      onChange={(e) => setRut(e.target.value)}
                      className={`${campo} placeholder:text-[#5f6c8e]`}
                    />
                  </Campo>
                </fieldset>

                <fieldset className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-2">
                  <legend className={leyenda}>Tu cuenta de administrador</legend>
                  <Campo id="nombre" texto="Tu nombre completo" error={intentado && !nombreOk ? 'Escribe tu nombre.' : null}>
                    <input
                      id="nombre"
                      type="text"
                      autoComplete="name"
                      maxLength={120}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      aria-invalid={intentado && !nombreOk}
                      className={campo}
                    />
                  </Campo>
                  <Campo
                    id="correo"
                    texto="Correo"
                    error={(intentado || correo.length > 3) && !correoOk ? 'Escribe un correo válido.' : null}
                  >
                    <input
                      id="correo"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      aria-invalid={(intentado || correo.length > 3) && !correoOk}
                      className={campo}
                    />
                  </Campo>
                  <Campo id="clave" texto="Contraseña">
                    <input
                      id="clave"
                      type="password"
                      autoComplete="new-password"
                      maxLength={CONTRASENA_MAXIMO}
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      aria-describedby="reglas-clave"
                      aria-invalid={intentado && !claveOk}
                      className={campo}
                    />
                    <ul id="reglas-clave" className="m-0 mt-0.5 flex list-none flex-col gap-1 p-0" aria-label="Requisitos">
                      {reglas.map((r) => (
                        <li
                          key={r.texto}
                          className={`flex items-center gap-1.5 text-xs ${r.cumple ? 'text-[#6ee7b7]' : 'text-[#a9b5d6]'}`}
                        >
                          {r.cumple ? <Check size={13} strokeWidth={3} aria-hidden /> : <Circle size={11} aria-hidden />}
                          {r.texto}
                          <span className="sr-only">{r.cumple ? '(cumple)' : '(falta)'}</span>
                        </li>
                      ))}
                    </ul>
                  </Campo>
                  <Campo
                    id="clave2"
                    texto="Repite la contraseña"
                    error={clave2.length > 0 && !coincide ? 'No coincide con la contraseña.' : intentado && !coincide ? 'Repite la contraseña.' : null}
                  >
                    <input
                      id="clave2"
                      type="password"
                      autoComplete="new-password"
                      maxLength={CONTRASENA_MAXIMO}
                      value={clave2}
                      onChange={(e) => setClave2(e.target.value)}
                      aria-invalid={clave2.length > 0 && !coincide}
                      className={campo}
                    />
                  </Campo>
                </fieldset>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="acepto" className="flex cursor-pointer items-start gap-2.5 text-sm leading-normal text-[#b6c2e2]">
                    <input
                      id="acepto"
                      type="checkbox"
                      checked={acepto}
                      onChange={(e) => setAcepto(e.target.checked)}
                      className="mt-0.5 h-5 w-5 flex-none accent-[#38bdf8]"
                    />
                    <span>
                      Acepto los{' '}
                      <a href="/terminos" target="_blank" rel="noopener" className="text-[#7dd3fc] hover:text-[#bae6fd]">
                        términos de uso
                      </a>{' '}
                      y la{' '}
                      <a href="/privacidad" target="_blank" rel="noopener" className="text-[#7dd3fc] hover:text-[#bae6fd]">
                        política de privacidad
                      </a>
                      .
                    </span>
                  </label>
                  {intentado && !acepto && <p className="m-0 pl-[30px] text-xs text-rose-300">Debes aceptar para continuar.</p>}
                </div>

                {error && (
                  <p role="alert" className="m-0 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3.5">
                  <button
                    type="submit"
                    disabled={enviando}
                    aria-disabled={!valido}
                    className={`min-h-[52px] rounded-[14px] bg-[#38bdf8] px-7 text-base font-bold text-[#04101f] transition hover:bg-[#7dd3fc] disabled:cursor-wait ${
                      valido ? '' : 'opacity-50'
                    }`}
                  >
                    {enviando ? 'Creando tu empresa…' : 'Crear cuenta'}
                  </button>
                  <p className="m-0 text-[13px] text-[#8f9cc0]">Plan Básico · gratis · sin tarjeta</p>
                </div>
              </form>
            </section>

            <aside
              aria-label="Resumen del plan"
              className="flex min-w-0 flex-[1_1_300px] flex-col gap-[18px] rounded-[22px] border border-[rgba(56,189,248,0.4)] bg-[#0a1328] p-7"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className={`${fuenteTitulo.className} m-0 text-xl font-bold text-[#f1f5ff]`}>Plan Básico</h2>
                <p className={`${fuenteTitulo.className} m-0 text-[26px] font-extrabold text-[#f6f8ff]`}>Gratis</p>
              </div>
              <ListaPlan items={INCLUYE_PLAN_BASICO.slice(0, 5)} compacta />
              <p className="m-0 border-t border-[rgba(148,163,196,0.14)] pt-3.5 text-[13px] leading-relaxed text-[#8f9cc0]">
                Si tu equipo crece, pasas a Pro o Empresa sin perder tus datos.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function Campo({
  id,
  texto,
  opcional,
  error,
  children,
}: {
  id: string;
  texto: string;
  opcional?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={etiqueta}>
        {texto} {opcional && <span className="font-normal text-[#8f9cc0]">(opcional)</span>}
      </label>
      {children}
      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
