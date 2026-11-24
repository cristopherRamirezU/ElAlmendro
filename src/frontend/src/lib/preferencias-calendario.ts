export type EstiloCelda = 'limpio' | 'calor';

export interface PreferenciasCalendario {
  estiloCelda: EstiloCelda;
  mostrarResumenMes: boolean;
  mostrarHoras: boolean;
  mostrarPersonasSesiones: boolean;
  mostrarBarraAvance: boolean;
  mostrarAlertas: boolean;
  mostrarFinesDeSemana: boolean;
  mostrarSinRegistroEnDetalle: boolean;
  mostrarProyectoEnSesion: boolean;
}

export const PREFERENCIAS_CALENDARIO_DEFECTO: PreferenciasCalendario = {
  estiloCelda: 'limpio',
  mostrarResumenMes: true,
  mostrarHoras: true,
  mostrarPersonasSesiones: false,
  mostrarBarraAvance: false,
  mostrarAlertas: true,
  mostrarFinesDeSemana: true,
  mostrarSinRegistroEnDetalle: false,
  mostrarProyectoEnSesion: false,
};

const CLAVE_STORAGE = 'timeflow:calendario:prefs:v1';

/** Lee las preferencias guardadas del calendario de forma segura en cliente. */
export function leerPreferenciasCalendario(): PreferenciasCalendario {
  if (typeof window === 'undefined') return PREFERENCIAS_CALENDARIO_DEFECTO;
  try {
    const bruto = window.localStorage.getItem(CLAVE_STORAGE);
    if (!bruto) return PREFERENCIAS_CALENDARIO_DEFECTO;
    const dato = JSON.parse(bruto) as Partial<PreferenciasCalendario> | null;
    if (!dato || typeof dato !== 'object') return PREFERENCIAS_CALENDARIO_DEFECTO;

    return {
      estiloCelda: dato.estiloCelda === 'calor' ? 'calor' : 'limpio',
      mostrarResumenMes:
        typeof dato.mostrarResumenMes === 'boolean'
          ? dato.mostrarResumenMes
          : PREFERENCIAS_CALENDARIO_DEFECTO.mostrarResumenMes,
      mostrarHoras:
        typeof dato.mostrarHoras === 'boolean'
          ? dato.mostrarHoras
          : PREFERENCIAS_CALENDARIO_DEFECTO.mostrarHoras,
      mostrarPersonasSesiones:
        typeof dato.mostrarPersonasSesiones === 'boolean'
          ? dato.mostrarPersonasSesiones
          : PREFERENCIAS_CALENDARIO_DEFECTO.mostrarPersonasSesiones,
      mostrarBarraAvance:
        typeof dato.mostrarBarraAvance === 'boolean'
          ? dato.mostrarBarraAvance
          : PREFERENCIAS_CALENDARIO_DEFECTO.mostrarBarraAvance,
      mostrarAlertas:
        typeof dato.mostrarAlertas === 'boolean'
          ? dato.mostrarAlertas
          : PREFERENCIAS_CALENDARIO_DEFECTO.mostrarAlertas,
      mostrarFinesDeSemana:
        typeof dato.mostrarFinesDeSemana === 'boolean'
          ? dato.mostrarFinesDeSemana
          : PREFERENCIAS_CALENDARIO_DEFECTO.mostrarFinesDeSemana,
      mostrarSinRegistroEnDetalle:
        typeof dato.mostrarSinRegistroEnDetalle === 'boolean'
          ? dato.mostrarSinRegistroEnDetalle
          : PREFERENCIAS_CALENDARIO_DEFECTO.mostrarSinRegistroEnDetalle,
      mostrarProyectoEnSesion:
        typeof dato.mostrarProyectoEnSesion === 'boolean'
          ? dato.mostrarProyectoEnSesion
          : PREFERENCIAS_CALENDARIO_DEFECTO.mostrarProyectoEnSesion,
    };
  } catch {
    return PREFERENCIAS_CALENDARIO_DEFECTO;
  }
}

/** Persiste las preferencias del calendario sin lanzar errores en navegacion privada. */
export function guardarPreferenciasCalendario(prefs: PreferenciasCalendario): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(prefs));
  } catch {
    // Ignorado cuando storage esta restringido.
  }
}

/** Indica si alguna preferencia difiere de los valores por defecto. */
export function esPersonalizada(prefs: PreferenciasCalendario): boolean {
  return (
    prefs.estiloCelda !== PREFERENCIAS_CALENDARIO_DEFECTO.estiloCelda ||
    prefs.mostrarResumenMes !== PREFERENCIAS_CALENDARIO_DEFECTO.mostrarResumenMes ||
    prefs.mostrarHoras !== PREFERENCIAS_CALENDARIO_DEFECTO.mostrarHoras ||
    prefs.mostrarPersonasSesiones !== PREFERENCIAS_CALENDARIO_DEFECTO.mostrarPersonasSesiones ||
    prefs.mostrarBarraAvance !== PREFERENCIAS_CALENDARIO_DEFECTO.mostrarBarraAvance ||
    prefs.mostrarAlertas !== PREFERENCIAS_CALENDARIO_DEFECTO.mostrarAlertas ||
    prefs.mostrarFinesDeSemana !== PREFERENCIAS_CALENDARIO_DEFECTO.mostrarFinesDeSemana ||
    prefs.mostrarSinRegistroEnDetalle !==
      PREFERENCIAS_CALENDARIO_DEFECTO.mostrarSinRegistroEnDetalle ||
    prefs.mostrarProyectoEnSesion !== PREFERENCIAS_CALENDARIO_DEFECTO.mostrarProyectoEnSesion
  );
}
