'use client';

/** Bloque base animado coherente con los 3 temas de TimeFlow (`var(--tf-*)`). */
export function BloqueEsqueleto({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`tf-skeleton rounded-xl ${className}`} />;
}

/** Esqueleto completo de página (barra lateral + contenido) para cargas iniciales o Suspense. */
export function EsqueletoPagina() {
  return (
    <main
      aria-busy="true"
      aria-label="Cargando espacio de trabajo"
      className="flex min-h-screen bg-[var(--tf-fondo)] text-[var(--tf-texto)]"
    >
      <aside className="hidden w-60 shrink-0 flex-col gap-3 border-r border-[var(--tf-borde)] bg-[var(--tf-sidebar)] p-4 md:flex">
        <div className="mb-3 flex items-center gap-3 border-b border-[var(--tf-borde)] pb-4">
          <BloqueEsqueleto className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <BloqueEsqueleto className="h-3.5 w-24" />
            <BloqueEsqueleto className="h-2.5 w-28" />
          </div>
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <BloqueEsqueleto key={i} className="h-9 w-full rounded-xl" />
        ))}
        <div className="mt-auto space-y-2 border-t border-[var(--tf-borde)] pt-3">
          <BloqueEsqueleto className="h-10 w-full rounded-xl" />
          <BloqueEsqueleto className="h-9 w-full rounded-xl" />
        </div>
      </aside>

      <div className="flex flex-1 flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <BloqueEsqueleto className="h-6 w-48" />
            <BloqueEsqueleto className="h-3.5 w-64" />
          </div>
          <div className="flex gap-2">
            <BloqueEsqueleto className="h-9 w-28 rounded-full" />
            <BloqueEsqueleto className="h-9 w-28 rounded-full" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-5"
            >
              <BloqueEsqueleto className="h-4 w-24 rounded-full" />
              <BloqueEsqueleto className="mt-3 h-5 w-3/4" />
              <BloqueEsqueleto className="mt-2 h-3.5 w-full" />
              <BloqueEsqueleto className="mt-6 h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

/** Esqueleto de tarjetas para /panel. */
export function EsqueletoTarjetas({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando proyectos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <BloqueEsqueleto className="h-9 w-56 rounded-full" />
          <BloqueEsqueleto className="h-9 w-40 rounded-full" />
        </div>
        <div className="flex gap-2">
          <BloqueEsqueleto className="h-9 w-32 rounded-full" />
          <BloqueEsqueleto className="h-9 w-32 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cantidad }, (_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-5"
          >
            <div>
              <div className="flex items-center justify-between">
                <BloqueEsqueleto className="h-5 w-24 rounded-full" />
                <BloqueEsqueleto className="h-4 w-16" />
              </div>
              <BloqueEsqueleto className="mt-3 h-5 w-2/3" />
              <BloqueEsqueleto className="mt-2 h-3.5 w-full" />
            </div>
            <div className="space-y-3">
              <BloqueEsqueleto className="h-2 w-full rounded-full" />
              <div className="flex gap-2 pt-2">
                <BloqueEsqueleto className="h-8 flex-1 rounded-xl" />
                <BloqueEsqueleto className="h-8 w-20 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Esqueleto de tabla para /usuarios, /reportes y /saas-admin. */
export function EsqueletoTabla({
  filas = 5,
  columnas = 5,
}: {
  filas?: number;
  columnas?: number;
}) {
  return (
    <div aria-busy="true" aria-label="Cargando tabla" className="space-y-3 p-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
        {Array.from({ length: columnas }, (_, c) => (
          <BloqueEsqueleto key={c} className="h-3.5 w-2/3" />
        ))}
      </div>
      <div className="space-y-2.5 border-t border-[var(--tf-borde)] pt-3">
        {Array.from({ length: filas }, (_, f) => (
          <div
            key={f}
            className="grid items-center gap-3 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] px-3 py-3"
            style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columnas }, (_, c) => (
              <BloqueEsqueleto key={c} className={`h-4 ${c === 0 ? 'w-4/5' : 'w-3/5'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Esqueleto de calendario (rejilla mensual, semana o panel lateral de día). */
export function EsqueletoCalendario({ tipo }: { tipo: 'mes' | 'semana' | 'detalle' }) {
  if (tipo === 'detalle') {
    return (
      <div aria-busy="true" aria-label="Cargando detalle del día" className="space-y-3">
        <div className="flex gap-2">
          <BloqueEsqueleto className="h-7 w-24 rounded-full" />
          <BloqueEsqueleto className="h-7 w-28 rounded-full" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-3"
          >
            <div className="flex items-center gap-2.5">
              <BloqueEsqueleto className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <BloqueEsqueleto className="h-3.5 w-36" />
                <BloqueEsqueleto className="h-3 w-24" />
              </div>
            </div>
            <BloqueEsqueleto className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (tipo === 'semana') {
    return (
      <div aria-busy="true" aria-label="Cargando vista semanal" className="space-y-2.5 py-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <BloqueEsqueleto className="h-8 w-24 shrink-0 rounded-lg" />
            <BloqueEsqueleto className="h-8 flex-1 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-busy="true" aria-label="Cargando calendario" className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <BloqueEsqueleto key={i} className="mx-auto h-3.5 w-8" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }, (_, i) => (
          <BloqueEsqueleto key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Esqueleto del mapa de nodos en /nodos mientras llegan las actividades. */
export function EsqueletoMapa() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando mapa de nodos"
      className="flex h-[max(32rem,calc(100vh-14rem))] items-center justify-center rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] p-8"
    >
      <div className="flex flex-col items-center gap-8 sm:flex-row">
        <BloqueEsqueleto className="h-24 w-60 rounded-2xl" />
        <div className="flex flex-col gap-4">
          <BloqueEsqueleto className="h-16 w-52 rounded-xl" />
          <BloqueEsqueleto className="h-16 w-52 rounded-xl" />
          <BloqueEsqueleto className="h-16 w-52 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Esqueleto del detalle de tarea dentro de PanelTarea o /bolsa/[id]. */
export function EsqueletoPanelTarea() {
  return (
    <div aria-busy="true" aria-label="Cargando tarea" className="space-y-4 py-2">
      <BloqueEsqueleto className="h-20 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <BloqueEsqueleto className="h-28 w-full rounded-2xl" />
          <BloqueEsqueleto className="h-14 w-full rounded-2xl" />
        </div>
        <BloqueEsqueleto className="h-44 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/** Esqueleto vertical para listas (historial, configuración). */
export function EsqueletoLista({ filas = 5 }: { filas?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando contenido" className="space-y-3">
      {Array.from({ length: filas }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-4"
        >
          <div className="flex-1 space-y-2">
            <BloqueEsqueleto className="h-4 w-1/3" />
            <BloqueEsqueleto className="h-3 w-2/3" />
          </div>
          <BloqueEsqueleto className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
