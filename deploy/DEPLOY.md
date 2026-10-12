# Despliegue de TimeFlow en el VPS

Documento operativo: como esta armado el servidor, como se entra y como se
actualiza. Escrito para quien tenga que hacer un deploy sin haber tocado nunca
el VPS.

## 1. Inventario

| Cosa | Valor |
|---|---|
| Proveedor | OVH, VPS `vps-222bebae.vps.ovh.ca` |
| IPv4 | `148.113.249.196` |
| IPv6 | `2607:5300:205:200::bce1` |
| Usuario SSH | `ubuntu` (sudo sin contrasena, imagen estandar de OVH) |
| Dominio | `timeflows.site` (+ `www` redirige al apex) |
| Repositorio | `https://github.com/cristopherRamirezU/ElAlmendro.git`, rama `main` |
| Clave SSH (PC de Cristopher) | `C:\Users\ItSma\.ssh\timeflow_vps_ed25519` (ed25519, sin passphrase) |

### DNS (en el panel del registrador de `timeflows.site`)

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| A | `@` | `148.113.249.196` | 300 |
| A | `www` | `148.113.249.196` | 300 |
| AAAA | `@` | `2607:5300:205:200::bce1` | 300 (opcional) |
| AAAA | `www` | `2607:5300:205:200::bce1` | 300 (opcional) |

Comprobar propagacion: `nslookup timeflows.site 8.8.8.8` debe devolver la IPv4.
Caddy no puede emitir el certificado hasta que esto resuelva, y sin certificado
la cookie `secure` del login no funciona. **El DNS va antes que el primer deploy.**

## 2. Arquitectura en el servidor

```
internet ── 443/80 ──> Caddy (systemd, TLS automatico Let's Encrypt)
                         ├── /api/*        ──> 127.0.0.1:4000  timeflow-api  (pm2, NestJS)
                         ├── /socket.io/*  ──> 127.0.0.1:4000  (chat en vivo, websocket)
                         └── /*            ──> 127.0.0.1:3000  timeflow-web  (pm2, Next.js)

timeflow-api ──> 127.0.0.1:5432  postgres:16   (docker, volumen timeflow_db_data)
             ──> 127.0.0.1:9000  minio         (docker, volumen timeflow_storage_data)
```

Decisiones y por que:

- **API y web con pm2 en el host, datos en Docker.** El `docker-compose.yml`
  del repo ya define Postgres y MinIO; se reutiliza tal cual. La app corre con
  pm2 porque el ciclo `git pull -> build -> restart` es mas rapido y mas facil
  de inspeccionar (`pm2 logs`) que reconstruir imagenes.
- **Un solo origen.** El navegador llama a `https://timeflows.site/api/...` y
  al websocket en `https://timeflows.site/socket.io/`. Al ser el mismo origen
  que la web, la cookie httpOnly del login viaja sin CORS y `SameSite=Lax` no
  estorba. Por eso `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_WEB_URL` valen ambas
  `https://timeflows.site`.
- **Postgres y MinIO cerrados a internet.** Docker publica puertos por encima
  de ufw, asi que el firewall solo no alcanza: el `.env` de produccion fija
  `BIND_ADDR=127.0.0.1` y compose los ata a loopback. El navegador nunca habla
  con MinIO: subida y descarga de evidencias pasan por la API.
- **`NODE_ENV=production`** lo inyecta `ecosystem.config.cjs`; con eso la
  cookie de sesion sale con `secure`.
- **Reloj del sistema en UTC.** La app guarda todo en UTC y convierte a
  `America/Santiago` al mostrar; el VPS en UTC evita sorpresas en logs y cron.

Rutas en el VPS:

| Ruta | Que es |
|---|---|
| `/var/www/timeflow` | clon del repo (rama `main`) |
| `/var/www/timeflow/.env` | secretos de produccion, fuera de git |
| `/etc/caddy/Caddyfile` | copia de `deploy/Caddyfile` (update.sh la sincroniza) |
| `/var/log/caddy/timeflows.site.log` | acceso HTTP |
| `~/.pm2/logs/` | stdout/stderr de api y web |
| volumen `timeflow_db_data` | datos de Postgres (sobrevive a `docker compose down`) |
| volumen `timeflow_storage_data` | evidencias en MinIO |

## 3. Como se entra (acceso no interactivo)

La regla: **ningun paso puede pedir teclado**. Clave sin passphrase, huella del
host ya aceptada, y el comando remoto siempre como argumento entre comillas:

```powershell
ssh -i "$env:USERPROFILE\.ssh\timeflow_vps_ed25519" ubuntu@148.113.249.196 "comando remoto"
```

