'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ReactFlow, Controls, Connection, Edge, Node, NodeMouseHandler, OnNodeDrag, OnNodesChange, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Marco from '@/components/Marco';
import NodoTarea, { DatosNodoTarea } from '@/components/nodos/NodoTarea';
import NodoRaiz, { DatosNodoRaiz } from '@/components/nodos/NodoRaiz';
import PanelTarea from '@/components/nodos/PanelTarea';
import { llenadoDeBolsa } from '@/components/tesoro/llenado';
import { api, ErrorApi, ProyectoItem, Sesion } from '@/lib/api';
import { Derivacion, NodoActividad } from '@/lib/tipos';
import {
  aplicarPosicionesGuardadas,
  calcularArbol,
  conPosicion,
  desplazamientoRespectoDelPadre,
  Orientacion,
  posicionGuardada,
  Punto,
} from '@/lib/mapaMental';
import { useSesion } from '@/lib/sesion';
import { useTesoro } from '@/lib/tesoro';
import { useColorPrimario } from '@/lib/color';
import { leerCacheSesion, guardarCacheSesion } from '@/lib/cacheSesion';
import { FondoMapa, fondoMapaValido } from '@/lib/fondosMapa';
import { fuenteTitulo } from '@/lib/fuentes';
import SelectorFondo from '@/components/nodos/SelectorFondo';
import { DecoracionFondo, estiloFondoMapa, PuntosFondo } from '@/components/nodos/FondoMapa';

const RAIZ = 'raiz-proyecto';

