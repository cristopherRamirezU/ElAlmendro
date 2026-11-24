# Requisitos No Funcionales — TimeFlow

| Categoría | Requisito implementado |
|---|---|
| **Seguridad** | Contraseñas con Argon2id y hash señuelo anti-enumeración; cookies `httpOnly` + `SameSite=Strict` (`__Host-` en HTTPS); revocación global mediante `versionSesion`; límites de intentos en login, registro y subidas; CSP estricta y `X-Content-Type-Options: nosniff`; aislamiento Multi-SaaS en API y triggers PostgreSQL. |
| **Integridad de datos** | Cronómetro y marcas de tiempo generados exclusivamente en el servidor en UTC (`timestamptz`); restricción `btree_gist` contra solape de tramos; inmutabilidad de auditoría y prohibición de `DELETE` físico en sesiones y evidencias. |
| **Rendimiento** | Índices compuestos por organización y fecha; caché reactiva en frontend; ventana deslizable de 21 días en Carta Gantt y paginación en bitácora de historial. |
| **Disponibilidad y respaldo** | Autocierre programado cada 15 min de sesiones olvidadas (`SESION_UMBRAL_AUTOCIERRE_HORAS`); respaldos automáticos diarios con retención de 14 días (`deploy/respaldo.sh`). |
| **Portabilidad y despliegue** | Contenerización de infraestructura (`PostgreSQL 16` + `MinIO S3`) en `docker/docker-compose.yml` y proxy inverso TLS automático con `Caddy 2`. |
