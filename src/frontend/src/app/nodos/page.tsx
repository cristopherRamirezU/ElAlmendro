'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ReactFlow, Controls, MiniMap, Connection, ConnectionMode, Edge, Node, NodeMouseHandler, OnEdgesChange, OnNodeDrag,
  OnNodesChange, Position, ReactFlowInstance, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertCircle, Check, Loader2, Map as IconoMapa, Maximize2, Redo2, Trash2, Undo2 } from 'lucide-react';
import Marco, { ControlesUsuarioBarra } from '@/components/Marco';
import NodoTarea, { DatosNodoTarea } from '@/components/nodos/NodoTarea';
import NodoRaiz, { DatosNodoRaiz } from '@/components/nodos/NodoRaiz';
import AristaMapa, { DatosAristaMapa } from '@/components/nodos/AristaMapa';
import { type Ancla, idManilla } from '@/components/nodos/orientacion';
import PanelTarea from '@/components/nodos/PanelTarea';
import Modal from '@/components/ui/Modal';
import ModalConfirmacion from '@/components/ui/ModalConfirmacion';
import Selector from '@/components/ui/Selector';
import { EsqueletoMapa, EsqueletoPagina } from '@/components/ui/Esqueleto';
import { useToast } from '@/components/ui/Toast';
import { llenadoDeBolsa } from '@/components/tesoro/llenado';
import { api, ErrorApi, MiembroProyecto, ProyectoItem, Sesion } from '@/lib/api';
import { estadoDeActividad, tiempoRelativo } from '@/lib/formato';
import { ContextoEquipoUsuario, Derivacion, NodoActividad } from '@/lib/tipos';
import {
  ALTO_NODO,
  ALTO_RAIZ,
  ANCHO_NODO,
  ANCHO_RAIZ,
  aplicarPosicionesGuardadas,
  calcularArbol,
  conLados,
  conPosicion,
  desplazamientoRespectoDelPadre,
  LadoLinea,
  LadosFijados,
  ladosGuardados,
  Orientacion,
  posicionGuardada,
  posicionInsignia,
  Punto,
  validarCambioPadre,
} from '@/lib/mapaMental';
import { Caja, ladosEnfrentados } from '@/lib/rutasAristas';
import { useSesion, useTienePermiso } from '@/lib/sesion';
import { PERMISOS } from '@/lib/rbac';
import { useTesoro } from '@/lib/tesoro';
import { useColorPrimario } from '@/lib/color';
import { useTemaFondo } from '@/lib/tema';
import { leerCacheSesion, guardarCacheSesion } from '@/lib/cacheSesion';
import { esFondoMapaClaro, FondoMapa, fondoMapaValido } from '@/lib/fondosMapa';
import { fuenteTitulo } from '@/lib/fuentes';
import SelectorFondo from '@/components/nodos/SelectorFondo';
import { DecoracionFondo, estiloFondoMapa, PuntosFondo } from '@/components/nodos/FondoMapa';

const RAIZ = 'raiz-proyecto';
const CLAVE_MINIMAPA = 'tf_nodos_minimap';

/** Un movimiento del mapa: que posicion queda en cada nodo (`null` = automatica). */
interface CambioPosiciones {
  orientacion: Orientacion;
  cambios: { id: string; posicion: Punto | null }[];
}

type EntradaHistorial =
  | { tipo: 'posiciones'; antes: CambioPosiciones; despues: CambioPosiciones }
  | {
      tipo: 'lados';
      orientacion: Orientacion;
      destinoId: string;
      antes: LadosFijados | null;
      despues: LadosFijados | null;
    };

type EstadoGuardadoMapa = 'inactivo' | 'guardando' | 'guardado' | 'error';

/**
 * Reencuadra el mapa cuando cambia su forma (expandir, colapsar, recargar,
 * girar). Antes se lograba remontando ReactFlow entero con `key`, lo que
 * destruia y volvia a crear todos los nodos en cada clic.
 */
function AjustarVista({ clave }: { clave: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => fitView({ ...ENCUADRE, duration: 250 }));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [clave, fitView]);
  return null;
}
const TIPOS_NODO = { raiz: NodoRaiz, tarea: NodoTarea };
/**
 * Ritmo de la entrada (segundos, como en el diseno): cada linea empieza a
 * dibujarse en RETRASO_LINEA, cada tarea brota en RETRASO_TAREA, y la
 * siguiente espera PASO_ENTRADA mas que la anterior.
 */
const RETRASO_LINEA = 0.45;
const RETRASO_TAREA = 0.75;
const PASO_ENTRADA = 0.18;
/**
 * Encuadre automatico. Con pocos nodos (o solo el principal) React Flow
 * acercaba hasta el doble, y el menu del nodo principal quedaba cortado por
 * el borde del mapa; mas alla de 1,25x no se acerca solo.
 */
const ENCUADRE = { padding: 0.25, maxZoom: 1.15, minZoom: 0.35 };
const TIPOS_ARISTA = { mapa: AristaMapa };
const CLAVE_ORIENTACION = 'tf_nodos_orientacion';

/**
 * Textos de accesibilidad del mapa en espanol (React Flow los trae en ingles):
 * los leen los lectores de pantalla al recorrer nodos y lineas con el teclado.
 */
const DIRECCIONES: Record<string, string> = { up: 'arriba', down: 'abajo', left: 'la izquierda', right: 'la derecha' };
const TEXTOS_ACCESIBLES = {
  'node.a11yDescription.default':
    'Presiona Enter o Espacio para seleccionar un nodo. En modo edición puedes moverlo con las flechas; Escape cancela.',
  'node.a11yDescription.keyboardDisabled': 'Presiona Enter o Espacio para seleccionar un nodo.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }: { direction: string; x: number; y: number }) =>
    `Nodo movido hacia ${DIRECCIONES[direction] ?? direction}, a la posición x ${x}, y ${y}.`,
  'edge.a11yDescription.default':
    'Presiona Enter o Espacio para seleccionar una línea. En modo edición puedes elegir por dónde sale y por dónde llega.',
  'controls.ariaLabel': 'Controles del mapa',
  'controls.zoomIn.ariaLabel': 'Acercar',
  'controls.zoomOut.ariaLabel': 'Alejar',
  'controls.fitView.ariaLabel': 'Encuadrar el mapa',
  'controls.interactive.ariaLabel': 'Bloquear o desbloquear el mapa',
  'minimap.ariaLabel': 'Minimapa',
  'handle.ariaLabel': 'Punto de conexión',
};

/** Opciones del panel de la linea seleccionada ('' = la elige el mapa). */
const OPCIONES_LADO: { valor: LadoLinea | ''; texto: string }[] = [
  { valor: '', texto: 'Automático' },
  { valor: 'top', texto: 'Arriba' },
  { valor: 'bottom', texto: 'Abajo' },
  { valor: 'left', texto: 'Izquierda' },
  { valor: 'right', texto: 'Derecha' },
];

/** El borde de una manilla a partir de su id ("salida-top" -> "top"). */
/** Margen que se deja bajo el mapa para aprovechar al máximo la pantalla. */
const MARGEN_BAJO_MAPA = 12;
/** Alto minimo del mapa en pantallas bajas: debajo de esto la pagina se desplaza. */
const ALTO_MINIMO_MAPA = 512;

