import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { MapNodeData, NodeColor } from '../types';

/** Visual size of the square body (n8n-like). Name sits below. */
export const EXEC_NODE_SIZE = 88;
export const EXEC_NODE_LABEL_H = 36;
export const EXEC_NODE_TOTAL_H = EXEC_NODE_SIZE + EXEC_NODE_LABEL_H;

const COLORS: Record<NodeColor, { border: string; bg: string; dot: string; type: string }> = {
  green: { border: '#22c55e', bg: '#14532d', dot: '#4ade80', type: '#bbf7d0' },
  yellow: { border: '#eab308', bg: '#713f12', dot: '#facc15', type: '#fef08a' },
  red: { border: '#ef4444', bg: '#7f1d1d', dot: '#f87171', type: '#fecaca' },
  gray: { border: '#64748b', bg: '#1e293b', dot: '#94a3b8', type: '#cbd5e1' },
};

type ExecNodeType = Node<MapNodeData, 'execNode'>;
type WfLabelType = Node<MapNodeData, 'wfLabel'>;

function shortTypeLabel(t: string): string {
  const s = t.replace(/^n8n-nodes-base\./, '').replace(/^@n8n\/n8n-nodes-langchain\./, '');
  if (s.length <= 14) return s;
  return `${s.slice(0, 12)}…`;
}

function ExecNodeInner({ data, selected }: NodeProps<ExecNodeType>) {
  const c = COLORS[data.color] || COLORS.gray;
  const isTrigger = !!data.isTrigger;
  // n8n: trigger = large radius on left, small on right; normal = small rounded square
  const radius = isTrigger ? '40px 10px 10px 40px' : '12px';

  return (
    <div
      style={{
        width: EXEC_NODE_SIZE,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: EXEC_NODE_SIZE,
          height: EXEC_NODE_SIZE,
          border: `2px solid ${selected ? '#e2e8f0' : c.border}`,
          background: c.bg,
          borderRadius: radius,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected ? '0 0 0 2px #64748b' : '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          style={{ background: '#94a3b8', width: 8, height: 8, border: 'none' }}
        />
        <span
          style={{
            position: 'absolute',
            top: 6,
            left: isTrigger ? 14 : 6,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: c.dot,
          }}
        />
        <div
          style={{
            color: c.type,
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.15,
            padding: '0 6px',
            wordBreak: 'break-word',
            maxWidth: '100%',
          }}
          title={data.nodeType}
        >
          {shortTypeLabel(data.nodeType)}
        </div>
        <Handle
          id="out-main"
          type="source"
          position={Position.Right}
          style={{
            background: '#22c55e',
            width: 8,
            height: 8,
            border: 'none',
            top: data.hasSecondaryOut ? '35%' : '50%',
          }}
        />
        {data.hasSecondaryOut ? (
          <Handle
            id="out-secondary"
            type="source"
            position={Position.Right}
            style={{ background: '#eab308', width: 8, height: 8, border: 'none', top: '70%' }}
          />
        ) : null}
      </div>
      <div
        style={{
          marginTop: 6,
          maxWidth: 120,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: '#e2e8f0',
          lineHeight: 1.25,
          wordBreak: 'break-word',
        }}
        title={data.nodeName}
      >
        {data.nodeName}
      </div>
    </div>
  );
}

export const ExecNode = memo(ExecNodeInner);

function WfLabelInner({ data, selected }: NodeProps<WfLabelType>) {
  return (
    <div
      style={{
        minWidth: 220,
        maxWidth: 360,
        padding: '8px 12px',
        color: '#e2e8f0',
        fontSize: 12,
        borderLeft: selected ? '3px solid #38bdf8' : '3px solid #334155',
        background: 'rgba(15,23,42,0.85)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontWeight: 700 }}>{data.workflowName}</div>
      <div style={{ color: '#64748b', fontSize: 11 }}>{data.nodeType}</div>
    </div>
  );
}

export const WfLabel = memo(WfLabelInner);
