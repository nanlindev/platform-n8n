#!/usr/bin/env bash
set -euo pipefail

echo "Ensuring Docker networks..."

docker network create proxy_network --driver bridge 2>/dev/null || true
docker network inspect n8n_platform >/dev/null 2>&1 || \
  docker network create n8n_platform --driver bridge

echo "Networks ready (both external; compose attaches services to them):"
echo "  - n8n_platform  : n8n <-> rss_python_ai / crm_python_ai"
echo "  - proxy_network : OTEL (otel-collector), Langfuse (langfuse-web)"
