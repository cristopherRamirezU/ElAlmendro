import { diaRelativo, duracion, ESTADOS, etiquetaPlan, etiquetaRol, hora } from './formato';
import { PERMISOS_EXTRA } from './rbac';

export interface CambioHumano {
  etiqueta: string;
  antes?: string;
  despues: string;
  colorAntes?: string;
  colorDespues?: string;
}

const ACCIONES_HUMANAS: Record<string, string> = {
  INICIO_SESION: 'inició sesión en la plataforma',
  INICIO_SESION_FALLIDO: 'intentó iniciar sesión con credenciales incorrectas',
  INICIO_SESION_BLOQUEADO: 'superó el límite de intentos al iniciar sesión',
  CIERRE_SESION: 'cerró sesión',
  SESIONES_CERRADAS: 'cerró sesión en todos los dispositivos',
  CONTRASENA_CAMBIADA: 'cambió su contraseña',
  ORGANIZACION_CREADA: 'creó una nueva empresa',
  ORGANIZACION_ACTUALIZADA: 'actualizó la configuración de la empresa',
  ORGANIZACION_COLOR_ACTUALIZADO: 'actualizó la apariencia de la empresa',
  REGISTRO_PUBLICO: 'registró una nueva empresa desde la web',
  PROYECTO_CREADO: 'creó un proyecto',
  PROYECTO_ELIMINADO: 'eliminó un proyecto',
  PROYECTO_MIEMBRO_AGREGADO: 'sumó a un integrante al proyecto',
  PROYECTO_MIEMBRO_QUITADO: 'retiró a un integrante del proyecto',
  ACTIVIDAD_CREADA: 'creó una actividad',
  ACTIVIDAD_REASIGNADA: 'derivó una actividad a otro responsable',
  ACTIVIDAD_ESTADO_ACTUALIZADO: 'cambió el estado de una actividad',
  ACTIVIDAD_CAMBIO_ESTADO: 'cambió el estado de una actividad',
  ACTIVIDAD_INSTRUCCIONES: 'editó las instrucciones de una actividad',
  ACTIVIDAD_BLOQUEO_SECUENCIAL: 'cambió el candado secuencial de una actividad',
  ACTIVIDAD_ELIMINADA: 'eliminó una actividad',
  ACTIVIDAD_AUDIO_AGREGADO: 'agregó una nota de voz en una actividad',
  ACTIVIDAD_AUDIO_QUITADO: 'eliminó una nota de voz de una actividad',
  JORNADA_ABIERTA: 'inició su jornada laboral',
  JORNADA_CERRADA: 'cerró su jornada laboral',
  SESION_INICIADA: 'inició el cronómetro en una actividad',
  SESION_PAUSADA: 'pausó el cronómetro de una actividad',
  SESION_REANUDADA: 'reanudó el cronómetro de una actividad',
  SESION_CERRADA: 'finalizó una sesión de trabajo',
  SESION_AUTOCERRADA: 'autocerró una sesión vencida (>10 h)',
  EVIDENCIA_SUBIDA: 'adjuntó una evidencia',
  EVIDENCIA_ELIMINADA: 'eliminó una evidencia',
  USUARIO_CREADO: 'creó una cuenta de usuario',
  USUARIO_ACTUALIZADO: 'actualizó los datos de un usuario',
  USUARIO_PERMISOS: 'actualizó los permisos adicionales de un usuario',
  USUARIO_ELIMINADO: 'desactivó o eliminó una cuenta de usuario',
};

const ETIQUETAS_CAMPO: Record<string, string> = {
  temaFondo: 'Tema visual',
  colorPrimario: 'Color de marca',
  nombre: 'Nombre',
  nombreCompleto: 'Nombre completo',
  email: 'Correo electrónico',
  correo: 'Correo electrónico',
  empresa: 'Empresa',
  rut: 'RUT',
  rol: 'Rol',
  rolEnProyecto: 'Rol en el proyecto',
  plan: 'Plan',
  maxUsuarios: 'Límite de usuarios',
  maxProyectos: 'Límite de proyectos',
  activo: 'Estado de la cuenta',
  estado: 'Estado',
  desenlace: 'Resultado de la sesión',
  motivo: 'Motivo',
  notaCierre: 'Nota de cierre',
  permisosExtra: 'Permisos adicionales',
  bloquearOrdenHijas: 'Orden secuencial en subtareas',
  nombreArchivo: 'Archivo adjunto',
  titulo: 'Título',
  descripcion: 'Descripción',
  minutosEstimados: 'Tiempo estimado',
  fechaLimite: 'Fecha límite',
  zonaHoraria: 'Zona horaria',
  segundos: 'Duración',
  metodo: 'Acción aplicada',
  tareasAfectadas: 'Tareas afectadas',
  eliminado: 'Eliminación',
  eliminadoEn: 'Fecha de eliminación',
  cuentaExiste: 'Cuenta registrada',
};

