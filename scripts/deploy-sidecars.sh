#!/usr/bin/env bash
# Deploy RSS and CRM Python sidecars from /home/deploy/projects (production layout).
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

if [[ -x "${PLATFORM_DIR}/scripts/ensure-networks.sh" ]]; then
  "${PLATFORM_DIR}/scripts/ensure-networks.sh"
elif [[ -x "$(dirname "$0")/ensure-networks.sh" ]]; then
  "$(dirname "$0")/ensure-networks.sh"
fi

deploy_sidecar() {
  local name="$1"
  local dir="$2"
  local image="$3"
  echo "--- Deploying ${name} from ${dir} ---"

  if [[ ! -f "${dir}/.env" ]]; then
    echo "ERROR: ${dir}/.env not found."
    echo "Copy docker/.env.example to .env and set DEEPSEEK_* and LANGFUSE_* before deploy."
    exit 1
  fi

  cd "${dir}"
  git pull origin main
  docker pull "${image}"
  # --env-file loads repo-root .env for ${VAR} interpolation (compose project dir is docker/)
  docker compose -f docker/compose.yml --env-file .env up -d
}

deploy_sidecar "RSS sidecar" "${RSS_DIR}" "ghcr.io/nanlindev/n8n_portfolio/python-ai-service:latest"
deploy_sidecar "CRM sidecar" "${CRM_DIR}" "ghcr.io/nanlindev/crm-workflow/python-ai-service:latest"

echo ""
echo "Sidecars deployed."
echo "  RSS: http://localhost:8001/health  (service: rss_python_ai)"
echo "  CRM: http://localhost:8002/health  (service: crm_python_ai)"
echo ""
echo "Networks: n8n_platform (n8n <-> sidecars), proxy_network (OTEL/Langfuse)"
