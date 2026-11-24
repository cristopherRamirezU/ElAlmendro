import { PERMISOS, PermisoCodigo, Rol } from './rbac';

export interface PasoManual {
  titulo: string;
  detalle: string;
}

export interface SeccionManual {
  id: string;
  categoria: string;
  titulo: string;
  resumen: string;
  roles: readonly Rol[];
  pasos: readonly PasoManual[];
  consejos: readonly string[];
  rutaRelacionada?: {
    href: string;
    etiqueta: string;
    permisoRequerido?: PermisoCodigo;
  };
}

export interface PreguntaFrecuente {
  id: string;
  pregunta: string;
  respuesta: string;
  roles: readonly Rol[];
}

export const ETIQUETAS_ROL: Record<Rol, { nombre: string; clase: string }> = {
  TRABAJADOR: {
    nombre: 'Trabajador',
    clase: 'border-sky-500/30 bg-sky-500/12 text-[var(--tf-acento-azul)]',
  },
  SUPERVISOR: {
    nombre: 'Supervisor',
    clase: 'border-amber-500/30 bg-amber-500/12 text-[var(--tf-acento-ambar)]',
  },
  ADMINISTRADOR: {
    nombre: 'Administrador',
    clase: 'border-emerald-500/30 bg-emerald-500/12 text-[var(--tf-acento-verde)]',
  },
  SUPER_ADMIN: {
    nombre: 'SuperAdmin',
    clase: 'border-violet-500/30 bg-violet-500/12 text-[var(--tf-acento-violeta)]',
  },
};

