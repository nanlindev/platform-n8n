# Workflow Import Guide

Workflows live in project repos; the shared n8n runtime stores active copies in its volume.

## Source of truth

| Project | Workflow files | Tag |
|---------|----------------|-----|
| RSS | `n8n_portfolio/workflows/` | `rss-filter` |
| CRM | `crm-workflow/workflows/` | `crm-workflow` |

## Import order (CRM)

1. B2B Lead Error Handler
2. B2B Lead Enrichment Scoring
3. B2B Lead CRM Sync Notification
4. B2B Lead Intake
5. B2B Lead Daily Summary

Activate **Intake** and **Daily Summary**. RSS: activate **RSS News Filter** after import.

## After import

1. Re-bind credentials (Postgres, Discord, Telegram, Google Sheets, Slack, HubSpot)
2. Confirm sidecar URLs:
   - RSS: `http://rss_python_ai:8001/analyze`
   - CRM: `http://crm_python_ai:8001/enrich`, `/score`
3. Set CRM `config_main.mode=test` before live traffic

## Change workflow

1. Edit in n8n UI or regenerate JSON (CRM: `scripts/generate_workflows.py`)
2. Export from n8n or commit generated JSON
3. Re-import if replacing existing workflow (note credential IDs may change)

## Error workflow

CRM workflows reference error handler by ID. Import Error Handler first; if IDs change, update `errorWorkflow` settings on dependent workflows.
