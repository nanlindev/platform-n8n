#!/usr/bin/env bash
# Switch shared platform to production port 5678 and restart.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_FILE="${ROOT_DIR}/docker/compose.yml"
PROD_PORT="${N8N_PROD_PORT:-5678}"

cd "${ROOT_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}."
  exit 1
fi

current_port="$(grep -E '^N8N_PORT=' "${ENV_FILE}" | cut -d= -f2- || true)"
if [[ "${current_port}" == "${PROD_PORT}" ]]; then
  echo "N8N_PORT already ${PROD_PORT}; restarting stack..."
else
  echo "Setting N8N_PORT=${PROD_PORT} (was: ${current_port:-unset})..."
  if grep -q '^N8N_PORT=' "${ENV_FILE}"; then
    sed -i "s/^N8N_PORT=.*/N8N_PORT=${PROD_PORT}/" "${ENV_FILE}"
  else
    echo "N8N_PORT=${PROD_PORT}" >> "${ENV_FILE}"
  fi
fi

docker compose -f "${COMPOSE_FILE}" up -d

echo "Cutover complete. n8n: http://localhost:${PROD_PORT}"
echo "Activate workflows and update reverse proxy / webhook URLs if needed."
