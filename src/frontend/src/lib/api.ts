import { PermisoCodigo, Rol } from './rbac';

/**
 * Cliente de la API.
 *
 * Todas las llamadas viajan con la cookie httpOnly emitida por la API en el
 * inicio de sesion: por eso `credentials: include`. El token nunca pasa por
 * JavaScript, de modo que un script inyectado no puede leerlo.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Para construir enlaces directos (descargas) fuera del cliente `api.*`. */
export const URL_API = `${BASE}/api`;

/**
 * URL de la foto de perfil de un usuario. La version va en la URL: al cambiar
 * la foto cambia la URL y el navegador no muestra la vieja desde su cache.
 */
export function urlFotoPerfil(usuarioId: string, version: string): string {
  return `${URL_API}/fotos-perfil/${usuarioId}?v=${encodeURIComponent(version)}`;
}

export class ErrorApi extends Error {
  public readonly recuperable: boolean;
  constructor(
    public readonly estado: number,
    mensaje: string,
    opciones?: { recuperable?: boolean },
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.recuperable =
      opciones?.recuperable ??
      (estado === 0 || estado === 408 || estado === 429 || estado >= 500);
  }
}

let ultimoAvisoSesionMs = 0;

function notificarSesionExpirada(ruta: string) {
  if (typeof window === 'undefined' || ruta.startsWith('/auth/login')) return;
  const ahora = Date.now();
  if (ahora - ultimoAvisoSesionMs < 3000) return;
  ultimoAvisoSesionMs = ahora;
  window.dispatchEvent(new CustomEvent('tf:sesion-expirada'));
}

/**
 * Traduce códigos HTTP y errores de red a mensajes claros y accionables
 * en lenguaje del dominio, preservando mensajes específicos del servidor.
 */
export function traducirErrorHttp(
  estado: number,
  mensajeServidor?: string,
  ruta = '',
): string {
  const limpio = (mensajeServidor ?? '').trim();
  const esGenerico =
    !limpio ||
    /^forbidden(\s+resource)?$/i.test(limpio) ||
    /^unauthorized$/i.test(limpio) ||
    /^not found$/i.test(limpio) ||
    /^internal server error$/i.test(limpio) ||
    /^bad request$/i.test(limpio);

  if (estado === 0) {
    return 'Sin conexión con el servidor. Revisa tu red e intenta nuevamente; tus cambios escritos no se han perdido.';
  }
  if (estado === 401) {
    return !esGenerico
      ? limpio
      : 'Tu sesión expiró o dejó de ser válida. Vuelve a iniciar sesión para continuar.';
  }
  if (estado === 403) {
    if (!esGenerico) return limpio;
    if (
      ruta.includes('/actividades/posiciones') ||
      ruta.includes('/actividades/lados') ||
      ruta.includes('/bloqueo-hijas')
    ) {
      return 'No tienes permiso para editar el mapa de nodos (requiere permiso «Editar el mapa» o rol Supervisor/Administrador).';
    }
    if (ruta.startsWith('/usuarios')) {
      return 'No tienes permisos suficientes para gestionar usuarios (requiere rol Administrador o Supervisor).';
    }
    if (ruta.includes('/organizaciones/mia')) {
      return 'Solo un Administrador de la empresa puede modificar la apariencia y configuración.';
    }
    if (ruta.startsWith('/organizaciones')) {
      return 'Esta acción está reservada para el Super Administrador de la plataforma.';
    }
    if (ruta.startsWith('/proyectos') || ruta.startsWith('/actividades')) {
      return 'No tienes permiso para realizar esta acción en el proyecto o tarea. Consulta con un Administrador.';
    }
    return 'No tienes los permisos necesarios para realizar esta acción.';
  }
  if (estado === 404) {
    return !esGenerico ? limpio : 'El elemento solicitado ya no existe o fue eliminado.';
  }
  if (estado === 429) {
    return 'Demasiadas solicitudes seguidas. Espera unos segundos y vuelve a intentar.';
  }
  if (estado >= 500) {
    return !esGenerico
      ? limpio
      : 'El servidor tuvo un inconveniente temporal. Intenta nuevamente en unos segundos.';
  }
  return !esGenerico
    ? limpio
    : 'No se pudo completar la operación. Revisa los datos e intenta nuevamente.';
}