Cada llamada es conectar -> ejecutar -> cortar. No sobrevive nada entre
llamadas (ni `cd`, ni variables), asi que lo que dependa de estado va
encadenado con `&&` en la misma linea.

Comillas: PowerShell rompe las comillas dobles al pasarlas a `ssh.exe`. De
menor a mayor complejidad:

| Caso | Que usar |
|---|---|
| Comando simple | `ssh ... "comando"` |
| Comando con comillas adentro | here-string `@'...'@` y recien ahi a ssh |
| Script largo, heredocs, SQL | escribir `.sh` local -> `scp` -> `ssh ... "bash /tmp/x.sh"` |

### Primer acceso (una sola vez, requiere teclado -> lo hace una persona)

OVH entrega el VPS con la contrasena vencida: el primer login obliga a
cambiarla y eso es interactivo. Desde una terminal real de Windows:

```powershell
# 1) Cambiar la contrasena (pide la actual, luego la nueva dos veces)
ssh ubuntu@148.113.249.196

# 2) Ya con la nueva contrasena, pegar la clave publica en el servidor
type "$env:USERPROFILE\.ssh\timeflow_vps_ed25519.pub" | ssh ubuntu@148.113.249.196 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

# 3) Probar que entra por clave sin pedir nada
ssh -i "$env:USERPROFILE\.ssh\timeflow_vps_ed25519" ubuntu@148.113.249.196 "whoami; hostname"
```

Recien cuando el paso 3 funciona se desactiva la contrasena por SSH:

```bash
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

## 4. Aprovisionar el servidor (una vez)

```powershell
scp -i "$env:USERPROFILE\.ssh\timeflow_vps_ed25519" deploy\setup-vps.sh ubuntu@148.113.249.196:/tmp/
ssh -i "$env:USERPROFILE\.ssh\timeflow_vps_ed25519" ubuntu@148.113.249.196 "bash /tmp/setup-vps.sh"
```

`setup-vps.sh` instala Node 20, pm2, Docker + compose, Caddy, ufw (22/80/443)
y fail2ban, clona el repo en `/var/www/timeflow` y pone el reloj en UTC. Es
idempotente: se puede repetir sin romper nada.

## 5. Primer deploy

### 5.0 Fase sin dominio (mientras el DNS no resuelve)

Se puede desplegar antes contra la IP pelada. En el `.env` se pone
`NEXT_PUBLIC_API_URL=https://148.113.249.196` y `NEXT_PUBLIC_WEB_URL` igual;
`update.sh` detecta que es una IP e instala `deploy/Caddyfile.ip`, que sirve
HTTPS con un certificado interno (autofirmado) de Caddy. El navegador avisa
"la conexion no es privada": aceptar la excepcion. Hace falta HTTPS aunque sea
asi porque la cookie de sesion sale con `secure`.

Para pasar al dominio despues: cambiar ambas variables a
`https://timeflows.site` en el `.env` y correr `bash deploy/update.sh` de nuevo
(rebuildea la web con la URL nueva y cambia el Caddyfile solo).

1. Crear el `.env` de produccion a partir de `deploy/env.production.example`,
   reemplazando cada `CAMBIAR_*` (`openssl rand -hex 24`). Subirlo con `scp`
   a `/var/www/timeflow/.env`. Nunca se commitea.
2. Con el DNS ya resolviendo:

```bash
cd /var/www/timeflow && bash deploy/update.sh --primera-vez
npm run usuario:crear -- superadmin@empresa.cl "Nombre Apellido" '<clave-larga-y-unica>' SUPER_ADMIN
```

`--primera-vez` instala el Caddyfile, arranca pm2 y lo registra en systemd
para que vuelva solo tras un reinicio. La primera cuenta se crea a mano con
`usuario:crear` (aplica la misma politica de contrasenas que la app) y desde
ella se crean las empresas y sus administradores.

**Nunca correr `--seed` en un servidor publico.** El seed crea cuentas cuyas
claves estan escritas en este repositorio (que es publico): cualquiera podria
entrar con ellas. Desde la rama `fix/seguridad` el seed se niega a correr si
el ambiente parece de produccion (se puede forzar con `PERMITIR_SEED=si`, solo
para un servidor de pruebas).

3. Verificar:

```powershell
curl.exe -s https://timeflows.site/api/salud
curl.exe -sI https://timeflows.site/login | Select-String "HTTP"
```

## 6. Deploy de cada cambio (ciclo normal)

