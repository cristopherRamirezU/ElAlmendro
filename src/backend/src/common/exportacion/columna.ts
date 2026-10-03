/**
 * Descripcion de una columna exportable.
 *
 * El formato decide como se representa el valor en cada destino: una duracion
 * se ve como HH:MM:SS en CSV y PDF, pero en Excel va como horas decimales para
 * que las celdas se puedan sumar con una formula.
 */
export type FormatoColumna =
  | 'texto'
  | 'numero'
  | 'entero'
  | 'duracion'
  | 'fecha';

export interface Columna<T = Record<string, unknown>> {
  /** Clave del campo dentro de la fila. */
  clave: keyof T & string;
  /** Encabezado visible. */
  titulo: string;
  /** Por defecto 'texto'. */
  formato?: FormatoColumna;
  /** Ancho de columna, solo para Excel y PDF. */
  ancho?: number;
}

export interface Seccion<T = Record<string, unknown>> {
  /** Nombre de la pestana (Excel) o del bloque (PDF). */
  nombre: string;
  columnas: Columna<T>[];
  filas: T[];
}
