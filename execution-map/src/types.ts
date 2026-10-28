export type NodeColor = 'green' | 'yellow' | 'red' | 'gray';

export type Tag = { id: string; name: string };

export type WorkflowSummary = {
  id: string;
  name: string;
  tags: Tag[];
  isArchived?: boolean;
  nodes?: WorkflowNode[];
  connections?: WorkflowConnections;
};

export type WorkflowNode = {
  id: string;
  name: string;
  type: string;
  position?: [number, number] | { x: number; y: number };
  continueOnFail?: boolean;
  onError?: string;
  parameters?: Record<string, unknown>;
};

export type WorkflowConnections = Record<
  string,
  Partial<Record<string, Array<Array<{ node: string; type: string; index: number } | null> | null>>>
>;

export type ExecutionListItem = {
  id: string;
  finished: boolean;
  mode: string;
  status: string;
  startedAt: string | null;
  stoppedAt: string | null;
  workflowId: string;
  waitTill: string | null;
};

export type ITaskData = {
  startTime?: number;
  executionTime?: number;
  executionStatus?: string;
  error?: {
    message?: string;
    description?: string;
    /** Present when Execute Sub-workflow failed — child id lives here, not in metadata.subExecution */
    executionId?: string;
    workflowId?: string;
    [k: string]: unknown;
  };
  data?: {
    main?: Array<Array<{ json?: Record<string, unknown>; [k: string]: unknown }> | null>;
  };
  metadata?: {
    subExecution?: { executionId: string; workflowId: string };
    parentExecution?: { executionId: string; workflowId: string };
    [k: string]: unknown;
  };
  source?: unknown;
};

export type ExecutionDetail = ExecutionListItem & {
  createdAt?: string;
  customData?: Record<string, string>;
  data?: {
    parentExecution?: {
      executionId: string;
      workflowId: string;
      shouldResume?: boolean;
      executionContext?: unknown;
    };
    resultData?: {
      runData?: Record<string, ITaskData[]>;
      lastNodeExecuted?: string;
      error?: unknown;
    };
  };
  workflowData?: {
    id?: string;
    name?: string;
    nodes?: WorkflowNode[];
    connections?: WorkflowConnections;
  };
};

export type MapNodeData = {
  executionId: string;
  workflowId: string;
  workflowName: string;
  nodeName: string;
  nodeType: string;
  /** Full n8n type string for trigger detection */
  nodeTypeFull?: string;
  isTrigger?: boolean;
  /** IF / continueErrorOutput / multi-output — show yellow secondary handle */
  hasSecondaryOut?: boolean;
  color: NodeColor;
  truncatedIn?: string;
  truncatedOut?: string;
  fullIn?: unknown;
  fullOut?: unknown;
  errorMessage?: string;
};

export type MapEdgeKind = 'node' | 'parentChild';