const NOMBRES_TEMA: Record<string, string> = {
  'oscuro-medianoche': 'Oscuro Medianoche',
  'oscuro-grafito': 'Oscuro Grafito',
  'claro-nube': 'Claro Nube',
  'claro-arena': 'Claro Arena',
};

const DESENLACES: Record<string, string> = {
  COMPLETADA: 'Completada',
  INCONCLUSA: 'Inconclusa',
};

const METODOS_BAJA: Record<string, string> = {
  SOFT_DELETE: 'Desactivación de cuenta',
  HARD_DELETE: 'Eliminación definitiva',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_REGEX = /^#[0-9a-f]{6}$/i;
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function etiquetaCampo(clave: string): string {
  if (ETIQUETAS_CAMPO[clave]) return ETIQUETAS_CAMPO[clave];
  const separada = clave
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
  return separada.charAt(0).toUpperCase() + separada.slice(1);
}

function nombrePermiso(codigo: string): string {
  const encontrado = PERMISOS_EXTRA.find((p) => p.codigo === codigo);
  if (encontrado) return encontrado.nombre;
  if (codigo === 'nodos:editar') return 'Editar el mapa';
  if (codigo === 'actividades:eliminar') return 'Eliminar tareas';
  return codigo.replace(/[:_]/g, ' ');
}

function formatearValor(clave: string, valor: unknown): { texto: string; colorHex?: string } {
  if (valor === null || valor === undefined || valor === '') {
    return { texto: 'Sin especificar' };
  }

  if (clave === 'temaFondo' && typeof valor === 'string') {
    return { texto: NOMBRES_TEMA[valor] ?? valor.replace(/-/g, ' ') };
  }
  if (clave === 'colorPrimario' && typeof valor === 'string') {
    const hex = valor.trim();
    return { texto: hex.toUpperCase(), colorHex: HEX_REGEX.test(hex) ? hex : undefined };
  }
  if (clave === 'rol' && typeof valor === 'string') {
    return { texto: etiquetaRol(valor) };
  }
  if (clave === 'rolEnProyecto' && typeof valor === 'string') {
    return { texto: valor === 'LIDER' ? 'Líder' : valor === 'OBSERVADOR' ? 'Observador' : 'Miembro' };
  }
  if (clave === 'plan' && typeof valor === 'string') {
    return { texto: etiquetaPlan(valor) };
  }
  if (clave === 'estado' && typeof valor === 'string') {
    if (valor in ESTADOS) return { texto: ESTADOS[valor].texto };
    if (valor === 'ACTIVO') return { texto: 'Activo' };
    if (valor === 'PAUSADO') return { texto: 'Pausado' };
    if (valor === 'CERRADO') return { texto: 'Cerrado' };
    return { texto: valor.toLowerCase().replace(/_/g, ' ') };
  }
  if (clave === 'desenlace' && typeof valor === 'string') {
    return { texto: DESENLACES[valor] ?? valor };
  }
  if (clave === 'metodo' && typeof valor === 'string') {
    return { texto: METODOS_BAJA[valor] ?? valor };
  }
  if (clave === 'permisosExtra' && Array.isArray(valor)) {
    if (valor.length === 0) return { texto: 'Ninguno' };
    return { texto: valor.map((v) => nombrePermiso(String(v))).join(', ') };
  }
  if (typeof valor === 'boolean') {
    if (clave === 'activo' || clave === 'bloquearOrdenHijas') {
      return { texto: valor ? 'Activado' : 'Desactivado' };
    }
    return { texto: valor ? 'Sí' : 'No' };
  }
  if (typeof valor === 'number') {
    if (clave === 'minutosEstimados') return { texto: `${valor} min` };
    if (clave === 'segundos') return { texto: duracion(valor) };
    return { texto: String(valor) };
  }
  if (typeof valor === 'string') {
    if (HEX_REGEX.test(valor.trim())) {
      return { texto: valor.trim().toUpperCase(), colorHex: valor.trim() };
    }
    if (ISO_REGEX.test(valor) && !Number.isNaN(new Date(valor).getTime())) {
      return { texto: `${diaRelativo(valor)} a las ${hora(valor)}` };
    }
    if (UUID_REGEX.test(valor)) {
      return { texto: 'Elemento del sistema' };
    }
    return { texto: valor };
  }
  if (Array.isArray(valor)) {
    return { texto: valor.length === 0 ? 'Ninguno' : valor.map(String).join(', ') };
  }
  if (esObjeto(valor)) {
    const partes = Object.entries(valor)
      .filter(([, v]) => v !== undefined && v !== null && !UUID_REGEX.test(String(v)))
      .map(([k, v]) => `${etiquetaCampo(k)}: ${formatearValor(k, v).texto}`);
    return { texto: partes.join(' · ') || 'Actualizado' };
  }

  return { texto: String(valor) };
}

/** Traduce un código de acción de auditoría a lenguaje natural. */
export function describirAccionHistorial(accion: string): string {
  if (ACCIONES_HUMANAS[accion]) return ACCIONES_HUMANAS[accion];
  return accion.toLowerCase().replace(/_/g, ' ');
}

/**
 * Convierte `valorAnterior` y `valorNuevo` en un resumen humano y una lista de
 * cambios legibles, ocultando UUIDs internos y evitando mostrar JSON crudo.
 */
export function construirDetalleHumano(
  accion: string,
  valorAnterior: unknown,
  valorNuevo: unknown,
): { resumen: string; cambios: CambioHumano[] } {
  const antObj = esObjeto(valorAnterior) ? valorAnterior : null;
  const nueObj = esObjeto(valorNuevo) ? valorNuevo : null;

  const claves = Array.from(
    new Set([...(antObj ? Object.keys(antObj) : []), ...(nueObj ? Object.keys(nueObj) : [])]),
  );

  const cambios: CambioHumano[] = [];

  for (const clave of claves) {
    // Ocultar identificadores internos en crudo que no aportan contexto humano.
    if (clave.endsWith('Id') && typeof (nueObj?.[clave] ?? antObj?.[clave]) === 'string') {
      const valStr = String(nueObj?.[clave] ?? antObj?.[clave]);
      if (UUID_REGEX.test(valStr)) continue;
    }

    const tieneAnt = antObj !== null && clave in antObj && antObj[clave] !== undefined;
    const tieneNue = nueObj !== null && clave in nueObj && nueObj[clave] !== undefined;

    if (tieneAnt && tieneNue) {
      const fAnt = formatearValor(clave, antObj[clave]);
      const fNue = formatearValor(clave, nueObj[clave]);
      if (fAnt.texto === fNue.texto) continue;
      cambios.push({
        etiqueta: etiquetaCampo(clave),
        antes: fAnt.texto,
        despues: fNue.texto,
        colorAntes: fAnt.colorHex,
        colorDespues: fNue.colorHex,
      });
    } else if (tieneNue) {
      const fNue = formatearValor(clave, nueObj[clave]);
      cambios.push({
        etiqueta: etiquetaCampo(clave),
        despues: fNue.texto,
        colorDespues: fNue.colorHex,
      });
    } else if (tieneAnt) {
      const fAnt = formatearValor(clave, antObj[clave]);
      cambios.push({
        etiqueta: `${etiquetaCampo(clave)} previo`,
        despues: fAnt.texto,
        colorDespues: fAnt.colorHex,
      });
    }
  }

  let resumen = `Evento: ${describirAccionHistorial(accion)}.`;
  if (accion === 'ORGANIZACION_COLOR_ACTUALIZADO' && cambios.length > 0) {
    resumen = 'Se actualizó la apariencia visual de la empresa.';
  } else if (accion === 'PROYECTO_MIEMBRO_AGREGADO') {
    resumen = 'Se incorporó un nuevo integrante al equipo del proyecto.';
  } else if (accion === 'PROYECTO_MIEMBRO_QUITADO') {
    resumen = 'Se retiró a un integrante del equipo del proyecto.';
  } else if (accion === 'PROYECTO_ELIMINADO') {
    resumen = 'Se eliminó el proyecto junto con sus tareas asociadas.';
  } else if (cambios.length === 0 && (valorAnterior !== null || valorNuevo !== null)) {
    resumen = `Se completó la acción (${describirAccionHistorial(accion)}) sin cambios visibles de texto.`;
  }

  return { resumen, cambios };
}
