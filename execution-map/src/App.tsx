import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { listExecutions, listWorkflows } from './api/n8n';
import { ExecutionList } from './components/ExecutionList';
import { MapView } from './components/MapView';
import type { ExecutionListItem, Tag, WorkflowSummary } from './types';

/** Tags on non-archived workflows only (n8n keeps archived WFs + orphan tags). */
function tagsInUse(workflows: WorkflowSummary[]): Tag[] {
  const byId = new Map<string, Tag>();
  for (const w of workflows) {
    if (w.isArchived) continue;
    for (const t of w.tags || []) {
      if (t?.id && t?.name) byId.set(t.id, t);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function App() {
  const [executions, setExecutions] = useState<ExecutionListItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, e] = await Promise.all([listWorkflows(), listExecutions(80)]);
      setWorkflows(w);
      setTags(tagsInUse(w));
      setExecutions(e);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — set N8N_API_KEY in execution-map/.env (see .env.example)`
          : String(err),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ExecutionList
            executions={executions}
            workflows={workflows}
            tags={tags}
            loading={loading}
            error={error}
            onRefresh={() => void refresh()}
          />
        }
      />
      <Route path="/map/:executionId" element={<MapView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
