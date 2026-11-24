import {
  esDatoCacheFresco,
  guardarDatoCache,
  invalidarCacheDatos,
  leerDatoCache,
  precargarDatos,
} from '@/lib/cacheDatos';

describe('cacheDatos', () => {
  beforeEach(() => {
    invalidarCacheDatos();
  });

  it('deduplica peticiones concurrentes con la misma clave mediante precargarDatos', async () => {
    let resolver!: (valor: { total: number }) => void;
    const cargar = jest.fn(
      () =>
        new Promise<{ total: number }>((res) => {
          resolver = res;
        }),
    );

    const p1 = precargarDatos('proyectos:mios', cargar, 15_000);
    const p2 = precargarDatos('proyectos:mios', cargar, 15_000);

    expect(cargar).toHaveBeenCalledTimes(1);
    resolver({ total: 4 });
    await Promise.all([p1, p2]);

    expect(leerDatoCache<{ total: number }>('proyectos:mios')?.datos).toEqual({ total: 4 });
  });

  it('respeta staleTimeMs y omite refetch si el dato sigue fresco', async () => {
    const cargar = jest.fn(async () => ['a', 'b']);

    await precargarDatos('clave:1', cargar, 15_000);
    expect(esDatoCacheFresco('clave:1', 15_000)).toBe(true);

    await precargarDatos('clave:1', cargar, 15_000);
    expect(cargar).toHaveBeenCalledTimes(1);

    expect(esDatoCacheFresco('clave:1', 0)).toBe(false);
  });

  it('precargarDatos absorbe errores silenciosamente sin dejar rechazos sin capturar', async () => {
    const cargar = jest.fn(async () => {
      throw new Error('fallo de red');
    });

    await expect(precargarDatos('nodos:fallo', cargar, 15_000)).resolves.toBeUndefined();
    expect(leerDatoCache('nodos:fallo')).toBeNull();
  });

  it('invalidarCacheDatos limpia por prefijo o todo el mapa', () => {
    guardarDatoCache('nodos:p1', { ok: 1 });
    guardarDatoCache('nodos:p2', { ok: 2 });
    guardarDatoCache('proyectos:mios', [{ id: 'p1' }]);

    invalidarCacheDatos('nodos:');

    expect(leerDatoCache('nodos:p1')).toBeNull();
    expect(leerDatoCache('nodos:p2')).toBeNull();
    expect(leerDatoCache('proyectos:mios')?.datos).toEqual([{ id: 'p1' }]);

    invalidarCacheDatos();
    expect(leerDatoCache('proyectos:mios')).toBeNull();
  });
});
