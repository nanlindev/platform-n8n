#!/usr/bin/env bash
# Deploy shared n8n platform on port 5680 for parallel migration (legacy stacks on 5678/5679).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_FILE="${ROOT_DIR}/docker/compose.yml"
PARALLEL_PORT="${N8N_PARALLEL_PORT:-5680}"

cd "${ROOT_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy from .env.example and set POSTGRES_PASSWORD."
  exit 1
fi

set_env_port() {
  if grep -q '^N8N_PORT=' "${ENV_FILE}"; then
    sed -i "s/^N8N_PORT=.*/N8N_PORT=${PARALLEL_PORT}/" "${ENV_FILE}"
  else
    echo "N8N_PORT=${PARALLEL_PORT}" >> "${ENV_FILE}"
  fi
}

set_env_port

echo "Deploying platform-n8n on port ${PARALLEL_PORT}..."
"${SCRIPT_DIR}/ensure-networks.sh"
docker compose -f "${COMPOSE_FILE}" pull
docker compose --env-file /home/deploy/projects/platform-n8n/.env -f "${COMPOSE_FILE}" up -d

echo "Platform n8n: http://localhost:${PARALLEL_PORT}"
echo "Next: import workflows, then ./scripts/deploy-sidecars.sh"
