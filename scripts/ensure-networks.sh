#!/usr/bin/env bash
set -euo pipefail

echo "Ensuring Docker networks..."

docker network create proxy_network --driver bridge 2>/dev/null || true
docker network inspect n8n_platform >/dev/null 2>&1 || \
  docker network create n8n_platform --driver bridge

echo "Networks ready: proxy_network, n8n_platform"
