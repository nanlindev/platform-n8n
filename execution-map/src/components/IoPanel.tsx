import { useState } from 'react';
import { editorExecutionUrl } from '../api/n8n';
import type { MapNodeData } from '../types';

type Props = {
  node: MapNodeData | null;
  onClose: () => void;
};

export function IoPanel({ node, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!node) return null;

  const out = expanded
    ? JSON.stringify(node.fullOut, null, 2)
    : node.truncatedOut;
  const inn = expanded
    ? JSON.stringify(node.fullIn, null, 2)
    : node.truncatedIn;

  return (
    <aside className="io-panel">
      <div className="io-panel__head">
        <div>
          <strong>{node.nodeName}</strong>
          <div className="muted">
            {node.workflowName} · exec {node.executionId} · {node.color}
          </div>
        </div>
        <button type="button" className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
      {node.errorMessage ? (
        <p className="io-error">{node.errorMessage}</p>
      ) : null}
      <div className="io-actions">
        <button type="button" className="btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Truncate I/O' : 'Expand I/O'}
        </button>
        <a
          className="btn primary"
          href={editorExecutionUrl(node.workflowId, node.executionId)}
          target="_blank"
          rel="noreferrer"
        >
          Open in n8n
        </a>
      </div>
      <h4>Output</h4>
      <pre>{out}</pre>
      <h4>Source / input meta</h4>
      <pre>{inn}</pre>
    </aside>
  );
}
