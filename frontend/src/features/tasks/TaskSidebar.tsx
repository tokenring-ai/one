import { ChevronDown, ChevronRight, ExternalLink, FileText, ListChecks, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import ListItemWithActions from "../../components/ui/ListItemWithActions.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useTasks } from "../../rpc.ts";
import { PriorityMarker, TaskStatusBadge } from "./taskStatus.tsx";
import type { TaskListSummary, TaskRun, TaskSummary } from "./types.ts";

function ListRow({
  list,
  expanded,
  onToggle,
  selected,
  activeRuns,
  onSelectTask,
  onNewTask,
  onRunList,
  onDeleteList,
  runningList,
}: {
  list: TaskListSummary;
  expanded: boolean;
  onToggle: () => void;
  selected: { list: string; name: string } | null;
  activeRuns: TaskRun[];
  onSelectTask: (list: string, name: string) => void;
  onNewTask: (list: string) => void;
  onRunList: (list: string) => void;
  onDeleteList: (list: string) => void;
  runningList: string | null;
}) {
  // Streamed while expanded so tasks written by an agent appear without a manual refresh.
  const { data, isLoading, error } = useTasks(expanded ? list.name : null);
  const tasks = (data?.tasks ?? null) as TaskSummary[] | null;

  useEffect(() => {
    if (error) toastManager.error(`Could not load tasks in "${list.name}"`, { duration: 4000 });
  }, [error, list.name]);

  const pending = list.statusCounts.pending;

  return (
    <div className="border-b border-primary/50">
      <ListItemWithActions
        id={`list:${list.name}`}
        onPrimary={onToggle}
        className="gap-1.5 px-2 py-2 rounded-none"
        action={
          <>
            <button
              type="button"
              onClick={() => onRunList(list.name)}
              disabled={pending === 0 || runningList === list.name}
              title={pending === 0 ? "No pending tasks to run" : `Run ${pending} pending task${pending === 1 ? "" : "s"}`}
              aria-label={`Run pending tasks in ${list.name}`}
              className="p-0.5 text-muted hover:text-cyan-600 dark:hover:text-cyan-400 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {runningList === list.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => onNewTask(list.name)}
              title="New task in this list"
              aria-label={`New task in ${list.name}`}
              className="p-0.5 text-muted hover:text-primary rounded transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteList(list.name)}
              title="Delete list"
              aria-label={`Delete list ${list.name}`}
              className="p-0.5 text-muted hover:text-red-500 rounded transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        }
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted" />}
          <ListChecks className="w-3.5 h-3.5 shrink-0 opacity-70" />
          <span className="flex-1 min-w-0 truncate text-xs font-medium text-primary" title={list.name}>
            {list.name}
          </span>
          {pending > 0 && (
            <span className="text-xs text-muted shrink-0" title={`${pending} pending`}>
              {pending}/{list.taskCount}
            </span>
          )}
          {pending === 0 && <span className="text-xs text-muted shrink-0">{list.taskCount}</span>}
        </span>
      </ListItemWithActions>

      {expanded && (
        <div className="pl-5">
          {isLoading && tasks === null ? (
            <div className="px-2 py-2 text-xs text-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          ) : tasks && tasks.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted">No tasks yet</p>
          ) : (
            tasks?.map(task => {
              const isSelected = !!(selected && selected.list === list.name && selected.name === task.name);
              const isRunning = activeRuns.some(run => run.list === list.name && run.name === task.name);
              return (
                <ListItemWithActions
                  key={task.name}
                  id={`task:${list.name}/${task.name}`}
                  selected={isSelected}
                  onPrimary={() => onSelectTask(list.name, task.name)}
                  className={`gap-1.5 px-2 py-1.5 rounded-none ${isSelected ? "bg-accent-muted text-accent" : "text-primary"}`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3 h-3 shrink-0 opacity-70" />
                    <span className="flex-1 min-w-0 truncate text-xs" title={task.title || task.name}>
                      {task.title || task.name}
                    </span>
                    <PriorityMarker priority={task.priority} />
                    {isRunning ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" title="Running" />
                    ) : (
                      <TaskStatusBadge status={task.status} />
                    )}
                  </span>
                </ListItemWithActions>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskSidebar({
  lists,
  isLoading,
  error,
  onRetry,
  expandedLists,
  onToggleList,
  selected,
  activeRuns,
  runningList,
  onSelectTask,
  onNewTask,
  onNewList,
  onRunList,
  onDeleteList,
  onOpenAgent,
}: {
  lists: TaskListSummary[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  expandedLists: Set<string>;
  onToggleList: (name: string) => void;
  selected: { list: string; name: string } | null;
  activeRuns: TaskRun[];
  runningList: string | null;
  onSelectTask: (list: string, name: string) => void;
  onNewTask: (list: string) => void;
  onNewList: () => void;
  onRunList: (list: string) => void;
  onDeleteList: (list: string) => void;
  onOpenAgent: (agentId: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-secondary border-r border-primary">
      <NavigationSidebarHeader
        title="Task lists"
        actions={[{ icon: <Plus className="w-3.5 h-3.5" />, label: "New list", title: "New task list", onClick: onNewList }]}
      />

      <div className="flex-1 overflow-y-auto">
        {activeRuns.length > 0 && (
          <div className="border-b border-primary/50">
            <span className="block px-3 pt-2.5 pb-1 text-xs font-bold text-amber-600 dark:text-amber-500/90 uppercase tracking-widest">Running</span>
            {activeRuns.map(run => (
              <button
                type="button"
                key={run.id}
                onClick={() => (run.agentId ? onOpenAgent(run.agentId) : onSelectTask(run.list, run.name))}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-hover transition-colors cursor-pointer focus-ring"
                aria-label={run.agentId ? `Open agent running ${run.list}/${run.name}` : `View task ${run.list}/${run.name}`}
              >
                <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-primary truncate">{run.title || run.name}</div>
                  <div className="text-xs text-muted truncate">
                    {run.status === "starting"
                      ? "Starting agent…"
                      : run.messages.length > 1
                        ? `Step ${Math.min(run.currentStep + 1, run.messages.length)} of ${run.messages.length}`
                        : run.list}
                  </div>
                </div>
                {run.agentId && <ExternalLink className="w-3 h-3 text-muted shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {isLoading && lists.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted flex items-center justify-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
          </div>
        ) : error && lists.length === 0 ? (
          <ErrorState title="Unable to load task lists" error={error} onRetry={onRetry} />
        ) : lists.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <ListChecks className="w-6 h-6 text-muted mx-auto mb-2 opacity-60" />
            <p className="text-xs text-muted">No task lists yet</p>
          </div>
        ) : (
          lists.map(list => (
            <ListRow
              key={list.name}
              list={list}
              expanded={expandedLists.has(list.name)}
              onToggle={() => onToggleList(list.name)}
              selected={selected}
              activeRuns={activeRuns}
              runningList={runningList}
              onSelectTask={onSelectTask}
              onNewTask={onNewTask}
              onRunList={onRunList}
              onDeleteList={onDeleteList}
            />
          ))
        )}
      </div>
    </div>
  );
}
