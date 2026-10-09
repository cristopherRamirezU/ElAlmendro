import { Sora } from 'next/font/google';

/**
 * Tipografia de titulos del mapa: el nombre del proyecto en la cabecera y en
 * el nodo principal comparten esta letra, distinta de la del resto de la app.
 */
export const fuenteTitulo = Sora({ subsets: ['latin'], weight: ['600', '700', '800'], display: 'swap' });
