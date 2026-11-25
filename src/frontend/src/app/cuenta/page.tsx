'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Check, Eye, EyeOff, Globe, KeyRound, LogOut, MonitorSmartphone, Trash2, X } from 'lucide-react';
import Marco from '@/components/Marco';
import RecortadorFotoPerfil from '@/components/cuenta/RecortadorFotoPerfil';
import Avatar from '@/components/ui/Avatar';
import SelectorZona from '@/components/ui/SelectorZona';
import { api, ErrorApi, type Usuario } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { guardarCacheSesion, leerCacheSesion, limpiarCacheSesion } from '@/lib/cacheSesion';
import { colorConAlfa, useColorPrimario } from '@/lib/color';
import { esZonaValida, nombreZona, ZONA_POR_DEFECTO, zonaDelNavegador } from '@/lib/zona';
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
    <Marco activo="/cuenta" titulo="Mi cuenta" subtitulo="Tus datos, tu foto, tu zona horaria y tu seguridad">
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
          {usuario?.rol === 'ADMINISTRADOR' ? (
            <>
              Puedes editar tu nombre o tu correo desde{' '}
              <Link href="/usuarios" className="font-semibold text-sky-400 hover:underline">
                Usuarios y Roles
              </Link>
              .
            </>
          ) : (
            'Para cambiar tu nombre o tu correo, pídeselo al administrador de tu empresa.'
          )}
        </p>
      </section>

      <FotoPerfil />
      <ZonaHoraria />
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

// --------------------------------------------------------- foto de perfil

/** Tope del archivo original, antes de encuadrarlo y reducirlo en el navegador. */
const MAXIMO_ORIGINAL_MB = 15;

/** Actualiza el usuario en la cache de sesion: la cabecera y el chat lo ven al instante. */
function actualizarUsuarioEnCache(cambios: Partial<Usuario>) {
  const cache = leerCacheSesion();
  if (cache?.usuario) guardarCacheSesion({ ...cache, usuario: { ...cache.usuario, ...cambios } });
}

