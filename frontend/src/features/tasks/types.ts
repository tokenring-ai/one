export type TaskStatus = "pending" | "in-progress" | "blocked" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskRunStatus = "starting" | "running" | "completed" | "failed" | "cancelled";

export interface TaskStatusCounts {
  pending: number;
  "in-progress": number;
  blocked: number;
  done: number;
  cancelled: number;
}

export interface TaskListSummary {
  name: string;
  taskCount: number;
  statusCounts: TaskStatusCounts;
  updatedAt: string;
}

export interface TaskSummary {
  list: string;
  name: string;
  title: string;
  description: string;
  agentType: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  stepCount: number;
  dependsOn: string[];
  lastRunAt: string | null;
  lastRunStatus: TaskRunStatus | null;
  lastRunId: string | null;
  size: number;
  updatedAt: string;
}

export interface Task extends TaskSummary {
  body: string;
  steps: string[];
  lastResult: string;
  frontmatter: Record<string, unknown>;
}

export interface TaskRun {
  id: string;
  batchId: string | null;
  list: string;
  name: string;
  title: string;
  agentType: string;
  agentId: string | null;
  messages: string[];
  currentStep: number;
  status: TaskRunStatus;
  message: string;
  startedAt: number;
  finishedAt: number | null;
}

export interface TaskBatch {
  id: string;
  label: string;
  list: string;
  parallel: number;
  runIds: string[];
  startedAt: number;
  finishedAt: number | null;
}

export interface AgentTypeOption {
  type: string;
  displayName: string;
  description: string;
  category?: string | undefined;
}

/** The editable half of a task; everything else is run bookkeeping owned by the backend. */
export interface TaskDraft {
  title: string;
  description: string;
  agentType: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  steps: string[];
  body: string;
}

export function toDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    agentType: task.agentType,
    status: task.status,
    priority: task.priority,
    tags: [...task.tags],
    steps: [...task.steps],
    body: task.body,
  };
}

export function isSameDraft(a: TaskDraft, b: TaskDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isRunActive(run: TaskRun): boolean {
  return run.finishedAt === null;
}
