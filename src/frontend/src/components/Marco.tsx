'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  Calendar,
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUp,
  History,
  Keyboard,
  LayoutGrid,
  LogOut,
  LucideIcon,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { PERMISOS, PermisoCodigo } from '@/lib/rbac';
import { api, ErrorApi, Jornada, Sesion, Usuario } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import { ContextoSesion } from '@/lib/sesion';
import AvisoVersion from './AvisoVersion';
import ConfirmarSalida from './ConfirmarSalida';
import InterruptorJornada from './ui/InterruptorJornada';
import { ProveedorChat } from '@/lib/chat';
import { cerrarSocketChat } from '@/lib/socket';
import { cerrarSocketNotificaciones } from '@/lib/notificaciones';
import ChatFlotante from '@/components/chat/ChatFlotante';
import InsigniaChat from '@/components/chat/InsigniaChat';
import CampanaNotificaciones from '@/components/CampanaNotificaciones';
import LogoTimeFlow from '@/components/login/LogoTimeFlow';
import '@/components/login/login.css';
import {
  guardarCacheSesion,
  leerCacheSesion,
  leerCacheSesionServidor,
  limpiarCacheSesion,
  suscribirCacheSesion,
} from '@/lib/cacheSesion';
import { precalentarRutas } from '@/lib/precalentar';
import { limpiarBolsaAbierta } from '@/lib/tesoro';
import {
  aplicarColorMarcaEnDocumento,
  colorConAlfa,
  COLOR_PRIMARIO_DEFECTO,
  colorRgb,
  colorSecundarioDeMarca,
  colorTextoSobre,
} from '@/lib/color';
import { TEMA_FONDO_DEFECTO, useAplicarTemaFondo } from '@/lib/tema';
import FondoAmbiental from './FondoAmbiental';
import { EsqueletoPagina } from './ui/Esqueleto';
import AtajosTeclado, { abrirPanelAtajos } from './ui/AtajosTeclado';

/** La barra lateral escondida se recuerda en este navegador. */
const CLAVE_BARRA = 'tf_barra_oculta';
/** La cabecera superior retraida en mapas se recuerda en este navegador. */
const CLAVE_CABECERA = 'tf_cabecera_oculta';

interface SeccionNav {
  href: string;
  texto: string;
  icono: LucideIcon;
  permisoRequerido?: PermisoCodigo;
}

const SECCIONES: SeccionNav[] = [
  {
    href: '/saas-admin',
    texto: 'Consola SaaS',
    icono: ShieldCheck,
    permisoRequerido: PERMISOS.ORGANIZACIONES_GESTIONAR,
  },
  {
    href: '/panel',
    texto: 'Proyectos',
    icono: LayoutGrid,
    permisoRequerido: PERMISOS.ACTIVIDADES_VER_PROPIAS,
  },
  {
    href: '/calendario',
    texto: 'Calendario',
    icono: Calendar,
    permisoRequerido: PERMISOS.CALENDARIO_VER_PROPIO,
  },
  // El mapa de nodos no va en el menu: se entra desde la ventana de cada
  // proyecto (Proyectos > un planeta > Ir al mapa de nodos).
  {
    href: '/reportes',
    texto: 'Reportes',
    icono: BarChart3,
    permisoRequerido: PERMISOS.REPORTES_VER_EQUIPO,
  },
  {
    href: '/usuarios',
    texto: 'Usuarios y Roles',
    icono: Users,
    permisoRequerido: PERMISOS.USUARIOS_GESTIONAR,
  },
  {
    href: '/chat',
    texto: 'Chat del equipo',
    icono: MessageCircle,
    permisoRequerido: PERMISOS.CHAT_USAR,
  },
  {
    href: '/historial',
    texto: 'Historial',
    icono: History,
    permisoRequerido: PERMISOS.HISTORIAL_VER,
  },
  {
    href: '/configuracion',
    texto: 'Configuración',
    icono: Settings,
    permisoRequerido: PERMISOS.CONFIGURACION_GESTIONAR,
  },
  {
    href: '/manual',
    texto: 'Manual de uso',
    icono: BookOpen,
  },
];

