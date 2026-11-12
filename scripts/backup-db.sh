#!/usr/bin/env bash
# Sauvegarde quotidienne de la base BOCS (installation Docker Compose).
# À planifier sur le serveur, ex. chaque nuit à 2 h (crontab -e) :
#   0 2 * * * cd /opt/bocs && ./scripts/backup-db.sh >> backups/backup.log 2>&1
# Copier ensuite le dossier backups/ vers un second support (NAS, disque externe
# en rotation) : règle 3-2-1. Tester une restauration chaque mois.
set -euo pipefail

cd "$(dirname "$0")/.."
DEST="${BACKUP_DIR:-backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
mkdir -p "$DEST"

FILE="$DEST/bocs-$(date +%Y%m%d-%H%M%S).dump"
# Un échec de pg_dump ne doit pas laisser derrière lui un fichier vide ou tronqué.
trap '[ -n "${FILE:-}" ] && [ ! -s "$FILE" ] && rm -f "$FILE"' EXIT
trap 'rm -f "$FILE"; echo "$(date -Iseconds) ÉCHEC : pg_dump" >&2' ERR
docker compose exec -T db pg_dump -U bocs -d bocs --format=custom --no-owner > "$FILE"
# Une sauvegarde vide signale un échec silencieux : on l'écarte.
if [ ! -s "$FILE" ]; then
  rm -f "$FILE"
  echo "$(date -Iseconds) ÉCHEC : sauvegarde vide" >&2
  exit 1
fi
chmod 600 "$FILE"
find "$DEST" -name 'bocs-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Iseconds) OK : $FILE ($(du -h "$FILE" | cut -f1))"

# Restauration :
#   docker compose cp backups/bocs-AAAAMMJJ-HHMMSS.dump db:/tmp/restauration.dump
#   docker compose exec -T db pg_restore -U bocs -d bocs --clean --if-exists --no-owner /tmp/restauration.dump
