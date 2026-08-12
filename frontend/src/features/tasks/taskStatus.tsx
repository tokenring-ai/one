import { Ban, CheckCircle2, CircleDashed, CircleDot, Loader2, OctagonAlert, XCircle } from "lucide-react";
import type { StatusBadgeDefinition } from "../../components/ui/StatusBadge.tsx";
import StatusBadge from "../../components/ui/StatusBadge.tsx";
import type { TaskPriority, TaskRunStatus, TaskStatus } from "./types.ts";

export const TASK_STATUS_BADGES: Record<TaskStatus, StatusBadgeDefinition> = {
  pending: {
    label: "Pending",
    icon: <CircleDashed className="w-3 h-3" />,
    colorClass: "text-muted",
  },
  "in-progress": {
    label: "In progress",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    colorClass: "text-amber-600 dark:text-amber-400",
  },
  blocked: {
    label: "Blocked",
    icon: <OctagonAlert className="w-3 h-3" />,
    colorClass: "text-red-600 dark:text-red-400",
  },
  done: {
    label: "Done",
    icon: <CheckCircle2 className="w-3 h-3" />,
    colorClass: "text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: <Ban className="w-3 h-3" />,
    colorClass: "text-muted",
  },
};

export const RUN_STATUS_BADGES: Record<TaskRunStatus, StatusBadgeDefinition> = {
  starting: {
    label: "Starting",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    colorClass: "text-amber-600 dark:text-amber-400",
  },
  running: {
    label: "Running",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    colorClass: "text-amber-600 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="w-3 h-3" />,
    colorClass: "text-emerald-600 dark:text-emerald-400",
  },
  failed: {
    label: "Failed",
    icon: <XCircle className="w-3 h-3" />,
    colorClass: "text-red-600 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: <Ban className="w-3 h-3" />,
    colorClass: "text-muted",
  },
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-muted",
  normal: "text-secondary",
  high: "text-amber-600 dark:text-amber-400",
  urgent: "text-red-600 dark:text-red-400",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <StatusBadge status={status} statuses={TASK_STATUS_BADGES} variant="inline" />;
}

export function RunStatusBadge({ status }: { status: TaskRunStatus }) {
  return <StatusBadge status={status} statuses={RUN_STATUS_BADGES} variant="inline" />;
}

/** Priority is only worth calling out when it deviates from the default. */
export function PriorityMarker({ priority }: { priority: TaskPriority }) {
  if (priority === "normal") return null;
  return (
    <span className={`flex items-center gap-1 text-xs ${PRIORITY_COLORS[priority]}`} title={`Priority: ${priority}`}>
      <CircleDot className="w-3 h-3" />
      {priority}
    </span>
  );
}