```
  DEV                     DEV                        OPERADOR
  ───                     ───                        ────────
  commit local     ->     push a main (GitHub)  ->   ssh al VPS + update.sh
                                                          |
                                                     verificar /api/salud
```

```powershell
ssh -i "$env:USERPROFILE\.ssh\timeflow_vps_ed25519" ubuntu@148.113.249.196 "cd /var/www/timeflow && git pull && bash deploy/update.sh"
curl.exe -s https://timeflows.site/api/salud
```

Que hace `update.sh`, en orden: `npm ci` -> `prisma generate` -> build de API
y web (la app sigue arriba mientras tanto) -> asegura Postgres/MinIO ->
`prisma migrate deploy` + reglas de integridad -> `pm2 restart --update-env`
-> comprueba `/api/salud`. El corte real es el restart: segundos.

Detalles que importan:

- Va `bash deploy/update.sh`, no `./deploy/update.sh`: el bit ejecutable no
  viaja por git (`core.filemode false`).
- Un cambio en `.env` no requiere rebuild **salvo** las `NEXT_PUBLIC_*`, que
  se incrustan en el bundle de Next en tiempo de build. Con `update.sh` se
  rebuildea siempre, asi que alcanza con volver a correrlo.
- Si cambia `deploy/Caddyfile` en el repo, `update.sh` lo copia y hace
  `reload` de Caddy sin cortar conexiones.

## 6.1 Despliegue automatico (push a main -> servidor actualizado)

Desde que esto esta activo, nadie necesita entrar al VPS: **basta con hacer
push a `main`**.

```
  DEV                     GitHub                     VPS (solo)
  ───                     ──────                     ──────────
  push a main      ->     origin/main avanza    ->   timer cada minuto detecta
                                                     el commit y corre update.sh
                                                          |
                                                     pestanas abiertas avisan
                                                     "Hay una version nueva"
```

### Como funciona

Un timer de systemd (`timeflow-autodeploy.timer`) ejecuta cada minuto
`deploy/auto-deploy.sh`, que hace `git fetch`, compara `HEAD` con
`origin/main` y, si hay algo nuevo, hace `git reset --hard origin/main` y
corre `deploy/update.sh`. Si no hay commits nuevos termina en milisegundos.

Se eligio un timer y no un webhook de GitHub por una razon concreta: el
repositorio pertenece a otra cuenta y el equipo no tiene permiso de
administrador, que es lo que exige GitHub para crear webhooks o secretos.
Preguntar cada minuto no necesita permiso de nadie.

Detalles pensados para que no moleste:

- **Sin despliegues encima de otro.** systemd no lanza la unidad si la
  anterior sigue corriendo.
- **Sin bucles de reconstruccion.** Si un commit falla al desplegar, queda
  anotado en `~/.timeflow-autodeploy-fallido` y no se reintenta hasta que
  alguien suba un commit nuevo.
- **El `.env` no se toca.** No esta versionado, asi que `git reset --hard`
  no lo alcanza.

### Instalacion (una vez)

```bash
cd /var/www/timeflow && bash deploy/auto-deploy.sh --instalar
```

### Operacion

```bash
systemctl list-timers timeflow-autodeploy.timer   # cuando corre la proxima vez
journalctl -u timeflow-autodeploy -f              # que desplego y con que resultado
journalctl -u timeflow-autodeploy -n 50 --no-pager
bash deploy/auto-deploy.sh                        # forzar una pasada ahora
bash deploy/auto-deploy.sh --desinstalar          # apagar la automatizacion
```

### La pestana abierta se entera

`update.sh` estampa el commit desplegado en dos lugares: dentro del bundle de
la web (`NEXT_PUBLIC_VERSION`, fijo desde que se compilo) y en
`/version.json`, que siempre refleja lo que corre ahora. El componente
`AvisoVersion` compara ambos cada minuto y, si difieren, muestra una barra
"Hay una version nueva · Actualizar ahora".

No recarga sola a proposito: una recarga forzada podria cortar un cronometro
en marcha o borrar un mensaje a medio escribir.

### Despliegue instantaneo con GitHub Actions

`.github/workflows/desplegar.yml` se dispara con cada push a `main` y entra al
VPS por SSH a correr `deploy/auto-deploy.sh`. Tarda segundos en arrancar en
vez de hasta un minuto, y el resultado queda visible en la pestana Actions.

Clave dedicada, distinta de la que usan las personas, para poder revocarla
sola si hiciera falta:

| Archivo | Donde vive |
|---|---|
| `~/.ssh/timeflow_ci_ed25519` | PC de Cristopher; su contenido es el secreto `VPS_SSH_KEY` en GitHub |
| `~/.ssh/timeflow_ci_ed25519.pub` | en `/home/ubuntu/.ssh/authorized_keys` del VPS |

