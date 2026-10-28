import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ExecutionListItem, Tag, WorkflowSummary } from '../types';

type Props = {
  executions: ExecutionListItem[];
  workflows: WorkflowSummary[];
  tags: Tag[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

/** Comma-separated ids in VITE_HIDE_EXECUTION_IDS — list-only hide (API key is read-only). */
function hiddenExecutionIds(): Set<string> {
  const raw = import.meta.env.VITE_HIDE_EXECUTION_IDS || '';
  return new Set(
    raw
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean),
  );
}

export function ExecutionList({
  executions,
  workflows,
  tags,
  loading,
  error,
  onRefresh,
}: Props) {
  const [tag, setTag] = useState('');
  const [nameQ, setNameQ] = useState('');
  const [rootsOnly, setRootsOnly] = useState(true);
  const hidden = useMemo(() => hiddenExecutionIds(), []);

  const wfById = useMemo(() => {
    const m = new Map<string, WorkflowSummary>();
    for (const w of workflows) m.set(w.id, w);
    return m;
  }, [workflows]);

  const rows = useMemo(() => {
    return executions
      .map((e) => {
        const wf = wfById.get(e.workflowId);
        return {
          ...e,
          workflowName: wf?.name || e.workflowId,
          tagNames: (wf?.tags || []).map((t) => t.name),
        };
      })
      .filter((e) => {
        if (hidden.has(String(e.id))) return false;
        // integrated = sub-WF; error = Error Handler runs (parent is the failed business exec)
        if (rootsOnly && (e.mode === 'integrated' || e.mode === 'error')) return false;
        if (tag && !e.tagNames.includes(tag)) return false;
        if (nameQ && !e.workflowName.toLowerCase().includes(nameQ.toLowerCase())) return false;
        return true;
      });
  }, [executions, wfById, tag, nameQ, rootsOnly, hidden]);

  return (
    <div className="list-page">
      <header className="list-header">
        <div>
          <h1>Execution Map</h1>
          <p className="muted">Read-only cross-workflow map · n8n 2.28.7</p>
        </div>
        <button type="button" className="btn" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      <div className="filters">
        <label>
          Tag
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entry WF name
          <input
            value={nameQ}
            onChange={(e) => setNameQ(e.target.value)}
            placeholder="Filter by workflow name"
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={rootsOnly}
            onChange={(e) => setRootsOnly(e.target.checked)}
          />
          Hide sub-executions & error handlers
        </label>
      </div>

      {error ? <div className="banner error">{error}</div> : null}

      <table className="exec-table">
        <thead>
          <tr>
            <th>Started</th>
            <th>Workflow</th>
            <th>Tags</th>
            <th>Status</th>
            <th>Mode</th>
            <th>Id</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono">{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
              <td>
                <Link to={`/map/${r.id}`}>{r.workflowName}</Link>
              </td>
              <td>
                {r.tagNames.length ? (
                  r.tagNames.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                <span className={`status status--${r.status}`}>{r.status}</span>
              </td>
              <td className="muted">{r.mode}</td>
              <td className="mono">
                <Link to={`/map/${r.id}`}>{r.id}</Link>
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                No executions match filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
