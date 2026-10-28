import type { ExecutionDetail, ITaskData, NodeColor, WorkflowNode } from '../types';

function mainBranches(run: ITaskData): Array<Array<{ json?: Record<string, unknown> }> | null> {
  return run.data?.main || [];
}

function mainItems(run: ITaskData): Array<{ json?: Record<string, unknown> }> {
  const out: Array<{ json?: Record<string, unknown> }> = [];
  for (const branch of mainBranches(run)) {
    if (!branch) continue;
    out.push(...branch);
  }
  return out;
}

export function nodeUsesContinueErrorOutput(node: WorkflowNode | undefined): boolean {
  if (!node) return false;
  if (node.continueOnFail) return true;
  const onError = node.onError || '';
  return onError === 'continueErrorOutput' || onError.startsWith('continue');
}

function hasErrorInItems(items: Array<{ json?: Record<string, unknown> }> | null | undefined): boolean {
  if (!items) return false;
  for (const item of items) {
    const j = item?.json;
    if (!j || typeof j !== 'object') continue;
    if (j.error != null && j.error !== '') return true;
    const meta = j._metadata;
    if (meta && typeof meta === 'object' && (meta as { error_message?: unknown }).error_message) {
      return true;
    }
    if (j.processing_status === 'failed') return true;
    for (const [k, v] of Object.entries(j)) {
      if (k.endsWith('_failed') && v === true) return true;
    }
  }
  return false;
}

/**
 * True when continueErrorOutput (or continueOnFail) sent items on the error branch.
 * IF / Switch false|branch1 is a normal path — do NOT treat as error.
 */
export function usedErrorOutput(
  run: ITaskData | undefined,
  wfNode?: WorkflowNode,
): boolean {
  if (!run || !nodeUsesContinueErrorOutput(wfNode)) return false;
  const branches = mainBranches(run);
  if (branches.length < 2) return false;
  const successEmpty = !branches[0] || branches[0].length === 0;
  const errorHas = !!branches[1] && branches[1].length > 0;
  return errorHas && (successEmpty || hasErrorInItems(branches[1]));
}

export function hasErrorShapedOutput(run: ITaskData): boolean {
  if (run.error) return true;
  return hasErrorInItems(mainItems(run));
}

export function isTriggerNodeType(type: string): boolean {
  return /webhook|manualTrigger|cron|scheduleTrigger|executeWorkflowTrigger|formTrigger|emailReadImap|sseTrigger|chatTrigger|mcpTrigger/i.test(
    type,
  );
}

/**
 * Green / yellow / red / gray per PRD §6 + spike + continueErrorOutput.
 */
export function colorForNodeRun(opts: {
  run: ITaskData | undefined;
  executionStatus: string;
  wfNode?: WorkflowNode;
}): NodeColor {
  const { run, executionStatus, wfNode } = opts;
  if (!run) return 'gray';

  const status = run.executionStatus || '';
  const hardFailStatuses = new Set(['error', 'crashed', 'failed']);
  const execHardFail = hardFailStatuses.has(executionStatus);
  const nodeHardFail = hardFailStatuses.has(status);

  if (nodeHardFail && execHardFail) return 'red';
  if (nodeHardFail && !nodeUsesContinueErrorOutput(wfNode)) return 'red';

  // Yellow: continued after error / error-output taken / error-handler path.
  // IF false is NOT yellow (normal branch).
  if (
    usedErrorOutput(run, wfNode) ||
    hasErrorShapedOutput(run) ||
    (run.error && (executionStatus === 'success' || nodeUsesContinueErrorOutput(wfNode)))
  ) {
    return 'yellow';
  }

  if (status === 'success' || status === 'waiting' || status === 'running') return 'green';
  if (!status) return 'green';
  return 'gray';
}

export function summarizeIo(run: ITaskData | undefined, max = 1200): {
  truncatedIn: string;
  truncatedOut: string;
  fullIn: unknown;
  fullOut: unknown;
  errorMessage?: string;
} {
  const fullIn = run?.source ?? null;
  const items = mainItems(run || ({} as ITaskData));
  const fullOut = items.map((i) => i.json ?? i);
  let errorMessage =
    run?.error?.message ||
    (typeof items[0]?.json?.error === 'string' ? items[0].json.error : undefined);
  if (!errorMessage) {
    for (const it of items) {
      const meta = it.json?._metadata;
      if (meta && typeof meta === 'object') {
        const m = (meta as { error_message?: string }).error_message;
        if (m) {
          errorMessage = m;
          break;
        }
      }
    }
  }

  const trunc = (v: unknown) => {
    const s = JSON.stringify(v, null, 2) ?? 'null';
    return s.length > max ? `${s.slice(0, max)}\n… (truncated)` : s;
  };

  return {
    truncatedIn: trunc(fullIn),
    truncatedOut: trunc(fullOut),
    fullIn,
    fullOut,
    errorMessage,
  };
}

export function workflowNodeByName(
  detail: ExecutionDetail,
  name: string,
): WorkflowNode | undefined {
  return detail.workflowData?.nodes?.find((n) => n.name === name);
}

/** Which main[] branch indices produced items for this run. */
export function takenBranchIndexes(run: ITaskData | undefined): Set<number> {
  const taken = new Set<number>();
  if (!run?.data?.main) return taken;
  run.data.main.forEach((branch, i) => {
    if (branch && branch.length > 0) taken.add(i);
  });
  return taken;
}
