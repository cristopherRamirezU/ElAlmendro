'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, KeyRound, LogOut, MonitorSmartphone, X } from 'lucide-react';
import Marco from '@/components/Marco';
import { api, ErrorApi } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { limpiarCacheSesion } from '@/lib/cacheSesion';
import { cerrarSocketChat } from '@/lib/socket';
import { limpiarBolsaAbierta } from '@/lib/tesoro';
import { CONTRASENA_MAXIMO, contrasenaValida, reglasContrasena } from '@/lib/contrasena';

const NOMBRE_ROL: Record<string, string> = {
  SUPER_ADMIN: 'Super administrador',
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor',
  TRABAJADOR: 'Trabajador',
};

export default function CuentaPage() {
  return (
    <Marco activo="/cuenta" titulo="Mi cuenta" subtitulo="Tus datos, tu contraseña y tus sesiones">
      <ContenidoCuenta />
    </Marco>
  );
}

function ContenidoCuenta() {
  const usuario = useSesion();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className="rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-6">
        <h2 className="font-bold text-[var(--tf-texto)]">Tus datos</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Dato etiqueta="Nombre" valor={usuario?.nombreCompleto} />
          <Dato etiqueta="Correo" valor={usuario?.email} />
          <Dato etiqueta="Rol" valor={usuario ? NOMBRE_ROL[usuario.rol] ?? usuario.rol : undefined} />
          {usuario?.organizacionNombre && <Dato etiqueta="Empresa" valor={usuario.organizacionNombre} />}
        </dl>
        <p className="mt-4 text-xs text-[var(--tf-texto-tenue)]">
          Para cambiar tu nombre o tu correo, pídeselo al administrador de tu empresa.
        </p>
      </section>

      <CambiarContrasena />
      <CerrarTodas />
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--tf-texto-tenue)]">{etiqueta}</dt>
      <dd className="truncate font-medium text-[var(--tf-texto)]">{valor || '—'}</dd>
    </div>
  );
}

// ------------------------------------------------------------ contrasena

