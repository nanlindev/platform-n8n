#!/usr/bin/env bash
# Optional: deploy BOTH RSS + CRM sidecars in one shot (migration / manual ops).
# Normal steady-state: push to n8n_portfolio or crm-workflow main — CI deploys each sidecar.
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_PROJECTS_ROOT:-/home/deploy/projects}"
PLATFORM_DIR="${DEPLOY_ROOT}/platform-n8n"
RSS_DIR="${DEPLOY_ROOT}/n8n_portfolio"
CRM_DIR="${DEPLOY_ROOT}/crm-workflow"

ensure_dir() {
  if [[ ! -d "$1" ]]; then
    echo "Expected directory not found: $1"
    exit 1
  fi
}

ensure_dir "${RSS_DIR}"
ensure_dir "${CRM_DIR}"

if [[ -d "${PLATFORM_DIR}/.git" ]]; then
  echo "--- Updating platform-n8n (compose templates) ---"
  git -C "${PLATFORM_DIR}" pull origin main
else
  echo "ERROR: ${PLATFORM_DIR} not found — clone platform-n8n first"
  exit 1
fi

grep -q 'external: true' "${PLATFORM_DIR}/docker/templates/networks.yml" \
  || { echo "ERROR: networks.yml missing external: true"; exit 1; }

if [[ -x "${PLATFORM_DIR}/scripts/ensure-networks.sh" ]]; then
  "${PLATFORM_DIR}/scripts/ensure-networks.sh"
elif [[ -x "$(dirname "$0")/ensure-networks.sh" ]]; then
  "$(dirname "$0")/ensure-networks.sh"
fi

deploy_sidecar() {
  local name="$1"
  local dir="$2"
  local image="$3"
  local service="$4"
  echo "--- Deploying ${name} from ${dir} ---"

  if [[ ! -f "${dir}/.env" ]]; then
    echo "ERROR: ${dir}/.env not found."
    echo "Copy docker/.env.example to .env and set DEEPSEEK_* and LANGFUSE_* before deploy."
    exit 1
  fi

  cd "${dir}"
  git pull origin main
  docker pull "${image}"
  docker compose -f docker/compose.yml --env-file .env up -d --remove-orphans
  docker compose -f docker/compose.yml --env-file .env ps
  running="$(docker compose -f docker/compose.yml --env-file .env ps --status running -q "${service}" | wc -l)"
  if [[ "${running}" -lt 1 ]]; then
    echo "ERROR: ${service} is not running in ${dir}"
    docker compose -f docker/compose.yml --env-file .env logs --tail=50 "${service}" || true
    exit 1
  fi
}

deploy_sidecar "RSS sidecar" "${RSS_DIR}" "ghcr.io/nanlindev/n8n_portfolio/python-ai-service:latest" "rss_python_ai"
deploy_sidecar "CRM sidecar" "${CRM_DIR}" "ghcr.io/nanlindev/crm-workflow/python-ai-service:latest" "crm_python_ai"

echo ""
echo "Sidecars deployed."
echo "  RSS: http://localhost:8001/health  (service: rss_python_ai)"
echo "  CRM: http://localhost:8002/health  (service: crm_python_ai)"
echo ""
echo "Networks: n8n_platform (n8n <-> sidecars), proxy_network (OTEL/Langfuse)"
