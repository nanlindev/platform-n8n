# Shared n8n Automation Platform

Shared n8n runtime and Docker templates for automation projects (RSS, CRM, and future workflows).

## Layout

| Path | Purpose |
|------|---------|
| `docker/compose.yml` | Shared n8n + Postgres runtime |
| `docker/templates/` | Reusable compose/env/Dockerfile templates for project sidecars |
| `docker/docs/DOCKER_STANDARDS.md` | Naming, ports, networks, deploy conventions |
| `scripts/ensure-networks.sh` | Create `proxy_network` and `n8n_platform` |
| `docs/DEPLOY.md` | Platform deployment guide |
| `docs/MIGRATION_RUNBOOK.md` | Production cutover steps |

## Quick start (local)

```bash
cp .env.example .env
./scripts/ensure-networks.sh
docker compose --env-file .env -f docker/compose.yml up -d
```

Requires sibling OBS stacks on `proxy_network` for full observability.

## Sibling projects

Projects reference templates from `../platform-n8n/docker/templates/` and run their Python sidecars on `n8n_platform`:

- `../n8n_portfolio` — RSS (`rss_python_ai`, port 8001)
- `../crm-workflow` — CRM (`crm_python_ai`, port 8002)

## Deploy paths

| Environment | Path |
|-------------|------|
| Local | `/home/lotey/lindev/platform-n8n` |
| Production | `/home/deploy/projects/platform-n8n` |
