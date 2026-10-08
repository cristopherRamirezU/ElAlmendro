'use client';

import { useEffect } from 'react';
import { useSesion } from './sesion';

/** Oscuro medianoche: el tema original de TimeFlow, el que ve cualquier empresa que no eligió otro. */
export const TEMA_FONDO_DEFECTO = 'oscuro-medianoche';

export interface DefinicionTema {
  codigo: string;
  nombre: string;
  claro: boolean;
  /** Para la miniatura del selector en Configuración. */
  fondo: string;
  superficie: string;
  texto: string;
}

/** Debe calzar exactamente con TEMAS_FONDO_VALIDOS en el backend (dto/actualizar-color.dto.ts). */
export const TEMAS: DefinicionTema[] = [
  {
    codigo: 'oscuro-medianoche',
    nombre: 'Medianoche',
    claro: false,
    fondo: '#020617',
    superficie: '#0f172a',
    texto: '#f1f5f9',
  },
  {
    codigo: 'oscuro-grafito',
    nombre: 'Grafito',
    claro: false,
    fondo: '#0a0a0a',
    superficie: '#27272a',
    texto: '#fafafa',
  },
  {
    codigo: 'claro-nube',
    nombre: 'Nube',
    claro: true,
    fondo: '#dbeefc',
    superficie: '#bcdefa',
    texto: '#000000',
  },
];

/** Tema de fondo de la empresa del usuario en sesión, o medianoche por defecto. */
export function useTemaFondo(): string {
  const usuario = useSesion();
  return usuario?.organizacionTema || TEMA_FONDO_DEFECTO;
}

/**
 * Marca <html data-tema="..."> para que las variables CSS de globals.css
 * tiñan toda la app, incluidos los portales (modales, ventana de bolsa) que
 * viven fuera del árbol de Marco.
 */
export function useAplicarTemaFondo(tema: string) {
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
  }, [tema]);
}
