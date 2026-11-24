# Documento de Inicio de Proyecto — TimeFlow

## Problema u oportunidad
Equipos remotos y freelancers suelen registrar sus horas de forma manual o fragmentada, dificultando saber qué actividades consumen más tiempo, qué tareas dependen de otras y qué respaldos concretos respaldan cada entrega.

## Objetivos del proyecto
- Proveer control de jornada y cronometraje por actividad con reloj autoritativo en el servidor.
- Articular tareas jerárquicas mediante un mapa visual interactivo de nodos con dependencias y trazabilidad de derivaciones.
- Entregar seguimiento temporal confiable (Calendario personalizable, Carta Gantt diaria y reportes exportables) con aislamiento estricto Multi-SaaS por empresa.

## Usuarios o stakeholders
- **Super Administrador SaaS:** administra organizaciones clientes, planes, cuotas globales y métricas de plataforma.
- **Administrador:** gestiona proyectos, usuarios, roles, permisos extra, marca de empresa, reportes e historial.
- **Supervisor:** supervisa avances operativos del equipo, reportes y calendario.
- **Trabajador:** registra jornada, cronometra sus actividades, adjunta evidencias/audios y participa en el chat del equipo.

## Alcance del sistema
- Autenticación segura con cookies `httpOnly`, cambio de contraseña, foto de perfil y zona horaria IANA por usuario.
- Panel de proyectos (constelación 2D), mapa interactivo de nodos, cronómetro en panel y ventana flotante (`/bolsa/[id]`), y autocierre automático tras superar el umbral configurado.
- Evidencias en S3/MinIO con visor inline seguro y descarga opcional, comentarios de voz, chat en vivo, notificaciones en tiempo real, bitácora US-08 (`/historial`) y manual interactivo integrado (`/manual`).

## Restricciones
- Toda marca de tiempo se persiste en UTC (`timestamptz`) en PostgreSQL 16 y se convierte únicamente al presentarse según la zona horaria del usuario.
- Invariantes críticas garantizadas en base de datos (`btree_gist` anti-solape de tramos, índices únicos parciales y triggers de inmutabilidad/aislamiento Multi-SaaS).

## Justificación de la solución
Separar la interfaz (Next.js 15), la API transaccional (NestJS 11 + Prisma), los datos relacionales (PostgreSQL 16) y el almacenamiento de binarios (MinIO S3) bajo proxy inverso Caddy 2 garantiza seguridad, auditabilidad e integridad del tiempo trabajado.