export const SECCIONES_MANUAL: readonly SeccionManual[] = [
  {
    id: 'jornada-perfil',
    categoria: 'Inicio y cuenta',
    titulo: 'Jornada laboral y perfil personal',
    resumen: 'Marca tu entrada y salida diaria, configura tu zona horaria y actualiza tu perfil.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
    rutaRelacionada: {
      href: '/cuenta',
      etiqueta: 'Ir a Mi cuenta',
    },
    pasos: [
      {
        titulo: 'Marca tu inicio de jornada',
        detalle:
          'En la cabecera superior usa el interruptor «Fuera de jornada» para registrar tu entrada antes de comenzar a trabajar.',
      },
      {
        titulo: 'Cierra tu jornada al terminar el día',
        detalle:
          'Vuelve a pulsar el interruptor para marcar tu salida. Si aún tienes un cronómetro corriendo, TimeFlow te avisará y te permitirá ir directo a esa tarea para cerrarla.',
      },
      {
        titulo: 'Configura tu zona horaria y foto',
        detalle:
          'En «Mi cuenta» puedes subir o recortar tu foto de perfil, ajustar tu zona horaria IANA (ej. America/Santiago) y cambiar tu contraseña o cerrar sesiones en otros dispositivos.',
      },
    ],
    consejos: [
      'Todos los horarios se guardan en UTC en el servidor y se muestran convertidos automáticamente a tu zona horaria.',
      'Si intentas cerrar sesión con la jornada abierta, la app te ofrecerá marcar la salida primero.',
    ],
  },
  {
    id: 'proyectos-nodos',
    categoria: 'Flujo de trabajo',
    titulo: 'Proyectos y mapa interactivo de nodos',
    resumen: 'Explora tus proyectos en la constelación, navega por nodos y entiende el semáforo de estados.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
    rutaRelacionada: {
      href: '/panel',
      etiqueta: 'Ir a Proyectos',
      permisoRequerido: PERMISOS.ACTIVIDADES_VER_PROPIAS,
    },
    pasos: [
      {
        titulo: 'Busca y abre tu proyecto',
        detalle:
          'Desde Proyectos puedes usar el buscador y las pestañas (Todos, En proceso, Completados) para ubicar tu proyecto y abrir su mapa de nodos.',
      },
      {
        titulo: 'Lee el semáforo y las subtareas (monedas)',
        detalle:
          'Cada nodo muestra su estado actual (Por hacer, En progreso, Bloqueada, Inconclusa o Completada), prioridad y el avance de sus subtareas.',
      },
      {
        titulo: 'Edita estructura y relaciones (según permisos)',
        detalle:
          'Quienes tienen permiso de edición pueden activar el modo edición para crear nodos, mover su posición, conectar líneas de relación y asignar responsables.',
      },
    ],
    consejos: [
      'Al entrar a /nodos, el mapa encuadra automáticamente todo el árbol del proyecto para que veas todas las ramas.',
      'Un administrador puede otorgar permisos extra de edición o eliminación a un trabajador específico desde Usuarios y Roles.',
    ],
  },
  {
    id: 'cronometro-autocierre',
    categoria: 'Control de tiempo',
    titulo: 'Cronómetro, ventana flotante y autocierre',
    resumen: 'Registra tiempo real por tarea, usa la ventana aparte y evita sesiones olvidadas.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
    rutaRelacionada: {
      href: '/panel',
      etiqueta: 'Abrir una tarea desde Proyectos',
      permisoRequerido: PERMISOS.ACTIVIDADES_VER_PROPIAS,
    },
    pasos: [
      {
        titulo: 'Comienza, pausa o reanuda una actividad',
        detalle:
          'Haz clic sobre un nodo para abrir su panel y pulsa «Comenzar». Puedes pausar y reanudar todas las veces que necesites; solo puedes tener un cronómetro activo a la vez.',
      },
      {
        titulo: 'Lleva el reloj en ventana aparte',
        detalle:
          'Pulsa el botón expandir (⤢) en la esquina del panel de tarea para abrir el cronómetro y tus objetivos en una ventana flotante siempre visible.',
      },
      {
        titulo: 'Finaliza como Completada o Inconclusa',
        detalle:
          'Al pulsar «Terminar» eliges el desenlace. Para cerrar como Completada necesitas tener al menos una evidencia adjunta; si queda Inconclusa debes escribir una nota de cierre.',
      },
    ],
    consejos: [
      'El cronómetro es autoritativo del servidor: nunca depende del reloj del navegador.',
      'Si una sesión queda abierta más de 10 horas sin movimiento, el sistema la autocierra automáticamente como Inconclusa para proteger tus reportes.',
    ],
  },
  {
    id: 'evidencias-audios',
    categoria: 'Colaboración',
    titulo: 'Evidencias, vista previa y notas de voz',
    resumen: 'Adjunta respaldos hasta 25 MB, previsualízalos sin descargar y graba audios en la tarea.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
    rutaRelacionada: {
      href: '/panel',
      etiqueta: 'Ver tareas con evidencias',
      permisoRequerido: PERMISOS.ACTIVIDADES_VER_PROPIAS,
    },
    pasos: [
      {
        titulo: 'Arrastra o selecciona un archivo (hasta 25 MB)',
        detalle:
          'Antes de subirlo verás una vista previa instantánea (miniatura de imagen, reproductor de audio/video o inicio de texto).',
      },
      {
        titulo: 'Previsualiza archivos ya subidos sin descargarlos',
        detalle:
          'Haz clic sobre cualquier evidencia de la lista para abrir el visor interno (imágenes, PDF, audio, video o texto). Si prefieres guardarlo en tu equipo, usa el botón Descargar.',
      },
      {
        titulo: 'Adjunta comentarios de voz',
        detalle:
          'En la sección de comentarios puedes grabar un audio con tu micrófono, escucharlo antes de enviarlo y publicarlo con autor y fecha.',
      },
    ],
    consejos: [
      'Una vez que la tarea pasa a estado Completada ya no se pueden agregar ni eliminar evidencias: quedan como respaldo oficial.',
      'Por seguridad, formatos ejecutables o activos (como SVG o HTML) no se abren inline y solo se entregan mediante descarga segura.',
    ],
  },
  {
    id: 'calendario-personalizable',
    categoria: 'Seguimiento',
    titulo: 'Calendario personalizable por capas',
    resumen: 'Alterna vistas Mes, Matriz y Semana y adapta qué información quieres ver en pantalla.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
    rutaRelacionada: {
      href: '/calendario',
      etiqueta: 'Abrir Calendario',
      permisoRequerido: PERMISOS.CALENDARIO_VER_PROPIO,
    },
    pasos: [
      {
        titulo: 'Elige entre Mes, Matriz o Semana',
        detalle:
          '«Mes» muestra el balance diario, «Matriz» compara trabajador por día y «Semana» dibuja la línea de tiempo real con pausas y traslapes.',
      },
      {
        titulo: 'Configura tus capas en «Personalizar»',
        detalle:
          'Desde el botón Personalizar puedes alternar el estilo Limpio o Mapa de calor y decidir si quieres ver horas, cantidad de personas/sesiones, barra de cumplimiento, alertas (▲) o fines de semana.',
      },
      {
        titulo: 'Despliega el detalle del día a tu ritmo',
        detalle:
          'Al hacer clic en un día verás las alertas colapsadas arriba y un acordeón por trabajador; despliega solo a quienes quieres revisar y haz clic en una sesión para ver tramos o notas.',
      },
    ],
    consejos: [
      'Tus preferencias de visualización se recuerdan automáticamente en tu navegador.',
      'Las personas sin registro en ese día permanecen ocultas por defecto para no saturar el panel; puedes mostrarlas con un clic al final.',
    ],
  },
  {
    id: 'reportes-gantt',
    categoria: 'Seguimiento',
    titulo: 'Reportes, Carta Gantt y exportación',
    resumen: 'Analiza productividad del equipo, revisa la Carta Gantt diaria y exporta en CSV, Excel o PDF.',
    roles: ['SUPERVISOR', 'ADMINISTRADOR', 'SUPER_ADMIN'],
    rutaRelacionada: {
      href: '/reportes',
      etiqueta: 'Abrir Reportes',
      permisoRequerido: PERMISOS.REPORTES_VER_EQUIPO,
    },
    pasos: [
      {
        titulo: 'Consulta el Registro consolidado',
        detalle:
          'En la pestaña «Registro» revisas horas, días trabajados, marcajes, nodos, tareas y promedio diario por trabajador. Si alguien supera 12 h/día promedio aparece la alerta ▲ Revisar.',
      },
      {
        titulo: 'Inspecciona la Carta Gantt por día',
        detalle:
          'En la pestaña «Carta Gantt» filtras por proyecto, estado o actividad en el período y haces clic en cualquier fila para ver fechas de creación, inicio real, fecha límite (◆) e ir al mapa.',
      },
      {
        titulo: 'Exporta informes del período',
        detalle:
          'Usa los botones CSV, Excel o PDF en la cabecera para descargar exactamente el período y alcance visibles en pantalla.',
      },
    ],
    consejos: [
      'Si el período elegido supera 31 días (ej. Últimos 3 meses), la Carta Gantt incluye controles ‹ Anterior / Siguiente › para navegar ventanas de 21 días sin perder legibilidad.',
    ],
  },
  {
    id: 'chat-usuarios-config',
    categoria: 'Equipo y empresa',
    titulo: 'Chat en vivo, usuarios, roles y marca',
    resumen: 'Comunícate en tiempo real, administra permisos granulares y personaliza tu empresa.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
    rutaRelacionada: {
      href: '/chat',
      etiqueta: 'Ir al Chat',
      permisoRequerido: PERMISOS.CHAT_USAR,
    },
    pasos: [
      {
        titulo: 'Conversa en canal general o mensajes directos',
        detalle:
          'Usa el módulo Chat del equipo o la burbuja flotante inferior derecha para escribir mensajes en tiempo real y ver quién está en línea.',
      },
      {
        titulo: 'Gestiona cuentas y permisos extra (Administrador)',
        detalle:
          'En «Usuarios y Roles» creas usuarios respetando la cuota de tu plan, cambias roles (Trabajador, Supervisor, Administrador) y asignas permisos extra como editar mapa o eliminar nodos.',
      },
      {
        titulo: 'Personaliza colores y revisa cuotas (Administrador)',
        detalle:
          'En «Configuración» ves los datos de tu organización, el uso de cupos de usuarios/proyectos y eliges el color primario y fondo del espacio de trabajo.',
      },
    ],
    consejos: [
      'El chat y los reportes están estrictamente aislados por organización: ninguna empresa ve datos de otra.',
    ],
  },
  {
    id: 'consola-saas',
    categoria: 'Plataforma global',
    titulo: 'Consola SaaS Multi-Empresa',
    resumen: 'Crea organizaciones clientes, asigna planes y controla límites globales de la plataforma.',
    roles: ['SUPER_ADMIN'],
    rutaRelacionada: {
      href: '/saas-admin',
      etiqueta: 'Abrir Consola SaaS',
      permisoRequerido: PERMISOS.ORGANIZACIONES_GESTIONAR,
    },
    pasos: [
      {
        titulo: 'Da de alta nuevas empresas',
        detalle:
          'Registra el nombre, RUT opcional, plan (Básico, Pro, Empresa), topes de usuarios/proyectos y las credenciales del administrador inicial.',
      },
      {
        titulo: 'Monitorea o suspende organizaciones',
        detalle:
          'Consulta el uso global de la plataforma, filtra reportes por empresa desde Reportes y activa o suspende inquilinos cuando corresponda.',
      },
    ],
    consejos: [
      'La Consola SaaS es exclusiva del rol SuperAdmin; los administradores de empresa ven un acceso restringido limpio.',
    ],
  },
];

