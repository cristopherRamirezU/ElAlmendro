'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  LayoutGrid,
  LogOut,
  LucideIcon,
  MessageCircle,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import { PERMISOS, PermisoCodigo } from '@/lib/rbac';
import { api, ErrorApi, Jornada, Usuario } from '@/lib/api';
import { iniciales } from '@/lib/formato';
import { ContextoSesion } from '@/lib/sesion';
import AvisoVersion from './AvisoVersion';
import ConfirmarSalida from './ConfirmarSalida';
import { ProveedorChat } from '@/lib/chat';
import { cerrarSocketChat } from '@/lib/socket';
import InsigniaChat from '@/components/chat/InsigniaChat';
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
import { colorConAlfa, COLOR_PRIMARIO_DEFECTO } from '@/lib/color';
import { TEMA_FONDO_DEFECTO, useAplicarTemaFondo } from '@/lib/tema';

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
  {
    href: '/nodos',
    texto: 'Mapa de nodos',
    icono: Workflow,
    permisoRequerido: PERMISOS.NODOS_VER_MAPA,
  },
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
    href: '/configuracion',
    texto: 'Configuración',
    icono: Settings,
    permisoRequerido: PERMISOS.CONFIGURACION_GESTIONAR,
  },
];

/**
 * Marco comun de la aplicacion: barra lateral adaptativa por RBAC,
 * cabecera y control de sesion.
 */
export default function Marco({
  activo,
  titulo,
  subtitulo,
  acciones,
  children,
}: {
  activo: string;
  titulo: string;
  subtitulo?: string;
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
  const colorPrimario = usuario?.organizacionColor || COLOR_PRIMARIO_DEFECTO;
  const temaFondo = usuario?.organizacionTema || TEMA_FONDO_DEFECTO;
  useAplicarTemaFondo(temaFondo);

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

  async function alternarJornada() {
    setAvisoJornada(null);
    try {
      await api.post(jornada ? '/jornadas/salida' : '/jornadas/entrada');
      const j = await api.get<Jornada | null>('/jornadas/actual');
      if (usuario) guardarCacheSesion({ usuario, jornada: j });
    } catch (err) {
      setAvisoJornada(err instanceof ErrorApi ? err.message : 'No se pudo actualizar la jornada.');
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

  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  async function cerrarSesion() {
    setConfirmandoSalida(false);
    cerrarSocketChat();
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
    try {
      await api.post('/jornadas/salida');
    } catch (err) {
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
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--tf-fondo)] text-sm text-[var(--tf-texto-tenue)]">
        Cargando…
      </main>
    );
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

  const contenido = (
    <ContextoSesion.Provider value={usuario}>
      <AvisoVersion />
      {confirmandoSalida && (
        <ConfirmarSalida
          onMarcarYSalir={marcarSalidaYCerrar}
          onSalirSinMarcar={cerrarSesion}
          onCancelar={() => setConfirmandoSalida(false)}
        />
      )}
      <div
        className="flex min-h-screen bg-[var(--tf-fondo)] text-[var(--tf-texto)]"
        style={{ '--color-primario': colorPrimario } as React.CSSProperties}
      >
        <aside className="hidden w-60 shrink-0 flex-col gap-1 bg-[var(--tf-superficie)] p-4 md:flex">
          <div className="mb-4 flex items-center gap-3 px-2 py-2">
            <LogoTimeFlow tamano={40} className="h-10 w-10 shrink-0" />
            <div>
              <p className="font-bold leading-tight text-[var(--tf-texto)]">TimeFlow</p>
              <p className="text-[11px] text-[var(--tf-texto-tenue)]">Jornada · Actividades</p>
            </div>
          </div>

          {seccionesVisibles.map((s) => {
            const Icono = s.icono;
            return (
              <Link
                key={s.href}
                href={s.href}
                style={
                  activo === s.href
                    ? { backgroundColor: colorConAlfa(colorPrimario, 0.15), color: colorPrimario }
                    : undefined
                }
                className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                  activo === s.href
                    ? 'font-semibold'
                    : 'text-[var(--tf-texto-tenue)] hover:translate-x-0.5 hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]'
                }`}
              >
                <Icono
                  size={18}
                  className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                  style={activo === s.href ? { color: colorPrimario } : undefined}
                />
                <span className="flex-1">{s.texto}</span>
                {s.href === '/chat' && <InsigniaChat />}
              </Link>
            );
          })}

          <div className="mt-auto border-t border-[var(--tf-borde)] pt-3">
            <button
              onClick={salir}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--tf-texto-tenue)] transition hover:bg-[var(--tf-hover)] hover:text-[var(--tf-texto)]"
            >
              <LogOut size={18} className="shrink-0" />
              Cerrar sesion
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center gap-3 bg-[var(--tf-superficie)] px-6 py-4">
            <div className="min-w-0">
              <h1 className="truncate font-bold text-[var(--tf-texto)]">{titulo}</h1>
              {subtitulo && <p className="text-xs text-[var(--tf-texto-tenue)]">{subtitulo}</p>}
            </div>
            <div className="ml-auto flex items-center gap-3">
              {avisoJornada && (
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">
                  {avisoJornada}
                </span>
              )}
              {usuario?.rol !== 'SUPER_ADMIN' && (
                <button
                  onClick={alternarJornada}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    jornada
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                      : 'border-[var(--tf-borde)] bg-[var(--tf-hover)] text-[var(--tf-texto-tenue)] hover:bg-[var(--tf-borde)]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${jornada ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`}
                  />
                  {jornada ? 'En jornada · marcar salida' : 'Marcar entrada'}
                </button>
              )}
              {acciones}
              <div
                style={{ backgroundColor: colorConAlfa(colorPrimario, 0.15), color: colorPrimario }}
                className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold"
                title={usuario?.nombreCompleto}
              >
                {iniciales(usuario?.nombreCompleto ?? '')}
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-auto p-6">{children}</div>
        </div>
      </div>
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