interface DatosControlesMarco {
  usuario: Usuario | null;
  jornada: Jornada | null;
  jornadaPendiente: boolean | null;
  avisoJornada: string | null;
  tareaAbierta: Sesion['actividad'] | null;
  colorPrimario: string;
  textoSobreSuave: string;
  alternarJornada: () => void;
  irATareaAbierta: () => void;
  descartarAvisoJornada: () => void;
}

const ContextoControlesMarco = createContext<DatosControlesMarco | null>(null);

/**
 * Controles globales de usuario (InterruptorJornada, CampanaNotificaciones y Avatar)
 * para insertarlos en la fila unica superior de /panel y /nodos en escritorio.
 */
export function ControlesUsuarioBarra({ className = '' }: { className?: string }) {
  const ctx = useContext(ContextoControlesMarco);
  if (!ctx || !ctx.usuario) return null;

  const {
    usuario,
    jornada,
    jornadaPendiente,
    avisoJornada,
    tareaAbierta,
    colorPrimario,
    textoSobreSuave,
    alternarJornada,
    irATareaAbierta,
    descartarAvisoJornada,
  } = ctx;

  return (
    <div className={`hidden shrink-0 items-center gap-2 md:flex ${className}`}>
      {usuario.rol !== 'SUPER_ADMIN' && (
        <div className="relative shrink-0">
          <InterruptorJornada
            variante="cabecera"
            compactarHora
            encendido={Boolean(jornada)}
            pendiente={jornadaPendiente}
            desde={jornada?.inicioEn}
            onAlternar={alternarJornada}
          />
          {avisoJornada && (
            <div
              role="alert"
              className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-rose-500/35 bg-[var(--tf-superficie-solida)] p-3 text-xs font-medium text-[var(--tf-acento-rojo)] shadow-2xl backdrop-blur"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="leading-relaxed">{avisoJornada}</p>
                <button
                  type="button"
                  onClick={descartarAvisoJornada}
                  aria-label="Cerrar aviso de jornada"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
                >
                  <X size={13} aria-hidden />
                </button>
              </div>
              {tareaAbierta && (
                <button
                  type="button"
                  onClick={irATareaAbierta}
                  title={`Ir a «${tareaAbierta.titulo}» para cerrar su cronómetro`}
                  className="mt-2 inline-flex rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-[var(--tf-texto)] transition hover:bg-rose-500/35"
                >
                  Ir a la tarea →
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <CampanaNotificaciones posicion="cabecera" />
      <Link
        href="/cuenta"
        className="shrink-0 rounded-full transition hover:brightness-110"
        title={`${usuario.nombreCompleto ?? ''} · Mi cuenta`}
        aria-label={`Mi cuenta (${usuario.nombreCompleto ?? ''})`}
      >
        <Avatar
          id={usuario.id ?? ''}
          nombre={usuario.nombreCompleto ?? ''}
          foto={usuario.fotoPerfil}
          style={{ backgroundColor: colorConAlfa(colorPrimario, 0.16), color: textoSobreSuave }}
          className="h-9 w-9 text-xs font-bold"
        />
      </Link>
    </div>
  );
}

/**
 * Marco comun de la aplicacion: barra lateral adaptativa por RBAC,
 * cabecera y control de sesion.
 */
export default function Marco({
  activo,
  titulo,
  subtitulo,
  tituloOculto = false,
  permitirOcultarCabecera = false,
  controlesEnSidebar = false,
  compacto = false,
  acciones,
  children,
}: {
  activo: string;
  titulo: string;
  subtitulo?: string;
  /** El titulo queda solo para lectores de pantalla (la cabecera no lo muestra). */
  tituloOculto?: boolean;
  /** Permite replegar la cabecera superior para ampliar vistas de mapas. */
  permitirOcultarCabecera?: boolean;
  /** En escritorio oculta la cabecera superior para integrar los controles en la barra de la vista. */
  controlesEnSidebar?: boolean;
  /** Reduce el relleno del contenedor principal para aprovechar mas el alto/ancho. */
  compacto?: boolean;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Usuario y jornada salen de la cache de sesion: si ya hay una, la pantalla
  // se pinta al instante y la API solo confirma en segundo plano (y expulsa al
  // login si la sesion ya no vale). En el servidor la cache es null, asi que
  // el HTML inicial es "Cargando…" tanto en servidor como en cliente.
  const cache = useSyncExternalStore(suscribirCacheSesion, leerCacheSesion, leerCacheSesionServidor);
  const usuario: Usuario | null = cache?.usuario ?? null;
  const jornada: Jornada | null = cache?.jornada ?? null;
  const [respondio, setRespondio] = useState(false);
  const listo = usuario !== null || respondio;
  const [avisoJornada, setAvisoJornada] = useState<string | null>(null);
  // Posicion pedida al interruptor mientras el servidor la confirma.
  const [jornadaPendiente, setJornadaPendiente] = useState<boolean | null>(null);
  // Si la salida se rechaza porque hay un cronometro corriendo, la tarea donde
  // corre: el aviso ofrece ir directo a ella para cerrarlo.
  const [tareaAbierta, setTareaAbierta] = useState<Sesion['actividad'] | null>(null);
  const colorPrimario = usuario?.organizacionColor || COLOR_PRIMARIO_DEFECTO;
  const colorSecundario = colorSecundarioDeMarca(colorPrimario);
  const textoPrimario = colorTextoSobre(colorPrimario);
  const temaFondo = usuario?.organizacionTema || TEMA_FONDO_DEFECTO;
  useAplicarTemaFondo(temaFondo);
  const textoSobreSuave =
    temaFondo === 'claro-nube' && textoPrimario === '#0f172a' ? '#0f172a' : colorPrimario;

  useEffect(() => {
    aplicarColorMarcaEnDocumento(document, colorPrimario);
  }, [colorPrimario]);

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        // Las dos peticiones son independientes: en paralelo, no en cascada.
        const [u, j] = await Promise.all([
          api.get<Usuario>('/auth/yo'),
          api.get<Jornada | null>('/jornadas/actual'),
        ]);
        if (!vigente) return;
        guardarCacheSesion({ usuario: u, jornada: j });
      } catch (err) {
        if (err instanceof ErrorApi && err.estado === 401) {
          limpiarCacheSesion();
          router.replace('/login');
          return;
        }
      } finally {
        if (vigente) setRespondio(true);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [router]);

  /**
   * Busca la sesion de cronometro abierta, para ofrecer ir a su tarea cuando
   * la salida se rechaza por ella.
   */
  async function buscarTareaAbierta() {
    const sesion = await api.get<Sesion | null>('/sesiones/activa').catch(() => null);
    setTareaAbierta(sesion?.actividad.proyectoId ? sesion.actividad : null);
  }

  /** Lleva al mapa del proyecto con el popup de la tarea abierta. */
  function irATareaAbierta() {
    if (!tareaAbierta?.proyectoId) return;
    const nombre = tareaAbierta.proyecto?.nombre ?? 'Proyecto';
    setAvisoJornada(null);
    setTareaAbierta(null);
    setConfirmandoSalida(false);
    router.push(
      // `abrir` cambia en cada clic: aunque ya se este en ese mapa con esa
      // tarea en la direccion, el popup se vuelve a abrir.
      `/nodos?proyectoId=${tareaAbierta.proyectoId}&nombre=${encodeURIComponent(nombre)}&tarea=${tareaAbierta.id}&abrir=${Date.now()}`,
    );
  }

  async function alternarJornada() {
    setAvisoJornada(null);
    setTareaAbierta(null);
    setJornadaPendiente(!jornada);
    try {
      await api.post(jornada ? '/jornadas/salida' : '/jornadas/entrada');
      const j = await api.get<Jornada | null>('/jornadas/actual');
      if (usuario) guardarCacheSesion({ usuario, jornada: j });
    } catch (err) {
      setAvisoJornada(err instanceof ErrorApi ? err.message : 'No se pudo actualizar la jornada.');
      if (jornada) await buscarTareaAbierta();
    } finally {
      setJornadaPendiente(null);
    }
  }

  // Con la jornada abierta, cerrar o recargar la pestaña pide confirmacion: el
  // navegador muestra su propio aviso (su texto no se puede personalizar).
  useEffect(() => {
    if (!jornada) return;
    function alSalirDeLaPagina(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', alSalirDeLaPagina);
    return () => window.removeEventListener('beforeunload', alSalirDeLaPagina);
  }, [jornada]);

  // Barra lateral y cabecera superior: se pueden esconder con la flecha para ampliar el modulo.
  const [barraOculta, setBarraOculta] = useState(false);
  const [cabeceraOculta, setCabeceraOculta] = useState(false);
  const [menuMovil, setMenuMovil] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_BARRA) === 'si') setBarraOculta(true);
      if (permitirOcultarCabecera && window.localStorage.getItem(CLAVE_CABECERA) === 'si') {
        setCabeceraOculta(true);
      }
    } catch {
      /* almacenamiento bloqueado: queda visible */
    }
  }, [permitirOcultarCabecera]);
  useEffect(() => {
    if (!permitirOcultarCabecera && !controlesEnSidebar) return;
    const raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(raf);
  }, [cabeceraOculta, barraOculta, permitirOcultarCabecera, controlesEnSidebar]);
  useEffect(() => {
    setMenuMovil(false);
  }, [activo]);
  useEffect(() => {
    if (!menuMovil) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuMovil(false);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [menuMovil]);
  function alternarBarra() {
    setBarraOculta((v) => {
      try {
        window.localStorage.setItem(CLAVE_BARRA, v ? 'no' : 'si');
      } catch {
        /* sin persistencia, pero el cambio aplica igual */
      }
      return !v;
    });
  }
  function alternarCabecera() {
    setCabeceraOculta((v) => {
      try {
        window.localStorage.setItem(CLAVE_CABECERA, v ? 'no' : 'si');
      } catch {
        /* sin persistencia, pero el cambio aplica igual */
      }
      return !v;
    });
  }
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  async function cerrarSesion() {
    setConfirmandoSalida(false);
    cerrarSocketChat();
    cerrarSocketNotificaciones();
    limpiarCacheSesion();
    limpiarBolsaAbierta();
    await api.post('/auth/logout');
    router.replace('/login');
  }

  /** "Cerrar sesion": con la jornada abierta, primero se ofrece marcar la salida. */
  function salir() {
    if (jornada) setConfirmandoSalida(true);
    else cerrarSesion();
  }

  async function marcarSalidaYCerrar() {
    setTareaAbierta(null);
    try {
      await api.post('/jornadas/salida');
    } catch (err) {
      await buscarTareaAbierta();
      throw new Error(err instanceof ErrorApi ? err.message : 'No se pudo marcar la salida.');
    }
    await cerrarSesion();
  }

  // En desarrollo, compila por adelantado las demas pantallas del menu.
  useEffect(() => {
    if (!usuario) return;
    const rutas = SECCIONES.filter(
      (s) => !s.permisoRequerido || usuario.permisos?.includes(s.permisoRequerido),
    ).map((s) => s.href);
    precalentarRutas(rutas.filter((h) => h !== activo));
  }, [usuario, activo]);

  if (!listo) {
    return <EsqueletoPagina />;
  }

  // Filtrado RBAC: los usuarios solo ven los módulos que tienen autorizados
  const seccionesVisibles = SECCIONES.filter((s) => {
    if (!s.permisoRequerido) return true;
    return usuario?.permisos?.includes(s.permisoRequerido) ?? false;
  }).map((s) => {
    if (s.href === '/panel') {
      if (usuario?.rol === 'TRABAJADOR') return { ...s, texto: 'Mi Progreso' };
      if (usuario?.rol === 'SUPERVISOR') return { ...s, texto: 'Supervisión' };
      return { ...s, texto: 'Proyectos' };
    }
    return s;
  });

  // En /chat la pantalla completa reemplaza al desplegable.
  const conChatFlotante = Boolean(usuario?.permisos?.includes(PERMISOS.CHAT_USAR)) && activo !== '/chat';

  const contenido = (
    <ContextoSesion.Provider value={usuario}>
      <ContextoControlesMarco.Provider
        value={{
          usuario,
          jornada,
          jornadaPendiente,
          avisoJornada,
          tareaAbierta,
          colorPrimario,
          textoSobreSuave,
          alternarJornada,
          irATareaAbierta,
          descartarAvisoJornada: () => {
            setAvisoJornada(null);
            setTareaAbierta(null);
          },
        }}
      >
      <AvisoVersion />
      {confirmandoSalida && (
        <ConfirmarSalida
          onMarcarYSalir={marcarSalidaYCerrar}
          onSalirSinMarcar={cerrarSesion}
          onCancelar={() => setConfirmandoSalida(false)}
          onIrATarea={tareaAbierta ? irATareaAbierta : undefined}
          tituloTarea={tareaAbierta?.titulo}
        />
      )}
      <div
        className="relative isolate flex min-h-screen bg-[var(--tf-fondo)] text-[var(--tf-texto)]"
        style={
          {
            '--color-primario': colorPrimario,
            '--color-primario-2': colorSecundario,
            '--tf-primario-rgb': colorRgb(colorPrimario),
            '--tf-primario-2-rgb': colorRgb(colorSecundario),
            '--tf-texto-primario': textoPrimario,
            '--tf-sangria-izq-barra': controlesEnSidebar && barraOculta ? '6.25rem' : '0px',
          } as React.CSSProperties
        }
      >
        <FondoAmbiental colorPrimario={colorPrimario} />

        {controlesEnSidebar && barraOculta && (
          <button
            type="button"
            onClick={alternarBarra}
            title={
              jornada
                ? 'Mostrar barra lateral · En jornada activa'
                : 'Mostrar barra lateral · Fuera de jornada'
            }
            aria-label={
              jornada
                ? 'Mostrar barra lateral (En jornada activa)'
                : 'Mostrar barra lateral (Fuera de jornada)'
            }
            className="fixed left-4 top-3 z-40 hidden h-9 items-center gap-2 rounded-full border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)]/95 px-2.5 text-[var(--tf-texto-tenue)] shadow-lg backdrop-blur-md transition hover:border-[var(--color-primario)] hover:text-[var(--tf-texto)] md:inline-flex"
          >
            <LogoTimeFlow tamano={20} className="h-5 w-5 shrink-0" />
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
              {jornada && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  jornada
                    ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                    : 'bg-slate-400 ring-4 ring-slate-400/15'
                }`}
              />
            </span>
            <ChevronsRight size={15} aria-hidden />
          </button>
        )}

        <aside
          className={`relative z-30 w-60 shrink-0 flex-col gap-1 border-r border-[var(--tf-borde)] bg-[var(--tf-sidebar)] p-4 backdrop-blur-xl ${barraOculta ? 'hidden' : 'hidden md:flex'}`}
        >
          <div className="mb-4 flex items-center gap-3 border-b border-[var(--tf-borde)] px-2 pb-4 pt-1">
            <LogoTimeFlow tamano={40} className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="tf-display text-[15px] font-bold leading-tight text-[var(--tf-texto)]">TimeFlow</p>
              <p className="text-[11px] text-[var(--tf-texto-tenue)]">Jornada · Actividades</p>
            </div>
            <button
              type="button"
              onClick={alternarBarra}
              title="Esconder la barra lateral"
              aria-label="Esconder la barra lateral"
              className="-mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
            >
              <ChevronsLeft size={18} aria-hidden />
            </button>
          </div>

          {seccionesVisibles.map((s) => {
            const Icono = s.icono;
            const esActivo = activo === s.href;
            return (
              <Link
                key={s.href}
                href={s.href}
                style={
                  esActivo
                    ? {
                        background: `linear-gradient(90deg, ${colorConAlfa(colorPrimario, 0.16)}, ${colorConAlfa(colorPrimario, 0.03)})`,
                        borderColor: colorConAlfa(colorPrimario, 0.28),
                        color: 'var(--tf-texto)',
                      }
                    : undefined
                }
                className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
                  esActivo
                    ? 'font-semibold'
                    : 'border-transparent text-[var(--tf-texto-tenue)] hover:translate-x-0.5 hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
                }`}
              >
                {esActivo && (
                  <span
                    aria-hidden
                    className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full"
                    style={{ backgroundColor: colorPrimario, boxShadow: `0 0 10px ${colorPrimario}` }}
                  />
                )}
                <Icono
                  size={18}
                  className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                  style={esActivo ? { color: colorPrimario } : undefined}
                />
                <span className="flex-1">{s.texto}</span>
                {s.href === '/chat' && <InsigniaChat />}
              </Link>
            );
          })}

          <div className="mt-auto">
            <div className="border-t border-[var(--tf-borde)] pt-3">
              <Link
                href="/cuenta"
                style={
                  activo === '/cuenta'
                    ? { backgroundColor: colorConAlfa(colorPrimario, 0.15), color: textoSobreSuave }
                    : undefined
                }
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  activo === '/cuenta'
                    ? 'font-semibold'
                    : 'text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
                }`}
              >
                <UserCog size={18} className="shrink-0" />
                Mi cuenta
              </Link>
              <button
                type="button"
                onClick={abrirPanelAtajos}
                className="flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
              >
                <span className="flex items-center gap-2.5">
                  <Keyboard size={16} className="shrink-0" aria-hidden />
                  Atajos de teclado
                </span>
                <kbd className="rounded border border-[var(--tf-borde-fuerte)] bg-[var(--tf-hover)] px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                  ?
                </kbd>
              </button>
              <button
                onClick={salir}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
              >
                <LogOut size={18} className="shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </aside>

        {menuMovil && (
          <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setMenuMovil(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[1px]"
            />
            <aside className="relative z-10 flex h-full w-72 max-w-[82vw] flex-col gap-1 border-r border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] p-4 shadow-2xl">
              <div className="mb-4 flex items-center gap-3 px-2 py-2">
                <LogoTimeFlow tamano={36} className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight text-[var(--tf-texto)]">TimeFlow</p>
                  <p className="text-[11px] text-[var(--tf-texto-tenue)]">Jornada · Actividades</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuMovil(false)}
                  aria-label="Cerrar menú"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>

              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
                {seccionesVisibles.map((s) => {
                  const Icono = s.icono;
                  return (
                    <Link
                      key={s.href}
                      href={s.href}
                      onClick={() => setMenuMovil(false)}
                      style={
                        activo === s.href
                          ? { backgroundColor: colorConAlfa(colorPrimario, 0.15), color: colorPrimario }
                          : undefined
                      }
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                        activo === s.href
                          ? 'font-semibold'
                          : 'text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
                      }`}
                    >
                      <Icono size={18} className="shrink-0" style={activo === s.href ? { color: colorPrimario } : undefined} />
                      <span className="flex-1">{s.texto}</span>
                      {s.href === '/chat' && <InsigniaChat />}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto border-t border-[var(--tf-borde)] pt-3">
                <Link
                  href="/cuenta"
                  onClick={() => setMenuMovil(false)}
                  style={
                    activo === '/cuenta'
                      ? { backgroundColor: colorConAlfa(colorPrimario, 0.15), color: colorPrimario }
                      : undefined
                  }
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    activo === '/cuenta'
                      ? 'font-semibold'
                      : 'text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
                  }`}
                >
                  <UserCog size={18} className="shrink-0" />
                  Mi cuenta
                </Link>
                <button
                  onClick={() => {
                    setMenuMovil(false);
                    salir();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
                >
                  <LogOut size={18} className="shrink-0" />
                  Cerrar sesión
                </button>
              </div>
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {!controlesEnSidebar && permitirOcultarCabecera && cabeceraOculta ? (
            <div className="pointer-events-none sticky top-0 z-30 flex items-start justify-center px-3">
              <div className="pointer-events-auto inline-flex items-center gap-1 rounded-b-xl border border-t-0 border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] px-2 py-1 text-[11px] font-medium text-[var(--tf-texto-tenue)] shadow-md backdrop-blur">
                {barraOculta && (
                  <button
                    type="button"
                    onClick={alternarBarra}
                    title="Mostrar la barra lateral"
                    aria-label="Mostrar la barra lateral"
                    className="hidden items-center gap-1 rounded-lg px-1.5 py-0.5 transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] md:inline-flex"
                  >
                    <ChevronsRight size={14} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={alternarCabecera}
                  title="Desplegar cabecera"
                  aria-label="Desplegar cabecera"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
                >
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${jornada ? 'bg-emerald-500' : 'bg-slate-400'}`}
                  />
                  <ChevronsDown size={14} aria-hidden />
                  <span>Cabecera</span>
                </button>
              </div>
            </div>
          ) : (
            <header
              className={`relative z-30 flex flex-wrap items-center gap-3 border-b border-[var(--tf-borde)] bg-[var(--tf-sidebar)] px-4 py-3.5 backdrop-blur-xl md:px-6 md:py-4 ${
                controlesEnSidebar ? 'md:hidden' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setMenuMovil(true)}
                aria-label="Abrir menú de navegación"
                aria-expanded={menuMovil}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] md:hidden"
              >
                <Menu size={18} aria-hidden />
              </button>
              {barraOculta && (
                <button
                  type="button"
                  onClick={alternarBarra}
                  title="Mostrar la barra lateral"
                  aria-label="Mostrar la barra lateral"
                  className="hidden h-9 items-center gap-2 rounded-xl pl-1 pr-3 text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] md:flex"
                >
                  <LogoTimeFlow tamano={28} className="h-7 w-7 shrink-0" />
                  <ChevronsRight size={16} aria-hidden />
                </button>
              )}
              {tituloOculto ? (
                <h1 className="sr-only">{titulo}</h1>
              ) : (
                <div className="min-w-0">
                  <h1 className="tf-display truncate text-lg font-bold text-[var(--tf-texto)]">{titulo}</h1>
                  {subtitulo && <p className="text-xs text-[var(--tf-texto-tenue)]">{subtitulo}</p>}
                </div>
              )}
              <div className="ml-auto flex items-center gap-3">
                {avisoJornada && (
                  <span className="flex items-center gap-2 rounded-full border border-rose-500/35 bg-rose-500/10 py-1 pl-3 pr-1 text-xs font-medium text-[var(--tf-acento-rojo)]">
                    {avisoJornada}
                    {tareaAbierta ? (
                      <button
                        onClick={irATareaAbierta}
                        title={`Ir a «${tareaAbierta.titulo}» para cerrar su cronómetro`}
                        className="rounded-full bg-rose-500/20 px-2.5 py-0.5 font-semibold text-[var(--tf-texto)] transition hover:bg-rose-500/35"
                      >
                        Ir a la tarea →
                      </button>
                    ) : (
                      <span className="pr-2" />
                    )}
                  </span>
                )}
                {usuario?.rol !== 'SUPER_ADMIN' && (
                  <InterruptorJornada
                    encendido={Boolean(jornada)}
                    pendiente={jornadaPendiente}
                    desde={jornada?.inicioEn}
                    onAlternar={alternarJornada}
                  />
                )}
                {acciones}
                {usuario && <CampanaNotificaciones />}
                <Link
                  href="/cuenta"
                  className="rounded-full transition hover:brightness-110"
                  title={`${usuario?.nombreCompleto ?? ''} · Mi cuenta`}
                  aria-label={`Mi cuenta (${usuario?.nombreCompleto ?? ''})`}
                >
                  <Avatar
                    id={usuario?.id ?? ''}
                    nombre={usuario?.nombreCompleto ?? ''}
                    foto={usuario?.fotoPerfil}
                    style={{ backgroundColor: colorConAlfa(colorPrimario, 0.16), color: textoSobreSuave }}
                    className="h-9 w-9 text-xs font-bold"
                  />
                </Link>
                {permitirOcultarCabecera && !controlesEnSidebar && (
                  <button
                    type="button"
                    onClick={alternarCabecera}
                    title="Ocultar cabecera para ampliar el mapa"
                    aria-label="Ocultar cabecera para ampliar el mapa"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--tf-borde)] text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
                  >
                    <ChevronsUp size={17} aria-hidden />
                  </button>
                )}
                {/* En celular la barra lateral no se ve: aqui queda la salida. */}
                <button
                  onClick={salir}
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                  className="grid h-9 w-9 place-items-center rounded-full text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)] md:hidden"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </header>
          )}

          <div
            className={`min-h-0 flex-1 overflow-auto ${
              compacto ? 'px-4 py-3 pb-3' : 'p-6'
            } ${conChatFlotante && !compacto ? 'pb-16' : ''}`}
          >
            {children}
          </div>
        </div>
      </div>
      {usuario && conChatFlotante && <ChatFlotante yoId={usuario.id} />}
      <AtajosTeclado activo={activo} />
      </ContextoControlesMarco.Provider>
    </ContextoSesion.Provider>
  );

  // El socket de chat solo se abre con sesion valida: sin usuario no hay
  // presencia que anunciar ni cookie que el gateway pueda verificar.
  const conChat = usuario ? (
    <ProveedorChat usuarioId={usuario.id}>{contenido}</ProveedorChat>
  ) : (
    contenido
  );

  // El proveedor del tesoro vive en el layout raiz, no aqui: cada pantalla
  // monta su propio Marco, de modo que si la ventana de la bolsa colgara de
  // este componente se cerraria en cada navegacion.
  return conChat;
}
