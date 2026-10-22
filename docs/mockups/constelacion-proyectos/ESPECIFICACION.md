# Constelación de proyectos — especificación

Rediseño de la vista de proyectos del panel (`/panel`). Reemplaza el "sistema solar" actual (dos galaxias, sol con el nombre de la empresa, planetas que orbitan) por una **constelación**: todos los proyectos visibles de entrada, alrededor de una mini esfera de tareas.

Referencia visual y de comportamiento: [`maqueta.html`](maqueta.html) (abrir en el navegador). La maqueta está hecha con canvas 2D y datos de ejemplo; la implementación debe reproducir su aspecto y su comportamiento, no necesariamente su código.

## Archivos actuales involucrados

- `src/frontend/src/components/panel/GalaxiaProyectos.tsx`: componente React de la vista (props `proyectos`, `seleccionado`, `onElegir`, `onCrear`).
- `src/frontend/src/components/panel/escenaEspacial.ts`: escena en canvas 2D (galaxias, sol, planetas, órbitas, túnel de estrellas).
- `src/frontend/src/app/panel/page.tsx`: usa `<GalaxiaProyectos>`; tiene la barra "Proyectos del Sistema / Mis Proyectos" (aprox. línea 259) y `irATareas(p)`, que navega a `/nodos?proyectoId=…&nombre=…`.
- `src/frontend/src/lib/api.ts`: `ProyectoItem` (`id`, `nombre`, `descripcion`, `estado`, `totalTareas`, `tareasCompletadas`).
- `src/frontend/src/lib/fuentes.ts`: `fuenteTitulo` (Sora).

No hace falta tocar el backend: todo sale de `ProyectoItem`.

## Qué se elimina

- Las dos galaxias ("En proceso" / "Completados") y el paso de "entrar" a una galaxia, con el botón "Volver a galaxias".
- El sol con el nombre de la empresa y el edificio. **No se muestra el nombre de la empresa.**
- Los planetas con texturas junto a cada tarjeta.
- El reloj de arena de cada tarjeta.
- El interruptor "Movimiento" y su clave en `localStorage` (`tf_galaxia_movimiento`).
- El botón "Crear proyecto" de abajo a la derecha (pasa a la esfera).
- En `page.tsx`, la barra de título "Proyectos del Sistema / Mis Proyectos" con su contador y el texto "Elige una galaxia y luego un proyecto". **Solo queda el mapa.**
- El texto de ayuda "Pasa el mouse sobre un planeta…". En general, la vista debe tener el mínimo texto posible.

## Escena

- Fondo oscuro con estrellas tenues que titilan muy despacio.
- **Dos anillos** elípticos punteados alrededor del centro, en perspectiva (vista 3D inclinada):
  - **Interior:** proyectos **en proceso**, en azul.
  - **Exterior:** proyectos **completados**, en verde.
  - Un proyecto está completado si `proyectoCompletado(p)` (ya existe en `GalaxiaProyectos.tsx`: `estado === 'CERRADO'` o todas sus tareas terminadas).
- Las tarjetas del fondo (mitad lejana del anillo) se ven más pequeñas que las del frente, y la esfera queda entre ambas capas, de modo que hay profundidad.
- Las tarjetas **no deben encimarse** entre sí. Hoy `escenaEspacial.ts` ya tiene un algoritmo de acomodo para que no se encimen; hay que conservar esa garantía con muchos proyectos (por ejemplo, ajustando ángulos o usando un tercer anillo si el interior se llena).

### Movimiento: casi imperceptible

- Los anillos giran **muy lento**: en la maqueta, `0.00025` rad por cuadro (una vuelta completa tarda varios minutos). Debe notarse que la escena está viva solo si uno se fija.
- La esfera rota igual de lento.
- Mientras hay un proyecto enfocado, todo se detiene.
- Respetar `prefers-reduced-motion`: sin giro.

## Tarjeta de proyecto (en el anillo)

- Estilo actual de TimeFlow: fondo azul muy oscuro, borde tenue, esquinas redondeadas y línea de color en el borde inferior (celeste en proceso, verde completado).
- Contenido, **sin ícono**:
  - "PROYECTO" en mayúsculas pequeñas, espaciadas y en celeste.
  - Nombre del proyecto en blanco.
  - Barra de avance (rosa `#ff5aa0` en proceso, verde `#1fbf86` completado) y el % a la derecha.
- Sin avatares, sin reloj de arena, sin fechas.

## Mini esfera de tareas (centro)

- Esfera pequeña (radio ~24 px) hecha de puntos: **cada punto es una tarea**. Para cada proyecto se generan `totalTareas` puntos, de los cuales `tareasCompletadas` están "hechos". Se reparten en una esfera de Fibonacci.
- Puntos pendientes: tenues (azul grisáceo). Hechos: brillantes (blanco si el proyecto está en proceso, verde si está completado). Más brillo y tamaño en la cara frontal.
- Los filtros también afectan a la esfera: los puntos de proyectos filtrados se atenúan.
- Si hay muchas tareas (más de ~1500), agrupar varias tareas por punto para mantener el rendimiento.

### Porcentaje bajo la esfera

