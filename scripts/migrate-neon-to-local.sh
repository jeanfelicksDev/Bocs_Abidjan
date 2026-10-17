#!/usr/bin/env bash
# Reprise unique des données : base Neon (cloud) → PostgreSQL local (Docker Compose).
# À lancer une seule fois, sur le serveur, base locale démarrée et VIDE :
#   NEON_URL='postgresql://…neon.tech/…?sslmode=require' ./scripts/migrate-neon-to-local.sh
# La base Neon n'est que lue. Ne la supprimer qu'après avoir vérifié l'application locale.
set -euo pipefail

cd "$(dirname "$0")/.."
: "${NEON_URL:?Renseignez NEON_URL (chaîne de connexion Neon, accès en lecture)}"
mkdir -p backups
DUMP="backups/neon-reprise-$(date +%Y%m%d-%H%M%S).dump"

echo "1/3 Export de la base Neon…"
docker run --rm postgres:16-alpine pg_dump "$NEON_URL" --format=custom --no-owner --no-privileges > "$DUMP"
[ -s "$DUMP" ] || { echo "Export vide : abandon." >&2; exit 1; }
chmod 600 "$DUMP"

echo "2/3 Import dans la base locale…"
# Le fichier est copié dans le conteneur : plus fiable qu'un flux sur l'entrée standard.
docker compose cp "$DUMP" db:/tmp/reprise.dump
docker compose exec -T db pg_restore -U bocs -d bocs --no-owner --no-privileges --exit-on-error /tmp/reprise.dump
docker compose exec -T db rm -f /tmp/reprise.dump

echo "3/3 Contrôle…"
docker compose exec -T db psql -U bocs -d bocs -c \
  "SELECT 'escales' AS table, count(*) FROM escales UNION ALL SELECT 'bls', count(*) FROM bls
   UNION ALL SELECT 'invoices', count(*) FROM invoices UNION ALL SELECT 'users', count(*) FROM users;"
echo "Reprise terminée. Export conservé : $DUMP (données sensibles : à protéger ou supprimer)."