function CambiarContrasena() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [visible, setVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const idReglas = useId();
  const correo = useSesion()?.email ?? '';

  const reglas = reglasContrasena(nueva);
  const coinciden = repetida.length > 0 && repetida === nueva;
  const listo = actual.length > 0 && contrasenaValida(nueva) && coinciden && nueva !== actual && !enviando;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo) return;
    setMensaje(null);
    setEnviando(true);
    try {
      await api.patch('/auth/yo/contrasena', { actual, nueva });
      setActual('');
      setNueva('');
      setRepetida('');
      setMensaje({
        tipo: 'exito',
        texto: 'Contraseña actualizada. Por seguridad se cerró la sesión en tus otros dispositivos.',
      });
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err instanceof ErrorApi ? err.message : 'No se pudo cambiar la contraseña.',
      });
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    'w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-fondo)] px-3 py-2.5 text-sm text-[var(--tf-texto)] outline-none transition focus:border-[var(--color-primario)] focus:ring-2 focus:ring-[var(--color-primario)]/30';

  return (
    <section className="rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-6">
      <h2 className="flex items-center gap-2 font-bold text-[var(--tf-texto)]">
        <KeyRound size={18} aria-hidden /> Cambiar contraseña
      </h2>
      <p className="mt-1 text-sm text-[var(--tf-texto-tenue)]">
        Al cambiarla, se cierra la sesión en tus otros dispositivos. En este sigues dentro.
      </p>

      {mensaje && (
        <p
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          className={`mt-4 rounded-xl border p-3 text-sm ${
            mensaje.tipo === 'exito'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      <form onSubmit={enviar} className="mt-4 flex flex-col gap-4" noValidate>
        {/* Campo de usuario oculto: ayuda al gestor de contrasenas a asociar la clave nueva. */}
        <input type="email" name="username" autoComplete="username" value={correo} readOnly hidden />
        <div>
          <label htmlFor="clave-actual" className="mb-1 block text-xs font-semibold text-[var(--tf-texto-tenue)]">
            Contraseña actual
          </label>
          <input
            id="clave-actual"
            type={visible ? 'text' : 'password'}
            autoComplete="current-password"
            maxLength={256}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="clave-nueva" className="mb-1 block text-xs font-semibold text-[var(--tf-texto-tenue)]">
            Contraseña nueva
          </label>
          <input
            id="clave-nueva"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={CONTRASENA_MAXIMO}
            aria-describedby={idReglas}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className={campo}
          />
          <ul id={idReglas} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Requisitos">
            {reglas.map((r) => (
              <li
                key={r.texto}
                className={`flex items-center gap-1 ${r.cumple ? 'text-emerald-500' : 'text-[var(--tf-texto-tenue)]'}`}
              >
                {r.cumple ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
                {r.texto}
                <span className="sr-only">{r.cumple ? '(cumple)' : '(falta)'}</span>
              </li>
            ))}
            {nueva.length > 0 && nueva === actual && (
              <li className="text-rose-400">Debe ser distinta de la actual</li>
            )}
          </ul>
        </div>

        <div>
          <label htmlFor="clave-repetida" className="mb-1 block text-xs font-semibold text-[var(--tf-texto-tenue)]">
            Repite la contraseña nueva
          </label>
          <input
            id="clave-repetida"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={CONTRASENA_MAXIMO}
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            aria-invalid={repetida.length > 0 && !coinciden}
            className={campo}
          />
          {repetida.length > 0 && !coinciden && (
            <p className="mt-1 text-xs text-rose-400">No coincide con la contraseña nueva.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!listo}
            className="rounded-xl bg-[var(--color-primario)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
          >
            {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            {visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
          </button>
        </div>
      </form>
    </section>
  );
}

// -------------------------------------------------------------- sesiones

function CerrarTodas() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const botonConfirmar = useRef<HTMLButtonElement>(null);
  const botonAbrir = useRef<HTMLButtonElement>(null);
  // Al cancelar, el foco vuelve al boton que abrio la confirmacion.
  const devolverFoco = useRef(false);

  useEffect(() => {
    if (confirmando) botonConfirmar.current?.focus();
    else if (devolverFoco.current) {
      devolverFoco.current = false;
      botonAbrir.current?.focus();
    }
  }, [confirmando]);

  function cancelar() {
    devolverFoco.current = true;
    setConfirmando(false);
  }

  async function cerrarTodas() {
    setError(null);
    setEnviando(true);
    try {
      await api.post('/auth/cerrar-todas');
      cerrarSocketChat();
      limpiarCacheSesion();
      limpiarBolsaAbierta();
      router.replace('/login');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron cerrar las sesiones.');
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-6">
      <h2 className="flex items-center gap-2 font-bold text-[var(--tf-texto)]">
        <MonitorSmartphone size={18} aria-hidden /> Sesiones abiertas
      </h2>
      <p className="mt-1 text-sm text-[var(--tf-texto-tenue)]">
        Si iniciaste sesión en un computador ajeno o perdiste tu celular, cierra la sesión en todos los
        dispositivos. Tendrás que volver a ingresar también en este. Tu jornada no se cierra.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
          {error}
        </p>
      )}

      {confirmando ? (
        <div
          role="group"
          aria-label="Confirmar cierre de todas las sesiones"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !enviando) cancelar();
          }}
        >
          <span className="text-sm text-[var(--tf-texto)]">¿Cerrar la sesión en todos tus dispositivos?</span>
          <button
            ref={botonConfirmar}
            onClick={cerrarTodas}
            disabled={enviando}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {enviando ? 'Cerrando…' : 'Sí, cerrar todas'}
          </button>
          <button
            onClick={cancelar}
            disabled={enviando}
            className="rounded-xl px-4 py-2 text-sm text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          ref={botonAbrir}
          onClick={() => setConfirmando(true)}
          className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10"
        >
          <LogOut size={16} aria-hidden /> Cerrar sesión en todos los dispositivos
        </button>
      )}
    </section>
  );
}