- Solo el número, por ejemplo `12%`: el avance global de los proyectos visibles con el filtro actual (`Σ tareasCompletadas / Σ totalTareas`).
- **Sin cápsula ni borde.** Texto claro algo grande (~22 px, peso ligero), con un resplandor azul suave y un halo oscuro detrás.
- Se dibuja **por encima de las tarjetas**: ningún proyecto debe taparlo.
- Al cambiar de filtro, el número transiciona suavemente.
- Se oculta mientras hay zoom a un proyecto o mientras está abierto el botón "Nuevo proyecto".

### Botón "Nuevo proyecto" (al pasar el mouse por la esfera)

- Solo para quien hoy puede crear proyectos (misma regla que el botón actual; si el usuario no puede, la esfera no reacciona).
- Al pasar el mouse por la esfera:
  1. La esfera casi deja de girar y se ilumina con un resplandor suave.
  2. Sale **una línea de luz fina** desde el borde derecho de la esfera, con unas chispas pequeñas.
  3. La línea **despliega una pastilla** "Nuevo proyecto", con degradado `#3f6bff → #825aff` y un brillo que la recorre despacio. El "+" entra girando y el texto aparece un instante después.
  4. Las tarjetas se atenúan un poco.
- **Una sola opción**: solo "Nuevo proyecto".
- Debe poder llevarse el mouse de la esfera al botón sin que se cierre (margen de ~400 ms).
- Al hacer clic: onda de luz desde el botón y `onCrear()` (abre el modal de creación existente). Cuando el proyecto queda creado y aparece en la lista, su tarjeta **nace desde la esfera** y viaja a su lugar en el anillo con un brillo breve.
- Al alejar el mouse, todo se recoge hacia la esfera.

## Pasar el mouse por un proyecto: zoom y luego tarjetita

Secuencia en dos tiempos, como el zoom actual de TimeFlow pero aplicado a la constelación:

1. **Zoom:** la cámara se acerca al proyecto (escala ~1,85) y lo lleva al centro de la escena. El resto (tarjetas, anillos y esfera) se **desenfoca** (~4 px) y se oscurece. La escena deja de girar y los filtros se atenúan.
2. **Al terminar el zoom**, se despliega debajo del proyecto una **tarjetita** con:
   - La descripción del proyecto (`descripcion`, si existe).
   - "X de Y tareas".
   - Dos botones, sin íconos:
     - **Ir al mapa** (destacado, con degradado `#3f6bff → #825aff`): navega al mapa de nodos del proyecto (igual que `irATareas(p)` en `page.tsx`).
     - **Ver proyecto** (secundario, oscuro con borde): abre el detalle del proyecto (`onElegir(id)`, que abre `ModalDetalleProyecto`).
   - Sin fecha de entrega, sin avatares y sin íconos.
- Se puede bajar el mouse del proyecto a la tarjetita sin que se cierre.
- Al salir: primero se recoge la tarjetita y después la cámara vuelve.
- **Trabajadores:** hoy, en el detalle, su botón dice "Iniciar tarea / Registrar avance" en vez de "Ir al mapa de nodos". Revisar `page.tsx` (aprox. línea 432) y mantener esa misma diferencia por rol en el botón destacado de la tarjetita.
- **Táctil:** el primer toque hace el zoom y despliega la tarjetita; tocar fuera la cierra.

## Filtros

- Arriba al centro, tres palabras sin fondo ni borde: **Todos · En proceso · Completados**.
- Fuente **Sora** (`fuenteTitulo`), ~13 px. Inactivos: peso ligero y color apagado (`#56618a`), algo más claros al pasar el mouse.
- **Activo:** peso medio y **texto con el degradado de marca** (más suave que el del botón "Ir al mapa" para no competir, por ejemplo `#7f9dff → #b49aff`). **Sin línea ni subrayado.**
- Filtrar **no cambia de pantalla**: atenúa las tarjetas y los puntos de la esfera que no corresponden y resalta el anillo del grupo elegido.
- Sin contadores.

## Criterios de aceptación

- [ ] Al entrar a `/panel`, se ven todos los proyectos en la constelación sin hacer clic en nada.
- [ ] No aparecen el sol, los planetas, el nombre de la empresa, el reloj de arena, el interruptor "Movimiento" ni la barra "Proyectos del Sistema".
- [ ] En proceso en el anillo interior y completados en el exterior; las tarjetas no se enciman con hasta ~20 proyectos.
- [ ] La esfera central representa las tareas reales (`totalTareas` / `tareasCompletadas`) y el % debajo coincide con el filtro.
- [ ] Ninguna tarjeta tapa el %.
- [ ] El giro es casi imperceptible y se detiene con `prefers-reduced-motion`.
- [ ] Al pasar el mouse por la esfera aparece solo "Nuevo proyecto", y solo para usuarios con permiso; el clic abre el modal existente.
- [ ] Al pasar el mouse por un proyecto: zoom, desenfoque del resto y luego la tarjetita con "Ir al mapa" (destacado) y "Ver proyecto".
- [ ] "Ir al mapa" lleva a `/nodos?proyectoId=…`; "Ver proyecto" abre el detalle.
- [ ] Filtros en Sora; el activo con degradado y sin subrayado.
- [ ] Funciona con 0 proyectos (estado vacío con la esfera y "Nuevo proyecto"), con 1 y con muchos.
- [ ] Se ve bien en pantallas angostas (tablet) y funciona con toque.
- [ ] `npm run build` del frontend sin errores y sin advertencias nuevas de lint o tipos.
