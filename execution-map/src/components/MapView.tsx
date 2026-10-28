import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { editorExecutionUrl } from '../api/n8n';
import { buildFlowGraph, type WorkflowJump } from '../lib/graph';
import { loadExecutionTree } from '../lib/tree';
import type { ExecutionDetail, MapNodeData } from '../types';
import { ExecNode, WfLabel } from './ExecNode';
import { IoPanel } from './IoPanel';

const nodeTypes = { execNode: ExecNode, wfLabel: WfLabel };

type IssueHit = {
  nodeId: string;
  color: 'yellow' | 'red';
  workflowName: string;
  executionId: string;
  nodeName: string;
  errorMessage?: string;
};

function WorkflowJumpBar({
  jumps,
  activeId,
  onJump,
  issues,
  onJumpIssue,
}: {
  jumps: WorkflowJump[];
  activeId: string | null;
  onJump: (j: WorkflowJump) => void;
  issues: IssueHit[];
  onJumpIssue: (hit: IssueHit) => void;
}) {
  const [open, setOpen] = useState(false);
  const nameCount = new Map<string, number>();
  for (const j of jumps) nameCount.set(j.workflowName, (nameCount.get(j.workflowName) || 0) + 1);
  const nameSeen = new Map<string, number>();
  const yellowN = issues.filter((i) => i.color === 'yellow').length;
  const redN = issues.filter((i) => i.color === 'red').length;

  // Group issues by workflow for the menu
  const byWf = new Map<string, IssueHit[]>();
  for (const hit of issues) {
    const key = `${hit.executionId}::${hit.workflowName}`;
    if (!byWf.has(key)) byWf.set(key, []);
    byWf.get(key)!.push(hit);
  }

  return (
    <nav className="wf-jump" aria-label="Workflow jump">
      <div className="issue-jump">
        <button
          type="button"
          className={`issue-jump__toggle${issues.length ? '' : ' empty'}${open ? ' open' : ''}`}
          disabled={!issues.length}
          onClick={() => setOpen((v) => !v)}
          title={issues.length ? 'Jump to yellow/red nodes' : 'No yellow or red nodes'}
        >
          Issues
          {issues.length ? (
            <span className="issue-jump__counts">
              {yellowN ? <span className="issue-jump__y">{yellowN}y</span> : null}
              {redN ? <span className="issue-jump__r">{redN}r</span> : null}
            </span>
          ) : (
            <span className="issue-jump__counts muted">0</span>
          )}
          <span className="issue-jump__caret">▾</span>
        </button>
        {open && issues.length ? (
          <div className="issue-jump__menu" role="listbox">
            {[...byWf.entries()].map(([key, hits]) => (
              <div key={key} className="issue-jump__group">
                <div className="issue-jump__group-title">{hits[0].workflowName}</div>
                {hits.map((hit) => (
                  <button
                    key={hit.nodeId}
                    type="button"
                    className="issue-jump__item"
                    role="option"
                    onClick={() => {
                      onJumpIssue(hit);
                      setOpen(false);
                    }}
                  >
                    <span className={`dot ${hit.color}`} />
                    <span className="issue-jump__name">{hit.nodeName}</span>
                    {hit.errorMessage ? (
                      <span className="issue-jump__msg" title={hit.errorMessage}>
                        {hit.errorMessage}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {jumps.length > 1
        ? jumps.map((j, i) => {
            const dup = (nameCount.get(j.workflowName) || 0) > 1;
            const nth = (nameSeen.get(j.workflowName) || 0) + 1;
            nameSeen.set(j.workflowName, nth);
            const suffix = dup ? ` · #${nth} · exec ${j.executionId}` : ` · exec ${j.executionId}`;
            return (
              <span key={j.executionId} className="wf-jump__item">
                {i > 0 ? <span className="wf-jump__arrow">→</span> : null}
                <span
                  className={`wf-jump__chip${activeId === j.executionId ? ' active' : ''}`}
                >
                  <button
                    type="button"
                    className="wf-jump__btn"
                    title={`Jump in map · execution ${j.executionId}${dup ? ` (same WF ran ${nameCount.get(j.workflowName)}× in this tree)` : ''}`}
                    onClick={() => onJump(j)}
                  >
                    <span className="wf-jump__idx">WF{i + 1}</span>
                    {j.workflowName}
                    <span className="wf-jump__exec">{suffix}</span>
                  </button>
                  <a
                    className="wf-jump__open"
                    href={editorExecutionUrl(j.workflowId, j.executionId)}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open WF${i + 1} execution ${j.executionId} in n8n`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    ↗
                  </a>
                </span>
              </span>
            );
          })
        : null}
    </nav>
  );
}

function MapCanvas({ tree }: { tree: ExecutionDetail[] }) {
  const built = useMemo(() => buildFlowGraph(tree), [tree]);
  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);
  const [selected, setSelected] = useState<MapNodeData | null>(null);
  const [activeWf, setActiveWf] = useState<string | null>(tree[0]?.id ?? null);
  const { fitView, setCenter } = useReactFlow();

  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
    setSelected(null);
    setActiveWf(tree[0]?.id ?? null);
    requestAnimationFrame(() => {
      void fitView({ padding: 0.12, duration: 200 });
    });
  }, [built, setNodes, setEdges, fitView, tree]);

  const onNodeClick = useCallback((_: MouseEvent, node: Node) => {
    if (node.type === 'wfLabel') {
      setActiveWf((node.data as MapNodeData).executionId);
      return;
    }
    if (node.type !== 'execNode') return;
    const data = node.data as MapNodeData;
    setSelected(data);
    setActiveWf(data.executionId);
  }, []);

  const issues = useMemo((): IssueHit[] => {
    const hits: IssueHit[] = [];
    for (const n of built.nodes) {
      if (n.type !== 'execNode') continue;
      const d = n.data as MapNodeData;
      if (d.color !== 'yellow' && d.color !== 'red') continue;
      hits.push({
        nodeId: n.id,
        color: d.color,
        workflowName: d.workflowName,
        executionId: d.executionId,
        nodeName: d.nodeName,
        errorMessage: d.errorMessage,
      });
    }
    // red first, then yellow; stable within WF order of built.nodes
    hits.sort((a, b) => {
      if (a.color !== b.color) return a.color === 'red' ? -1 : 1;
      return 0;
    });
    return hits;
  }, [built.nodes]);

  const jumpTo = useCallback(
    (j: WorkflowJump) => {
      setActiveWf(j.executionId);
      const label = built.nodes.find((n) => n.id === j.labelNodeId);
      if (label) {
        void fitView({
          nodes: [label],
          padding: 0.45,
          duration: 400,
          maxZoom: 0.85,
        });
      } else {
        setCenter(j.center.x, j.center.y, { zoom: 0.7, duration: 400 });
      }
      // Also include a few nodes from that WF for better framing
      const wfNodes = built.nodes.filter(
        (n) => n.type === 'execNode' && (n.data as MapNodeData).executionId === j.executionId,
      );
      if (wfNodes.length) {
        void fitView({
          nodes: [label, ...wfNodes.slice(0, 12)].filter(Boolean) as Node[],
          padding: 0.2,
          duration: 400,
          maxZoom: 0.9,
        });
      }
    },
    [built.nodes, fitView, setCenter],
  );

  const jumpToIssue = useCallback(
    (hit: IssueHit) => {
      const node = built.nodes.find((n) => n.id === hit.nodeId);
      if (!node) return;
      setActiveWf(hit.executionId);
      setSelected(node.data as MapNodeData);
      void fitView({
        nodes: [node],
        padding: 0.55,
        duration: 400,
        maxZoom: 1.1,
      });
    },
    [built.nodes, fitView],
  );

  const root = tree[0];

  return (
    <div className="map-layout">
      <WorkflowJumpBar
        jumps={built.jumps}
        activeId={activeWf}
        onJump={jumpTo}
        issues={issues}
        onJumpIssue={jumpToIssue}
      />
      <div className="map-body">
        <div className="map-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.08}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#334155" gap={18} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const c = (n.data as MapNodeData)?.color;
                if (c === 'green') return '#16a34a';
                if (c === 'yellow') return '#ca8a04';
                if (c === 'red') return '#dc2626';
                return '#64748b';
              }}
              maskColor="rgba(15,23,42,0.7)"
            />
          </ReactFlow>
        </div>
        <IoPanel node={selected} onClose={() => setSelected(null)} />
        {root ? (
          <div className="map-legend">
            <span className="dot green" /> success
            <span className="dot yellow" /> continued / error path
            <span className="dot red" /> hard fail
            <span className="dot gray" /> not run
            <span className="legend-line solid green" /> taken success
            <span className="legend-line solid amber" /> taken error
            <span className="legend-line solid white" /> not taken
            <span className="legend-line dashed" /> sub-WF
            <a
              href={editorExecutionUrl(root.workflowId, root.id)}
              target="_blank"
              rel="noreferrer"
              className="btn primary small"
            >
              Open root in n8n
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MapView() {
  const { executionId } = useParams();
  const navigate = useNavigate();
  const [tree, setTree] = useState<ExecutionDetail[] | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!executionId) return;
    let cancelled = false;
    setTree(null);
    setError(null);
    loadExecutionTree(executionId, setProgress)
      .then((t) => {
        if (cancelled) return;
        const rootId = t[0]?.id;
        // Opened via Error Handler / sub-exec → show the business root map URL
        if (rootId && String(rootId) !== String(executionId)) {
          navigate(`/map/${rootId}`, { replace: true });
          return;
        }
        setTree(t);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [executionId, navigate]);

  return (
    <div className="map-page">
      <header className="map-header">
        <Link to="/" className="btn ghost">
          ← List
        </Link>
        <div>
          <h1>Map · execution {executionId}</h1>
          <p className="muted">
            {tree
              ? `${tree.length} workflow execution(s) · native n8n positions · L→R`
              : progress || '…'}
          </p>
        </div>
      </header>
      {error ? <div className="banner error">{error}</div> : null}
      {!tree && !error ? <div className="banner">{progress || 'Loading tree…'}</div> : null}
      {tree ? (
        <ReactFlowProvider>
          <MapCanvas tree={tree} />
        </ReactFlowProvider>
      ) : null}
    </div>
  );
}
