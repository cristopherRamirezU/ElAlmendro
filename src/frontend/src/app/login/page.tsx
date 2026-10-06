'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorApi, Usuario } from '@/lib/api';
import { guardarCacheSesion, limpiarCacheSesion } from '@/lib/cacheSesion';
import LogoTimeFlow from '@/components/login/LogoTimeFlow';
import RutaTareas from '@/components/login/RutaTareas';
import '@/components/login/login.css';

const CORREO_VALIDO = /.+@.+\..+/;

/** Clase de un paso del indicador Correo → Contraseña → Entrar. */
function clasePaso(hecho: boolean, actual: boolean) {
  return `lg-paso ${hecho ? 'hecho' : actual ? 'actual' : ''}`;
}

/** US-01 — inicio de sesion. */
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const correoOk = CORREO_VALIDO.test(email);
  const claveOk = contrasena.length > 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      limpiarCacheSesion();
      const usuario = await api.post<Usuario>('/auth/login', { email, contrasena });
      // El panel se pinta de inmediato con el usuario recien autenticado.
      guardarCacheSesion({ usuario, jornada: null });
      setListo(true);
      if (usuario.rol === 'SUPER_ADMIN') {
        router.push('/saas-admin');
      } else {
        router.push('/panel');
      }
    } catch (err) {
      setError(
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo conectar con el servidor.',
      );
      setEnviando(false);
    }
  }

  return (
    <main className="lg-pantalla lg-fondo relative flex min-h-screen flex-wrap items-center overflow-hidden text-slate-100">
      {/* Fondo ligero: trama de puntos y luces difusas. */}
      <div aria-hidden className="lg-trama pointer-events-none absolute inset-0" />
      <div aria-hidden className="lg-luz" style={{ width: 520, height: 520, left: -160, bottom: -200, background: '#7c3aed' }} />
      <div aria-hidden className="lg-luz" style={{ width: 460, height: 460, left: '42%', top: -220, background: '#0ea5e9', animationDelay: '-8s' }} />
      <div aria-hidden className="lg-luz" style={{ width: 380, height: 380, right: -120, bottom: -140, background: '#10b981', animationDelay: '-14s' }} />

      {/* La ruta de tareas vive entre la marca y la tarjeta; en pantallas chicas se oculta. */}
      <RutaTareas className="absolute inset-y-0 left-[31%] hidden h-full w-[34%] min-[1000px]:block" />

      {/* En el celular la marca se compacta para que el formulario quede a la vista. */}
      <section className="relative flex min-w-0 flex-[999_1_520px] flex-col gap-7 px-6 pb-0 pt-10 sm:px-[6vw] sm:pb-4 lg:py-16">
        <div className="lg-sube flex items-center gap-4 sm:gap-5">
          <LogoTimeFlow tamano={88} className="h-14 w-14 sm:h-[88px] sm:w-[88px]" />
          <div>
            <p className="text-4xl font-extrabold leading-none tracking-[-0.04em] text-[#f4f7ff] sm:text-6xl">
              Time<span className="lg-flow">Flow</span>
            </p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.4em] text-[#8ea0c4] sm:text-xs">Ideas en movimiento</p>
          </div>
        </div>
        <p className="lg-sube-2 hidden max-w-[420px] text-xl leading-relaxed text-[#c7d2ea] sm:block">
          Organiza tus ideas, conecta tus tareas y avanza sin límites.
        </p>
        <span aria-hidden className="lg-sube-3 hidden h-1 w-[84px] rounded bg-gradient-to-r from-cyan-400 to-violet-400 sm:block" />
      </section>

      <section className="relative flex min-w-0 flex-[1_1_460px] justify-center px-6 py-10 sm:px-[6vw] lg:justify-end lg:pl-6">
        <div className="lg-marco lg-sube-2 w-full max-w-[440px]">
          <div className="lg-cuerpo flex flex-col gap-6 px-6 pb-7 pt-9 sm:px-[34px]">
            <div className="lg-sello">
              <LogoTimeFlow tamano={44} />
            </div>

            <div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.035em] text-[#f4f7ff]">
                Iniciar sesión
              </h1>
              <p className="mt-2 text-[15px] text-[#93a3c4]">Retoma tus tareas donde las dejaste.</p>
            </div>

            <div aria-hidden className="flex items-center gap-2">
              <span className={clasePaso(correoOk, true)}><i />Correo</span>
              <span className={`lg-tramo ${correoOk ? 'lleno' : ''}`} />
              <span className={clasePaso(claveOk, correoOk)}><i />Contraseña</span>
              <span className={`lg-tramo ${correoOk && claveOk ? 'lleno' : ''}`} />
              <span className={clasePaso(listo, correoOk && claveOk)}><i />Entrar</span>
            </div>

            <form onSubmit={enviar} className="flex flex-col gap-3.5">
              <div className="lg-campo">
                <input
                  id="correo"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder=" "
                  className="lg-input"
                />
                <label htmlFor="correo" className="lg-etiqueta">Correo</label>
                <svg
                  aria-hidden
                  className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#5f6f92]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7.5 12 13l9-5.5M4.5 5.5h15A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5Z"
                  />
                </svg>
              </div>

              <div className="lg-campo">
                <input
                  id="contrasena"
                  type={verContrasena ? 'text' : 'password'}
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder=" "
                  className="lg-input"
                />
                <label htmlFor="contrasena" className="lg-etiqueta">Contraseña</label>
                <button
                  type="button"
                  onClick={() => setVerContrasena((v) => !v)}
                  aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={verContrasena}
                  className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[#7f8db0] transition hover:bg-white/5 hover:text-slate-100"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {verContrasena && <path strokeLinecap="round" d="M4 4l16 16" />}
                  </svg>
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
                >
                  {error}
                </p>
              )}

              <button type="submit" disabled={enviando} className="lg-boton mt-2">
                {enviando && <span aria-hidden className="lg-giro" />}
                {listo ? 'Bienvenido' : enviando ? 'Ingresando…' : 'Ingresar'}
                {!enviando && (
                  <svg aria-hidden viewBox="0 0 24 24" className="lg-flecha h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </form>

            <p className="border-t border-white/10 pt-[18px] text-center text-[13px] text-[#7f8db0]">
              ¿Primera vez? Pide tu acceso al administrador de tu equipo.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
