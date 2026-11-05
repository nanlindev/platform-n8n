#!/usr/bin/env bash
# Pre-deploy backup on the server: Postgres custom dump + n8n_data volume tarball.
# Intended for GitHub Actions deploy (runs before image pull/up).
# Usage (from repo root, with .env present):
#   ./scripts/backup_n8n_pre_deploy.sh
# Optional: BACKUP_ROOT=/home/deploy/backups  BACKUP_KEEP=5
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: $ROOT/.env missing" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
source .env
set +a

COMPOSE=(docker compose -f docker/compose.yml --env-file .env)
BACKUP_ROOT="${BACKUP_ROOT:-/home/deploy/backups}"
KEEP="${BACKUP_KEEP:-5}"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
DEST="${BACKUP_ROOT}/n8n-${STAMP}-pre-deploy"
mkdir -p "$DEST"

echo "Backup → $DEST"

# Current image tag (for MANIFEST) — may still be old until pull.
IMAGE="$("${COMPOSE[@]}" images -q n8n_app 2>/dev/null | head -1 || true)"
VERSION_LINE="$("${COMPOSE[@]}" exec -T n8n_app n8n --version 2>/dev/null || echo 'n8n version unknown (app not running?)')"

# Postgres dump (custom format) via running postgres container.
PG_CID="$("${COMPOSE[@]}" ps -q n8n_postgres)"
if [[ -z "$PG_CID" ]]; then
  echo "ERROR: n8n_postgres is not running — cannot pg_dump" >&2
  exit 1
fi
docker exec "$PG_CID" \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  >"$DEST/n8n_postgres.dump"
DUMP_BYTES="$(wc -c <"$DEST/n8n_postgres.dump" | tr -d ' ')"
if [[ "$DUMP_BYTES" -lt 1000 ]]; then
  echo "ERROR: n8n_postgres.dump too small (${DUMP_BYTES} bytes)" >&2
  exit 1
fi
echo "OK  pg_dump → n8n_postgres.dump (${DUMP_BYTES} bytes)"

# n8n binary/config volume (project-scoped name from compose project "platform-n8n")
VOL_NAME="${N8N_DATA_VOLUME:-platform-n8n_n8n_data}"
if ! docker volume inspect "$VOL_NAME" >/dev/null 2>&1; then
  # Fallback: discover volume attached to n8n_app
  APP_CID="$("${COMPOSE[@]}" ps -q n8n_app || true)"
  if [[ -n "$APP_CID" ]]; then
    VOL_NAME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/home/node/.n8n"}}{{.Name}}{{end}}{{end}}' "$APP_CID")"
  fi
fi
if [[ -z "$VOL_NAME" ]] || ! docker volume inspect "$VOL_NAME" >/dev/null 2>&1; then
  echo "ERROR: could not resolve n8n_data volume (tried platform-n8n_n8n_data)" >&2
  exit 1
fi
docker run --rm \
  -v "${VOL_NAME}:/data:ro" \
  -v "${DEST}:/backup" \
  alpine:3.20 \
  sh -c 'tar czf /backup/n8n_data.tar.gz -C /data .'
TAR_BYTES="$(wc -c <"$DEST/n8n_data.tar.gz" | tr -d ' ')"
if [[ "$TAR_BYTES" -lt 100 ]]; then
  echo "ERROR: n8n_data.tar.gz too small (${TAR_BYTES} bytes)" >&2
  exit 1
fi
echo "OK  volume $VOL_NAME → n8n_data.tar.gz (${TAR_BYTES} bytes)"

{
  echo "created_utc=$STAMP"
  echo "host=$(hostname -f 2>/dev/null || hostname)"
  echo "project_dir=$ROOT"
  echo "n8n_version_line=$VERSION_LINE"
  echo "n8n_app_image_id=$IMAGE"
  echo "postgres_dump_bytes=$DUMP_BYTES"
  echo "n8n_data_tar_bytes=$TAR_BYTES"
  echo "n8n_data_volume=$VOL_NAME"
  echo "note=pre-deploy backup before compose pull/up"
} >"$DEST/MANIFEST.txt"
echo "OK  MANIFEST.txt"
ls -la "$DEST"

# Retention: keep newest $KEEP backup dirs
if [[ "$KEEP" =~ ^[0-9]+$ ]] && [[ "$KEEP" -gt 0 ]]; then
  i=0
  while IFS= read -r d; do
    i=$((i + 1))
    if [[ "$i" -gt "$KEEP" ]]; then
      echo "prune old backup: $d"
      rm -rf "$d"
    fi
  done < <(ls -1dt "${BACKUP_ROOT}"/n8n-*-pre-deploy 2>/dev/null || true)
fi

echo "PASS backup_n8n_pre_deploy → $DEST"
