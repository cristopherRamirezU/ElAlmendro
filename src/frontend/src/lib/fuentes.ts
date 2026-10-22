import { Sora, Space_Grotesk } from 'next/font/google';

/**
 * Tipografia de titulos del mapa: el nombre del proyecto en la cabecera y en
 * el nodo principal comparten esta letra, distinta de la del resto de la app.
 * Los pesos 300 y 500 son de los filtros de la constelacion de proyectos.
 */
export const fuenteTitulo = Sora({ subsets: ['latin'], weight: ['300', '500', '600', '700', '800'], display: 'swap' });

/** Letra de la constelacion de proyectos del Panel: tarjetas, % y tarjetita. */
export const fuenteEscena = Space_Grotesk({ subsets: ['latin'], weight: ['300', '400', '500'], display: 'swap' });
