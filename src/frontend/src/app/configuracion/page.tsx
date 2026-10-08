'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Marco from '@/components/Marco';
import { api, ErrorApi, OrganizacionMia } from '@/lib/api';
import { useSesion, useTienePermiso } from '@/lib/sesion';
import { PERMISOS } from '@/lib/rbac';
import { colorConAlfa, COLOR_PRIMARIO_DEFECTO } from '@/lib/color';
import { TEMA_FONDO_DEFECTO, TEMAS } from '@/lib/tema';
import { guardarCacheSesion, leerCacheSesion } from '@/lib/cacheSesion';

/** Paleta sugerida: suficiente variedad sin caer en colores ilegibles sobre fondo oscuro. */
const PRESETS = [
  { nombre: 'Celeste TimeFlow', valor: '#0ea5e9' },
  { nombre: 'Esmeralda', valor: '#10b981' },
  { nombre: 'Violeta', valor: '#8b5cf6' },
  { nombre: 'Rosa', valor: '#f43f5e' },
  { nombre: 'Ámbar', valor: '#f59e0b' },
  { nombre: 'Fucsia', valor: '#d946ef' },
  { nombre: 'Cian', valor: '#06b6d4' },
  { nombre: 'Naranja', valor: '#f97316' },
];

const HEX_VALIDO = /^#[0-9A-Fa-f]{6}$/;

export default function ConfiguracionPage() {
  return (
    <Marco activo="/configuracion" titulo="Configuración" subtitulo="Apariencia y datos de tu empresa">
      <ContenidoConfiguracion />
    </Marco>
  );
}

function ContenidoConfiguracion() {
  const router = useRouter();
  const usuario = useSesion();
  const puedeGestionar = useTienePermiso(PERMISOS.CONFIGURACION_GESTIONAR);

  const [color, setColor] = useState(COLOR_PRIMARIO_DEFECTO);
  const [tema, setTema] = useState(TEMA_FONDO_DEFECTO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    if (!puedeGestionar) {
      setCargando(false);
      return;
    }
    api
      .get<OrganizacionMia>('/organizaciones/mia')
      .then((org) => {
        setColor(org.colorPrimario && HEX_VALIDO.test(org.colorPrimario) ? org.colorPrimario : COLOR_PRIMARIO_DEFECTO);
        setTema(org.temaFondo || TEMA_FONDO_DEFECTO);
      })
      .catch((err) => {
        if (err instanceof ErrorApi && err.estado === 401) router.replace('/login');
      })
      .finally(() => setCargando(false));
  }, [puedeGestionar, router]);

  if (!puedeGestionar) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-slate-900 p-8 text-center shadow-sm backdrop-blur">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-400 font-bold text-lg">
          ✕
        </div>
        <h2 className="text-lg font-bold text-white">Acceso Restringido</h2>
        <p className="mt-1 text-sm text-slate-400">
          Solo el Administrador de la empresa puede personalizar la apariencia.
        </p>
        <button
          onClick={() => router.push('/panel')}
          className="mt-5 rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-600"
        >
          Volver a mis proyectos
        </button>
      </div>
    );
  }

  if (cargando) {
    return (
      <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-500">
        Cargando configuración…
      </p>
    );
  }

  async function guardar() {
    setMensaje(null);
    setGuardando(true);
    try {
      const actualizada = await api.patch<OrganizacionMia>('/organizaciones/mia/color', {
        colorPrimario: color,
        temaFondo: tema,
      });

      // Refresca la cache de sesion: Marco y el resto de la app usan el color
      // y el tema nuevos de inmediato, sin recargar la pagina.
      const cache = leerCacheSesion();
      if (usuario && cache) {
        guardarCacheSesion({
          ...cache,
          usuario: {
            ...usuario,
            organizacionColor: actualizada.colorPrimario,
            organizacionTema: actualizada.temaFondo,
          },
        });
      }

      setMensaje({ tipo: 'exito', texto: 'Apariencia actualizada.' });
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err instanceof ErrorApi ? err.message : 'No se pudo guardar el color.',
      });
    } finally {
      setGuardando(false);
    }
  }

  const colorValido = HEX_VALIDO.test(color);

  return (
    <div className="max-w-2xl">
      {mensaje && (
        <div
          role="alert"
          className={`mb-5 flex items-center justify-between rounded-xl border p-4 text-sm ${
            mensaje.tipo === 'exito'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          <span>{mensaje.texto}</span>
          <button
            onClick={() => setMensaje(null)}
            className="text-xs font-bold uppercase opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-slate-900 p-6 backdrop-blur">
        {/* ----------------------------------------------------------- tema de fondo */}
        <h2 className="font-bold text-white">Tema de fondo</h2>
        <p className="mt-1 text-sm text-slate-400">
          Define el fondo y los textos de toda la app para tu equipo.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {TEMAS.map((t) => (
            <button
              key={t.codigo}
              type="button"
              onClick={() => setTema(t.codigo)}
              className={`overflow-hidden rounded-xl border-2 text-left transition ${
                tema === t.codigo ? 'border-white' : 'border-transparent hover:border-white/20'
              }`}
            >
              <span
                className="flex h-14 flex-col justify-end gap-1 p-2"
                style={{ backgroundColor: t.fondo }}
              >
                <span
                  className="h-4 w-3/4 rounded"
                  style={{ backgroundColor: t.superficie, border: `1px solid ${t.texto}22` }}
                />
              </span>
              <span
                className="block px-2 py-1.5 text-xs font-medium"
                style={{ backgroundColor: t.superficie, color: t.texto }}
              >
                {t.nombre}
              </span>
            </button>
          ))}
        </div>

        {/* ------------------------------------------------------------- color de marca */}
        <p className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Color de marca
        </p>

        {/* ----------------------------------------------------- previsualizacion */}
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <div
            style={{ backgroundColor: colorConAlfa(color, 0.15), color }}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold"
          >
            {(usuario?.nombreCompleto ?? 'TF').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div
              style={{ backgroundColor: colorConAlfa(color, 0.15), color }}
              className="mb-2 w-fit rounded-xl px-3 py-2 text-sm font-semibold"
            >
              Proyectos
            </div>
            <button
              type="button"
              style={{ backgroundColor: color }}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Botón de ejemplo
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- presets */}
        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Colores sugeridos
        </p>
        <div className="flex flex-wrap gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.valor}
              type="button"
              onClick={() => setColor(preset.valor)}
              title={preset.nombre}
              aria-label={preset.nombre}
              className={`h-10 w-10 rounded-full border-2 transition ${
                color.toLowerCase() === preset.valor.toLowerCase()
                  ? 'border-white scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: preset.valor }}
            />
          ))}
        </div>

        {/* ------------------------------------------------------------ color propio */}
        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
          O elige un color propio
        </p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={colorValido ? color : COLOR_PRIMARIO_DEFECTO}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value.trim())}
            placeholder="#0ea5e9"
            maxLength={7}
            className="w-32 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-white/30"
          />
          {!colorValido && (
            <span className="text-xs text-rose-400">Formato hex inválido (ej: #0ea5e9)</span>
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
          <button
            onClick={guardar}
            disabled={guardando || !colorValido}
            style={colorValido ? { backgroundColor: color } : undefined}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar apariencia'}
          </button>
        </div>
      </section>
    </div>
  );
}