export const PREGUNTAS_FRECUENTES: readonly PreguntaFrecuente[] = [
  {
    id: 'faq-evidencia-obligatoria',
    pregunta: '¿Por qué el botón «Completada» aparece deshabilitado al terminar una tarea?',
    respuesta:
      'Para garantizar trazabilidad, TimeFlow exige al menos una evidencia adjunta antes de cerrar una tarea como Completada. Si aún no tienes respaldo final, puedes cerrarla como «Inconclusa» dejando una nota explicativa.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
  },
  {
    id: 'faq-autocierre-10h',
    pregunta: '¿Qué pasa si olvido detener mi cronómetro al final del día?',
    respuesta:
      'Un proceso automático del servidor revisa cada 15 minutos las sesiones abiertas y autocierra aquellas que superan el umbral de 10 horas, marcándolas como Autocerrada / Inconclusa para que no inflen los reportes.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
  },
  {
    id: 'faq-zona-horaria',
    pregunta: '¿Por qué un compañero ve horas distintas en su detalle diario?',
    respuesta:
      'Cada trabajador registra sus días según la zona horaria configurada en «Mi cuenta». Cuando revisas a alguien en otra zona, el calendario muestra una insignia indicando su desfase horario local.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
  },
  {
    id: 'faq-borrar-adjunto',
    pregunta: '¿Puedo eliminar una evidencia que subí por error?',
    respuesta:
      'Sí, siempre que la tarea siga abierta (no Completada) y tú hayas subido el archivo o seas Administrador. Una vez completada la tarea, los adjuntos quedan bloqueados como respaldo.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR'],
  },
  {
    id: 'faq-permisos-extra',
    pregunta: '¿Cómo doy permiso a un trabajador para editar el mapa de nodos sin hacerlo Supervisor?',
    respuesta:
      'En «Usuarios y Roles» edita al trabajador y activa los permisos extra granulares «Editar el mapa» o «Eliminar tareas».',
    roles: ['ADMINISTRADOR'],
  },
  {
    id: 'faq-cerrar-sesiones',
    pregunta: '¿Cómo cierro mi cuenta si la dejé abierta en otro computador?',
    respuesta:
      'Entra a «Mi cuenta» y pulsa «Cerrar todas mis sesiones»: el servidor incrementará la versión de sesión e invalidará de inmediato cualquier acceso previo.',
    roles: ['TRABAJADOR', 'SUPERVISOR', 'ADMINISTRADOR', 'SUPER_ADMIN'],
  },
];
