import type { ExecutionDetail, ExecutionListItem, Tag, WorkflowSummary } from '../types';

const BASE = '/n8n-api';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`n8n API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

type Page<T> = { data: T[]; nextCursor?: string | null };

export async function listTags(): Promise<Tag[]> {
  const out: Tag[] = [];
  let cursor: string | undefined;
  do {
    const q = new URLSearchParams({ limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const page = await getJson<Page<Tag>>(`/tags?${q}`);
    out.push(...page.data);
    cursor = page.nextCursor || undefined;
  } while (cursor);
  return out;
}

/** Fetch workflows; strips heavy fields client-side after load. */
export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const out: WorkflowSummary[] = [];
  let cursor: string | undefined;
  do {
    const q = new URLSearchParams({ limit: '50', excludePinnedData: 'true' });
    if (cursor) q.set('cursor', cursor);
    const page = await getJson<Page<WorkflowSummary>>(`/workflows?${q}`);
    for (const w of page.data) {
      out.push({
        id: w.id,
        name: w.name,
        tags: w.tags || [],
        isArchived: !!w.isArchived,
        // keep nodes/connections only when needed for map; list caches slim copy
        nodes: undefined,
        connections: undefined,
      });
    }
    cursor = page.nextCursor || undefined;
  } while (cursor);
  return out;
}

export async function listExecutions(limit = 50): Promise<ExecutionListItem[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  const page = await getJson<Page<ExecutionListItem>>(`/executions?${q}`);
  return page.data;
}

export async function getExecution(id: string, includeData = true): Promise<ExecutionDetail> {
  const q = includeData ? '?includeData=true' : '';
  return getJson<ExecutionDetail>(`/executions/${id}${q}`);
}

export function editorExecutionUrl(workflowId: string, executionId: string): string {
  const base = (import.meta.env.VITE_N8N_EDITOR_BASE_URL || 'http://127.0.0.1:5678').replace(
    /\/$/,
    '',
  );
  return `${base}/workflow/${workflowId}/executions/${executionId}`;
}
