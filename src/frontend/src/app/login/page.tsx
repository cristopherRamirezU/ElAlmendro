'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api, ErrorApi, Usuario } from '@/lib/api';
import { guardarCacheSesion, limpiarCacheSesion } from '@/lib/cacheSesion';

/** US-01 — inicio de sesion. */
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      limpiarCacheSesion();
      const usuario = await api.post<Usuario>('/auth/login', { email, contrasena });
      // El panel se pinta de inmediato con el usuario recien autenticado.
      guardarCacheSesion({ usuario, jornada: null });
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
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <Image
        src="/images/fondo-login.jpg"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/0 via-black/10 to-black/45" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10 lg:justify-end lg:pr-20">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/70 p-9 shadow-2xl backdrop-blur-2xl">
          <div className="mb-6 flex flex-col items-center gap-1">
            <Image
              src="/images/logo-timeflow.png"
              alt="TimeFlow"
              width={200}
              height={140}
              className="h-16 w-auto object-contain drop-shadow-[0_2px_12px_rgba(56,189,248,0.45)]"
            />
          </div>

          <h1 className="text-center text-xl font-bold text-white">
            Iniciar sesión
          </h1>
          <p className="mb-7 text-center text-sm text-slate-400">
            Ideas en movimiento
          </p>

          <form onSubmit={enviar}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Correo
            </label>
            <div className="relative mb-4">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="tu@correo.cl"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/70 focus:bg-white/10 focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Contraseña
            </label>
            <div className="relative mb-6">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 10.5V7.75a4.5 4.5 0 1 1 9 0v2.75M6 10.5h12a1 1 0 0 1 1 1v8.75a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11.5a1 1 0 0 1 1-1Z"
                />
              </svg>
              <input
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/70 focus:bg-white/10 focus:ring-2 focus:ring-sky-400/20"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="mb-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-400 hover:to-indigo-400 hover:shadow-sky-400/40 disabled:opacity-50"
            >
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
