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

  const [orgInfo, setOrgInfo] = useState<OrganizacionMia | null>(null);
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
        setOrgInfo(org);
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
  const temaPreview = TEMAS.find((t) => t.codigo === tema) ?? TEMAS[0];

  return (
    <div className="tf-enter grid max-w-6xl items-start gap-6 xl:grid-cols-12">
      <div className="flex flex-col gap-5 xl:col-span-7">
        {orgInfo && (
          <section className="tf-card-pro rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="tf-display font-bold text-[var(--tf-texto)]">
                  Datos y plan de tu empresa
                </h2>
                <p className="mt-0.5 text-xs text-[var(--tf-texto-tenue)]">
                  Resumen de tu organización y cupos vigentes.
                </p>
              </div>
              {orgInfo.plan && (
                <span
                  style={{
                    backgroundColor: colorConAlfa(color, 0.14),
                    color,
                    borderColor: colorConAlfa(color, 0.3),
                  }}
                  className="rounded-full border px-3 py-1 text-xs font-bold"
                >
                  Plan {orgInfo.plan === 'GRATIS' ? 'Básico' : orgInfo.plan}
                </span>
              )}
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--tf-texto-suave)]">Nombre</dt>
                <dd className="font-semibold text-[var(--tf-texto)]">{orgInfo.nombre}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--tf-texto-suave)]">RUT</dt>
                <dd className="font-medium text-[var(--tf-texto)]">
                  {orgInfo.rut || 'No registrado'}
                </dd>
              </div>
            </dl>
            {typeof orgInfo.maxUsuarios === 'number' && typeof orgInfo.maxProyectos === 'number' && (
              <div className="mt-4 grid gap-4 border-t border-[var(--tf-borde)] pt-4 sm:grid-cols-2">
                <BarraCupo
                  etiqueta="Usuarios activos"
                  actual={orgInfo.totalUsuarios ?? 0}
                  maximo={orgInfo.maxUsuarios}
                />
                <BarraCupo
                  etiqueta="Proyectos activos"
                  actual={orgInfo.totalProyectos ?? 0}
                  maximo={orgInfo.maxProyectos}
                />
              </div>
            )}
          </section>
        )}

        {mensaje && (
          <div
            role="alert"
            className={`flex items-center justify-between rounded-xl border p-4 text-sm ${
              mensaje.tipo === 'exito'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
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

        <section className="tf-card-pro rounded-2xl p-6">
          <h2 className="tf-display font-bold text-[var(--tf-texto)]">Tema de fondo</h2>
          <p className="mt-1 text-xs text-[var(--tf-texto-tenue)]">
            Define el fondo y los textos de toda la app para tu equipo.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {TEMAS.map((t) => {
              const seleccionado = tema === t.codigo;
              return (
                <button
                  key={t.codigo}
                  type="button"
                  onClick={() => setTema(t.codigo)}
                  style={seleccionado ? { borderColor: color } : undefined}
                  className={`overflow-hidden rounded-xl border-2 text-left transition ${
                    seleccionado
                      ? 'shadow-md'
                      : 'border-[var(--tf-borde)] hover:border-[var(--tf-borde-fuerte)]'
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
                    className="block px-2.5 py-2 text-xs font-semibold"
                    style={{ backgroundColor: t.superficie, color: t.texto }}
                  >
                    {t.nombre}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wide text-[var(--tf-texto-suave)]">
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
                className={`h-9 w-9 rounded-full border-2 transition ${
                  color.toLowerCase() === preset.valor.toLowerCase()
                    ? 'scale-110 border-white ring-2 ring-sky-400/50'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: preset.valor }}
              />
            ))}
          </div>

          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-[var(--tf-texto-suave)]">
            O elige un color propio
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colorValido ? color : COLOR_PRIMARIO_DEFECTO}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--tf-borde)] bg-transparent"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value.trim())}
              placeholder="#0ea5e9"
              maxLength={7}
              className="w-32 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-input)] px-3 py-2 font-mono text-sm text-[var(--tf-texto)] outline-none focus:border-sky-400"
            />
            {!colorValido && (
              <span className="text-xs text-rose-400">Formato hex inválido (ej: #0ea5e9)</span>
            )}
          </div>

          <div className="mt-6 flex justify-end border-t border-[var(--tf-borde)] pt-4">
            <button
              onClick={guardar}
              disabled={guardando || !colorValido}
              style={colorValido ? { backgroundColor: color } : undefined}
              className="tf-shimmer-cta rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar apariencia'}
            </button>
          </div>
        </section>
      </div>

      {/* Columna derecha: Vista previa en tiempo real antes de guardar */}
      <aside className="tf-card-pro rounded-2xl p-5 xl:sticky xl:top-6 xl:col-span-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="tf-display text-sm font-bold text-[var(--tf-texto)]">
            Vista previa en vivo
          </h2>
          <span className="text-[11px] text-[var(--tf-texto-suave)]">
            {temaPreview.nombre} · {color}
          </span>
        </div>

        <div
          className="overflow-hidden rounded-2xl border p-4 transition-colors"
          style={{
            backgroundColor: temaPreview.fondo,
            color: temaPreview.texto,
            borderColor: `${temaPreview.texto}22`,
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                style={{ backgroundColor: colorConAlfa(color, 0.18), color }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold"
              >
                {(usuario?.nombreCompleto ?? 'TF').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="tf-display text-xs font-bold">
                  {orgInfo?.nombre || 'Tu empresa'}
                </p>
                <p className="text-[10px] opacity-65">Panel principal</p>
              </div>
            </div>
            <span
              style={{ backgroundColor: colorConAlfa(color, 0.16), color }}
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            >
              En jornada
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: temaPreview.superficie,
                borderColor: `${temaPreview.texto}18`,
              }}
            >
              <p className="text-[10px] opacity-65">Horas del mes</p>
              <p className="tf-display mt-0.5 font-mono text-base font-bold">159h 20m</p>
            </div>
            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: temaPreview.superficie,
                borderColor: `${temaPreview.texto}18`,
              }}
            >
              <p className="text-[10px] opacity-65">Nodos listos</p>
              <p className="tf-display mt-0.5 font-mono text-base font-bold">11 / 16</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span
              style={{ backgroundColor: colorConAlfa(color, 0.15), color }}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
              Proyectos
            </span>
            <button
              type="button"
              style={{ backgroundColor: color }}
              className="tf-shimmer-cta rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm"
            >
              Botón de ejemplo
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function BarraCupo({ etiqueta, actual, maximo }: { etiqueta: string; actual: number; maximo: number }) {
  const pct = maximo > 0 ? Math.min(100, Math.round((actual / maximo) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[var(--tf-texto-tenue)]">{etiqueta}</span>
        <span className="font-mono font-semibold text-[var(--tf-texto)]">
          {actual} / {maximo}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--tf-borde)]">
        <div
          className={`tf-bar-grow h-full rounded-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-sky-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
