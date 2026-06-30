# Production Migration Runbook

Step-by-step cutover from dual n8n instances to shared platform.

## Phase 1 — Deploy platform (parallel)

On server:

```bash
cd /home/deploy/projects
git clone git@github.com:nanlindev/platform-n8n.git  # if not exists
cd platform-n8n
cp .env.example .env
# Set N8N_PORT=5680 for parallel testing
./scripts/ensure-networks.sh
docker compose -f docker/compose.yml up -d
```

Verify: n8n UI on port 5680, OTEL spans in Jaeger for `n8n-platform`.

## Phase 2 — Migrate workflows

1. Export all workflows + credentials from RSS n8n (:5678)
2. Export all workflows + credentials from CRM n8n (:5679)
3. Import into shared n8n (:5680)
4. Update sidecar URLs to `rss_python_ai` / `crm_python_ai`
5. Re-bind all credentials
6. Manual test: RSS schedule trigger, CRM test webhook

## Phase 3 — Deploy project sidecars

```bash
cd /home/deploy/projects/n8n_portfolio
git pull origin main
./../platform-n8n/scripts/ensure-networks.sh
docker pull ghcr.io/nanlindev/n8n_portfolio/python-ai-service:latest
docker compose -f docker/compose.yml up -d

cd /home/deploy/projects/crm-workflow
git pull origin main
docker pull ghcr.io/nanlindev/crm-workflow/python-ai-service:latest
docker compose -f docker/compose.yml up -d
```

Test from shared n8n: HTTP nodes reach sidecars.

## Phase 4 — Cutover

1. Stop legacy n8n containers (keep volumes):
   ```bash
   # In old n8n_portfolio root compose (if still running legacy stack)
   docker compose stop n8n_app
   # In old crm-workflow root compose
   docker compose stop n8n_app
   ```
2. Set `N8N_PORT=5678` in platform-n8n `.env`, restart platform:
   ```bash
   cd /home/deploy/projects/platform-n8n
   docker compose -f docker/compose.yml up -d
   ```
3. Activate RSS workflow in n8n UI
4. Update reverse proxy / webhook URLs from CRM :5679 → platform :5678
5. Monitor 24h: RSS schedule, CRM intake, Jaeger/Langfuse

## Phase 5 — Cleanup

After 7 days stable:

```bash
# Remove legacy n8n/postgres from old project composes (already slimmed in git)
docker volume ls  # backup n8n_data/postgres_data from old stacks before prune
docker compose down  # in legacy stacks if any containers remain
```

## Rollback

1. Stop platform n8n
2. Start legacy `n8n_app` from backed-up volumes on original ports
3. Re-point webhooks to legacy ports
