import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const desarrollo = process.env.NODE_ENV !== 'production';

/** Origen de la API y su par websocket (el chat va por socket.io). */
function origenesApi(): string[] {
  try {
    const url = new URL(API_URL);
    const ws = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
    return [url.origin, ws];
  } catch {
    return [];
  }
}

/**
 * Content-Security-Policy: lista de donde puede cargar cosas la pagina.
 * Si alguien lograra inyectar HTML, el navegador igual se negaria a cargar
 * scripts de otro sitio, a mandar datos a servidores ajenos (connect-src), a
 * mostrar la app dentro de un iframe ajeno (frame-ancestors) o a cambiar el
 * destino de los formularios.
 *
 * script-src lleva 'unsafe-inline' porque Next inyecta scripts en linea para
 * hidratar la pagina; quitarlo exige nonces por peticion (middleware y render
 * dinamico de todas las paginas). En desarrollo se suma 'unsafe-eval', que
 * usa la recarga en caliente.
 */
function politicaContenido(): string {
  const directivas: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(desarrollo ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    // La API sirve las fotos de perfil (en desarrollo esta en otro puerto).
    'img-src': ["'self'", 'data:', 'blob:', ...origenesApi().slice(0, 1)],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...origenesApi()],
    // blob: los comentarios de voz se escuchan desde memoria (grabacion recien
    // hecha o audio descargado con la sesion).
    'media-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const texto = Object.entries(directivas)
    .map(([nombre, valores]) => `${nombre} ${valores.join(' ')}`)
    .join('; ');
  return desarrollo ? texto : `${texto}; upgrade-insecure-requests`;
}

const CABECERAS_SEGURIDAD = [
  { key: 'Content-Security-Policy', value: politicaContenido() },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    // El microfono solo para el propio sitio: los comentarios de voz de las
    // tareas lo usan. Un iframe ajeno sigue sin acceso.
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // No anunciar "X-Powered-By: Next.js": no ayuda a nadie salvo a quien
  // busca versiones vulnerables.
  poweredByHeader: false,
  // La web actua ademas como BFF: agrega llamadas y custodia los tokens en
  // cookies httpOnly, de modo que el navegador nunca habla directo con la API.
  env: {
    API_URL,
  },
  async headers() {
    return [{ source: '/:path*', headers: CABECERAS_SEGURIDAD }];
  },
};

export default config;