function FotoPerfil() {
  const usuario = useSesion();
  const colorPrimario = useColorPrimario();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setMensaje(null);
    if (!archivo.type.startsWith('image/')) {
      setMensaje({ tipo: 'error', texto: 'Elige una imagen (JPG, PNG o WebP).' });
      return;
    }
    if (archivo.size > MAXIMO_ORIGINAL_MB * 1024 * 1024) {
      setMensaje({ tipo: 'error', texto: `La imagen no puede superar ${MAXIMO_ORIGINAL_MB} MB.` });
      return;
    }
    setArchivoPendiente(archivo);
  }

  async function subirRecorte(foto: Blob) {
    setEnviando(true);
    setMensaje(null);
    try {
      const formulario = new FormData();
      formulario.append('foto', foto, 'foto');
      const r = await api.subirArchivo<{ fotoPerfil: string }>('/auth/yo/foto', formulario);
      actualizarUsuarioEnCache({ fotoPerfil: r.fotoPerfil });
      setArchivoPendiente(null);
      setMensaje({ tipo: 'exito', texto: 'Foto actualizada. Tus compañeros la verán en el chat.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof ErrorApi ? err.message : 'No se pudo subir la foto.' });
      setArchivoPendiente(null);
    } finally {
      setEnviando(false);
    }
  }

  async function quitar() {
    setMensaje(null);
    setEnviando(true);
    try {
      await api.delete('/auth/yo/foto');
      actualizarUsuarioEnCache({ fotoPerfil: null });
      setMensaje({ tipo: 'exito', texto: 'Foto quitada: se mostrarán tus iniciales.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof ErrorApi ? err.message : 'No se pudo quitar la foto.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-6">
      <h2 className="flex items-center gap-2 font-bold text-[var(--tf-texto)]">
        <Camera size={18} aria-hidden /> Foto de perfil
      </h2>
      <p className="mt-1 text-sm text-[var(--tf-texto-tenue)]">
        Aparece en el chat y en la cabecera. Puedes ajustar y encuadrar tu foto antes de guardarla.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Avatar
          id={usuario?.id ?? ''}
          nombre={usuario?.nombreCompleto ?? ''}
          foto={usuario?.fotoPerfil}
          style={{ backgroundColor: colorConAlfa(colorPrimario, 0.15), color: colorPrimario }}
          className="h-20 w-20 text-2xl font-bold"
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={elegir}
            className="hidden"
            aria-hidden
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={enviando}
            style={{ color: 'var(--tf-texto-primario)' }}
            className="rounded-xl bg-[var(--color-primario)] px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-40"
          >
            {enviando ? 'Guardando…' : usuario?.fotoPerfil ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {usuario?.fotoPerfil && (
            <button
              type="button"
              onClick={quitar}
              disabled={enviando}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] disabled:opacity-40"
            >
              <Trash2 size={15} aria-hidden /> Quitar
            </button>
          )}
        </div>
      </div>

      {archivoPendiente && (
        <RecortadorFotoPerfil
          archivo={archivoPendiente}
          colorPrimario={colorPrimario}
          enviando={enviando}
          onCancelar={() => setArchivoPendiente(null)}
          onConfirmar={subirRecorte}
        />
      )}

      {mensaje && <Aviso {...mensaje} />}
    </section>
  );
}

// ----------------------------------------------------------- zona horaria

function ZonaHoraria() {
  const usuario = useSesion();
  const guardada = esZonaValida(usuario?.zonaHoraria) ? usuario!.zonaHoraria! : ZONA_POR_DEFECTO;
  const [zona, setZona] = useState(guardada);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [ahora, setAhora] = useState(() => new Date());
  const delEquipo = useMemo(() => zonaDelNavegador(), []);

  // Si la sesion llega despues (o cambia en otra pestaña), el selector la sigue.
  useEffect(() => setZona(guardada), [guardada]);

  // La vista previa de la hora avanza sola.
  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function guardar() {
    setMensaje(null);
    setEnviando(true);
    try {
      const r = await api.patch<{ zonaHoraria: string }>('/auth/yo/zona-horaria', { zonaHoraria: zona });
      actualizarUsuarioEnCache({ zonaHoraria: r.zonaHoraria });
      setMensaje({ tipo: 'exito', texto: 'Zona horaria guardada. Tus horas y tus días ya se cuentan en ella.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof ErrorApi ? err.message : 'No se pudo guardar la zona.' });
    } finally {
      setEnviando(false);
    }
  }

  const horaEn = (z: string) =>
    ahora.toLocaleString('es-CL', { timeZone: z, weekday: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <section className="rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-6">
      <h2 className="flex items-center gap-2 font-bold text-[var(--tf-texto)]">
        <Globe size={18} aria-hidden /> Zona horaria
      </h2>
      <p className="mt-1 text-sm text-[var(--tf-texto-tenue)]">
        La zona en la que trabajas. Con ella se muestran todas las horas en la app y se cuentan tus días de
        trabajo (calendario, avance semanal y mensual).
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <label htmlFor="zona-horaria" className="text-xs font-semibold text-[var(--tf-texto-tenue)]">
          Zona
        </label>
        <SelectorZona
          id="zona-horaria"
          value={zona}
          onChange={setZona}
          disabled={enviando}
          className="w-full rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-fondo)] px-3 py-2.5 text-sm text-[var(--tf-texto)] outline-none transition focus:border-[var(--color-primario)] focus:ring-2 focus:ring-[var(--color-primario)]/30"
        />
        <p className="text-xs text-[var(--tf-texto-tenue)]">
          Ahora allí es <span className="font-medium text-[var(--tf-texto)]">{horaEn(zona)}</span>
          {delEquipo && delEquipo !== zona && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => setZona(delEquipo)}
                className="font-medium text-[var(--color-primario)] underline-offset-2 hover:underline"
              >
                Usar la de este equipo ({nombreZona(delEquipo)})
              </button>
            </>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={guardar}
        disabled={enviando || zona === guardada}
        style={{ color: 'var(--tf-texto-primario)' }}
        className="mt-4 rounded-xl bg-[var(--color-primario)] px-5 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enviando ? 'Guardando…' : 'Guardar zona horaria'}
      </button>

      {mensaje && <Aviso {...mensaje} />}
    </section>
  );
}

function Aviso({ tipo, texto }: { tipo: 'exito' | 'error'; texto: string }) {
  return (
    <p
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`mt-4 rounded-xl border p-3 text-sm ${
        tipo === 'exito'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
      }`}
    >
      {texto}
    </p>
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
            style={{ color: 'var(--tf-texto-primario)' }}
            className="rounded-xl bg-[var(--color-primario)] px-5 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
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
