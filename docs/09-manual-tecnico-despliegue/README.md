# Manual técnico / despliegue — TimeFlow

## Desarrollo local
1. Copiar `.env.example` a `.env` en la raíz del repositorio y ajustar las variables si es necesario.
2. Levantar la infraestructura de datos y almacenamiento (`PostgreSQL 16` y `MinIO S3`):
   ```bash
   npm run setup
   ```
   *(O en equipos sin Docker: usar PostgreSQL 16 local en puerto `5432` con las extensiones `btree_gist` y `pgcrypto`, y correr `npm run prisma:deploy -w @timeflow/api` + `npm run db:seed`.)*
3. Iniciar API (`http://localhost:4000/api`) y Web (`http://localhost:3000`):
   ```bash
   npm run dev:api
   npm run dev:web
   ```

## Producción (VPS)
- El sistema corre detrás de **Caddy 2** (TLS automático + cabeceras de seguridad) enrutando `/api/*` y `/socket.io/*` a **NestJS (`timeflow-api`, PM2)** y `/*` a **Next.js (`timeflow-web`, PM2)**, con PostgreSQL 16 y MinIO atados a `127.0.0.1`.
- Cada push a `main` actualiza el VPS mediante el flujo descrito en [`deploy/DEPLOY.md`](../../deploy/DEPLOY.md) y `deploy/update.sh`.
- Ver también [`docker/`](../../docker) para la definición de contenedores y extensiones iniciales.
