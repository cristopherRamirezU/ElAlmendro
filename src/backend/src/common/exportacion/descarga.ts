import type { Response } from 'express';

export const MIME_CSV = 'text/csv; charset=utf-8';
export const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MIME_PDF = 'application/pdf';

export type FormatoExportacion = 'csv' | 'xlsx' | 'pdf';

const MIMES: Record<FormatoExportacion, string> = {
  csv: MIME_CSV,
  xlsx: MIME_XLSX,
  pdf: MIME_PDF,
};

/**
 * Prepara las cabeceras de descarga.
 *
 * Generaliza el patron ya probado en evidencias.controller.ts, agregando la
 * forma extendida filename* (RFC 5987) porque los nombres llevan acentos:
 * el filename simple solo admite ASCII, asi que se manda una version
 * saneada para clientes antiguos y la real codificada en UTF-8.
 */
export function prepararDescarga(
  res: Response,
  nombreArchivo: string,
  formato: FormatoExportacion,
): void {
  const ascii = nombreArchivo.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');

  res.set({
    'Content-Type': MIMES[formato],
    'Content-Disposition':
      `attachment; filename="${ascii}"; ` +
      `filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
  });
}

/** Nombre estable: timeflow-<reporte>_<desde>_<hasta>.<ext> */
export function nombreExportacion(
  reporte: string,
  desde: Date | string,
  hasta: Date | string,
  formato: FormatoExportacion,
): string {
  const dia = (v: Date | string) =>
    (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);

  return `timeflow-${reporte}_${dia(desde)}_${dia(hasta)}.${formato}`;
}