Cargar el secreto (una vez, desde la PC que tiene la clave):

```powershell
Get-Content "$env:USERPROFILE\.ssh\timeflow_ci_ed25519" -Raw | gh secret set VPS_SSH_KEY --repo cristopherRamirezU/ElAlmendro
```

El secreto `VPS_SSH_KEY` quedo cargado el 25-09-2026. Si algun dia no
existiera, el flujo **no falla**: se salta con un aviso y el
timer de systemd sigue siendo quien despliega. Con el secreto puesto, el timer
queda como red de seguridad: cuando Actions ya desplego, la pasada del minuto
siguiente no encuentra nada nuevo y termina enseguida.

Revocar el acceso del CI: borrar esa linea de `authorized_keys` en el VPS y
el secreto en GitHub.

## 7. Operacion diaria

```bash
pm2 list                                # estado de api y web
pm2 logs timeflow-api --lines 100       # errores de la API
pm2 logs timeflow-web --lines 100
docker ps                               # db y storage deben estar "healthy"
docker compose -f docker/docker-compose.yml --env-file .env logs -f db
sudo journalctl -u caddy -n 50          # certificado, enrutamiento
sudo tail -f /var/log/caddy/timeflows.site.log
df -h / && free -h                      # disco y memoria
```

Crear un usuario de produccion (mientras no se use la pantalla de usuarios):

```bash
cd /var/www/timeflow && npm run usuario:crear -- correo@empresa.cl "Nombre Apellido" ClaveSegura1 ADMINISTRADOR
```

## 8. Respaldos

Base de datos (a un archivo comprimido, desde el host):

```bash
docker exec timeflow-db pg_dump -U timeflow -d timeflow -Fc > /var/backups/timeflow-$(date +%F).dump
```

Restaurar: `docker exec -i timeflow-db pg_restore -U timeflow -d timeflow --clean < archivo.dump`.

Evidencias: el volumen del contenedor `timeflow-storage`
(`docker run --rm --volumes-from timeflow-storage:ro -v /var/backups:/b alpine tar czf /b/evidencias-$(date +%F).tgz -C /data .`).

Automatico: `deploy/respaldo.sh` hace ambas cosas, guarda en
`/var/backups/timeflow` y borra los de mas de 14 dias. Para dejarlo cada noche
a las 03:30 (hora del servidor, UTC):

```bash
sudo mkdir -p /var/backups/timeflow && sudo chown ubuntu: /var/backups/timeflow
( crontab -l 2>/dev/null; echo '30 3 * * * bash /var/www/timeflow/deploy/respaldo.sh >> /var/backups/timeflow/respaldo.log 2>&1' ) | crontab -
```

Los respaldos quedan en el mismo VPS: protegen de un error (borrar datos, una
migracion mala), no de perder el servidor. Copiarlos de vez en cuando a otro
lugar (`scp` a un PC, o un bucket externo).

## 9. Problemas conocidos

**Docker no baja `minio/minio`** — MinIO retiro sus imagenes de Docker Hub; el
compose usa `quay.io/minio/...`. Si una PC vieja tiene las de Docker Hub en
cache sigue funcionando, pero una instalacion nueva necesita el compose actual.

**Caddy `failed` con `permission denied` en `/var/log/caddy`** — algo corrio
`caddy` como root y creo el log con dueno root. `sudo chown -R caddy:caddy
/var/log/caddy && sudo systemctl restart caddy`. `update.sh` valida como el
usuario `caddy` justamente para no provocarlo.

**Caddy no obtiene certificado** — el DNS aun no apunta al VPS o los puertos
80/443 estan cerrados. `sudo journalctl -u caddy -n 50` lo dice. Caddy
reintenta solo cuando el DNS resuelva.

**El login "funciona" pero al recargar pide loguearse de nuevo** — la cookie
no se guardo. Casi siempre: `NEXT_PUBLIC_API_URL` distinto del origen de la
web (debe ser `https://timeflows.site`, sin puerto) o el sitio abierto por
`http://` (la cookie es `secure`).

**El chat no conecta** — `/socket.io/*` no llega a la API. Revisar que el
Caddyfile instalado sea el del repo (`sudo cmp deploy/Caddyfile /etc/caddy/Caddyfile`).

**`permission denied` con docker** — el usuario recien entro al grupo
`docker`; cerrar la sesion SSH y volver a entrar.

**`migrate deploy` falla por una migracion ya aplicada a mano** — nunca
correr `prisma migrate dev` en produccion; solo `deploy`.
