#!/usr/bin/env bash
# TimeFlow - respaldo de la base y de los archivos adjuntos (en el VPS).
#
#   bash deploy/respaldo.sh                 # deja los archivos en /var/backups/timeflow
#   DESTINO=/otra/ruta bash deploy/respaldo.sh
#
# Guarda un dump de PostgreSQL (formato custom, comprimido) y un tar.gz del
# volumen de MinIO, y borra los de mas de DIAS_RETENCION dias. Pensado para
# cron (ver deploy/DEPLOY.md, seccion Respaldos).
#
# Restaurar la base:
#   docker exec -i timeflow-db pg_restore -U timeflow -d timeflow --clean < timeflow-AAAA-MM-DD.dump
set -euo pipefail

DESTINO="${DESTINO:-/var/backups/timeflow}"
DIAS_RETENCION="${DIAS_RETENCION:-14}"
FECHA="$(date +%F-%H%M)"

mkdir -p "$DESTINO"
# Los respaldos contienen todos los datos: solo los lee su dueno.
umask 077

echo "== $(date -Is) respaldo en $DESTINO"

docker exec timeflow-db pg_dump -U timeflow -d timeflow -Fc > "$DESTINO/timeflow-$FECHA.dump.tmp"
mv "$DESTINO/timeflow-$FECHA.dump.tmp" "$DESTINO/timeflow-$FECHA.dump"
echo "   base:     timeflow-$FECHA.dump ($(du -h "$DESTINO/timeflow-$FECHA.dump" | cut -f1))"

# --volumes-from: el nombre del volumen cambia segun el proyecto de compose
# (docker_..., timeflow_...); asi se toma el que use el contenedor.
docker run --rm --volumes-from timeflow-storage:ro -v "$DESTINO":/b alpine \
  tar czf "/b/evidencias-$FECHA.tgz" -C /data .
echo "   archivos: evidencias-$FECHA.tgz ($(du -h "$DESTINO/evidencias-$FECHA.tgz" | cut -f1))"

find "$DESTINO" -maxdepth 1 -type f \( -name 'timeflow-*.dump' -o -name 'evidencias-*.tgz' \) \
  -mtime +"$DIAS_RETENCION" -print -delete | sed 's/^/   borrado:  /'

echo "== listo"
