#!/usr/bin/env bash
# TimeFlow - respaldo de la base y de los archivos adjuntos (en el VPS).
#
#   bash deploy/respaldo.sh               un respaldo ahora
#   bash deploy/respaldo.sh --instalar    timer de systemd diario (lo hace update.sh)
#   bash deploy/respaldo.sh --estado      ultimos respaldos y proxima ejecucion
#   bash deploy/respaldo.sh --desinstalar apaga el respaldo diario
#
# Guarda un dump de PostgreSQL (formato custom, comprimido) y un tar.gz del
# volumen de MinIO en /var/backups/timeflow, y borra los de mas de
# DIAS_RETENCION dias.
#
# Registro:  journalctl -u timeflow-respaldo
# Restaurar la base:
#   docker exec -i timeflow-db pg_restore -U timeflow -d timeflow --clean < timeflow-AAAA-MM-DD-HHMM.dump
set -euo pipefail

cd "$(dirname "$0")/.."
RAIZ="$(pwd)"
DESTINO="${DESTINO:-/var/backups/timeflow}"
DIAS_RETENCION="${DIAS_RETENCION:-14}"
# 03:30 UTC = 00:30 en Chile en verano (23:30 en invierno): la hora de menos uso.
HORA_UTC="${HORA_RESPALDO_UTC:-03:30}"
# Sin al menos 1 GB libre no se respalda: llenar el disco botaria la app.
LIBRE_MINIMO_KB=$((1024 * 1024))

estado() {
  echo "   ultimos respaldos en $DESTINO:"
  if ls "$DESTINO"/timeflow-*.dump >/dev/null 2>&1; then
    { ls -1t "$DESTINO"/timeflow-*.dump "$DESTINO"/evidencias-*.tgz 2>/dev/null || true; } | head -4 |
      while read -r f; do echo "     $(du -h "$f" | cut -f1)  $(basename "$f")"; done || true
  else
    echo "     (todavia ninguno)"
  fi
  if systemctl is-failed --quiet timeflow-respaldo.service 2>/dev/null; then
    echo "   !! el ultimo respaldo FALLO: journalctl -u timeflow-respaldo -n 30"
  fi
  systemctl list-timers timeflow-respaldo.timer --no-pager 2>/dev/null | sed -n '1,2p' | sed 's/^/   /'
}

# Escribe un archivo de sistema solo si cambio. Devuelve 0 si lo cambio.
instalar_archivo() {
  local destino="$1" contenido="$2"
  if [[ -f "$destino" ]] && [[ "$(cat "$destino")" == "$contenido" ]]; then
    return 1
  fi
  printf '%s\n' "$contenido" | sudo tee "$destino" >/dev/null
  return 0
}

instalar() {
  local usuario; usuario="$(id -un)"
  sudo install -d -m 0700 -o "$usuario" -g "$usuario" "$DESTINO"

  local servicio temporizador cambio=0
  servicio="[Unit]
Description=TimeFlow - respaldo de la base y de los archivos
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=${usuario}
Environment=HOME=/home/${usuario}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
WorkingDirectory=${RAIZ}
ExecStart=/usr/bin/env bash ${RAIZ}/deploy/respaldo.sh
# Que el respaldo no le quite recursos a la app.
Nice=10
IOSchedulingClass=idle
TimeoutStartSec=3600"
  temporizador="[Unit]
Description=TimeFlow - respaldo diario a las ${HORA_UTC} UTC

[Timer]
OnCalendar=*-*-* ${HORA_UTC}:00 UTC
# Si el servidor estaba apagado a esa hora, respalda apenas vuelve.
Persistent=true

[Install]
WantedBy=timers.target"

  instalar_archivo /etc/systemd/system/timeflow-respaldo.service "$servicio" && cambio=1
  instalar_archivo /etc/systemd/system/timeflow-respaldo.timer "$temporizador" && cambio=1
  if (( cambio )); then
    sudo systemctl daemon-reload
    echo "   timer de respaldo instalado/actualizado"
  fi
  sudo systemctl enable --now --quiet timeflow-respaldo.timer

  # La primera vez se respalda de inmediato: confirma que todo funciona en
  # este servidor sin esperar a la noche.
  if ! ls "$DESTINO"/timeflow-*.dump >/dev/null 2>&1; then
    echo "   primer respaldo (de prueba):"
    if sudo systemctl start timeflow-respaldo.service; then
      journalctl -u timeflow-respaldo -n 8 --no-pager -o cat 2>/dev/null | sed 's/^/     /' || true
    else
      echo "   !! el primer respaldo fallo:"
      journalctl -u timeflow-respaldo -n 20 --no-pager -o cat 2>/dev/null | sed 's/^/     /' || true
      return 1
    fi
  fi
  estado
}

desinstalar() {
  sudo systemctl disable --now timeflow-respaldo.timer
  sudo rm -f /etc/systemd/system/timeflow-respaldo.{service,timer}
  sudo systemctl daemon-reload
  echo "Respaldo diario apagado (los archivos en $DESTINO se conservan)."
}

case "${1:-}" in
  --instalar) instalar; exit $? ;;
  --estado) estado; exit 0 ;;
  --desinstalar) desinstalar; exit 0 ;;
  '') ;;
  *) echo "argumento desconocido: $1"; exit 1 ;;
esac

# --------------------------------------------------------------- respaldo
# Usuario y base, del mismo .env que usa docker compose.
if [[ -f "$RAIZ/.env" ]]; then
  set -a; source "$RAIZ/.env"; set +a
fi
PG_USUARIO="${POSTGRES_USER:-timeflow}"
PG_BASE="${POSTGRES_DB:-timeflow}"
FECHA="$(date -u +%F-%H%M)"

mkdir -p "$DESTINO"
# Los respaldos contienen todos los datos: solo los lee su dueno.
umask 077

libre_kb="$(df -Pk "$DESTINO" | awk 'NR==2 {print $4}')"
if (( libre_kb < LIBRE_MINIMO_KB )); then
  echo "!! Quedan $((libre_kb / 1024)) MB libres en el disco: no se respalda para no llenarlo." >&2
  exit 1
fi

echo "== $(date -Is) respaldo en $DESTINO"
temporal="$DESTINO/.timeflow-$FECHA.dump.tmp"
trap 'rm -f "$temporal" "$DESTINO/.evidencias-$FECHA.tgz.tmp"' EXIT

docker exec timeflow-db pg_dump -U "$PG_USUARIO" -d "$PG_BASE" -Fc > "$temporal"
mv "$temporal" "$DESTINO/timeflow-$FECHA.dump"
echo "   base:     timeflow-$FECHA.dump ($(du -h "$DESTINO/timeflow-$FECHA.dump" | cut -f1))"

# --volumes-from: el nombre del volumen cambia segun el proyecto de compose
# (docker_..., timeflow_...); asi se toma el que use el contenedor.
docker run --rm --volumes-from timeflow-storage:ro -v "$DESTINO":/b alpine \
  tar czf "/b/.evidencias-$FECHA.tgz.tmp" -C /data .
mv "$DESTINO/.evidencias-$FECHA.tgz.tmp" "$DESTINO/evidencias-$FECHA.tgz"
echo "   archivos: evidencias-$FECHA.tgz ($(du -h "$DESTINO/evidencias-$FECHA.tgz" | cut -f1))"

find "$DESTINO" -maxdepth 1 -type f \( -name 'timeflow-*.dump' -o -name 'evidencias-*.tgz' \) \
  -mtime +"$DIAS_RETENCION" -print -delete | sed 's/^/   borrado:  /'

echo "== listo"
