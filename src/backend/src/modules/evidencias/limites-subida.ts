import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const TAMANO_MAXIMO_MB = 25;
export const TAMANO_MAXIMO_BYTES = TAMANO_MAXIMO_MB * 1024 * 1024;

/**
 * Limites que multer aplica MIENTRAS recibe el archivo: sin ellos guardaba
 * en memoria el archivo completo, de cualquier tamano, y recien despues se
 * revisaba el limite (un archivo enorme podia tumbar la API).
 */
export const OPCIONES_SUBIDA: MulterOptions = {
  limits: {
    fileSize: TAMANO_MAXIMO_BYTES,
    files: 1,
    fields: 5,
    fieldSize: 1024,
    parts: 8,
  },
  // Los navegadores mandan el nombre del archivo en UTF-8; con el valor por
  // defecto (latin1) los nombres con tildes o ñ quedaban ilegibles.
  defParamCharset: 'utf8',
};

/**
 * Nombre de archivo apto para guardar y mostrar: sin rutas, sin caracteres
 * de control y con un largo razonable (conservando la extension).
 */
export function limpiarNombreArchivo(original: string | undefined): string {
  const base = (original ?? '')
    .normalize('NFC')
    .split(/[\\/]/)
    .pop()!
    // Caracteres de control, comillas y los que Windows no admite.
    .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  if (!base) return 'archivo';
  if (base.length <= 150) return base;
  const punto = base.lastIndexOf('.');
  const extension = punto > 0 && base.length - punto <= 12 ? base.slice(punto) : '';
  return base.slice(0, 150 - extension.length).trimEnd() + extension;
}

/** Tipo MIME declarado por el navegador, o uno neutro si viene vacio o raro. */
export function limpiarTipoMime(tipo: string | undefined): string {
  const t = (tipo ?? '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(t) && t.length <= 100
    ? t
    : 'application/octet-stream';
}