/**
 * Caja del mapa: se estira hasta el borde inferior de la ventana (menos el
 * margen del marco), mida lo que mida lo de arriba (cabecera, barra de
 * edicion). Se vuelve a medir al cambiar el tamano de la ventana o lo de arriba.
 */
function CajaMapa({
  className,
  style,
  children,
}: {
  className: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState<number | null>(null);
  useEffect(() => {
    const medir = () => {
      const el = caja.current;
      if (!el) return;
      const arriba = el.getBoundingClientRect().top + window.scrollY;
      // Se resta 1 px por el borde de la tarjeta del mapa, para que la pagina no se desplace.
      setAlto(Math.max(ALTO_MINIMO_MAPA, Math.floor(window.innerHeight - arriba - MARGEN_BAJO_MAPA - 1)));
    };
    medir();
    window.addEventListener('resize', medir);
    // Lo de arriba puede crecer (p. ej. la barra de edicion del mapa): se vuelve a medir.
    const ro = new ResizeObserver(medir);
    if (caja.current?.parentElement) ro.observe(caja.current.parentElement);
    return () => {
      window.removeEventListener('resize', medir);
      ro.disconnect();
    };
  }, []);
  return (
    <div
      ref={caja}
      className={className}
      style={{ height: alto ?? 'max(32rem, calc(100vh - 15rem))', ...style }}
    >
      {children}
    </div>
  );
}

function ladoDeManilla(id: string | null | undefined): LadoLinea | undefined {
  const lado = id?.split('-')[1];
  return lado === 'top' || lado === 'right' || lado === 'bottom' || lado === 'left' ? lado : undefined;
}

const ORIENTACIONES: { valor: Orientacion; texto: string; icono: string; titulo: string }[] = [
  { valor: 'horizontal', texto: 'Horizontal', icono: '→', titulo: 'De izquierda a derecha' },
  { valor: 'vertical', texto: 'Vertical', icono: '↓', titulo: 'De arriba a abajo' },
];

/** US-05 y US-06 — mapa mental de tareas del proyecto y sus derivaciones. */
export default function Pagina() {
  return (
    <Suspense fallback={<EsqueletoPagina />}>
      <Nodos />
    </Suspense>
  );
}

function Nodos() {
  const router = useRouter();
  const { toast } = useToast();
  const sesionActual = useSesion();

  const temaEsClaro = useTemaFondo() === 'claro-nube';
  // Fondo del mapa: preferencia de cada usuario, guardada en su cuenta. Mientras
  // se guarda se muestra ya el elegido; si el servidor lo rechaza, vuelve atras.
  const [fondoElegido, setFondoElegido] = useState<FondoMapa | null>(null);
  const fondo = fondoElegido ?? fondoMapaValido(sesionActual?.fondoMapa, temaEsClaro);
  const esClaro = esFondoMapaClaro(fondo);
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
  // "Tarea para alguien" asigna trabajo: lo ofrece solo a quien puede asignar.
  const puedeAsignar = useTienePermiso(PERMISOS.ACTIVIDADES_GESTIONAR);
  // Mientras el menu del nodo principal esta abierto, el resto del mapa se desenfoca.
  const [raizEnfocada, setRaizEnfocada] = useState(false);
  // Editar el mapa lo da el rol (administrador, supervisor) o un permiso extra
  // que el administrador le dio a un trabajador.
  const puedeEditarMapa = useTienePermiso(PERMISOS.NODOS_EDITAR);
  const tienePermisoEliminar = useTienePermiso(PERMISOS.ACTIVIDADES_ELIMINAR);
  const puedeEliminarNodo = tienePermisoEliminar || sesionActual?.rol === 'SUPER_ADMIN';

  const parametros = useSearchParams();
  const proyectoId = parametros.get('proyectoId');
  const nombreProyecto = parametros.get('nombre');
  const tareaParam = parametros.get('tarea');
  const abrirParam = parametros.get('abrir');

  const [actividades, setActividades] = useState<NodoActividad[]>([]);
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([]);
  const [miembros, setMiembros] = useState<MiembroProyecto[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargas, setCargas] = useState(0);
  const [buscandoProyecto, setBuscandoProyecto] = useState(!proyectoId);

  // Indicador discreto en tiempo real del autoguardado en el editor.
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardadoMapa>('inactivo');
  const timerGuardadoRef = useRef<number | null>(null);
  const reintentoGuardadoRef = useRef<(() => void) | null>(null);
  const notificarGuardado = useCallback(
    (estado: 'guardando' | 'guardado' | 'error', reintentar?: () => void) => {
      if (timerGuardadoRef.current) {
        window.clearTimeout(timerGuardadoRef.current);
        timerGuardadoRef.current = null;
      }
      setEstadoGuardado(estado);
      reintentoGuardadoRef.current = estado === 'error' ? reintentar ?? null : null;
      if (estado === 'guardado') {
        timerGuardadoRef.current = window.setTimeout(() => {
          setEstadoGuardado('inactivo');
        }, 3200);
      }
    },
    [],
  );
  useEffect(() => {
    return () => {
      if (timerGuardadoRef.current) window.clearTimeout(timerGuardadoRef.current);
    };
  }, []);

  // Al abrir el proyecto se despliegan solas las tareas de primer nivel (las
  // subtareas no: cada rama parte colapsada).
  const [expandidoRaiz, setExpandidoRaiz] = useState(true);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [tareaSeleccionada, setTareaSeleccionada] = useState<string | null>(tareaParam);
  // Las derivaciones se consultan en una ventana emergente: el mapa usa todo el ancho.
  const [verDerivaciones, setVerDerivaciones] = useState(false);

  // Modo edicion: cada burbuja se deja donde se suelta y queda asi para todo
  // el equipo. Mientras se arrastra, `arrastre` lleva su posicion provisional;
  // `historial` y `futuro` permiten Deshacer (Ctrl+Z) y Rehacer (Ctrl+Y / Ctrl+Shift+Z).
  const [editando, setEditando] = useState(false);
  const [nodoSeleccionadoId, setNodoSeleccionadoId] = useState<string | null>(null);
  const [nodoPorEliminar, setNodoPorEliminar] = useState<NodoActividad | null>(null);
  const [eliminandoNodo, setEliminandoNodo] = useState(false);
  const [mostrarMinimapa, setMostrarMinimapa] = useState(true);
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_MINIMAPA);
      if (guardado === 'si') setMostrarMinimapa(true);
      else if (guardado === 'no') setMostrarMinimapa(false);
      else setMostrarMinimapa(window.innerWidth >= 1024);
    } catch {
      /* almacenamiento bloqueado */
    }
  }, []);
  const alternarMinimapa = useCallback(() => {
    setMostrarMinimapa((v) => {
      const siguiente = !v;
      try {
        window.localStorage.setItem(CLAVE_MINIMAPA, siguiente ? 'si' : 'no');
      } catch {
        /* ignorar */
      }
      return siguiente;
    });
  }, []);

  // Linea seleccionada en modo edicion: su panel deja elegir sus bordes.
  const [aristaSeleccionada, setAristaSeleccionada] = useState<string | null>(null);
  // Linea cuyo extremo se esta arrastrando: solo puede soltarse en sus mismos
  // nodos. Mientras tanto los bordes reciben el extremo y se anota donde esta
  // el puntero, para pegar la linea en el punto exacto donde se suelta.
  const reconectando = useRef<Edge | null>(null);
  const [recibiendoExtremo, setRecibiendoExtremo] = useState(false);
  const ultimoPuntero = useRef<{ x: number; y: number } | null>(null);
  const instanciaMapa = useRef<ReactFlowInstance | null>(null);
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number } | null>(null);
  const [historial, setHistorial] = useState<EntradaHistorial[]>([]);
  const [futuro, setFuturo] = useState<EntradaHistorial[]>([]);

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

  const alHacerClicEnNodo: NodeMouseHandler = useCallback(
    (_evento, nodo) => {
      if (nodo.id === RAIZ) {
        if (editando) setNodoSeleccionadoId(null);
        return;
      }
      if (editando) {
        setNodoSeleccionadoId(nodo.id);
        return;
      }
      setTareaSeleccionada(nodo.id);
    },
    [editando],
  );

  const alHacerDobleClicEnNodo: NodeMouseHandler = useCallback((_evento, nodo) => {
    if (nodo.id === RAIZ) return;
    setTareaSeleccionada(nodo.id);
  }, []);

  // Pedido explicito de abrir la tarea de la URL (por ejemplo desde "Ir a la
  // tarea" del aviso de jornada): reabre su popup aunque ya se hubiera cerrado.
  useEffect(() => {
    if (abrirParam && tareaParam) setTareaSeleccionada(tareaParam);
  }, [abrirParam, tareaParam]);

  // La tarea de la URL se enfoca una sola vez: si se repitiera en cada recarga
  // del mapa, el panel saltaria de vuelta a ella cada vez que algo cambia.
  const tareaEnfocada = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    const [d, listaMiembros] = await Promise.all([
      api.get<{ actividades: NodoActividad[]; derivaciones: Derivacion[] }>(
        `/nodos?proyectoId=${proyectoId}`,
      ),
      api.get<MiembroProyecto[]>(`/proyectos/${proyectoId}/miembros`).catch(() => [] as MiembroProyecto[]),
    ]);
    setActividades(d.actividades);
    setDerivaciones(d.derivaciones);
    setMiembros(listaMiembros);
    setCargas((c) => c + 1);
    setAviso(null);

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
      else setAviso(err instanceof ErrorApi ? err.message : 'No se pudo conectar con el servidor.');
    });
  }, [cargar, router]);

  const contextoEquipo = useMemo(() => {
    const mapa: Record<string, ContextoEquipoUsuario> = {};
    for (const m of miembros) {
      mapa[m.id] = { rol: m.rol, rolEnProyecto: m.rolEnProyecto, activas: 0, pendientes: 0, total: 0 };
    }
    for (const a of actividades) {
      const uid = a.responsableId ?? a.responsable?.id;
      if (!uid) continue;
      if (!mapa[uid]) mapa[uid] = { activas: 0, pendientes: 0, total: 0 };
      mapa[uid].total += 1;
      if (a.estado === 'EN_PROGRESO') mapa[uid].activas += 1;
      else if (a.estado === 'PENDIENTE' || a.estado === 'BLOQUEADA' || a.estado === 'INCONCLUSA') {
        mapa[uid].pendientes += 1;
      }
    }
    return mapa;
  }, [miembros, actividades]);

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

  /**
   * "Tarea para alguien" desde el nodo principal: la crea ya con responsable.
   * Devuelve el motivo si el servidor la rechaza, para mostrarlo ahi mismo.
   */
  const agregarTareaPara = useCallback(
    async (titulo: string, responsableId: string): Promise<string | null> => {
      if (!proyectoId) return 'No hay un proyecto abierto.';
      try {
        await api.post('/actividades', { proyectoId, titulo, responsableId });
        setExpandidoRaiz(true);
        await cargar();
        return null;
      } catch (err) {
        return err instanceof ErrorApi ? err.message : 'No se pudo crear la tarea.';
      }
    },
    [proyectoId, cargar],
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

  /*
   * Entrada al mapa: primero aparece la insignia y despues, una por una, cada
   * tarea de primer nivel con su linea. Ocurre una vez al abrir el proyecto,
   * no cada vez que se despliega algo. `entrada` da el turno de cada tarea.
   */
  const [entrada, setEntrada] = useState<Map<string, number> | null>(null);
  const proyectoAnimado = useRef<string | null>(null);
  useEffect(() => {
    if (!proyectoId || cargas === 0 || proyectoAnimado.current === proyectoId) return;
    proyectoAnimado.current = proyectoId;
    setEntrada(new Map(arbol.raicesProyecto.map((a, i) => [a.id, i])));
  }, [proyectoId, cargas, arbol.raicesProyecto]);
  useEffect(() => {
    if (!entrada) return;
    const id = window.setTimeout(() => setEntrada(null), (RETRASO_TAREA + entrada.size * PASO_ENTRADA + 0.8) * 1000);
    return () => window.clearTimeout(id);
  }, [entrada]);

  const { nodos, aristas } = useMemo(() => {
    const { posicionRaiz, raicesProyecto } = arbol;
    const porId = new Map(actividades.map((a) => [a.id, a]));
    const nodos: Node[] = [];
    const aristas: Edge[] = [];
    /** Segundos que espera una tarea de primer nivel (o su linea) en la entrada. */
    const turnoEntrada = (id: string, base: number) => {
      const turno = entrada?.get(id);
      return turno === undefined ? undefined : base + turno * PASO_ENTRADA;
    };

    if (nombreProyecto) {
      const datosRaiz: DatosNodoRaiz = {
        nombre: nombreProyecto,
        totalTareas: actividades.length,
        completadas: actividades.filter((a) => a.estado === 'COMPLETADA').length,
        entrando: entrada !== null,
        tieneHijos: raicesProyecto.length > 0,
        expandido: expandidoRaiz,
        orientacion,
        editando,
        esMapaClaro: esClaro,
        contextoEquipo,
        onAlternar: alternarRaiz,
        onAgregarHija: (titulo: string) => agregarTarea(titulo),
        onAgregarParaAlguien: puedeAsignar ? agregarTareaPara : undefined,
        onEnfoque: setRaizEnfocada,
      };
      // Siempre por encima de las tareas, para que su menu no quede tapado. No
      // es enfocable como nodo: el foco lo toma el boton de su nombre.
      nodos.push({
        id: RAIZ,
        type: 'raiz',
        position: posicionInsignia(posicionRaiz),
        data: datosRaiz,
        draggable: false,
        focusable: false,
        zIndex: 2000,
      });
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
        bloquearOrdenHijas: a.bloquearOrdenHijas,
        bloqueadaPorOrden: a.bloqueadaPorOrden,
        prerequisitoTitulo: a.prerequisitoTitulo,
        ordenEnRama: a.ordenEnRama,
        esMapaClaro: esClaro,
        seleccionadoEdicion: editando && nodoSeleccionadoId === a.id,
        retrasoEntrada: turnoEntrada(a.id, RETRASO_TAREA),
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
          type: 'mapa',
          ariaLabel: `Línea hacia «${a.titulo}»`,
          style: { stroke: pos.color, strokeWidth: 2, opacity: 0.55 },
        });
      } else if (pos.profundidad === 1 && nombreProyecto) {
        const retrasoLinea = turnoEntrada(a.id, RETRASO_LINEA);
        aristas.push({
          id: `${RAIZ}-${a.id}`,
          source: RAIZ,
          target: a.id,
          type: 'mapa',
          ariaLabel: `Línea hacia «${a.titulo}»`,
          className: retrasoLinea !== undefined ? 'tf-arista-entra' : undefined,
          style: {
            stroke: pos.color,
            strokeWidth: 2.5,
            opacity: 0.7,
            ...(retrasoLinea !== undefined ? { '--tf-retraso': `${retrasoLinea}s` } : {}),
          } as React.CSSProperties,
        });
      }
    }

    return { nodos, aristas };
  }, [
    actividades, arbol, finales, nombreProyecto, expandidoRaiz, expandido, orientacion,
    agregarTarea, agregarTareaPara, puedeAsignar, sesionActual, editando, entrada, esClaro,
    contextoEquipo, nodoSeleccionadoId,
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

  /*
   * Cada linea sale y llega por los bordes enfrentados de sus dos burbujas,
   * segun donde estan en pantalla (tambien mientras se arrastra), y conoce
   * todas las burbujas para rodear las que le queden en medio. De paso se
   * anota que bordes usa cada nodo, para mostrar ahi su manilla.
   */
  const { aristasVisibles, anclasPorNodo } = useMemo(() => {
    const cajas: Caja[] = nodosVisibles.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      ancho: n.id === RAIZ ? ANCHO_RAIZ : ANCHO_NODO,
      alto: n.id === RAIZ ? ALTO_RAIZ : ALTO_NODO,
    }));
    const porId = new Map(cajas.map((c) => [c.id, c]));
    const actividadPorId = new Map(actividades.map((a) => [a.id, a]));
    const datos: DatosAristaMapa = { cajas };
    const anclasPorNodo = new Map<string, Ancla[]>();
    const anotar = (id: string, ancla: Ancla) => {
      const lista = anclasPorNodo.get(id) ?? [];
      const clave = idManilla(ancla.tipo, ancla.lado, ancla.fraccion);
      if (!lista.some((a) => idManilla(a.tipo, a.lado, a.fraccion) === clave)) lista.push(ancla);
      anclasPorNodo.set(id, lista);
    };

    const aristasVisibles = aristas.map((arista) => {
      const origen = porId.get(arista.source);
      const destino = porId.get(arista.target);
      if (!origen || !destino) return arista;
      // Lo que alguien fijo a mano manda; el extremo que no, lo elige el mapa.
      const automaticos = ladosEnfrentados(origen, destino, orientacion);
      const fijados = ladosGuardados(actividadPorId.get(arista.target), orientacion);
      const salida = (fijados.salida as Position | undefined) ?? automaticos.salida;
      const entrada = (fijados.entrada as Position | undefined) ?? automaticos.entrada;
      // Un extremo fijado puede ir en cualquier punto de su borde; si no, al centro.
      const fraccionSalida = fijados.salida ? fijados.salidaPos ?? 0.5 : 0.5;
      const fraccionEntrada = fijados.entrada ? fijados.entradaPos ?? 0.5 : 0.5;
      anotar(arista.source, { tipo: 'salida', lado: salida, fraccion: fraccionSalida });
      anotar(arista.target, { tipo: 'entrada', lado: entrada, fraccion: fraccionEntrada });
      const seleccionada = arista.id === aristaSeleccionada;
      return {
        ...arista,
        sourceHandle: idManilla('salida', salida, fraccionSalida),
        targetHandle: idManilla('entrada', entrada, fraccionEntrada),
        data: { ...datos, fraccionSalida, fraccionEntrada },
        selected: seleccionada,
        style: seleccionada
          ? { ...arista.style, strokeWidth: 4, opacity: 1, filter: 'drop-shadow(0 0 4px rgba(251,191,36,.9))' }
          : arista.style,
      };
    });
    return { aristasVisibles, anclasPorNodo };
  }, [aristas, nodosVisibles, orientacion, actividades, aristaSeleccionada]);

  /**
   * Persiste los bordes fijados de la linea que llega a `destinoId` con indicador
   * de autoguardado en tiempo real.
   */
  const persistirLados = useCallback(
    (destinoId: string, orientacionObjetivo: Orientacion, lados: LadosFijados | null) => {
      const limpios = lados && (lados.salida || lados.entrada) ? lados : null;
      const anterior = actividades.find((a) => a.id === destinoId)?.ladosLinea ?? null;
      const conLadosLinea = (ladosLinea: NodoActividad['ladosLinea']) =>
        setActividades((prev) => prev.map((a) => (a.id === destinoId ? { ...a, ladosLinea } : a)));
      const actual = actividades.find((a) => a.id === destinoId);
      if (actual) conLadosLinea(conLados(actual, orientacionObjetivo, limpios));
      notificarGuardado('guardando');
      return api
        .patch('/actividades/lados', {
          orientacion: orientacionObjetivo,
          cambios: [{ id: destinoId, lados: limpios }],
        })
        .then(() => {
          notificarGuardado('guardado');
        })
        .catch((err) => {
          conLadosLinea(anterior);
          notificarGuardado('error', () => {
            persistirLados(destinoId, orientacionObjetivo, limpios).catch(() => undefined);
          });
          setAviso(err instanceof ErrorApi ? err.message : 'No se pudo guardar el borde de la línea.');
          cargar().catch(() => undefined);
          throw err;
        });
    },
    [actividades, cargar, notificarGuardado],
  );

  const guardarLados = useCallback(
    (destinoId: string, lados: LadosFijados | null) => {
      const actuales = ladosGuardados(actividades.find((a) => a.id === destinoId), orientacion);
      const antes: LadosFijados | null = actuales.salida || actuales.entrada ? actuales : null;
      const despues = lados && (lados.salida || lados.entrada) ? lados : null;
      const entradaHist: EntradaHistorial = {
        tipo: 'lados',
        orientacion,
        destinoId,
        antes,
        despues,
      };
      setHistorial((h) => [...h.slice(-49), entradaHist]);
      setFuturo([]);
      persistirLados(destinoId, orientacion, despues).catch(() =>
        setHistorial((h) => h.filter((x) => x !== entradaHist)),
      );
    },
    [actividades, orientacion, persistirLados],
  );

  /**
   * Donde (0 a 1 a lo largo del borde) quedo el puntero al soltar el extremo,
   * segun la caja real del nodo. Se deja un margen para que no quede en la
   * esquina misma.
   */
  const fraccionEnBorde = useCallback(
    (nodoId: string, lado: LadoLinea) => {
      const puntero = ultimoPuntero.current;
      const instancia = instanciaMapa.current;
      const nodo = nodosVisibles.find((n) => n.id === nodoId);
      if (!puntero || !instancia || !nodo) return 0.5;
      const p = instancia.screenToFlowPosition(puntero);
      const ancho = nodoId === RAIZ ? ANCHO_RAIZ : ANCHO_NODO;
      const alto = nodoId === RAIZ ? ALTO_RAIZ : ALTO_NODO;
      const crudo =
        lado === 'top' || lado === 'bottom' ? (p.x - nodo.position.x) / ancho : (p.y - nodo.position.y) / alto;
      return Math.round(Math.min(0.94, Math.max(0.06, crudo)) * 1000) / 1000;
    },
    [nodosVisibles],
  );

  /** Soltar el extremo de una linea en otro punto de un borde del mismo nodo lo fija ahi. */
  const alReconectar = useCallback(
    (vieja: Edge, nueva: Connection) => {
      if (nueva.source !== vieja.source || nueva.target !== vieja.target) {
        setAviso('Suelta el extremo en otro borde del mismo nodo: aquí solo se elige por dónde sale o llega la línea.');
        return;
      }
      // El extremo se solto sobre la franja de un borde ("borde-top", ...).
      const extremo = nueva.sourceHandle?.startsWith('borde-')
        ? 'salida'
        : nueva.targetHandle?.startsWith('borde-')
          ? 'entrada'
          : null;
      if (!extremo) return;
      const lado = ladoDeManilla(extremo === 'salida' ? nueva.sourceHandle : nueva.targetHandle);
      if (!lado) return;
      const nodoId = extremo === 'salida' ? vieja.source : vieja.target;
      const actuales = ladosGuardados(actividades.find((a) => a.id === vieja.target), orientacion);
      const lados: LadosFijados = { ...actuales };
      lados[extremo] = lado;
      const fraccion = fraccionEnBorde(nodoId, lado);
      if (extremo === 'salida') lados.salidaPos = fraccion;
      else lados.entradaPos = fraccion;
      setAviso(null);
      guardarLados(vieja.target, lados);
    },
    [actividades, orientacion, guardarLados, fraccionEnBorde],
  );

  /** La seleccion de lineas (clic o teclado) vive aqui: el mapa no guarda la suya. */
  const alCambiarAristas: OnEdgesChange = useCallback((cambios) => {
    for (const c of cambios) {
      if (c.type !== 'select') continue;
      setAristaSeleccionada((prev) => (c.selected ? c.id : prev === c.id ? null : prev));
    }
  }, []);

  // Fuera del modo edicion, o al girar el arbol, no queda ninguna linea ni nodo elegido.
  useEffect(() => {
    if (!editando) {
      setAristaSeleccionada(null);
      setNodoSeleccionadoId(null);
    }
  }, [editando]);
  useEffect(() => setAristaSeleccionada(null), [orientacion]);

  const lineaSeleccionada = editando ? aristasVisibles.find((a) => a.id === aristaSeleccionada) : undefined;
  const ladosLineaSeleccionada = lineaSeleccionada
    ? ladosGuardados(actividades.find((a) => a.id === lineaSeleccionada.target), orientacion)
    : {};

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
      notificarGuardado('guardando');
      return api
        .patch('/actividades/posiciones', cambio)
        .then(() => {
          notificarGuardado('guardado');
        })
        .catch((err) => {
          notificarGuardado('error', () => {
            aplicarCambios(cambio).catch(() => undefined);
          });
          setAviso(err instanceof ErrorApi ? err.message : 'No se pudo guardar la posición.');
          cargar().catch(() => undefined);
          throw err;
        });
    },
    [cargar, notificarGuardado],
  );

  /** Mueve nodos dejando anotado como deshacer y rehacer. */
  const mover = useCallback(
    (cambios: CambioPosiciones['cambios']) => {
      const porId = new Map(actividades.map((a) => [a.id, a]));
      const antes: CambioPosiciones = {
        orientacion,
        cambios: cambios.map((c) => ({
          id: c.id,
          posicion: posicionGuardada(porId.get(c.id)!, orientacion),
        })),
      };
      const despues: CambioPosiciones = { orientacion, cambios };
      const entradaHist: EntradaHistorial = { tipo: 'posiciones', antes, despues };
      setHistorial((h) => [...h.slice(-49), entradaHist]);
      setFuturo([]);
      return aplicarCambios(despues).catch(() =>
        setHistorial((h) => h.filter((x) => x !== entradaHist)),
      );
    },
    [actividades, orientacion, aplicarCambios],
  );

  const ejecutarEntrada = useCallback(
    (entradaHist: EntradaHistorial, direccion: 'deshacer' | 'rehacer') => {
      if (entradaHist.tipo === 'posiciones') {
        const cambio = direccion === 'deshacer' ? entradaHist.antes : entradaHist.despues;
        return aplicarCambios(cambio);
      }
      const lados = direccion === 'deshacer' ? entradaHist.antes : entradaHist.despues;
      return persistirLados(entradaHist.destinoId, entradaHist.orientacion, lados);
    },
    [aplicarCambios, persistirLados],
  );

  const deshacer = useCallback(() => {
    const ultimo = historial[historial.length - 1];
    if (!ultimo) return;
    setHistorial((h) => h.slice(0, -1));
    setFuturo((f) => [...f.slice(-49), ultimo]);
    ejecutarEntrada(ultimo, 'deshacer').catch(() => undefined);
  }, [historial, ejecutarEntrada]);

  const rehacer = useCallback(() => {
    const siguiente = futuro[futuro.length - 1];
    if (!siguiente) return;
    setFuturo((f) => f.slice(0, -1));
    setHistorial((h) => [...h.slice(-49), siguiente]);
    ejecutarEntrada(siguiente, 'rehacer').catch(() => undefined);
  }, [futuro, ejecutarEntrada]);

  const deshacerRef = useRef(deshacer);
  deshacerRef.current = deshacer;

  /** Devuelve todos los nodos de esta orientacion al acomodo automatico. */
  const hayMovidos = actividades.some((a) => posicionGuardada(a, orientacion));
  function restablecer() {
    const movidos = actividades.filter((a) => posicionGuardada(a, orientacion));
    if (!movidos.length) return;
    mover(movidos.map((a) => ({ id: a.id, posicion: null }))).then(() => {
      toast({
        tipo: 'info',
        titulo: 'Posiciones restablecidas',
        descripcion: 'Todos los nodos volvieron al acomodo automático.',
        duracionMs: 7000,
        accion: {
          etiqueta: 'Deshacer',
          alHacer: () => deshacerRef.current(),
        },
      });
    });
  }

  const confirmarEliminarSeleccionado = useCallback(async () => {
    if (!nodoPorEliminar || !puedeEliminarNodo) return;
    setEliminandoNodo(true);
    try {
      await api.delete(`/actividades/${nodoPorEliminar.id}`);
      const eliminado = nodoPorEliminar;
      setNodoPorEliminar(null);
      setNodoSeleccionadoId(null);
      toast({
        tipo: 'info',
        titulo: 'Nodo eliminado',
        descripcion: `Se eliminó «${eliminado.titulo}» y sus subtareas.`,
      });
      await cargar();
    } catch (err) {
      setAviso(err instanceof ErrorApi ? err.message : 'No se pudo eliminar el nodo.');
      setNodoPorEliminar(null);
    } finally {
      setEliminandoNodo(false);
    }
  }, [nodoPorEliminar, puedeEliminarNodo, toast, cargar]);

  // Atajos de teclado del mapa:
  // Ctrl+Z / Ctrl+Y (o Ctrl+Shift+Z) en edicion; E (editar), F (encuadrar),
  // M (minimapa), Supr/Delete (eliminar nodo seleccionado en edicion).
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      const objetivo = e.target as HTMLElement | null;
      if (objetivo?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (tareaSeleccionada || verDerivaciones || nodoPorEliminar) return;

      const mod = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();

      if (editando && mod && keyLower === 'z' && !e.shiftKey) {
        e.preventDefault();
        deshacer();
        return;
      }
      if (editando && ((mod && keyLower === 'y') || (mod && e.shiftKey && keyLower === 'z'))) {
        e.preventDefault();
        rehacer();
        return;
      }
      if (mod || e.altKey) return;

      if (keyLower === 'e' && puedeEditarMapa) {
        e.preventDefault();
        setEditando((v) => !v);
        setArrastre(null);
      } else if (keyLower === 'f') {
        e.preventDefault();
        instanciaMapa.current?.fitView({ ...ENCUADRE, duration: 250 });
      } else if (keyLower === 'm') {
        e.preventDefault();
        alternarMinimapa();
      } else if (
        editando &&
        puedeEliminarNodo &&
        nodoSeleccionadoId &&
        nodoSeleccionadoId !== RAIZ &&
        (e.key === 'Delete' || e.key === 'Backspace')
      ) {
        const encontrado = actividades.find((a) => a.id === nodoSeleccionadoId);
        if (encontrado) {
          e.preventDefault();
          setNodoPorEliminar(encontrado);
        }
      }
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [
    editando,
    deshacer,
    rehacer,
    puedeEditarMapa,
    puedeEliminarNodo,
    nodoSeleccionadoId,
    actividades,
    alternarMinimapa,
    tareaSeleccionada,
    verDerivaciones,
    nodoPorEliminar,
  ]);

  // El historial es de este proyecto: no se arrastra a otro.
  useEffect(() => {
    setHistorial([]);
    setFuturo([]);
  }, [proyectoId]);

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
    () =>
      nodosVisibles.map((n) => {
        const conLados = {
          ...n,
          data: { ...n.data, anclas: anclasPorNodo.get(n.id), recibiendoExtremo },
        };
        return medidas[n.id] ? { ...conLados, measured: medidas[n.id] } : conLados;
      }),
    [nodosVisibles, anclasPorNodo, medidas, recibiendoExtremo],
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
          <div className="grid place-items-center rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] p-16 text-center backdrop-blur">
            <div className="flex flex-col items-center gap-3">
              <span className="relative flex h-5 w-5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-5 w-5 rounded-full bg-emerald-500" />
              </span>
              <p className="text-sm font-semibold text-[var(--tf-texto)]">Abriendo tu tarea activa...</p>
              <p className="text-xs text-[var(--tf-texto-tenue)]">Te estamos llevando directo al cronómetro de tu proyecto.</p>
            </div>
          </div>
        </Marco>
      );
    }

    return (
      <Marco activo="/nodos" titulo="Mapa de nodos" subtitulo="Flujo de tareas y derivaciones">
        <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--tf-borde-fuerte)] p-16 text-center">
          <p className="mb-4 max-w-sm text-sm text-[var(--tf-texto-tenue)]">
            No tienes proyectos o tareas asignadas por el momento. Entra a Proyectos para explorar o crear un nuevo proyecto.
          </p>
          <Link
            href="/panel"
            style={{ backgroundColor: colorPrimario, color: 'var(--tf-texto-primario)' }}
            className="rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:brightness-110"
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
      controlesEnSidebar
      compacto
      acciones={
        <div className="flex items-center gap-2">
          {esTrabajador ? (
            <span className="whitespace-nowrap rounded-full border border-sky-500/30 bg-sky-500/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--tf-acento-azul)]">
              Vista Colaborativa
            </span>
          ) : esSupervisor ? (
            <span className="whitespace-nowrap rounded-full border border-purple-500/30 bg-purple-500/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--tf-acento-violeta)]">
              Vista Supervisor
            </span>
          ) : (
            <span className="whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--tf-acento-ambar)]">
              Vista Administrador
            </span>
          )}
        </div>
      }
    >
      {aviso && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-[var(--tf-acento-rojo)]"
        >
          <span>{aviso}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAviso(null);
                cargar().catch((err) =>
                  setAviso(err instanceof ErrorApi ? err.message : 'No se pudo conectar con el servidor.'),
                );
              }}
              className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-xs font-semibold hover:bg-rose-500/25"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => setAviso(null)}
              aria-label="Descartar aviso"
              className="text-xs font-bold opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {/* Barra de controles FUERA y ARRIBA del mapa: deja el lienzo 100% libre y alinea con el botón flotante */}
        <div className="relative z-30 flex flex-wrap items-center justify-between gap-2 transition-[padding] duration-200 md:flex-nowrap md:pl-[var(--tf-sangria-izq-barra,0px)]">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2
              className={`${fuenteTitulo.className} min-w-0 truncate text-lg font-bold tracking-[-0.02em] text-[var(--tf-texto)]`}
              title={nombreProyecto ?? undefined}
            >
              {nombreProyecto}
            </h2>
            <span
              className={`hidden shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold 2xl:inline-flex ${
                esTrabajador
                  ? 'border-sky-500/30 bg-sky-500/12 text-[var(--tf-acento-azul)]'
                  : esSupervisor
                  ? 'border-purple-500/30 bg-purple-500/12 text-[var(--tf-acento-violeta)]'
                  : 'border-amber-500/30 bg-amber-500/12 text-[var(--tf-acento-ambar)]'
              }`}
            >
              {esTrabajador ? 'Vista Colaborativa' : esSupervisor ? 'Vista Supervisor' : 'Vista Administrador'}
            </span>
            {estadoGuardado === 'guardando' && (
              <span
                role="status"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] px-2.5 py-1 text-[11px] font-medium text-[var(--tf-texto-tenue)]"
              >
                <Loader2 size={12} className="animate-spin text-[var(--tf-acento-azul)]" aria-hidden />
                Guardando cambios…
              </span>
            )}
            {estadoGuardado === 'guardado' && (
              <span
                role="status"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--tf-acento-verde)]"
              >
                <Check size={12} aria-hidden />
                Guardado ✓
              </span>
            )}
            {estadoGuardado === 'error' && (
              <span
                role="alert"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-500/35 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--tf-acento-rojo)]"
              >
                <AlertCircle size={12} aria-hidden />
                Error al guardar
                {reintentoGuardadoRef.current && (
                  <button
                    type="button"
                    onClick={() => reintentoGuardadoRef.current?.()}
                    className="ml-1 underline underline-offset-2 hover:opacity-80"
                  >
                    Reintentar
                  </button>
                )}
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 md:flex-nowrap xl:gap-2">
            {derivaciones.length > 0 && (
              <button
                onClick={() => setVerDerivaciones(true)}
                aria-label={`Derivaciones (${derivaciones.length})`}
                title="Traspasos de responsable, con su motivo y su fecha"
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] px-3 text-xs font-medium text-[var(--tf-texto)] transition hover:border-[var(--tf-borde-fuerte)] hover:bg-[var(--tf-hover)]"
              >
                <span aria-hidden>⇄</span>
                <span className="hidden xl:inline">Derivaciones</span>
                <span className="rounded-full bg-sky-500/20 px-1.5 text-[10px] font-bold text-[var(--tf-acento-azul)]">
                  {derivaciones.length}
                </span>
              </button>
            )}
            <SelectorFondo valor={fondo} onCambiar={cambiarFondo} />
            <button
              type="button"
              onClick={alternarMinimapa}
              aria-pressed={mostrarMinimapa}
              aria-label={mostrarMinimapa ? 'Ocultar minimapa' : 'Mostrar minimapa'}
              title="Mostrar u ocultar minimapa (M)"
              className={`flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full border text-xs transition 2xl:w-auto 2xl:px-3 ${
                mostrarMinimapa
                  ? 'border-sky-500/40 bg-sky-500/15 font-medium text-[var(--tf-acento-azul)]'
                  : 'border-[var(--tf-borde)] bg-[var(--tf-superficie)] text-[var(--tf-texto-tenue)] hover:border-[var(--tf-borde-fuerte)] hover:text-[var(--tf-texto)]'
              }`}
            >
              <IconoMapa size={15} aria-hidden />
              <span className="hidden 2xl:inline">Minimapa</span>
            </button>
            <button
              type="button"
              onClick={() => instanciaMapa.current?.fitView({ ...ENCUADRE, duration: 250 })}
              title="Encuadrar mapa en pantalla (F)"
              aria-label="Encuadrar mapa en pantalla"
              className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] text-xs text-[var(--tf-texto-tenue)] transition hover:border-[var(--tf-borde-fuerte)] hover:text-[var(--tf-texto)] 2xl:w-auto 2xl:px-3"
            >
              <Maximize2 size={15} aria-hidden />
              <span className="hidden 2xl:inline">Encuadrar</span>
            </button>
            {puedeEditarMapa && (
              <button
                aria-pressed={editando}
                onClick={alternarEdicion}
                title="Arrastra las tareas y déjalas donde quieras (E)"
                className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs transition ${
                  editando
                    ? 'border-amber-500/50 bg-amber-500/20 font-semibold text-[var(--tf-acento-ambar)]'
                    : 'border-[var(--tf-borde)] bg-[var(--tf-superficie)] text-[var(--tf-texto-tenue)] hover:border-[var(--tf-borde-fuerte)] hover:text-[var(--tf-texto)]'
                }`}
              >
                <span aria-hidden>✥</span>
                {editando ? 'Listo' : 'Editar mapa'}
              </button>
            )}
            {editando && (
              <>
                <button
                  type="button"
                  onClick={deshacer}
                  disabled={historial.length === 0}
                  aria-label="Deshacer"
                  title="Deshacer el último movimiento o borde (Ctrl+Z)"
                  className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] text-xs text-[var(--tf-texto)] transition hover:border-[var(--tf-borde-fuerte)] disabled:cursor-not-allowed disabled:opacity-40 2xl:w-auto 2xl:px-3"
                >
                  <Undo2 size={14} aria-hidden />
                  <span className="hidden 2xl:inline">Deshacer</span>
                </button>
                <button
                  type="button"
                  onClick={rehacer}
                  disabled={futuro.length === 0}
                  aria-label="Rehacer"
                  title="Rehacer el cambio deshecho (Ctrl+Y / Ctrl+Shift+Z)"
                  className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] text-xs text-[var(--tf-texto)] transition hover:border-[var(--tf-borde-fuerte)] disabled:cursor-not-allowed disabled:opacity-40 2xl:w-auto 2xl:px-3"
                >
                  <Redo2 size={14} aria-hidden />
                  <span className="hidden 2xl:inline">Rehacer</span>
                </button>
                <button
                  type="button"
                  onClick={restablecer}
                  disabled={!hayMovidos}
                  title="Devolver todos los nodos al acomodo automático en esta orientación"
                  className="h-9 shrink-0 whitespace-nowrap rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] px-3 text-xs text-[var(--tf-texto)] transition hover:border-[var(--tf-borde-fuerte)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Restablecer
                </button>
              </>
            )}
            <div className="flex h-9 shrink-0 items-center rounded-full border border-[var(--tf-borde)] bg-[var(--tf-superficie)] p-0.5" role="radiogroup">
              {ORIENTACIONES.map((o) => (
                <button
                  key={o.valor}
                  role="radio"
                  aria-checked={orientacion === o.valor}
                  aria-label={o.texto}
                  title={o.titulo}
                  onClick={() => cambiarOrientacion(o.valor)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition 2xl:px-3 ${
                    orientacion === o.valor
                      ? 'bg-sky-500/20 font-semibold text-[var(--tf-acento-azul)]'
                      : 'text-[var(--tf-texto-tenue)] hover:text-[var(--tf-texto)]'
                  }`}
                >
                  <span aria-hidden>{o.icono}</span>
                  <span className="hidden xl:inline">{o.texto}</span>
                </button>
              ))}
            </div>
            <span aria-hidden className="hidden h-5 w-px bg-[var(--tf-borde)] md:block" />
            <ControlesUsuarioBarra />
          </div>
        </div>

        {editando && nodoSeleccionadoId && (() => {
          const sel = actividades.find((a) => a.id === nodoSeleccionadoId);
          if (!sel) return null;
          return (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs">
              <span className="min-w-0 truncate text-[var(--tf-texto)]">
                Nodo seleccionado: <strong className="text-[var(--tf-acento-ambar)]">«{sel.titulo}»</strong>
                <span className="ml-2 hidden text-[11px] text-[var(--tf-texto-tenue)] sm:inline">
                  Doble clic para abrir detalle
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTareaSeleccionada(sel.id)}
                  className="rounded-lg border border-[var(--tf-borde-fuerte)] bg-[var(--tf-superficie-solida)] px-2.5 py-1 text-[11px] font-medium text-[var(--tf-texto)] transition hover:bg-[var(--tf-hover)]"
                >
                  Abrir detalle
                </button>
                {puedeEliminarNodo && (
                  <button
                    type="button"
                    onClick={() => setNodoPorEliminar(sel)}
                    title="Eliminar nodo seleccionado (Supr)"
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-[var(--tf-acento-rojo)] transition hover:bg-rose-500/25"
                  >
                    <Trash2 size={12} aria-hidden />
                    Eliminar (Supr)
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {cargas === 0 && !aviso ? (
          <EsqueletoMapa />
        ) : (
        <section className="overflow-hidden rounded-2xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] backdrop-blur">
          {lineaSeleccionada && (
          <div
            role="group"
            aria-label="Bordes de la línea seleccionada"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs text-[var(--tf-texto)]"
          >
            <span className="min-w-0 truncate font-semibold text-[var(--tf-acento-ambar)]">
              Línea hacia «{actividades.find((a) => a.id === lineaSeleccionada.target)?.titulo}»
            </span>
            <span className="flex items-center gap-1.5">
              <span>Sale por</span>
              <Selector
                ariaLabel="Sale por"
                forma="compacto"
                minAnchoMenu={145}
                valor={ladosLineaSeleccionada.salida ?? ''}
                onChange={(v) =>
                  guardarLados(lineaSeleccionada.target, {
                    ...ladosLineaSeleccionada,
                    salida: (v || undefined) as LadoLinea | undefined,
                  })
                }
                opciones={OPCIONES_LADO.map((o) => ({ valor: o.valor, etiqueta: o.texto }))}
              />
            </span>
            <span className="flex items-center gap-1.5">
              <span>Llega por</span>
              <Selector
                ariaLabel="Llega por"
                forma="compacto"
                minAnchoMenu={145}
                valor={ladosLineaSeleccionada.entrada ?? ''}
                onChange={(v) =>
                  guardarLados(lineaSeleccionada.target, {
                    ...ladosLineaSeleccionada,
                    entrada: (v || undefined) as LadoLinea | undefined,
                  })
                }
                opciones={OPCIONES_LADO.map((o) => ({ valor: o.valor, etiqueta: o.texto }))}
              />
            </span>
            <button
              onClick={() => guardarLados(lineaSeleccionada.target, null)}
              disabled={!ladosLineaSeleccionada.salida && !ladosLineaSeleccionada.entrada}
              title="Que el mapa vuelva a elegir solo por dónde sale y llega esta línea"
              className="rounded-lg border border-[var(--tf-borde)] bg-[var(--tf-superficie-solida)] px-2.5 py-1 text-xs text-[var(--tf-texto)] transition hover:border-[var(--tf-borde-fuerte)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Línea automática
            </button>
            <span className="text-[11px] text-[var(--tf-texto-tenue)]">
              También puedes arrastrar un extremo de la línea a cualquier punto de un borde del nodo: queda justo donde la sueltas.
            </span>
          </div>
        )}
        <CajaMapa
          className={`tf-mapa relative ${esClaro ? 'tf-mapa-claro' : ''} ${raizEnfocada ? 'raiz-enfocada' : ''}`}
          style={estiloFondoMapa(fondo)}
        >
          <DecoracionFondo fondo={fondo} />
          <ReactFlow
            style={{ background: 'transparent' }}
            nodes={nodosFlow}
            edges={aristasVisibles}
            onNodesChange={alCambiarNodos}
            onEdgesChange={alCambiarAristas}
            edgesReconnectable={editando && puedeEditarMapa}
            // En cada borde hay una manilla de entrada y otra de salida, una
            // encima de la otra: en modo flexible vale soltar en cualquiera de
            // las dos (de ella solo se usa el borde).
            connectionMode={ConnectionMode.Loose}
            onReconnect={alReconectar}
            onInit={(instancia) => {
              instanciaMapa.current = instancia as unknown as ReactFlowInstance;
            }}
            onReconnectStart={(evento, arista) => {
              reconectando.current = arista;
              const e = evento as unknown as MouseEvent;
              ultimoPuntero.current = { x: e.clientX, y: e.clientY };
              const anotarPuntero = (m: PointerEvent | MouseEvent) => {
                ultimoPuntero.current = { x: m.clientX, y: m.clientY };
              };
              window.addEventListener('pointermove', anotarPuntero);
              window.addEventListener('mousemove', anotarPuntero);
              const soltar = () => {
                window.removeEventListener('pointermove', anotarPuntero);
                window.removeEventListener('mousemove', anotarPuntero);
              };
              window.addEventListener('pointerup', soltar, { once: true });
              window.addEventListener('mouseup', soltar, { once: true });
              setRecibiendoExtremo(true);
            }}
            onReconnectEnd={() => {
              reconectando.current = null;
              setRecibiendoExtremo(false);
            }}
            // Mientras se arrastra el extremo de una linea, solo valen sus mismos nodos,
            // rechazando autoconexiones y dependencias circulares.
            isValidConnection={(c) => {
              const r = reconectando.current;
              if (r) return c.source === r.source && c.target === r.target;
              if (!c.source || !c.target || c.source === c.target) return false;
              if (c.source === RAIZ) return true;
              return validarCambioPadre(c.target, c.source, actividades).valido;
            }}
            nodeTypes={TIPOS_NODO}
            edgeTypes={TIPOS_ARISTA}
            onNodeClick={alHacerClicEnNodo}
            onNodeDoubleClick={alHacerDobleClicEnNodo}
            onPaneClick={() => {
              setNodoSeleccionadoId(null);
              setAristaSeleccionada(null);
            }}
            nodesDraggable={editando}
            onNodeDrag={alArrastrar}
            onNodeDragStop={alSoltar}
            fitView
            fitViewOptions={ENCUADRE}
            proOptions={{ hideAttribution: true }}
            ariaLabelConfig={TEXTOS_ACCESIBLES}
            colorMode={esClaro ? 'light' : 'dark'}
          >
            <AjustarVista
              clave={`${proyectoId}-${orientacion}-${cargas}-${expandidoRaiz}-${[...expandido].sort().join(',')}`}
            />
            <PuntosFondo fondo={fondo} />
            <Controls showInteractive={false} />
            {mostrarMinimapa && (
              <MiniMap
                pannable
                zoomable
                nodeBorderRadius={6}
                maskColor={esClaro ? 'rgba(241, 245, 249, 0.7)' : 'rgba(4, 8, 20, 0.72)'}
                nodeColor={(n) => {
                  if (n.id === RAIZ) return colorPrimario;
                  const act = actividades.find((a) => a.id === n.id);
                  const est = estadoDeActividad(act?.bloqueadaPorOrden ? 'BLOQUEADA' : (act?.estado ?? 'PENDIENTE'));
                  return esClaro ? est.colorClaro : est.color;
                }}
              />
            )}
          </ReactFlow>
        </CajaMapa>
        </section>
        )}
      </div>

      {/* Detalle de la tarea elegida, en una ventana emergente sobre el mapa. */}
      {tareaSeleccionada && (
        <PanelTarea
          key={tareaSeleccionada}
          actividadId={tareaSeleccionada}
          actividadesProyecto={actividades}
          contextoEquipo={contextoEquipo}
          onEstadoGuardado={notificarGuardado}
          onCerrar={() => setTareaSeleccionada(null)}
          onCambio={cargar}
        />
      )}

      <ModalConfirmacion
        abierto={nodoPorEliminar !== null}
        titulo="Eliminar nodo y subtareas"
        descripcion={
          nodoPorEliminar
            ? `¿Seguro que deseas eliminar «${nodoPorEliminar.titulo}»?`
            : ''
        }
        detalles={[
          'Se eliminará este nodo junto con todas sus subtareas dependientes.',
          'Cualquier cronómetro activo en estas tareas se cerrará.',
          'Esta acción no se puede deshacer.',
        ]}
        etiquetaConfirmar="Sí, eliminar nodo"
        ocupado={eliminandoNodo}
        onConfirmar={confirmarEliminarSeleccionado}
        onCancelar={() => setNodoPorEliminar(null)}
      />

      {verDerivaciones && (
        <Modal titulo="Derivaciones" onCerrar={() => setVerDerivaciones(false)}>
          <p className="mb-4 text-xs text-[var(--tf-texto-tenue)]">Traspasos de responsable, con su motivo y su fecha.</p>
          {derivaciones.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--tf-borde-fuerte)] p-6 text-center text-xs text-[var(--tf-texto-suave)]">
              Sin derivaciones registradas.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {derivaciones.map((d) => (
                <div key={d.id} className="rounded-xl border border-[var(--tf-borde)] bg-[var(--tf-superficie-2)] p-3">
                  <p className="text-sm font-semibold leading-snug text-[var(--tf-texto)]">{d.actividad.titulo}</p>
                  <p className="mt-1 text-xs text-[var(--tf-texto-tenue)]">
                    {d.deUsuario.nombreCompleto} → {d.aUsuario.nombreCompleto}
                  </p>
                  <p className="mt-1.5 rounded-lg bg-[var(--tf-hover)] px-2 py-1 text-[11px] text-[var(--tf-texto)]">{d.motivo}</p>
                  <p
                    title={new Date(d.ocurridoEn).toLocaleString('es-CL')}
                    className="mt-1 text-[10px] text-[var(--tf-texto-suave)]"
                  >
                    {tiempoRelativo(d.ocurridoEn)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </Marco>
  );
}
