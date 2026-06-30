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
  cd "${dir}"
  git pull origin main
  docker pull "${image}"
  docker compose -f docker/compose.yml up -d
}

deploy_sidecar "RSS sidecar" "${RSS_DIR}" "ghcr.io/nanlindev/n8n_portfolio/python-ai-service:latest"
deploy_sidecar "CRM sidecar" "${CRM_DIR}" "ghcr.io/nanlindev/crm-workflow/python-ai-service:latest"

echo "Sidecars up. RSS :8001, CRM :8002 (host) -> crm_python_ai / rss_python_ai on n8n_platform."
