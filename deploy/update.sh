#!/usr/bin/env bash
# TimeFlow - deploy/actualizacion en el VPS. Se corre desde la raiz del repo:
#
#   cd /var/www/timeflow && git pull && bash deploy/update.sh
#   bash deploy/update.sh --primera-vez     # ademas instala Caddyfile, arranca pm2 y persiste
#   bash deploy/update.sh --seed            # ademas carga los datos de prueba (solo la 1a vez)
#
# Orden pensado para que el corte sea de segundos:
#   1. dependencias y prisma generate      (la app sigue arriba)
#   2. build de API y web                   (la app sigue arriba)
#   3. levantar/asegurar db + storage       (idempotente)
#   4. migraciones + reglas de integridad   (prisma migrate deploy)
#   5. pm2 restart (o start la primera vez)
#   6. asegurar el respaldo diario          (idempotente; no detiene el deploy)
#   7. comprobar /api/salud
set -euo pipefail

cd "$(dirname "$0")/.."
RAIZ="$(pwd)"
PRIMERA_VEZ=0; SEED=0
for arg in "$@"; do
  case "$arg" in
    --primera-vez) PRIMERA_VEZ=1 ;;
    --seed) SEED=1 ;;
    *) echo "argumento desconocido: $arg"; exit 1 ;;
  esac
done

[[ -f .env ]] || { echo "Falta $RAIZ/.env (ver deploy/env.production.example)"; exit 1; }

# Las NEXT_PUBLIC_* se incrustan en el bundle en tiempo de build: next build
# no lee el .env de la raiz por su cuenta, por eso se exporta todo aqui.
set -a; source .env; set +a
export NODE_ENV=production

# Caddyfile segun el origen publico: con dominio (TLS de Let's Encrypt) o
# sobre la IP pelada (certificado interno) mientras el DNS no resuelva.
CADDY_SRC=deploy/Caddyfile
if [[ "${NEXT_PUBLIC_API_URL:-}" =~ ^https?://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  CADDY_SRC=deploy/Caddyfile.ip
fi

echo "== [1/7] npm ci"
# --include=dev: con NODE_ENV=production npm omitiria las devDependencies, y
# el build las necesita (nest cli, typescript, tailwind, dotenv-cli).
npm ci --include=dev --no-audit --no-fund

echo "== [2/7] prisma generate + build"
npm run db:generate
npm run build -w @timeflow/api
# El commit desplegado viaja en el bundle (NEXT_PUBLIC_* se incrusta en tiempo
# de build) y tambien como archivo estatico: comparando ambos, una pestana
# abierta se entera de que hay una version nueva.
export NEXT_PUBLIC_VERSION="$(git rev-parse --short HEAD)"
npm run build -w @timeflow/web
echo "{\"version\":\"$NEXT_PUBLIC_VERSION\"}" > src/frontend/public/version.json

echo "== [3/7] PostgreSQL y MinIO (docker compose)"
docker compose -f docker/docker-compose.yml --env-file .env up -d db storage storage-init
until docker compose -f docker/docker-compose.yml --env-file .env exec -T db pg_isready -U "${POSTGRES_USER:-timeflow}" -d "${POSTGRES_DB:-timeflow}" >/dev/null 2>&1; do
  echo "   esperando a la base..."; sleep 2
done

echo "== [4/7] migraciones + reglas de integridad"
npm run prisma:deploy -w @timeflow/api
if [[ $SEED -eq 1 ]]; then
  echo "   cargando datos de prueba (seed)"
  npm run db:seed
fi

echo "== [5/7] pm2"
if [[ $PRIMERA_VEZ -eq 1 ]]; then
  sudo install -m 0644 "$CADDY_SRC" /etc/caddy/Caddyfile
  sudo -u caddy caddy validate --config /etc/caddy/Caddyfile
  sudo systemctl restart caddy
  pm2 start ecosystem.config.cjs
  pm2 save
  sudo env PATH="$PATH:$(dirname "$(command -v node)")" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null
  pm2 save
else
  # --update-env relee el ecosystem (y con el, el .env) en cada restart.
  pm2 restart ecosystem.config.cjs --update-env
  # Si cambio el Caddyfile en el repo, se aplica sin cortar conexiones.
  # Se valida ANTES de instalarlo: si trae un error, el servidor sigue con el
  # que funcionaba y el deploy se detiene avisando.
  if ! sudo cmp -s "$CADDY_SRC" /etc/caddy/Caddyfile; then
    CADDY_TMP="$(mktemp)"
    cp "$CADDY_SRC" "$CADDY_TMP" && chmod 0644 "$CADDY_TMP"
    if sudo -u caddy caddy validate --adapter caddyfile --config "$CADDY_TMP"; then
      sudo install -m 0644 "$CADDY_SRC" /etc/caddy/Caddyfile
      sudo systemctl reload caddy
    else
      echo "!! El Caddyfile nuevo no es valido: se mantiene el anterior." >&2
      rm -f "$CADDY_TMP"
      exit 1
    fi
    rm -f "$CADDY_TMP"
  fi
fi

echo "== [6/7] respaldo diario"
# Instala (o deja como esta) el timer de systemd que respalda base y archivos
# cada noche; la primera vez hace un respaldo de prueba. Un problema aqui se
# avisa pero no tumba el despliegue: la app ya quedo actualizada.
bash deploy/respaldo.sh --instalar || echo "!! No se pudo asegurar el respaldo diario (ver arriba)." >&2

echo "== [7/7] salud"
for i in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${API_PORT:-4000}/api/salud" >/dev/null 2>&1; then
    echo "API OK: $(curl -fsS "http://127.0.0.1:${API_PORT:-4000}/api/salud")"
    curl -fsS -o /dev/null -w "WEB HTTP %{http_code}\n" "http://127.0.0.1:${WEB_PORT:-3000}/login"
    pm2 list
    exit 0
  fi
  sleep 2
done
echo "La API no respondio en /api/salud. Revisar: pm2 logs timeflow-api --lines 100"
exit 1
