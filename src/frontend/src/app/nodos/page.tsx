'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ReactFlow, Background, Controls, Connection, Edge, Node, NodeMouseHandler, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Marco from '@/components/Marco';
import NodoTarea, { DatosNodoTarea } from '@/components/nodos/NodoTarea';
import NodoRaiz, { DatosNodoRaiz } from '@/components/nodos/NodoRaiz';
import PanelTarea from '@/components/nodos/PanelTarea';
import { api, ErrorApi, ProyectoItem, Sesion } from '@/lib/api';
import { Derivacion, NodoActividad } from '@/lib/tipos';
import { calcularArbol, Orientacion } from '@/lib/mapaMental';
import { useSesion } from '@/lib/sesion';

const RAIZ = 'raiz-proyecto';

/**
 * Reencuadra el mapa cuando cambia su forma (expandir, colapsar, recargar,
 * girar). Antes se lograba remontando ReactFlow entero con `key`, lo que
 * destruia y volvia a crear todos los nodos en cada clic.
 */
function AjustarVista({ clave }: { clave: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = requestAnimationFrame(() => fitView({ padding: 0.3, duration: 250 }));
    return () => cancelAnimationFrame(id);
  }, [clave, fitView]);
  return null;
}
const TIPOS_NODO = { raiz: NodoRaiz, tarea: NodoTarea };
const CLAVE_ORIENTACION = 'tf_nodos_orientacion';

const ORIENTACIONES: { valor: Orientacion; texto: string; icono: string; titulo: string }[] = [
  { valor: 'horizontal', texto: 'Horizontal', icono: '→', titulo: 'De izquierda a derecha' },
  { valor: 'vertical', texto: 'Vertical', icono: '↓', titulo: 'De arriba a abajo' },
];

/** US-05 y US-06 — mapa mental de tareas del proyecto y sus derivaciones. */
export default function Pagina() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400">
          Cargando…
        </main>
      }
    >
      <Nodos />
    </Suspense>
  );
}

