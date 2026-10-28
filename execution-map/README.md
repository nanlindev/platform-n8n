# Execution Map (M2 MVP)

Read-only bypass viewer for n8n **2.28.7**: list executions (WF tag / name filter) → cross-workflow React Flow map (solid node edges, dashed parent→child) → truncated I/O + deep link into the official editor.

Does **not** call Jaeger / OTel. Does **not** fork n8n.

## Setup

1. In n8n: **Settings → API** → create a key with at least  
   `execution:list` `execution:read` `workflow:list` `workflow:read` `tag:list` `tag:read` `workflowTags:list`.
2. Copy env and fill the key:

```bash
cd execution-map
cp .env.example .env
# edit N8N_API_KEY and URLs
```

3. Run:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5179 — Vite proxies `/n8n-api` → `{N8N_BASE_URL}/api/v1` and injects `X-N8N-API-KEY` (key stays server-side in the Vite process).

## Deep link

`{VITE_N8N_EDITOR_BASE_URL}/workflow/{workflowId}/executions/{executionId}`

## Docs

- PRD: `../docs/EXECUTION_MAP_PRD.md`
- Spike: `../docs/EXECUTION_MAP_SPIKE.md`
- Memory: `../docs/00-execution-map-memory.md`
