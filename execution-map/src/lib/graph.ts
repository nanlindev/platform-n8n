import type { CSSProperties } from 'react';
import type { Edge, Node } from '@xyflow/react';
import {
  colorForNodeRun,
  isTriggerNodeType,
  nodeUsesContinueErrorOutput,
  summarizeIo,
  takenBranchIndexes,
} from './colors';
import { subExecFromRun } from './tree';
import { EXEC_NODE_SIZE, EXEC_NODE_TOTAL_H } from '../components/ExecNode';
import type {
  ExecutionDetail,
  MapEdgeKind,
  MapNodeData,
  WorkflowConnections,
  WorkflowNode,
} from '../types';

const NODE_W = EXEC_NODE_SIZE;
const NODE_H = EXEC_NODE_TOTAL_H;
/** Extra horizontal gap between consecutive workflow canvases */
const WF_GAP = 280;
/** Scale if n8n positions feel too tight (1 = native) */
const POS_SCALE = 1;

export type WorkflowJump = {
  executionId: string;
  workflowId: string;
  workflowName: string;
  /** Top-left of this WF block in canvas coords */
  origin: { x: number; y: number };
  /** Center for fitView */
  center: { x: number; y: number };
  labelNodeId: string;
};

function nativePos(node: WorkflowNode): { x: number; y: number } {
  const p = node.position;
  if (!p) return { x: 0, y: 0 };
  if (Array.isArray(p)) return { x: p[0] * POS_SCALE, y: p[1] * POS_SCALE };
  return { x: (p.x ?? 0) * POS_SCALE, y: (p.y ?? 0) * POS_SCALE };
}

function boundsOf(nodes: WorkflowNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (!nodes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const { x, y } = nativePos(n);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + NODE_W);
    maxY = Math.max(maxY, y + NODE_H);
  }
  return { minX, minY, maxX, maxY };
}

type SolidEdge = {
  source: string;
  target: string;
  branchIndex: number;
  connectionType: string;
  kind: 'success' | 'error' | 'false' | 'other';
};

/** Nodes with main[1+] or error outputs need the secondary handle. */
function nodesWithSecondaryOut(
  connections: WorkflowConnections | undefined,
  wfNodes: WorkflowNode[],
): Set<string> {
  const out = new Set<string>();
  if (!connections) return out;
  for (const [from, byType] of Object.entries(connections)) {
    if (!byType) continue;
    const wn = wfNodes.find((n) => n.name === from);
    if (byType.error && byType.error.some((b) => b && b.length)) {
      out.add(from);
      continue;
    }
    const main = byType.main;
    if (main && main.length > 1) {
      out.add(from);
      continue;
    }
    // continueErrorOutput may only wire error branch at runtime; still show port
    if (nodeUsesContinueErrorOutput(wn)) out.add(from);
  }
  return out;
}

function connectionsToEdges(
  executionId: string,
  connections: WorkflowConnections | undefined,
  wfNodes: WorkflowNode[],
): SolidEdge[] {
  const edges: SolidEdge[] = [];
  if (!connections) return edges;
  const byName = new Map(wfNodes.map((n) => [n.name, n]));

  for (const [from, byType] of Object.entries(connections)) {
    if (!byType) continue;
    const fromNode = byName.get(from);
    for (const [connType, outputs] of Object.entries(byType)) {
      if (!outputs) continue;
      outputs.forEach((branch, branchIndex) => {
        if (!branch) return;
        for (const link of branch) {
          if (!link?.node) continue;
          let kind: SolidEdge['kind'] = 'other';
          if (connType === 'error' || branchIndex >= 1) {
            if (nodeUsesContinueErrorOutput(fromNode) || connType === 'error') {
              kind = 'error';
            } else {
              kind = 'false'; // IF false / secondary
            }
          } else {
            kind = 'success';
          }
          edges.push({
            source: `${executionId}::${from}`,
            target: `${executionId}::${link.node}`,
            branchIndex,
            connectionType: connType,
            kind,
          });
        }
      });
    }
  }
  return edges;
}

function edgeStyle(kind: SolidEdge['kind'], taken: boolean): CSSProperties {
  // Untaken paths: solid white (readable on dark canvas). No faint dashed grey.
  if (!taken) {
    return {
      stroke: '#f1f5f9',
      strokeWidth: 1.75,
      opacity: 0.85,
    };
  }
  if (kind === 'error') {
    return { stroke: '#eab308', strokeWidth: 2.25, opacity: 1 };
  }
  if (kind === 'false') {
    return { stroke: '#94a3b8', strokeWidth: 2, opacity: 1 };
  }
  if (kind === 'success') {
    return { stroke: '#22c55e', strokeWidth: 2.25, opacity: 1 };
  }
  return { stroke: '#cbd5e1', strokeWidth: 2, opacity: 1 };
}

