'use client';

import { useMemo } from 'react';
import { nombreZona, zonasDisponibles } from '@/lib/zona';

/**
 * Lista de zonas horarias IANA: primero las frecuentes del equipo y luego
 * todas las demas. Cada opcion muestra la ciudad y su desfase actual.
 */
export default function SelectorZona({
  id,
  value,
  onChange,
  disabled,
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (zona: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { frecuentes, resto } = useMemo(() => {
    const z = zonasDisponibles();
    const etiquetar = (lista: string[]) => lista.map((zona) => ({ zona, texto: nombreZona(zona) }));
    return { frecuentes: etiquetar(z.frecuentes), resto: etiquetar(z.resto) };
  }, []);

  // Una zona guardada que este navegador no lista igual debe poder verse.
  const conocida = frecuentes.some((o) => o.zona === value) || resto.some((o) => o.zona === value);

  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {!conocida && value && <option value={value}>{value}</option>}
      <optgroup label="Frecuentes">
        {frecuentes.map((o) => (
          <option key={o.zona} value={o.zona}>
            {o.texto}
          </option>
        ))}
      </optgroup>
      {resto.length > 0 && (
        <optgroup label="Todas las zonas">
          {resto.map((o) => (
            <option key={o.zona} value={o.zona}>
              {o.texto}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
