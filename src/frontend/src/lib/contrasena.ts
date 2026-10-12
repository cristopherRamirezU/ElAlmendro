/**
 * Reglas de contrasena para avisar mientras se escribe. Son las mismas que
 * aplica la API (src/backend/src/common/seguridad/politica-contrasena.ts),
 * que es la que decide: si cambian alla, cambian aqui.
 */
export const CONTRASENA_MINIMO = 8;
export const CONTRASENA_MAXIMO = 128;

export interface ReglaContrasena {
  texto: string;
  cumple: boolean;
}

export function reglasContrasena(clave: string): ReglaContrasena[] {
  return [
    { texto: `Al menos ${CONTRASENA_MINIMO} caracteres`, cumple: clave.length >= CONTRASENA_MINIMO },
    { texto: 'Letras y números', cumple: /\p{L}/u.test(clave) && /\d/.test(clave) },
    { texto: 'Sin espacios al inicio ni al final', cumple: clave.length > 0 && clave.trim() === clave },
  ];
}

export function contrasenaValida(clave: string): boolean {
  return clave.length <= CONTRASENA_MAXIMO && reglasContrasena(clave).every((r) => r.cumple);
}

/** Texto corto para los campos de contrasena de otros formularios. */
export const AYUDA_CONTRASENA = `Mínimo ${CONTRASENA_MINIMO} caracteres, con letras y números`;
