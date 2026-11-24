'use client';

import { useSesion } from './sesion';

/** Celeste de TimeFlow: lo que ve cualquier empresa que no eligió su propio color. */
export const COLOR_PRIMARIO_DEFECTO = '#0ea5e9';

/** Convierte un color hexadecimal (#rgb o #rrggbb) a su terna RGB. */
export function parseHex(hex: string): [number, number, number] {
  const limpio = (hex || '').trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(limpio)) {
    return [
      parseInt(limpio[0] + limpio[0], 16),
      parseInt(limpio[1] + limpio[1], 16),
      parseInt(limpio[2] + limpio[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(limpio)) {
    const bigint = parseInt(limpio, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }
  return [14, 165, 233];
}

/** Mezcla un color de marca (hex) con una opacidad, para fondos e insignias tenues. */
export function colorConAlfa(hex: string, alfa: number): string {
  return `rgba(${colorRgb(hex)}, ${alfa})`;
}

/** Devuelve "r, g, b" de un hex para inyectar en variables CSS. */
export function colorRgb(hex: string): string {
  const [r, g, b] = parseHex(hex);
  return `${r}, ${g}, ${b}`;
}

/** Luminancia relativa WCAG 2.1 en el rango [0, 1]. */
export function luminanciaRelativa(hex: string): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/**
 * Devuelve `#0f172a` sobre colores claros (amarillo, lima, celeste claro, etc.)
 * y `#ffffff` sobre colores oscuros o saturados para mantener contraste legible.
 */
export function colorTextoSobre(hex: string): '#0f172a' | '#ffffff' {
  return luminanciaRelativa(hex) > 0.39 ? '#0f172a' : '#ffffff';
}

/**
 * Deriva un segundo tono armónico del color de marca para gradientes y halos,
 * evitando gradientes planos y sin caer en morados fijos.
 */
export function colorSecundarioDeMarca(hex: string): string {
  const [r0, g0, b0] = parseHex(hex);
  const r = r0 / 255;
  const g = g0 / 255;
  const b = b0 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  // Para amarillos/naranjas evita cruzar hacia verde oliva; en el resto rota +24°.
  const giro = h >= 32 && h <= 78 ? -20 : 24;
  const h2 = (h + giro + 360) % 360;
  const s2 = s < 0.08 ? s : Math.min(0.95, Math.max(s, 0.55));
  const l2 = Math.min(0.72, Math.max(0.28, l > 0.56 ? l - 0.07 : l + 0.05));

  return hslAHex(h2, s2, l2);
}

function hslAHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const aHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${aHex(r)}${aHex(g)}${aHex(b)}`;
}

/**
 * Aplica las variables CSS del color de marca sobre un `Document` (el principal
 * o el de la ventana flotante Document Picture-in-Picture).
 */
export function aplicarColorMarcaEnDocumento(doc: Document, colorPrimario: string): void {
  const colorSecundario = colorSecundarioDeMarca(colorPrimario);
  const textoPrimario = colorTextoSobre(colorPrimario);
  const root = doc.documentElement.style;
  root.setProperty('--color-primario', colorPrimario);
  root.setProperty('--color-primario-2', colorSecundario);
  root.setProperty('--tf-primario-rgb', colorRgb(colorPrimario));
  root.setProperty('--tf-primario-2-rgb', colorRgb(colorSecundario));
  root.setProperty('--tf-texto-primario', textoPrimario);
}

/**
 * Color de marca de la empresa de quien usa la app, o el celeste por
 * defecto si no personalizó ninguno (Configuración > Apariencia).
 */
export function useColorPrimario(): string {
  const usuario = useSesion();
  return usuario?.organizacionColor || COLOR_PRIMARIO_DEFECTO;
}