async function extraerMensajeError(
  res: Response,
  ruta: string,
  porDefecto: string,
): Promise<string> {
  let crudo = '';
  try {
    const cuerpo = await res.json();
    crudo = Array.isArray(cuerpo.message)
      ? String(cuerpo.message[0] ?? '')
      : typeof cuerpo.message === 'string'
        ? cuerpo.message
        : '';
  } catch {
    /* la respuesta no traía cuerpo JSON */
  }
  return traducirErrorHttp(res.status, crudo || porDefecto, ruta);
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${ruta}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
  } catch {
    throw new ErrorApi(0, traducirErrorHttp(0, undefined, ruta), { recuperable: true });
  }

  if (!res.ok) {
    if (res.status === 401) notificarSesionExpirada(ruta);
    const mensaje = await extraerMensajeError(res, ruta, '');
    throw new ErrorApi(res.status, mensaje);
  }

  // Nest responde con cuerpo vacio cuando el handler devuelve null, como
  // ocurre al no haber jornada abierta ni sesion activa. Ese caso es normal y
  // no debe tratarse como una respuesta invalida.
  const texto = await res.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

export const api = {
  get: <T>(ruta: string) => pedir<T>(ruta),
  post: <T>(ruta: string, cuerpo?: unknown) =>
    pedir<T>(ruta, {
      method: 'POST',
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    }),
  patch: <T>(ruta: string, cuerpo?: unknown) =>
    pedir<T>(ruta, {
      method: 'PATCH',
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    }),
  delete: <T>(ruta: string) =>
    pedir<T>(ruta, {
      method: 'DELETE',
    }),
  /** Sin Content-Type propio: el navegador arma el boundary del multipart. */
  subirArchivo: async <T>(ruta: string, formulario: FormData): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/api${ruta}`, {
        method: 'POST',
        credentials: 'include',
        body: formulario,
      });
    } catch {
      throw new ErrorApi(0, traducirErrorHttp(0, undefined, ruta), { recuperable: true });
    }
    if (!res.ok) {
      if (res.status === 401) notificarSesionExpirada(ruta);
      const mensaje = await extraerMensajeError(res, ruta, 'No se pudo subir el archivo.');
      throw new ErrorApi(res.status, mensaje);
    }
    return res.json() as Promise<T>;
  },
};

// ------------------------------- tipos -------------------------------

export interface Usuario {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: Rol;
  permisos: PermisoCodigo[];
  organizacionId?: string | null;
  organizacionNombre?: string | null;
  organizacionSlug?: string | null;
  organizacionColor?: string | null;
  organizacionTema?: string | null;
  /** Fondo del mapa de nodos elegido por el usuario (null = el de siempre). */
  fondoMapa?: string | null;
  /** Zona IANA en que trabaja (la eligio en Mi cuenta). */
  zonaHoraria?: string;
  /** Version de la foto de perfil (null = iniciales). */
  fotoPerfil?: string | null;
}

export interface OrganizacionMia {
  id: string;
  nombre: string;
  rut?: string | null;
  plan?: PlanSaaS;
  maxUsuarios?: number;
  maxProyectos?: number;
  totalUsuarios?: number;
  totalProyectos?: number;
  colorPrimario: string | null;
  temaFondo: string | null;
}

export type PlanSaaS = 'GRATIS' | 'PRO' | 'EMPRESA';

export interface OrganizacionItem {
  id: string;
  nombre: string;
  slug: string;
  rut: string | null;
  plan: PlanSaaS;
  maxUsuarios: number;
  maxProyectos: number;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
  totalUsuarios: number;
  totalProyectos: number;
}

export interface MetricasSaaS {
  totalOrganizaciones: number;
  activas: number;
  inactivas: number;
  totalUsuarios: number;
  totalProyectos: number;
  distribucionPlanes: Record<PlanSaaS, number>;
}

export interface CrearOrganizacionPayload {
  nombre: string;
  slug: string;
  rut?: string;
  plan?: PlanSaaS;
  maxUsuarios?: number;
  maxProyectos?: number;
  adminEmail?: string;
  adminNombre?: string;
  adminPassword?: string;
}

export interface ActualizarOrganizacionPayload {
  nombre?: string;
  rut?: string;
  plan?: PlanSaaS;
  maxUsuarios?: number;
  maxProyectos?: number;
  activo?: boolean;
}

export interface UsuarioItem {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: Rol;
  zonaHoraria: string;
  activo: boolean;
  creadoEn: string;
  actualizadoEn?: string;
  /** Permisos efectivos: los del rol mas los extra. */
  permisos: PermisoCodigo[];
  /** Permisos que el administrador le dio ademas de los de su rol. */
  permisosExtra?: PermisoCodigo[];
  _count?: {
    sesiones: number;
    jornadas: number;
    actividades: number;
  };
}

export interface RolCatalogoItem {
  codigo: Rol;
  nombre: string;
  descripcion: string;
  permisos: readonly PermisoCodigo[];
}

export interface Subtarea {
  id: string;
  titulo: string;
  completada: boolean;
}

export interface ProyectoItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  creadoEn: string;
  totalTareas: number;
  /** Tareas ya guardadas en el cofre: es el llenado del proyecto. */
  tareasCompletadas: number;
}

export interface TareaBusquedaItem {
  id: string;
  titulo: string;
  estado: string;
  proyectoId: string;
  proyectoNombre: string;
  responsableNombre: string;
}

export interface Actividad {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  minutosEstimados: number | null;
  segundosTrabajados: number;
  proyecto: { nombre: string };
  responsable: { id: string; nombreCompleto: string };
  subtareas: Subtarea[];
  /** Solo en el detalle: quien creo la tarea o un administrador. */
  puedeEditarInstrucciones?: boolean;
  /** Solo en el detalle: comentarios de voz, del mas antiguo al mas nuevo. */
  audios?: AudioComentario[];
  /** Solo en el detalle: quien trabaja la tarea puede grabarle audios. */
  puedeGrabarAudio?: boolean;
  /** Candado secuencial sobre las hijas directas de esta tarea. */
  bloquearOrdenHijas?: boolean;
  totalHijas?: number;
  bloqueadaPorOrden?: boolean;
  prerequisitoTitulo?: string | null;
  puedeGestionarBloqueo?: boolean;
}

/** Un comentario de voz de una tarea. */
export interface AudioComentario {
  id: string;
  segundos: number | null;
  creadoEn: string;
  autor: { id: string; nombreCompleto: string };
  /** Quien lo grabo o un administrador. */
  puedeEliminar: boolean;
}

/** Persona asignable: lo que devuelve /usuarios/trabajadores. */
export interface PersonaRef {
  id: string;
  nombre: string;
}

export interface MiembroProyecto extends PersonaRef {
  rol: string;
  activo: boolean;
  rolEnProyecto: 'LIDER' | 'MIEMBRO';
  agregadoEn: string;
}

export interface Evidencia {
  id: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanoBytes: number;
  subidaEn: string;
  subidaPor: { nombreCompleto: string };
  /** Quien lo subio o un administrador, y solo si la tarea no esta completada. */
  puedeEliminar: boolean;
}

export interface Jornada {
  id: string;
  inicioEn: string;
  terminoEn: string | null;
  estado: string;
}

export interface Sesion {
  id: string;
  estado: 'ACTIVA' | 'PAUSADA';
  inicioEn: string;
  segundosAcumulados: number;
  actividad: {
    id: string;
    titulo: string;
    proyectoId?: string;
    proyecto?: { id: string; nombre: string };
  };
}

export interface ProgresoPersonalItem {
  segundosSemana: number;
  segundosMes: number;
  diasLaborados: number;
  totalJornadas: number;
  tareasPendientes: number;
  tareasEnProgreso: number;
  tareasCompletadas: number;
}

// ------------------------------- chat -------------------------------

export interface MensajeChat {
  id: string;
  emisorId: string;
  /** null = canal general del equipo. */
  receptorId: string | null;
  cuerpo: string;
  creadoEn: string;
  leidoEn: string | null;
  emisor: { id: string; nombreCompleto: string; fotoPerfil?: string | null };
}

export interface ResumenMensaje {
  cuerpo: string;
  creadoEn: string;
  propio: boolean;
}

export interface ContactoChat {
  id: string;
  nombreCompleto: string;
  fotoPerfil?: string | null;
  rol: Rol;
  email: string;
  enLinea: boolean;
  noLeidos: number;
  ultimoMensaje: ResumenMensaje | null;
}

export interface ContactosChat {
  general: { ultimoMensaje: ResumenMensaje | null };
  contactos: ContactoChat[];
}
