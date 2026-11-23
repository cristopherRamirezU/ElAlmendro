'use client';

import { useSesion } from './sesion';

/** Celeste de TimeFlow: lo que ve cualquier empresa que no eligió su propio color. */
export const COLOR_PRIMARIO_DEFECTO = '#0ea5e9';

/** Mezcla un color de marca (hex) con una opacidad, para fondos e insignias tenues. */
export function colorConAlfa(hex: string, alfa: number): string {
  return `rgba(${colorRgb(hex)}, ${alfa})`;
}

/** Devuelve "r, g, b" de un hex para inyectar en variables CSS. */
export function colorRgb(hex: string): string {
  const limpio = hex.replace('#', '');
  const bigint = parseInt(limpio, 16);
  if (Number.isNaN(bigint)) return '14, 165, 233';
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}

/**
 * Color de marca de la empresa del usuario en sesion, o el celeste por
 * defecto si no personalizó ninguno (Configuración > Apariencia).
 */
export function useColorPrimario(): string {
  const usuario = useSesion();
  return usuario?.organizacionColor || COLOR_PRIMARIO_DEFECTO;
}
