'use client';

import { useMemo } from 'react';
import Selector, { type OpcionSelector } from '@/components/ui/Selector';
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
  const opciones = useMemo<OpcionSelector[]>(() => {
    const z = zonasDisponibles();
    const conocidas = new Set([...z.frecuentes, ...z.resto]);
    const lista: OpcionSelector[] = [];

    // Una zona guardada que este navegador no lista igual debe poder verse.
    if (value && !conocidas.has(value)) {
      lista.push({ valor: value, etiqueta: value, grupo: 'Actual' });
    }
    for (const zona of z.frecuentes) {
      lista.push({ valor: zona, etiqueta: nombreZona(zona), grupo: 'Frecuentes' });
    }
    for (const zona of z.resto) {
      lista.push({ valor: zona, etiqueta: nombreZona(zona), grupo: 'Todas las zonas' });
    }
    return lista;
  }, [value]);

  // Se mantiene `className` en props por compatibilidad con llamadores previos;
  // la estética visual la gobierna `Selector`.
  void className;

  return (
    <Selector
      id={id}
      ariaLabel="Zona horaria"
      buscable
      placeholderBusqueda="Buscar ciudad o zona horaria…"
      mensajeVacio="No se encontraron zonas horarias"
      valor={value}
      onChange={onChange}
      disabled={disabled}
      opciones={opciones}
    />
  );
}
