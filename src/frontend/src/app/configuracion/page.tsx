'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import Marco from '@/components/Marco';
import { EsqueletoLista } from '@/components/ui/Esqueleto';
import TooltipAyuda from '@/components/ui/TooltipAyuda';
import { useToast } from '@/components/ui/Toast';
import { api, ErrorApi, OrganizacionMia } from '@/lib/api';
import { etiquetaPlan } from '@/lib/formato';
import { useSesion, useTienePermiso } from '@/lib/sesion';
import { PERMISOS } from '@/lib/rbac';
import {
  colorConAlfa,
  colorSecundarioDeMarca,
  colorTextoSobre,
  COLOR_PRIMARIO_DEFECTO,
  luminanciaRelativa,
} from '@/lib/color';
import { TEMA_FONDO_DEFECTO, TEMAS } from '@/lib/tema';
import { guardarCacheSesion, leerCacheSesion } from '@/lib/cacheSesion';

/** Paleta sugerida destacada visible al abrir Configuración. */
const PRESETS = [
  '#0ea5e9',
  '#10b981',
  '#8b5cf6',
  '#f43f5e',
  '#f59e0b',
  '#d946ef',
  '#06b6d4',
  '#f97316',
];

/** Parrilla ampliada de tonalidades en todo el espectro (claras, medias y profundas). */
const PALETA_AMPLIADA = [
  // Azules y celestes
  '#e0f2fe', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#1d4ed8', '#2563eb', '#1e3a8a',
  // Cianes, turquesas y agua
  '#cffafe', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#2dd4bf', '#14b8a6', '#0d9488', '#115e59',
  // Verdes, esmeraldas y limas
  '#d1fae5', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#22c55e', '#16a34a', '#84cc16', '#65a30d',
  // Amarillos, dorados y naranjas
  '#fef08a', '#facc15', '#eab308', '#fbbf24', '#f59e0b', '#d97706', '#fb923c', '#f97316', '#ea580c', '#c2410c',
  // Rojos, corales y rosas
  '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#ef4444', '#dc2626', '#b91c1c', '#991b1b',
  // Fucsias, violetas e indigos
  '#f9a8d4', '#ec4899', '#db2777', '#e879f9', '#d946ef', '#a855f7', '#8b5cf6', '#7c3aed', '#6366f1', '#4f46e5',
  // Tierras y neutros
  '#d97757', '#b45309', '#92400e', '#78350f', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a',
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
  const { toast } = useToast();
  const usuario = useSesion();
  const puedeGestionar = useTienePermiso(PERMISOS.CONFIGURACION_GESTIONAR);

  const [orgInfo, setOrgInfo] = useState<OrganizacionMia | null>(null);
  const [color, setColor] = useState(COLOR_PRIMARIO_DEFECTO);
  const [tema, setTema] = useState(TEMA_FONDO_DEFECTO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [explorarColores, setExplorarColores] = useState(false);
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
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-[var(--tf-superficie)] p-8 text-center shadow-sm backdrop-blur">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-lg font-bold text-[var(--tf-acento-rojo)]">
          ✕
        </div>
        <h2 className="text-lg font-bold text-[var(--tf-texto)]">Acceso Restringido</h2>
        <p className="mt-1 text-sm text-[var(--tf-texto-tenue)]">
          Solo el Administrador de la empresa puede personalizar la apariencia.
        </p>
        <button
          onClick={() => router.push('/panel')}
          className="mt-5 rounded-xl border border-[var(--tf-borde-fuerte)] bg-[var(--tf-hover)] px-5 py-2.5 text-sm font-semibold text-[var(--tf-texto)] transition hover:bg-[var(--tf-borde)]"
        >
          Volver a mis proyectos
        </button>
      </div>
    );
  }

  if (cargando) {
    return <EsqueletoLista filas={4} />;
  }

  async function guardar() {
    const colorAnterior = orgInfo?.colorPrimario ?? usuario?.organizacionColor ?? COLOR_PRIMARIO_DEFECTO;
    const temaAnterior = orgInfo?.temaFondo ?? usuario?.organizacionTema ?? TEMA_FONDO_DEFECTO;
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
      setOrgInfo(actualizada);
      setMensaje({ tipo: 'exito', texto: 'Apariencia actualizada.' });
      toast({
        tipo: 'exito',
        titulo: 'Apariencia actualizada',
        descripcion: 'Todos los miembros de tu empresa ven el nuevo tema.',
        duracionMs: 7000,
        accion: {
          etiqueta: 'Deshacer',
          alHacer: async () => {
            const restaurada = await api.patch<OrganizacionMia>('/organizaciones/mia/color', {
              colorPrimario: colorAnterior,
              temaFondo: temaAnterior,
            });
            setColor(restaurada.colorPrimario || COLOR_PRIMARIO_DEFECTO);
            setTema(restaurada.temaFondo || TEMA_FONDO_DEFECTO);
            setOrgInfo(restaurada);
            const cacheActual = leerCacheSesion();
            if (cacheActual?.usuario) {
              guardarCacheSesion({
                ...cacheActual,
                usuario: {
                  ...cacheActual.usuario,
                  organizacionColor: restaurada.colorPrimario,
                  organizacionTema: restaurada.temaFondo,
                },
              });
            }
          },
        },
      });
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
  const colorEfectivo = colorValido ? color : COLOR_PRIMARIO_DEFECTO;
  const colorSecundario = colorSecundarioDeMarca(colorEfectivo);
  const textoSobreColor = colorTextoSobre(colorEfectivo);
  const luminanciaColor = luminanciaRelativa(colorEfectivo);
  const temaPreview = TEMAS.find((t) => t.codigo === tema) ?? TEMAS[0];
  const colorTextoEnChip =
    tema === 'claro-nube' && luminanciaColor > 0.48
      ? '#0f172a'
      : tema !== 'claro-nube' && luminanciaColor < 0.07
      ? '#e2e8f0'
      : colorEfectivo;

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
                  Plan {etiquetaPlan(orgInfo.plan)}
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
          <div className="flex items-center gap-1.5">
            <h2 className="tf-display font-bold text-[var(--tf-texto)]">Tema de fondo</h2>
            <TooltipAyuda
              etiqueta="Ayuda sobre el tema de fondo"
              titulo="Tema global de la empresa"
              texto="Define la paleta de superficies (Medianoche, Grafito o Nube) para todo tu equipo. Las vistas respetan automáticamente los contrastes."
            />
          </div>
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

          <p className="mb-2 mt-7 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--tf-texto-suave)]">
            <span>Colores sugeridos</span>
            <TooltipAyuda
              etiqueta="Ayuda sobre el color primario"
              titulo="Color de marca"
              texto="Tiñe botones principales, enlaces activos y barras de avance. TimeFlow ajusta automáticamente el texto blanco u oscuro para mantener legibilidad."
              tamano={13}
            />
          </p>
          <div className="flex flex-wrap gap-3">
            {PRESETS.map((valor) => {
              const activo = color.toLowerCase() === valor.toLowerCase();
              return (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setColor(valor)}
                  aria-label={`Seleccionar color ${valor}`}
                  className={`grid h-9 w-9 place-items-center rounded-full border-2 transition ${
                    activo
                      ? 'scale-110 border-white ring-2 ring-sky-400/50'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: valor, color: colorTextoSobre(valor) }}
                >
                  {activo && <Check size={14} strokeWidth={2.75} aria-hidden />}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <button
              type="button"
              aria-expanded={explorarColores}
              onClick={() => setExplorarColores((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] px-3.5 py-2 text-xs font-semibold text-[var(--tf-texto)] transition hover:border-[var(--tf-borde-fuerte)] hover:bg-[var(--tf-hover)]"
            >
              <span>Explorar más colores</span>
              <ChevronDown
                size={14}
                aria-hidden
                className={`text-[var(--tf-texto-tenue)] transition-transform duration-200 ${
                  explorarColores ? 'rotate-180' : ''
                }`}
              />
            </button>

            {explorarColores && (
              <div className="mt-3 rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-3.5">
                <div className="grid grid-cols-7 gap-2 sm:grid-cols-10">
                  {PALETA_AMPLIADA.map((valor) => {
                    const activo = color.toLowerCase() === valor.toLowerCase();
                    return (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setColor(valor)}
                        aria-label={`Color ${valor}`}
                        style={{
                          backgroundColor: valor,
                          color: colorTextoSobre(valor),
                        }}
                        className={`grid h-8 w-full place-items-center rounded-lg border transition ${
                          activo
                            ? 'scale-[1.06] border-white ring-2 ring-[var(--color-primario)]'
                            : 'border-black/15 hover:scale-[1.06]'
                        }`}
                      >
                        {activo && <Check size={13} strokeWidth={2.75} aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
              style={
                colorValido
                  ? {
                      background: `linear-gradient(135deg, ${colorEfectivo}, ${colorSecundario})`,
                      color: textoSobreColor,
                    }
                  : undefined
              }
              className="tf-shimmer-cta rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300 disabled:opacity-60"
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
                style={{
                  backgroundColor: colorConAlfa(colorEfectivo, 0.18),
                  color: colorTextoEnChip,
                }}
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
              style={{
                backgroundColor: colorConAlfa(colorEfectivo, 0.16),
                color: colorTextoEnChip,
              }}
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
              style={{
                backgroundColor: colorConAlfa(colorEfectivo, 0.16),
                color: colorTextoEnChip,
              }}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
              Proyectos
            </span>
            <button
              type="button"
              style={{
                background: `linear-gradient(135deg, ${colorEfectivo}, ${colorSecundario})`,
                color: textoSobreColor,
              }}
              className="tf-shimmer-cta rounded-xl px-4 py-2 text-xs font-semibold shadow-sm"
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
