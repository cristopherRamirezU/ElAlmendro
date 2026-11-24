'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface EntradaCache<T> {
  datos: T;
  actualizadaEn: number;
}

/**
 * Cache en memoria de respuestas de la API, por clave. Vive mientras dure la
 * pestana: al volver a una pantalla ya visitada, se pinta al instante con lo
 * ultimo que se vio y la peticion solo revalida si expiro su ventana de frescura.
 */
const memoria = new Map<string, EntradaCache<unknown>>();
const enVuelo = new Map<string, Promise<unknown>>();

const STALE_TIME_DEFECTO_MS = 15_000;

export function invalidarCacheDatos(prefijo?: string) {
  if (!prefijo) {
    memoria.clear();
    enVuelo.clear();
    return;
  }
  for (const clave of memoria.keys()) {
    if (clave.startsWith(prefijo)) memoria.delete(clave);
  }
  for (const clave of enVuelo.keys()) {
    if (clave.startsWith(prefijo)) enVuelo.delete(clave);
  }
}

export function leerDatoCache<T>(clave: string): { datos: T; actualizadaEn: number } | null {
  const entrada = memoria.get(clave) as EntradaCache<T> | undefined;
  return entrada ?? null;
}

export function guardarDatoCache<T>(clave: string, datos: T): void {
  memoria.set(clave, { datos, actualizadaEn: Date.now() });
}

export function esDatoCacheFresco(clave: string, staleTimeMs = STALE_TIME_DEFECTO_MS): boolean {
  const entrada = memoria.get(clave);
  if (!entrada || staleTimeMs <= 0) return false;
  return Date.now() - entrada.actualizadaEn < staleTimeMs;
}

async function ejecutarConDeduplicacion<T>(clave: string, cargar: () => Promise<T>): Promise<T> {
  const pendiente = enVuelo.get(clave) as Promise<T> | undefined;
  if (pendiente) return pendiente;

  const promesa = cargar()
    .then((resultado) => {
      guardarDatoCache(clave, resultado);
      return resultado;
    })
    .finally(() => {
      enVuelo.delete(clave);
    });

  enVuelo.set(clave, promesa);
  return promesa;
}

/**
 * Prefetch silencioso: no lanza errores no capturados y respeta `staleTimeMs`
 * ademas de deduplicar peticiones concurrentes con la misma clave.
 */
export async function precargarDatos<T>(
  clave: string,
  cargar: () => Promise<T>,
  staleTimeMs = STALE_TIME_DEFECTO_MS,
): Promise<void> {
  if (esDatoCacheFresco(clave, staleTimeMs)) return;
  try {
    await ejecutarConDeduplicacion(clave, cargar);
  } catch {
    /* prefetch silencioso */
  }
}

interface Resultado<T> {
  datos: T | null;
  /** true solo cuando no hay nada que mostrar todavia (primera carga). */
  cargando: boolean;
  /** true mientras se revalida en segundo plano teniendo datos en pantalla. */
  revalidando: boolean;
  error: unknown;
  recargar: () => Promise<void>;
}

/**
 * Patron "stale-while-revalidate": devuelve la copia en cache de inmediato y
 * omite el refetch automatico al montar si sigue dentro de `staleTimeMs`.
 * `recargar()` explicito siempre consulta a la API (deduplicando en vuelo).
 */
export function useDatosCache<T>(
  clave: string,
  cargar: () => Promise<T>,
  opciones?: { staleTimeMs?: number },
): Resultado<T> {
  const staleTimeMs = opciones?.staleTimeMs ?? STALE_TIME_DEFECTO_MS;
  const enCache = leerDatoCache<T>(clave)?.datos;
  const [datos, setDatos] = useState<T | null>(enCache ?? null);
  const [cargando, setCargando] = useState(enCache === undefined);
  const [revalidando, setRevalidando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const claveRef = useRef(clave);

  const recargar = useCallback(async () => {
    const claveActual = clave;
    const teniaDatos = memoria.has(claveActual);
    setRevalidando(true);
    if (!teniaDatos) setCargando(true);
    try {
      const resultado = await ejecutarConDeduplicacion(claveActual, cargar);
      if (claveRef.current === claveActual) {
        setDatos(resultado);
        setError(null);
      }
    } catch (err) {
      if (claveRef.current === claveActual) setError(err);
    } finally {
      if (claveRef.current === claveActual) {
        setCargando(false);
        setRevalidando(false);
      }
    }
  }, [clave, cargar]);

  useEffect(() => {
    claveRef.current = clave;
    const previo = leerDatoCache<T>(clave)?.datos;
    setDatos(previo ?? null);
    setCargando(previo === undefined);
    setError(null);
    if (esDatoCacheFresco(clave, staleTimeMs)) return;
    void recargar();
  }, [clave, recargar, staleTimeMs]);

  return { datos, cargando, revalidando, error, recargar };
}
