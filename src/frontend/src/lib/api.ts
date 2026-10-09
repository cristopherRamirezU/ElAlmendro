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

export class ErrorApi extends Error {
  constructor(public readonly estado: number, mensaje: string) {
    super(mensaje);
  }
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${ruta}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    let mensaje = 'No se pudo completar la operacion.';
    try {
      const cuerpo = await res.json();
      mensaje = Array.isArray(cuerpo.message)
        ? cuerpo.message[0]
        : (cuerpo.message ?? mensaje);
    } catch {
      /* la respuesta no traia cuerpo JSON */
    }
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
  subirArchivo: <T>(ruta: string, formulario: FormData) =>
    fetch(`${BASE}/api${ruta}`, {
      method: 'POST',
      credentials: 'include',
      body: formulario,
    }).then(async (res) => {
      if (!res.ok) {
        let mensaje = 'No se pudo subir el archivo.';
        try {
          const cuerpo = await res.json();
          mensaje = Array.isArray(cuerpo.message) ? cuerpo.message[0] : (cuerpo.message ?? mensaje);
        } catch {
          /* sin cuerpo JSON */
        }
        throw new ErrorApi(res.status, mensaje);
      }
      return res.json() as Promise<T>;
    }),
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
}

export interface OrganizacionMia {
  id: string;
  nombre: string;
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
  emisor: { id: string; nombreCompleto: string };
}

export interface ResumenMensaje {
  cuerpo: string;
  creadoEn: string;
  propio: boolean;
}

export interface ContactoChat {
  id: string;
  nombreCompleto: string;
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
