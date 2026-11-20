'use client';

import { useState, type CSSProperties } from 'react';
import { urlFotoPerfil } from '@/lib/api';
import { iniciales } from '@/lib/formato';

/**
 * Avatar de una persona: su foto de perfil si la tiene, sus iniciales si no.
 * Si la foto no carga (borrada, sin conexion) vuelve a las iniciales en vez
 * de dejar una imagen rota.
 *
 * El tamano y los colores de las iniciales vienen en `className`/`style`,
 * igual que antes de existir las fotos: cada lugar conserva su aspecto.
 */
export default function Avatar({
  id,
  nombre,
  foto,
  className = '',
  style,
}: {
  id: string;
  nombre: string;
  /** Version de la foto (null o vacio = iniciales). */
  foto?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  // Se recuerda que version fallo: si cambia la foto, se vuelve a intentar.
  const [fallida, setFallida] = useState<string | null>(null);
  const conFoto = Boolean(foto) && fallida !== foto;

  return (
    <span
      style={conFoto ? undefined : style}
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
    >
      {conFoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- viene de la API con cookie de sesion; next/image no la enviaria
        <img
          src={urlFotoPerfil(id, foto!)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFallida(foto!)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden>{iniciales(nombre)}</span>
      )}
    </span>
  );
}