export function buildFlowGraph(tree: ExecutionDetail[]): {
  nodes: Node<MapNodeData>[];
  edges: Edge[];
  jumps: WorkflowJump[];
} {
  const nodes: Node<MapNodeData>[] = [];
  const edges: Edge[] = [];
  const jumps: WorkflowJump[] = [];

  let offsetX = 0;

  tree.forEach((detail) => {
    const wfNodes = detail.workflowData?.nodes || [];
    const runData = detail.data?.resultData?.runData || {};
    const b = boundsOf(wfNodes);
    const padTop = 56;

    // Normalize so each WF block starts near (offsetX, 0) while keeping relative layout
    const originX = offsetX;
    const originY = 0;
    const dx = originX - b.minX;
    const dy = originY + padTop - b.minY;

    const labelNodeId = `wf-label-${detail.id}`;
    const wfName = detail.workflowData?.name || detail.workflowId;
    jumps.push({
      executionId: detail.id,
      workflowId: detail.workflowId,
      workflowName: wfName,
      origin: { x: originX, y: originY },
      center: {
        x: originX + (b.maxX - b.minX) / 2,
        y: originY + padTop + (b.maxY - b.minY) / 2,
      },
      labelNodeId,
    });

    nodes.push({
      id: labelNodeId,
      type: 'wfLabel',
      position: { x: originX, y: originY },
      data: {
        executionId: detail.id,
        workflowId: detail.workflowId,
        workflowName: wfName,
        nodeName: wfName,
        nodeType: `exec ${detail.id} · ${detail.status}`,
        color: 'gray',
      },
      draggable: false,
      selectable: true,
    });

    const secondaryOut = nodesWithSecondaryOut(detail.workflowData?.connections, wfNodes);

    for (const wn of wfNodes) {
      const id = `${detail.id}::${wn.name}`;
      const np = nativePos(wn);
      const runs = runData[wn.name];
      const run = runs?.[runs.length - 1];
      const color = colorForNodeRun({
        run,
        executionStatus: detail.status,
        wfNode: wn,
      });
      const io = summarizeIo(run);
      const typeShort = wn.type
        .replace(/^n8n-nodes-base\./, '')
        .replace(/^@n8n\/n8n-nodes-langchain\./, '');
      nodes.push({
        id,
        type: 'execNode',
        position: { x: np.x + dx, y: np.y + dy },
        data: {
          executionId: detail.id,
          workflowId: detail.workflowId,
          workflowName: wfName,
          nodeName: wn.name,
          nodeType: typeShort,
          nodeTypeFull: wn.type,
          isTrigger: isTriggerNodeType(wn.type),
          hasSecondaryOut: secondaryOut.has(wn.name),
          color,
          truncatedIn: io.truncatedIn,
          truncatedOut: io.truncatedOut,
          fullIn: io.fullIn,
          fullOut: io.fullOut,
          errorMessage: io.errorMessage,
        },
      });
    }

    const solid = connectionsToEdges(detail.id, detail.workflowData?.connections, wfNodes);
    for (const e of solid) {
      const srcName = e.source.split('::').slice(1).join('::');
      const takenSet = takenBranchIndexes(runData[srcName]?.[runData[srcName].length - 1]);
      // If node never ran, don't highlight; if ran but we can't see branches, treat connected as taken when target ran
      let taken = takenSet.has(e.branchIndex);
      if (takenSet.size === 0 && runData[srcName]) {
        // fallback: IF with empty secondary — only mark branch if target has runData
        const tgtName = e.target.split('::').slice(1).join('::');
        taken = !!runData[tgtName];
      }
      const srcRan = !!runData[srcName];
      // Never-ran source → all outgoing untaken (white). Ran → use branch items.
      if (!srcRan) {
        taken = false;
      }
      const label =
        e.kind === 'error' ? 'error' : e.kind === 'false' ? 'false' : e.kind === 'success' ? '' : e.connectionType;
      edges.push({
        id: `n-${e.source}-${e.branchIndex}->${e.target}`,
        source: e.source,
        target: e.target,
        sourceHandle: e.kind === 'error' || e.kind === 'false' ? 'out-secondary' : 'out-main',
        targetHandle: 'in',
        type: 'smoothstep',
        style: edgeStyle(e.kind, taken),
        label: taken && label ? label : undefined,
        labelStyle: { fill: e.kind === 'error' ? '#eab308' : '#94a3b8', fontSize: 10 },
        data: { kind: 'node' as MapEdgeKind, branch: e.kind, taken },
      });
    }

    // Dashed parent→child (success: metadata.subExecution; hard-fail: error.executionId)
    for (const wn of wfNodes) {
      const runs = runData[wn.name] || [];
      for (const run of runs) {
        const sub = subExecFromRun(run);
        if (!sub?.executionId) continue;
        const child = tree.find((t) => t.id === String(sub.executionId));
        if (!child) continue;
        const childNodes = child.workflowData?.nodes || [];
        const entry =
          childNodes.find((n) => /executeWorkflowTrigger|webhook|manualTrigger/i.test(n.type)) ||
          childNodes[0];
        if (!entry) continue;
        const source = `${detail.id}::${wn.name}`;
        const target = `${child.id}::${entry.name}`;
        edges.push({
          id: `pc-${source}->${target}`,
          source,
          target,
          sourceHandle: 'out-main',
          targetHandle: 'in',
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '6 4' },
          label: 'sub-WF',
          labelStyle: { fill: '#94a3b8', fontSize: 10 },
          data: { kind: 'parentChild' as MapEdgeKind },
        });
      }
    }

    offsetX += b.maxX - b.minX + WF_GAP;
  });

  return { nodes, edges, jumps };
}
