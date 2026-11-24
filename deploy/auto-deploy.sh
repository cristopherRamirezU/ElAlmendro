#!/usr/bin/env bash
# TimeFlow - despliegue automatico: vigila origin/main y actualiza el servidor
# cuando aparece un commit nuevo.
#
# No usa webhooks ni GitHub Actions a proposito: el repositorio es de otra
# cuenta y no tenemos permisos de administrador para crear secretos ni
# webhooks. Preguntarle a GitHub cada minuto no necesita permiso de nadie.
#
#   bash deploy/auto-deploy.sh --instalar    instala el timer de systemd (una vez)
#   bash deploy/auto-deploy.sh               una pasada manual
#   bash deploy/auto-deploy.sh --desinstalar apaga la automatizacion
#
# Registro:  journalctl -u timeflow-autodeploy -f
set -euo pipefail

cd "$(dirname "$0")/.."
RAIZ="$(pwd)"
RAMA="${RAMA_DESPLIEGUE:-main}"
# Recuerda el ultimo commit que fallo, para no reconstruirlo en bucle cada
# minuto: se vuelve a intentar solo cuando alguien sube algo nuevo.
ESTADO="$HOME/.timeflow-autodeploy-fallido"

instalar() {
  local usuario; usuario="$(id -un)"
  sudo tee /etc/systemd/system/timeflow-autodeploy.service >/dev/null <<UNIDAD
[Unit]
Description=TimeFlow - despliega origin/${RAMA} cuando hay commits nuevos
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
User=${usuario}
Environment=HOME=/home/${usuario}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
WorkingDirectory=${RAIZ}
ExecStart=/usr/bin/env bash ${RAIZ}/deploy/auto-deploy.sh
TimeoutStartSec=1800
UNIDAD

  sudo tee /etc/systemd/system/timeflow-autodeploy.timer >/dev/null <<TEMPORIZADOR
[Unit]
Description=TimeFlow - revisa origin/${RAMA} cada minuto

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
# Si un despliegue tarda mas de un minuto, systemd no lanza otro encima:
# el timer espera a que la unidad termine.
AccuracySec=10s

[Install]
WantedBy=timers.target
TEMPORIZADOR

  sudo systemctl daemon-reload
  sudo systemctl enable --now timeflow-autodeploy.timer
  systemctl list-timers timeflow-autodeploy.timer --no-pager
}

desinstalar() {
  sudo systemctl disable --now timeflow-autodeploy.timer
  sudo rm -f /etc/systemd/system/timeflow-autodeploy.{service,timer}
  sudo systemctl daemon-reload
  echo "Automatizacion apagada."
}

case "${1:-}" in
  --instalar) instalar; exit 0 ;;
  --desinstalar) desinstalar; exit 0 ;;
  '') ;;
  *) echo "argumento desconocido: $1"; exit 1 ;;
esac

# Candado exclusivo: impide que GitHub Actions y el timer de systemd ejecuten
# dos despliegues (git reset + npm ci) al mismo tiempo sobre /var/www/timeflow.
CANDADO="$HOME/.timeflow-autodeploy.lock"
exec 9>"$CANDADO"
if ! flock -w 900 9; then
  echo "Otro despliegue sigue activo tras 15 minutos; se omite esta pasada." >&2
  exit 1
fi

git fetch --quiet origin "$RAMA"
LOCAL="$(git rev-parse HEAD)"
REMOTO="$(git rev-parse "origin/$RAMA")"

if [[ "$LOCAL" == "$REMOTO" ]]; then
  exit 0
fi

if [[ -f "$ESTADO" && "$(cat "$ESTADO")" == "$REMOTO" ]]; then
  echo "El commit ${REMOTO:0:7} ya fallo antes; esperando un commit nuevo."
  exit 0
fi

echo "Commit nuevo en origin/$RAMA: ${LOCAL:0:7} -> ${REMOTO:0:7}"
git log --oneline "$LOCAL..$REMOTO" | sed 's/^/  /'

# reset --hard y no merge: el servidor no produce commits propios, solo
# reproduce lo que hay en GitHub. El .env no esta versionado, asi que no se toca.
git reset --hard --quiet "origin/$RAMA"

if bash deploy/update.sh 9>&-; then
  rm -f "$ESTADO"
  echo "Despliegue de ${REMOTO:0:7} terminado."
else
  codigo=$?
  echo "$REMOTO" > "$ESTADO"
  echo "Fallo el despliegue de ${REMOTO:0:7} (codigo $codigo). No se reintenta hasta el proximo commit."
  exit $codigo
fi
