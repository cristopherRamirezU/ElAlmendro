# TimeFlow

Sistema web de monitoreo y registro de actividad de trabajadores remotos.

Proyecto APT — Duoc UC, Sede San Bernardo.

| Apellido y Nombre | Rol |
|---|---|
| Ramírez, Cristopher | Líder de proyecto |
| Zuleta, Aníbal | Desarrollador |
| Rivera, Rodrigo | Desarrollador |

## Descripción

TimeFlow permite a un trabajador remoto registrar su jornada, cronometrar el
tiempo dedicado a cada actividad y adjuntar evidencia del trabajo realizado. El
administrador revisa lo trabajado desde un calendario diario, un mapa visual de
actividades y reportes de horas por período.

El sistema se apoya en dos principios que condicionan todo el diseño: el
cronómetro es autoritativo del servidor —la interfaz nunca transmite
duraciones, solo eventos de inicio y término— y toda marca temporal se almacena
en UTC, convirtiéndose a `America/Santiago` únicamente al mostrarse.

## Tecnologías utilizadas

| Parte del sistema | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| Backend | NestJS 11 |
| Base de datos | PostgreSQL 16 |
| ORM | Prisma |
| Frontend | Next.js 15 + React 19 |
| Estilos | Tailwind CSS 4 |
| Mapa de actividades | React Flow |
| Gráficos | SVG propio (sin librería) |
| Evidencias | MinIO (compatible S3) |
| Tiempo real | Socket.IO |
| Empaquetado | Docker y Docker Compose |
| Proxy inverso | Caddy 2 |

## Requisitos previos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 20.x | Ejecutar la aplicación |
| npm | 10.x | Viene con Node 20 |
| Docker Desktop | actual | Levantar la base de datos y el almacenamiento |
| Git | actual | Descargar el proyecto y subir cambios |

Verificar antes de empezar:

```bash
node -v && npm -v && docker --version
```

Docker Desktop debe estar **abierto y corriendo** (`docker ps` no debe dar
error) antes de levantar la infraestructura.

## Instrucciones para ejecutar el proyecto localmente

```bash
git clone https://github.com/cristopherRamirezU/ElAlmendro.git
cd ElAlmendro
cp .env.example .env
npm run setup
```

`npm run setup` instala las dependencias, levanta PostgreSQL y MinIO en Docker,
crea las tablas, aplica las reglas de integridad y carga los datos de prueba.

Luego, en dos terminales distintas:

```bash
npm run dev:api
npm run dev:web
```

### Usuarios de prueba

Solo existen en la base local de desarrollo (los crea `npm run db:seed`). Sus
claves son publicas: el seed se niega a correr en un ambiente de produccion.

| Correo | Clave | Rol | Nombre |
|---|---|---|---|
| `admin@admin.cl` | `12345` | Administrador | Administrador TimeFlow |
| `supervisor@timeflow.cl` | `Timeflow2026!` | Supervisor | Supervisor |
| `trabajador@timeflow.cl` | `Timeflow2026!` | Trabajador | Camila Soto |
| `trabajador2@timeflow.cl` | `Timeflow2026!` | Trabajador | Diego Fuentes |

Los datos iniciales incluyen tres semanas de historial de trabajo, porque el
calendario y los reportes carecen de sentido sobre una base vacia: mostrarian
cero en todas partes y seria imposible saber si funcionan.

### Crear un usuario nuevo

Mientras no exista el modulo `usuarios` con su pantalla de administracion:

```bash
npm run usuario:crear -- correo@timeflow.cl "Nombre Completo" LaClave123 TRABAJADOR
```

El rol es opcional, por defecto `TRABAJADOR`. El script calcula el hash Argon2id
de la contrasena: un usuario insertado a mano con la contrasena en texto plano
nunca podria iniciar sesion.

### Servicios locales

| Pantalla | Ruta |
|---|---|
| Inicio de sesión | `/login` |
| Mis actividades y cronómetro | `/panel` |
| Calendario de horas | `/calendario` |
| Mapa de nodos | `/nodos` |
| Reportes de horas | `/reportes` |
| Chat del equipo (en vivo, con presencia y chats privados) | `/chat` |

| Servicio | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000/api |
| Documentación OpenAPI | http://localhost:4000/api/docs |
| Estado de API y base de datos | http://localhost:4000/api/salud |
| Consola de MinIO | http://localhost:9001 |
| Adminer (`npm run infra:tools`) | http://localhost:8080 |

## Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run infra:up` | Levanta PostgreSQL y MinIO |
| `npm run infra:down` | Los detiene conservando los datos |
| `npm run infra:reset` | Los borra y vuelve a levantar desde cero |
| `npm run infra:logs` | Muestra los registros de los contenedores |
| `npm run infra:tools` | Levanta Adminer, consola web de la base |
| `npm run db:migrate` | Aplica migraciones y reglas de integridad |
| `npm run db:seed` | Carga los datos de prueba |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run dev:api` | API en modo desarrollo |
| `npm run dev:web` | Web en modo desarrollo |

## Estructura del repositorio

```
.
├── deploy/                  Despliegue en el VPS: scripts, Caddyfile, DEPLOY.md
├── docker/                  Infraestructura: compose, extensiones de BD, proxy
│   ├── docker-compose.yml   PostgreSQL 16 y MinIO
│   ├── db/init/             Extensiones cargadas al crear la base
│   └── proxy/Caddyfile      Proxy inverso para el despliegue
├── src/
│   ├── backend/             API NestJS 11 — reglas de negocio
│   │   ├── prisma/          Esquema, migraciones, reglas de integridad, seed
│   │   └── src/modules/     Un módulo por historia de usuario
│   ├── frontend/            Interfaz Next.js 15
│   └── shared/              Tipos y contratos compartidos web ↔ API
├── docs/                    Documentación del proyecto
├── Fase 1/ Fase 2/ Fase 3/  Evidencias de la asignatura
└── .env.example             Variables de entorno (copiar como .env)
```

Los contenedores `db` y `storage` de `docker/docker-compose.yml` son las capas
de datos y de archivos: no viven en el código.

### Convención dentro de cada módulo del backend

```
src/modules/<modulo>/
  <modulo>.controller.ts    HTTP, DTOs, códigos de estado
  <modulo>.service.ts       reglas de negocio y transiciones de estado
  <modulo>.repository.ts    acceso a datos vía Prisma
  dto/                      contratos de entrada y salida
  <modulo>.module.ts        cableado
```

Norma del equipo: **ningún módulo importa el repositorio de otro.** La
comunicación entre módulos ocurre por servicios públicos o por eventos de
dominio. Esto permite trabajar en paralelo sin pisarse.

### Módulos y su estado

| Módulo | Historia | Estado |
|---|---|---|
| `auth` | US-01 | Implementado — login, cookie httpOnly, guard |
| `jornada` | US-02 | Implementado — entrada, salida, jornada vigente |
| `actividades` | US-03, US-04 | Implementado — consulta con tiempo acumulado |
| `sesiones` | — | Implementado — iniciar, pausar, reanudar, cerrar |
| `reportes` | US-07 | Implementado — calendario, día, horas por trabajador |
| `nodos` | US-05, US-06 | Implementado — árbol y derivaciones (solo lectura) |
| `dashboard` | US-09 | Implementado — indicadores del panel |
| `usuarios` | — | Pendiente — CRUD y administración de roles |
| `evidencias` | — | Pendiente — URL firmadas, validación, SHA-256 |
| `historial` | US-08 | Pendiente como módulo; la bitácora ya se escribe |
| `notificaciones` | — | Pendiente — avisos internos |

## Reglas que no se negocian

Están en el documento de arquitectura y ya vienen implementadas en la base de
datos, no solo en el código:

1. **El cronómetro es del servidor.** El cliente envía solo eventos de inicio y
   término; las marcas de tiempo las estampa la API con su reloj.
2. **Todo se guarda en UTC** (`timestamptz`). Chile cambia de horario dos veces
   al año y guardar hora local duplicaría o anularía una hora de trabajo.
3. **Un trabajador, una sesión activa y una jornada abierta.** Lo garantizan
   índices únicos parciales.
4. **Los tramos de un mismo usuario no se solapan.** Restricción de exclusión
   con `btree_gist`.
5. **La auditoría es inmutable** y las sesiones y evidencias no se eliminan.

Ver `src/backend/prisma/sql/reglas-integridad.sql` y la documentación en
`docs/04-modelo-datos/`.

## Problemas frecuentes

**`Cannot connect to the Docker daemon`** — Docker Desktop no está corriendo.

**`Port 5432 is already allocated`** — Otro PostgreSQL ocupa el puerto. Cambia
`POSTGRES_PORT` en tu `.env` y ajusta el puerto en `DATABASE_URL`.

**`Environment variable not found: DATABASE_URL`** — Falta el `.env`. Ejecuta
`cp .env.example .env` en la raíz.

**Quiero empezar la base de datos de nuevo**

```bash
npm run infra:reset && npm run db:migrate && npm run db:seed
```

## Flujo de trabajo con Git

Una rama por historia de usuario. No se trabaja directo sobre `main`.

```bash
git checkout -b feat/us-01-login
git add .
git commit -m "feat(auth): pantalla de inicio de sesion"
git push -u origin feat/us-01-login
```

## Documentación

| Ubicación | Contenido |
|---|---|
| `docs/01-inicio-proyecto/` | Kick off y documento de inicio |
| `docs/02-metodologia-agil/` | Product Backlog, visión y sprints |
| `docs/03-arquitectura/` | Arquitectura del sistema y stack tecnológico |
| `docs/04-modelo-datos/` | Modelo de base de datos (DOC-BD-01) |
| `docs/mockups/` | Mockups validados con el cliente |
| `deploy/DEPLOY.md` | Despliegue en el VPS (timeflows.site): acceso, arquitectura, ciclo de actualizacion |

## Despliegue

El sitio vive en https://timeflows.site. **Lo que entra en `main` se despliega
solo**: el servidor revisa el repositorio cada minuto y se actualiza cuando
aparece un commit nuevo. No hay que entrar al VPS para publicar.

Ver `deploy/DEPLOY.md`, seccion 6.1.
