import { getExecution } from '../api/n8n';
import type { ExecutionDetail, ITaskData } from '../types';

export type SubExecLink = {
  executionId: string;
  workflowId?: string;
  /** Parent node that launched the child (Execute Workflow), if known */
  sourceNodeName?: string;
};

/**
 * Child execution ids from a parent detail.
 * Success path: run.metadata.subExecution
 * Hard-fail path (n8n 2.28): metadata often missing; id is on run.error.executionId
 *   (and mirrored on resultData.error).
 */
export function childLinksFromDetail(detail: ExecutionDetail): SubExecLink[] {
  const links: SubExecLink[] = [];
  const seen = new Set<string>();
  const add = (executionId: unknown, workflowId?: unknown, sourceNodeName?: string) => {
    if (executionId == null || executionId === '') return;
    const id = String(executionId);
    if (seen.has(id)) return;
    seen.add(id);
    links.push({
      executionId: id,
      workflowId: workflowId != null ? String(workflowId) : undefined,
      sourceNodeName,
    });
  };

  const runData = detail.data?.resultData?.runData || {};
  for (const [nodeName, runs] of Object.entries(runData)) {
    for (const run of runs || []) {
      const sub = run.metadata?.subExecution;
      if (sub?.executionId) {
        add(sub.executionId, sub.workflowId, nodeName);
        continue;
      }
      // Failed executeWorkflow: child id only on error
      if (run.error?.executionId) {
        add(run.error.executionId, run.error.workflowId, nodeName);
      }
    }
  }

  const topErr = detail.data?.resultData?.error;
  if (topErr && typeof topErr === 'object' && topErr !== null) {
    const e = topErr as { executionId?: string; workflowId?: string };
    add(e.executionId, e.workflowId);
  }

  return links;
}

function childIdsFromRunData(detail: ExecutionDetail): string[] {
  return childLinksFromDetail(detail).map((l) => l.executionId);
}

/** Resolve sub-exec link for a single node run (success or hard-fail). */
export function subExecFromRun(run: ITaskData | undefined): {
  executionId: string;
  workflowId?: string;
} | null {
  if (!run) return null;
  const sub = run.metadata?.subExecution;
  if (sub?.executionId) {
    return { executionId: String(sub.executionId), workflowId: sub.workflowId };
  }
  if (run.error?.executionId) {
    return {
      executionId: String(run.error.executionId),
      workflowId: run.error.workflowId != null ? String(run.error.workflowId) : undefined,
    };
  }
  return null;
}

/** Walk up parentExecution to root, then BFS via subExecution / error.executionId. */
export async function loadExecutionTree(
  startId: string,
  onProgress?: (msg: string) => void,
): Promise<ExecutionDetail[]> {
  const cache = new Map<string, ExecutionDetail>();

  const fetchOne = async (id: string) => {
    if (cache.has(id)) return cache.get(id)!;
    onProgress?.(`Loading execution ${id}…`);
    const d = await getExecution(id, true);
    cache.set(id, d);
    return d;
  };

  let current = await fetchOne(startId);
  const seenUp = new Set<string>([startId]);
  while (current.data?.parentExecution?.executionId) {
    const pid = String(current.data.parentExecution.executionId);
    if (seenUp.has(pid)) break;
    seenUp.add(pid);
    current = await fetchOne(pid);
  }
  const rootId = current.id;

  const queue = [rootId];
  const ordered: string[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
    const detail = await fetchOne(id);
    for (const cid of childIdsFromRunData(detail)) {
      if (!seen.has(cid)) queue.push(cid);
    }
  }

  return ordered.map((id) => cache.get(id)!);
}

export function isLikelyRoot(item: { mode: string }, childIds: Set<string>, id: string): boolean {
  if (childIds.has(id)) return false;
  // integrated = Execute Sub-workflow child; error = Error Handler invocation
  return item.mode !== 'integrated' && item.mode !== 'error';
}