function Nodos() {
  const router = useRouter();
  const sesionActual = useSesion();
  const esTrabajador = sesionActual?.rol === 'TRABAJADOR';
  const esSupervisor = sesionActual?.rol === 'SUPERVISOR';
  const esAdmin = sesionActual?.rol === 'ADMINISTRADOR';

  const parametros = useSearchParams();
  const proyectoId = parametros.get('proyectoId');
  const nombreProyecto = parametros.get('nombre');
  const tareaParam = parametros.get('tarea');

  const [actividades, setActividades] = useState<NodoActividad[]>([]);
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargas, setCargas] = useState(0);
  const [buscandoProyecto, setBuscandoProyecto] = useState(!proyectoId);

  // El arbol parte colapsado o expande la raiz si ya se solicita una tarea
  const [expandidoRaiz, setExpandidoRaiz] = useState(Boolean(tareaParam));
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [tareaSeleccionada, setTareaSeleccionada] = useState<string | null>(tareaParam);

  // Si entra a /nodos sin proyectoId, redirigir automáticamente a la tarea activa o su primer proyecto
  useEffect(() => {
    if (!proyectoId) {
      setBuscandoProyecto(true);
      api
        .get<Sesion | null>('/sesiones/activa')
        .then((s) => {
          if (s?.actividad?.proyectoId) {
            const nom = s.actividad.proyecto?.nombre || 'Proyecto';
            router.replace(
              `/nodos?proyectoId=${s.actividad.proyectoId}&nombre=${encodeURIComponent(
                nom,
              )}&tarea=${s.actividad.id}`,
            );
          } else {
            api
              .get<ProyectoItem[]>('/proyectos/mios')
              .then((projs) => {
                if (projs && projs.length > 0) {
                  router.replace(
                    `/nodos?proyectoId=${projs[0].id}&nombre=${encodeURIComponent(projs[0].nombre)}`,
                  );
                } else {
                  setBuscandoProyecto(false);
                }
              })
              .catch(() => setBuscandoProyecto(false));
          }
        })
        .catch(() => setBuscandoProyecto(false));
    }
  }, [proyectoId, router]);

  // Sentido del arbol. Se recuerda en el navegador para no tener que elegirlo
  // en cada visita; parte horizontal, que es como estaba antes.
  const [orientacion, setOrientacion] = useState<Orientacion>('horizontal');
  useEffect(() => {
    try {
      const guardada = window.localStorage.getItem(CLAVE_ORIENTACION);
      if (guardada === 'vertical' || guardada === 'horizontal') setOrientacion(guardada);
    } catch {
      /* almacenamiento bloqueado: queda la orientacion por defecto */
    }
  }, []);
  function cambiarOrientacion(valor: Orientacion) {
    setOrientacion(valor);
    try {
      window.localStorage.setItem(CLAVE_ORIENTACION, valor);
    } catch {
      /* sin persistencia, pero el cambio aplica igual en esta visita */
    }
  }

  const alHacerClicEnNodo: NodeMouseHandler = useCallback((_evento, nodo) => {
    if (nodo.id === RAIZ) return;
    setTareaSeleccionada(nodo.id);
  }, []);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    const d = await api.get<{ actividades: NodoActividad[]; derivaciones: Derivacion[] }>(
      `/nodos?proyectoId=${proyectoId}`,
    );
    setActividades(d.actividades);
    setDerivaciones(d.derivaciones);
    setCargas((c) => c + 1);

    // Si hay una tarea en el parametro de la URL, seleccionarla y expandir su linaje
    if (tareaParam) {
      const encontrada = d.actividades.find((a) => a.id === tareaParam);
      if (encontrada) {
        setTareaSeleccionada(encontrada.id);
        setExpandidoRaiz(true);
        const ancestros = new Set<string>();
        let padreId = encontrada.actividadPadreId;
        while (padreId) {
          ancestros.add(padreId);
          const p = d.actividades.find((a) => a.id === padreId);
          padreId = p?.actividadPadreId ?? null;
        }
        if (ancestros.size > 0) {
          setExpandido((prev) => new Set([...prev, ...ancestros]));
        }
      }
    }
  }, [proyectoId, tareaParam]);

  useEffect(() => {
    cargar().catch((err) => {
      if (err instanceof ErrorApi && err.estado === 401) router.replace('/login');
      else setAviso('No se pudo conectar con el servidor.');
    });
  }, [cargar, router]);

  const agregarTarea = useCallback(
    async (titulo: string, actividadPadreId?: string) => {
      if (!proyectoId) return;
      try {
        await api.post('/actividades', { proyectoId, titulo, actividadPadreId });
        // Al agregar una hija se despliega su padre, para que la tarea nueva
        // quede visible de inmediato en vez de perderse en una rama cerrada.
        if (actividadPadreId) {
          setExpandido((prev) => new Set(prev).add(actividadPadreId));
        } else {
          setExpandidoRaiz(true);
        }
        await cargar();
      } catch (err) {
        setAviso(err instanceof ErrorApi ? err.message : 'No se pudo crear la tarea.');
      }
    },
    [proyectoId, cargar],
  );

  const alConectar = useCallback(
    async (conexion: Connection) => {
      const origen = conexion.source;
      const destino = conexion.target;
      if (!origen || !destino || destino === RAIZ) return;
      const nuevoPadre = origen === RAIZ ? null : origen;
      try {
        await api.patch(`/actividades/${destino}`, { actividadPadreId: nuevoPadre });
        if (origen === RAIZ) setExpandidoRaiz(true);
        else setExpandido((prev) => new Set(prev).add(origen));
        await cargar();
      } catch (err) {
        setAviso(err instanceof ErrorApi ? err.message : 'No se pudo unir esa tarea.');
      }
    },
    [cargar],
  );

  function alternarRaiz() {
    setExpandidoRaiz((v) => !v);
  }

  function alternarNodo(id: string) {
    setExpandido((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  const { nodos, aristas } = useMemo(() => {
    const { posiciones, posicionRaiz, raicesProyecto } = calcularArbol(
      actividades,
      expandidoRaiz,
      expandido,
      orientacion,
    );
    const porId = new Map(actividades.map((a) => [a.id, a]));

    const nodos: Node[] = [];
    const aristas: Edge[] = [];

    if (nombreProyecto) {
      const datosRaiz: DatosNodoRaiz = {
        nombre: nombreProyecto,
        tieneHijos: raicesProyecto.length > 0,
        expandido: expandidoRaiz,
        orientacion,
        onAlternar: alternarRaiz,
        onAgregarHija: (titulo: string) => agregarTarea(titulo),
      };
      nodos.push({ id: RAIZ, type: 'raiz', position: posicionRaiz, data: datosRaiz });
    }

    for (const pos of posiciones.values()) {
      const a = porId.get(pos.id)!;
      const datos: DatosNodoTarea = {
        titulo: a.titulo,
        estado: a.estado,
        color: pos.color,
        tieneHijos: pos.tieneHijos,
        expandido: expandido.has(a.id),
        orientacion,
        responsableNombre: a.responsable?.nombreCompleto,
        esMiTarea: a.responsableId === sesionActual?.id,
        onAlternar: () => alternarNodo(a.id),
        onAgregarHija: (titulo: string) => agregarTarea(titulo, a.id),
      };
      nodos.push({ id: a.id, type: 'tarea', position: { x: pos.x, y: pos.y }, data: datos });

      const padreId = a.actividadPadreId && posiciones.has(a.actividadPadreId) ? a.actividadPadreId : null;
      if (padreId) {
        aristas.push({
          id: `${padreId}-${a.id}`,
          source: padreId,
          target: a.id,
          type: 'default',
          style: { stroke: pos.color, strokeWidth: 2, opacity: 0.55 },
        });
      } else if (pos.profundidad === 1 && nombreProyecto) {
        aristas.push({
          id: `${RAIZ}-${a.id}`,
          source: RAIZ,
          target: a.id,
          type: 'default',
          style: { stroke: pos.color, strokeWidth: 2.5, opacity: 0.7 },
        });
      }
    }

    return { nodos, aristas };
  }, [actividades, nombreProyecto, expandidoRaiz, expandido, orientacion, agregarTarea, sesionActual]);

  if (!proyectoId) {
    if (buscandoProyecto) {
      return (
        <Marco activo="/nodos" titulo="Mapa de nodos" subtitulo="Localizando tu tarea en curso...">
          <div className="grid place-items-center rounded-2xl border border-white/10 bg-slate-900/60 p-16 text-center backdrop-blur">
            <div className="flex flex-col items-center gap-3">
              <span className="relative flex h-5 w-5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-5 w-5 rounded-full bg-emerald-500" />
              </span>
              <p className="text-sm font-semibold text-white">Abriendo tu tarea activa...</p>
              <p className="text-xs text-slate-400">Te estamos llevando directo al cronómetro de tu proyecto.</p>
            </div>
          </div>
        </Marco>
      );
    }

    return (
      <Marco activo="/nodos" titulo="Mapa de nodos" subtitulo="Flujo de tareas y derivaciones">
        <div className="grid place-items-center rounded-2xl border border-dashed border-white/15 p-16 text-center">
          <p className="mb-4 max-w-sm text-sm text-slate-400">
            No tienes proyectos o tareas asignadas por el momento. Entra a Proyectos para explorar o crear un nuevo proyecto.
          </p>
          <Link
            href="/panel"
            className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-indigo-400"
          >
            Ir a Proyectos
          </Link>
        </div>
      </Marco>
    );
  }

  return (
    <Marco
      activo="/nodos"
      titulo="Mapa de nodos"
      subtitulo={`Tareas de "${nombreProyecto}"`}
      acciones={
        <div className="flex items-center gap-2">
          {esTrabajador ? (
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
              Vista Colaborativa · Equipo del Proyecto
            </span>
          ) : esSupervisor ? (
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
              Vista Supervisor · Flujo completo del equipo
            </span>
          ) : (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              Vista Administrador · Control total
            </span>
          )}
        </div>
      }
    >
      {aviso && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300"
        >
          {aviso}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
            <p className="text-xs text-slate-400">Sentido del arbol</p>
            <div className="flex rounded-lg border border-white/10 bg-slate-950/60 p-0.5" role="radiogroup">
              {ORIENTACIONES.map((o) => (
                <button
                  key={o.valor}
                  role="radio"
                  aria-checked={orientacion === o.valor}
                  title={o.titulo}
                  onClick={() => cambiarOrientacion(o.valor)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition ${
                    orientacion === o.valor
                      ? 'bg-sky-500/20 font-semibold text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span aria-hidden>{o.icono}</span>
                  {o.texto}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: '32rem' }}>
            <ReactFlow
              nodes={nodos}
              edges={aristas}
              nodeTypes={TIPOS_NODO}
              onConnect={esTrabajador ? undefined : alConectar}
              onNodeClick={alHacerClicEnNodo}
              nodesDraggable={false}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
              colorMode="dark"
            >
              <AjustarVista
                clave={`${orientacion}-${cargas}-${expandidoRaiz}-${[...expandido].sort().join(',')}`}
              />
              <Background color="rgba(255,255,255,0.08)" gap={18} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <p className="border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">
            {esTrabajador
              ? 'Haz clic en el círculo del borde de una burbuja para desplegar tareas, pasa el mouse sobre ella para agregarle una nueva, o haz clic en cualquier tarea para ver su detalle, cronometrar o subir evidencias.'
              : 'Haz clic en el círculo del borde de una burbuja para desplegar sus tareas, pasa el mouse sobre ella para agregarle una nueva, o arrastra desde su borde hacia otra para unirlas. Con el selector de arriba eliges si el árbol crece hacia la derecha o hacia abajo.'}
          </p>
        </section>

        <aside className="w-full shrink-0 rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur lg:w-80">
          {tareaSeleccionada ? (
            <PanelTarea
              key={tareaSeleccionada}
              actividadId={tareaSeleccionada}
              onCerrar={() => setTareaSeleccionada(null)}
              onCambio={cargar}
            />
          ) : (
            <>
              <h2 className="mb-1 font-bold text-white">Derivaciones</h2>
              <p className="mb-4 text-xs text-slate-400">
                Traspasos de responsable, con su motivo y su fecha.
              </p>

              {derivaciones.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-xs text-slate-500">
                  Sin derivaciones registradas.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {derivaciones.map((d) => (
                    <div key={d.id} className="rounded-xl border border-white/10 p-3">
                      <p className="text-sm font-semibold leading-snug text-white">
                        {d.actividad.titulo}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {d.deUsuario.nombreCompleto} → {d.aUsuario.nombreCompleto}
                      </p>
                      <p className="mt-1.5 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                        {d.motivo}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {new Date(d.ocurridoEn).toLocaleDateString('es-CL')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </Marco>
  );
}
