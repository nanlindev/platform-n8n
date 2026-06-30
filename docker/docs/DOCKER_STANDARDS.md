# Docker Standards

Conventions for the shared n8n platform and project sidecars.

## Directory layout

```
lindev/                          projects/  (production)
├── platform-n8n/                ├── platform-n8n/
├── n8n_portfolio/               ├── n8n_portfolio/
├── crm-workflow/                ├── crm-workflow/
├── otel-collector-stack/        ├── otel-collector-stack/
├── jaeger-stack/                ├── jaeger-stack/
└── langfuse-stack/              └── langfuse-stack/
```

All project repos must be **siblings** of `platform-n8n` so compose `include` paths resolve.

## Networks

| Network | Owner | Purpose |
|---------|-------|---------|
| `n8n_platform` | platform-n8n deploy | Shared bridge for n8n + project sidecars |
| `proxy_network` | otel-collector-stack | OBS connectivity (external) |

Create before any deploy:

```bash
./scripts/ensure-networks.sh
```

## Port allocation

| Service | Host port | Notes |
|---------|-----------|-------|
| n8n (platform) | 5678 | Production; use 5680 during parallel migration |
| RSS sidecar | 8001 | `rss_python_ai` |
| CRM sidecar | 8002 | `crm_python_ai` |
| Postgres | internal only | Not exposed on platform runtime |

## Service naming

| Service | Used by | HTTP from n8n |
|---------|---------|---------------|
| `n8n_app` | platform | n8n UI / webhooks |
| `rss_python_ai` | n8n_portfolio | `http://rss_python_ai:8001/analyze` |
| `crm_python_ai` | crm-workflow | `http://crm_python_ai:8001/enrich`, `/score` |

## OTEL / Langfuse naming

| Component | OTEL service name | Langfuse tags |
|-----------|-------------------|---------------|
| Platform n8n | `n8n-platform` | — |
| RSS sidecar | `n8n-rss-ai-service` | `rss-filter` |
| CRM sidecar | `n8n-crm-ai-service` | `crm-workflow` |

## Environment files

| File | Location | Contents |
|------|----------|----------|
| Platform `.env` | `platform-n8n/.env` | Postgres, N8N_PORT, proxy |
| Project `.env` | `<project>/.env` | Sidecar secrets (DeepSeek, Langfuse) |

Templates: `docker/templates/env.platform.example`, `env.project-sidecar.example`.

## Compose conventions

- **Platform**: `docker compose -f docker/compose.yml up -d` from `platform-n8n/`
- **Projects**: `docker compose -f docker/compose.yml up -d` from project repo (includes platform templates)
- Root `docker-compose.yml` in projects is a thin wrapper pointing to `docker/compose.yml`

## CI deploy standard steps

1. `./scripts/ensure-networks.sh` (or platform equivalent on server)
2. `git pull origin main`
3. `docker pull <ghcr-image>:latest` (project sidecars)
4. `docker compose -f docker/compose.yml up -d`
5. `docker image prune -f`

## Startup order (production)

1. OBS stacks: otel-collector → jaeger → langfuse
2. `platform-n8n` (shared n8n)
3. Project sidecars: `n8n_portfolio`, `crm-workflow`
4. Import/update n8n workflows manually

## New project checklist

1. Create `docker/compose.yml` including platform templates
2. Assign unique sidecar service name and host port
3. Add workflow tag for filtering in shared n8n
4. Document in project `docker/DEPLOY.md`
5. Register port in this file
