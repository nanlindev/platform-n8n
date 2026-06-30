# Platform Deployment

Deploy the shared n8n runtime to production or local.

## Prerequisites

- Docker Compose v2.20+ (for `include` support)
- OBS stacks running on `proxy_network` (optional but recommended)
- Sibling project repos cloned alongside this repo

## Local (lindev)

```bash
cd /home/lotey/lindev/platform-n8n
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, N8N_PORT if needed

./scripts/ensure-networks.sh
docker compose -f docker/compose.yml up -d
```

Open n8n: http://localhost:5678 (or `N8N_PORT`).

## Production (projects)

Path: `/home/deploy/projects/platform-n8n`

GitHub Actions deploys on push to `main`. Manual deploy:

```bash
cd /home/deploy/projects/platform-n8n
git pull origin main
./scripts/ensure-networks.sh
docker compose -f docker/compose.yml pull
docker compose -f docker/compose.yml up -d
```

## Parallel migration (port 5680)

While legacy RSS/CRM n8n instances still run on 5678/5679:

```bash
# In .env
N8N_PORT=5680
docker compose -f docker/compose.yml up -d
```

Validate at http://localhost:5680, then follow [MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md) for cutover.

## After platform is up

1. Import workflows from project repos (see [WORKFLOW_IMPORT.md](WORKFLOW_IMPORT.md))
2. Start project sidecars from `n8n_portfolio` and `crm-workflow`
3. Verify Jaeger traces for `n8n-platform` and sidecar service names
