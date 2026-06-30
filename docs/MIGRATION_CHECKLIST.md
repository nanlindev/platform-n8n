# Workflow Migration Checklist

Use while shared platform runs on **5680**; cut over to **5678** when every item is checked.

## Pre-migration

- [ ] Legacy RSS n8n reachable on `:5678`; CRM on `:5679`
- [ ] `./scripts/deploy-parallel.sh` (or `N8N_PORT=5680` + compose up) on platform-n8n
- [ ] Jaeger shows `n8n-platform` traces from `:5680`
- [ ] Full export of workflows and credentials from both legacy instances (backup files stored)

## Import on shared platform (`:5680`)

- [ ] All RSS workflows imported; IDs noted for webhook URL updates
- [ ] All CRM workflows imported
- [ ] Credentials re-created and bound in each workflow
- [ ] HTTP Request nodes use hostnames `rss_python_ai:8001` and `crm_python_ai:8001` (not localhost)
- [ ] Schedule triggers and webhooks tested manually (inactive until cutover if needed)

## Sidecars

- [ ] `./scripts/deploy-sidecars.sh` (or manual compose in each project repo)
- [ ] `curl` / n8n test calls succeed to RSS (`8001`) and CRM (`8002` on host)
- [ ] Langfuse traces for `n8n-rss-ai-service` and `n8n-crm-ai-service`

## Cutover

- [ ] Legacy `n8n_app` stopped (volumes retained for rollback)
- [ ] `./scripts/cutover-production.sh` sets `N8N_PORT=5678` and restarts platform
- [ ] Reverse proxy and external webhooks point to `:5678`
- [ ] RSS scheduled run verified; CRM intake webhook verified
- [ ] 24h monitoring: errors, Jaeger, Langfuse

## Rollback (if needed)

- [ ] Stop platform stack
- [ ] Start legacy n8n on original ports from backed-up volumes
- [ ] Restore webhook URLs to legacy ports

See also [MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md) and [WORKFLOW_IMPORT.md](WORKFLOW_IMPORT.md).