/** Un movimiento del mapa: que posicion queda en cada nodo (`null` = automatica). */
interface CambioPosiciones {
  orientacion: Orientacion;
  cambios: { id: string; posicion: Punto | null }[];
}

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

  // Fondo del mapa: preferencia de cada usuario, guardada en su cuenta. Mientras
  // se guarda se muestra ya el elegido; si el servidor lo rechaza, vuelve atras.
  const [fondoElegido, setFondoElegido] = useState<FondoMapa | null>(null);
  const fondo = fondoElegido ?? fondoMapaValido(sesionActual?.fondoMapa);
  async function cambiarFondo(nuevo: FondoMapa) {
    const anterior = fondo;
    setFondoElegido(nuevo);
    try {
      await api.patch('/auth/yo/preferencias', { fondoMapa: nuevo });
      const cache = leerCacheSesion();
      if (cache?.usuario) guardarCacheSesion({ ...cache, usuario: { ...cache.usuario, fondoMapa: nuevo } });
    } catch (err) {
      setFondoElegido(anterior);
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo guardar el fondo del mapa.');
    }
  }
  const colorPrimario = useColorPrimario();
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

  // Modo edicion: cada burbuja se deja donde se suelta y queda asi para todo
  // el equipo. Mientras se arrastra, `arrastre` lleva su posicion provisional;
  // `historial` guarda como deshacer cada movimiento (boton o Ctrl+Z).
  const [editando, setEditando] = useState(false);
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number } | null>(null);
  const [historial, setHistorial] = useState<CambioPosiciones[]>([]);

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
    setArrastre(null);
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

  // La tarea de la URL se enfoca una sola vez: si se repitiera en cada recarga
  // del mapa, el panel saltaria de vuelta a ella cada vez que algo cambia.
  const tareaEnfocada = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    const d = await api.get<{ actividades: NodoActividad[]; derivaciones: Derivacion[] }>(
      `/nodos?proyectoId=${proyectoId}`,
    );
    setActividades(d.actividades);
    setDerivaciones(d.derivaciones);
    setCargas((c) => c + 1);

    // Si hay una tarea en el parametro de la URL, seleccionarla y expandir su linaje
    if (tareaParam && tareaEnfocada.current !== tareaParam) {
      tareaEnfocada.current = tareaParam;
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

  // Las monedas se marcan en la bolsa flotante (u otra ventana), que no pasa
  // por el panel: sin esto el porcentaje del nodo quedaba desfasado hasta
  // recargar la pagina.
  const { version: versionTesoro } = useTesoro();
  useEffect(() => {
    if (versionTesoro === 0) return;
    cargar().catch(() => undefined);
  }, [versionTesoro, cargar]);

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

  // Acomodo automatico y, encima, lo que se movio a mano en esta orientacion.
  const arbol = useMemo(
    () => calcularArbol(actividades, expandidoRaiz, expandido, orientacion),
    [actividades, expandidoRaiz, expandido, orientacion],
  );
  const finales = useMemo(
    () => aplicarPosicionesGuardadas(arbol, actividades, orientacion),
    [arbol, actividades, orientacion],
  );

  const { nodos, aristas } = useMemo(() => {
    const { posicionRaiz, raicesProyecto } = arbol;
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
      nodos.push({ id: RAIZ, type: 'raiz', position: posicionRaiz, data: datosRaiz, draggable: false });
    }

    for (const pos of finales.values()) {
      const a = porId.get(pos.id)!;
      const datos: DatosNodoTarea = {
        titulo: a.titulo,
        estado: a.estado,
        color: pos.color,
        llenado: llenadoDeBolsa(a),
        tieneHijos: pos.tieneHijos,
        expandido: expandido.has(a.id),
        orientacion,
        responsableNombre: a.responsable?.nombreCompleto,
        esMiTarea: a.responsableId === sesionActual?.id,
        editando,
        onAlternar: () => alternarNodo(a.id),
        onAgregarHija: (titulo: string) => agregarTarea(titulo, a.id),
      };
      nodos.push({ id: a.id, type: 'tarea', position: { x: pos.x, y: pos.y }, data: datos });

      const padreId = a.actividadPadreId && finales.has(a.actividadPadreId) ? a.actividadPadreId : null;
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
  }, [
    actividades, arbol, finales, nombreProyecto, expandidoRaiz, expandido, orientacion,
    agregarTarea, sesionActual, editando,
  ]);

  /** Ramas de cada tarea: al arrastrar un padre lo acompanan sus descendientes. */
  const descendientes = useCallback(
    (id: string) => {
      const hijosPorPadre = new Map<string, string[]>();
      for (const a of actividades) {
        if (!a.actividadPadreId) continue;
        hijosPorPadre.set(a.actividadPadreId, [...(hijosPorPadre.get(a.actividadPadreId) ?? []), a.id]);
      }
      const resultado = new Set<string>();
      const pendientes = [...(hijosPorPadre.get(id) ?? [])];
      while (pendientes.length) {
        const actual = pendientes.pop()!;
        resultado.add(actual);
        pendientes.push(...(hijosPorPadre.get(actual) ?? []));
      }
      return resultado;
    },
    [actividades],
  );

  // La burbuja arrastrada sigue al puntero y su rama visible la acompana.
  const nodosVisibles = useMemo(() => {
    if (!arrastre) return nodos;
    const origen = finales.get(arrastre.id);
    if (!origen) return nodos;
    const dx = arrastre.x - origen.x;
    const dy = arrastre.y - origen.y;
    const rama = descendientes(arrastre.id);
    return nodos.map((n) =>
      n.id === arrastre.id || rama.has(n.id)
        ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
        : n,
    );
  }, [nodos, arrastre, finales, descendientes]);

  /**
   * Aplica un movimiento al instante y lo guarda para todo el equipo. Si el
   * servidor lo rechaza, se recarga el mapa tal como quedo guardado.
   */
  const aplicarCambios = useCallback(
    (cambio: CambioPosiciones) => {
      const porId = new Map(cambio.cambios.map((c) => [c.id, c.posicion]));
      setActividades((prev) =>
        prev.map((a) =>
          porId.has(a.id)
            ? { ...a, posicionNodo: conPosicion(a, cambio.orientacion, porId.get(a.id)!) }
            : a,
        ),
      );
      return api.patch('/actividades/posiciones', cambio).catch((err) => {
        setAviso(err instanceof ErrorApi ? err.message : 'No se pudo guardar la posición.');
        cargar().catch(() => undefined);
        throw err;
      });
    },
    [cargar],
  );

  /** Mueve nodos dejando anotado como volver atras. */
  const mover = useCallback(
    (cambios: CambioPosiciones['cambios']) => {
      const porId = new Map(actividades.map((a) => [a.id, a]));
      const inverso: CambioPosiciones = {
        orientacion,
        cambios: cambios.map((c) => ({
          id: c.id,
          posicion: posicionGuardada(porId.get(c.id)!, orientacion),
        })),
      };
      setHistorial((h) => [...h.slice(-49), inverso]);
      aplicarCambios({ orientacion, cambios }).catch(() =>
        setHistorial((h) => h.filter((x) => x !== inverso)),
      );
    },
    [actividades, orientacion, aplicarCambios],
  );

  const deshacer = useCallback(() => {
    const ultimo = historial[historial.length - 1];
    if (!ultimo) return;
    setHistorial((h) => h.slice(0, -1));
    aplicarCambios(ultimo).catch(() => undefined);
  }, [historial, aplicarCambios]);

  /** Devuelve todos los nodos de esta orientacion al acomodo automatico. */
  const hayMovidos = actividades.some((a) => posicionGuardada(a, orientacion));
  function restablecer() {
    const movidos = actividades.filter((a) => posicionGuardada(a, orientacion));
    if (movidos.length) mover(movidos.map((a) => ({ id: a.id, posicion: null })));
  }

  // Ctrl+Z (o Cmd+Z) deshace el ultimo movimiento mientras se edita, salvo que
  // se este escribiendo en un campo.
  useEffect(() => {
    if (!editando) return;
    function alTeclear(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      const objetivo = e.target as HTMLElement | null;
      if (objetivo?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      deshacer();
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [editando, deshacer]);

  // El historial es de este proyecto: no se arrastra a otro.
  useEffect(() => setHistorial([]), [proyectoId]);

  /*
   * Medidas de cada burbuja segun React Flow. Como los nodos se rearman en cada
   * cambio, sin devolverle sus medidas React Flow los oculta hasta volver a
   * medirlos, y el encuadre puede dejar fuera a los que aun no se midieron.
   */
  const [medidas, setMedidas] = useState<Record<string, { width: number; height: number }>>({});
  const alCambiarNodos: OnNodesChange = useCallback((cambios) => {
    setMedidas((prev) => {
      let siguiente = prev;
      for (const c of cambios) {
        if (c.type !== 'dimensions' || !c.dimensions) continue;
        const actual = prev[c.id];
        if (actual?.width === c.dimensions.width && actual?.height === c.dimensions.height) continue;
        if (siguiente === prev) siguiente = { ...prev };
        siguiente[c.id] = c.dimensions;
      }
      return siguiente;
    });
  }, []);
  const nodosFlow = useMemo(
    () => nodosVisibles.map((n) => (medidas[n.id] ? { ...n, measured: medidas[n.id] } : n)),
    [nodosVisibles, medidas],
  );

  const alArrastrar: OnNodeDrag = useCallback((_evento, nodo) => {
    setArrastre({ id: nodo.id, x: nodo.position.x, y: nodo.position.y });
  }, []);

  /** Al soltar una burbuja queda exactamente donde se dejo. */
  const alSoltar: OnNodeDrag = useCallback(
    (_evento, nodo) => {
      setArrastre(null);
      const a = actividades.find((x) => x.id === nodo.id);
      const origen = finales.get(nodo.id);
      if (!a || !origen) return;
      if (Math.abs(nodo.position.x - origen.x) < 1 && Math.abs(nodo.position.y - origen.y) < 1) return;
      mover([{ id: a.id, posicion: desplazamientoRespectoDelPadre(a, nodo.position, finales, arbol.posicionRaiz) }]);
    },
    [actividades, finales, arbol, mover],
  );

  function alternarEdicion() {
    setEditando((v) => !v);
    setArrastre(null);
  }


  if (!proyectoId) {
    if (buscandoProyecto) {
      return (
        <Marco activo="/nodos" titulo="Mapa de nodos" subtitulo="Localizando tu tarea en curso...">
          <div className="grid place-items-center rounded-2xl border border-white/10 bg-slate-900 p-16 text-center backdrop-blur">
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
            style={{ backgroundColor: colorPrimario }}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
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
        <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
            <h2
              className={`${fuenteTitulo.className} min-w-0 truncate text-lg font-bold tracking-[-0.02em] text-white`}
              title={nombreProyecto ?? undefined}
            >
              {nombreProyecto}
            </h2>
            <div className="flex items-center gap-2">
              <SelectorFondo valor={fondo} onCambiar={cambiarFondo} />
              {!esTrabajador && (
                <button
                  aria-pressed={editando}
                  onClick={alternarEdicion}
                  title="Arrastra las tareas y déjalas donde quieras"
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                    editando
                      ? 'border-amber-400/50 bg-amber-500/20 font-semibold text-amber-200'
                      : 'border-white/10 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span aria-hidden>✥</span>
                  {editando ? 'Listo' : 'Editar mapa'}
                </button>
              )}
              {editando && (
                <>
                  <button
                    onClick={deshacer}
                    disabled={historial.length === 0}
                    title="Deshacer el último movimiento (Ctrl+Z)"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1 text-xs text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span aria-hidden>↶</span>
                    Deshacer
                  </button>
                  <button
                    onClick={restablecer}
                    disabled={!hayMovidos}
                    title="Devolver todos los nodos al acomodo automático en esta orientación"
                    className="rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1 text-xs text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Restablecer
                  </button>
                </>
              )}
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
          </div>
          <div className="relative" style={{ height: '32rem', ...estiloFondoMapa(fondo) }}>
            <DecoracionFondo fondo={fondo} />
            <ReactFlow
              style={{ background: 'transparent' }}
              nodes={nodosFlow}
              edges={aristas}
              onNodesChange={alCambiarNodos}
              nodeTypes={TIPOS_NODO}
              onConnect={esTrabajador ? undefined : alConectar}
              onNodeClick={alHacerClicEnNodo}
              nodesDraggable={editando}
              onNodeDrag={alArrastrar}
              onNodeDragStop={alSoltar}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
              colorMode="dark"
            >
              <AjustarVista
                clave={`${orientacion}-${cargas}-${expandidoRaiz}-${[...expandido].sort().join(',')}`}
              />
              <PuntosFondo fondo={fondo} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </section>

        <aside className="w-full shrink-0 rounded-2xl border border-white/10 bg-slate-900 p-5 backdrop-blur lg:w-80">
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
