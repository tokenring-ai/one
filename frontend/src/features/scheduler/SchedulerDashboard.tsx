import formatError from "@tokenring-ai/utility/error/formatError";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  History,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Timer,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import HistoryRunRow from "../../components/ui/HistoryRunRow.tsx";
import StatusBadge, { type StatusBadgeDefinition } from "../../components/ui/StatusBadge.tsx";
import SummaryStat from "../../components/ui/SummaryStat.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useAsyncActionGuard } from "../../hooks/useAsyncActionGuard.ts";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { useTick } from "../../hooks/useTick.ts";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, schedulerRPCClient, useAgentList, useAgentTypes, useSchedulerHistory, useSchedulerStatus, useSchedulerTasks } from "../../rpc.ts";
import AddTaskForm from "./AddTaskForm.tsx";
import { formatRelativeTime, formatScheduleSummary, formatScheduleTime, truncateMessage } from "./formatters.ts";

type MainTab = "tasks" | "history";
type HistoryStatusFilter = "all" | "completed" | "failed";
type TaskRunStatus = "pending" | "running" | "idle";

const MAIN_TABS: FilterTabOption<MainTab>[] = [
  { id: "tasks", label: "Tasks" },
  { id: "history", label: "History" },
];

const SCHEDULER_STATUS_BADGES: Record<"enabled" | "disabled", StatusBadgeDefinition> = {
  enabled: {
    label: "Scheduler enabled",
    dotColor: "bg-emerald-500",
    pulse: true,
    colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  disabled: {
    label: "Scheduler disabled",
    icon: <Pause className="w-3 h-3" />,
    colorClass: "bg-tertiary text-muted border-primary",
  },
};

const TASK_STATUS_BADGES: Record<TaskRunStatus, StatusBadgeDefinition> = {
  running: {
    label: "Running",
    icon: <Activity className="w-3 h-3 animate-pulse" />,
    colorClass: "text-amber-600 dark:text-amber-400",
  },
  pending: {
    label: "Pending",
    icon: <Clock className="w-3 h-3" />,
    colorClass: "text-indigo-600 dark:text-indigo-400",
  },
  idle: {
    label: "Not scheduled",
    icon: <Pause className="w-3 h-3" />,
    colorClass: "text-muted",
  },
};

export default function SchedulerDashboard() {
  const navigate = useNavigate();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [tab, setTab] = useState<MainTab>("tasks");
  const [showAddForm, setShowAddForm] = useState(false);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const { activeKey: busyAction, execute: executeBusy } = useAsyncActionGuard();
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [historyTaskFilter, setHistoryTaskFilter] = useState<string>("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>("all");

  // Auto-select first agent when list loads / selection disappears
  useEffect(() => {
    const list = agents.data ?? [];
    if (list.length === 0) {
      setSelectedAgentId(null);
      return;
    }
    if (!selectedAgentId || !list.some(a => a.id === selectedAgentId)) {
      setSelectedAgentId(list[0]!.id);
    }
  }, [agents.data, selectedAgentId]);

  // Drop agent-scoped UI state when the selected agent changes
  useEffect(() => {
    setShowAddForm(false);
    setExpandedTask(null);
    setHistoryTaskFilter("");
    setHistoryStatusFilter("all");
    setTab("tasks");
  }, [selectedAgentId]);

  const tasksQuery = useSchedulerTasks(selectedAgentId ?? undefined);
  const statusQuery = useSchedulerStatus(selectedAgentId ?? undefined);
  const historyQuery = useSchedulerHistory(selectedAgentId ?? undefined);

  const taskEntries = useMemo(() => {
    const tasks = tasksQuery.data?.tasks ?? {};
    const executions = statusQuery.data?.executions ?? {};
    return Object.entries(tasks)
      .map(([name, task]) => {
        const exec = executions[name];
        const status: "pending" | "running" | "idle" = exec?.status ?? "idle";
        return {
          name,
          task,
          status,
          nextRunTime: exec?.nextRunTime ?? null,
          startTime: exec?.startTime,
        };
      })
      .sort((a, b) => {
        // Running first, then soonest next run
        if (a.status === "running" && b.status !== "running") return -1;
        if (b.status === "running" && a.status !== "running") return 1;
        const an = a.nextRunTime ?? Number.POSITIVE_INFINITY;
        const bn = b.nextRunTime ?? Number.POSITIVE_INFINITY;
        return an - bn;
      });
  }, [tasksQuery.data, statusQuery.data]);

  const historyEntries = useMemo(() => {
    const history = historyQuery.data?.history ?? {};
    return Object.entries(history)
      .flatMap(([taskName, runs]) =>
        runs.map(run => ({
          taskName,
          ...run,
        })),
      )
      .sort((a, b) => b.startTime - a.startTime);
  }, [historyQuery.data]);

  const filteredHistory = useMemo(() => {
    return historyEntries.filter(run => {
      if (historyTaskFilter && run.taskName !== historyTaskFilter) return false;
      if (historyStatusFilter !== "all" && run.status !== historyStatusFilter) return false;
      return true;
    });
  }, [historyEntries, historyTaskFilter, historyStatusFilter]);

  const historyTaskNames = useMemo(() => {
    const names = new Set(historyEntries.map(r => r.taskName));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [historyEntries]);

  const taskCount = taskEntries.length;
  const runningTaskCount = taskEntries.filter(t => t.status === "running").length;
  const schedulerRunning = statusQuery.data?.running ?? false;

  // Refresh relative-time labels while there is upcoming or active work
  useTick(15_000, runningTaskCount > 0 || taskEntries.some(t => t.nextRunTime != null));

  const tabs = useMemo<FilterTabOption<MainTab>[]>(
    () => [
      { id: "tasks", label: "Tasks", count: taskCount },
      { id: "history", label: "History", count: historyEntries.length },
    ],
    [taskCount, historyEntries.length],
  );

  const openHistoryForTask = useCallback((taskName: string) => {
    setHistoryTaskFilter(taskName);
    setHistoryStatusFilter("all");
    setTab("history");
    setShowAddForm(false);
  }, []);

  const refreshAll = async () => {
    await Promise.all([tasksQuery.mutate(), statusQuery.mutate(), historyQuery.mutate(), agents.mutate()]);
  };

  const handleStartStop = async () => {
    if (!selectedAgentId) return;
    const action = schedulerRunning ? "stop" : "start";
    await executeBusy(action, async () => {
      try {
        const result = schedulerRunning
          ? await schedulerRPCClient.stopScheduler({ agentId: selectedAgentId })
          : await schedulerRPCClient.startScheduler({ agentId: selectedAgentId });
        if (result.status === "agentNotFound") {
          toastManager.error("Agent no longer exists", { duration: 4000 });
          return;
        }
        toastManager.success(result.message, { duration: 2500 });
        await Promise.all([statusQuery.mutate(), tasksQuery.mutate()]);
      } catch (err) {
        toastManager.error(formatError(err), { duration: 5000 });
      }
    });
  };

  const handleRemove = async (agentId: string, name: string) => {
    const confirmed = await openConfirm({
      title: "Remove scheduled task",
      message: `Remove "${name}" from this agent's schedule? This cannot be undone.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;
    await executeBusy(`remove:${name}`, async () => {
      try {
        const result = await schedulerRPCClient.removeTask({ agentId, name });
        if (result.status === "agentNotFound") {
          toastManager.error("Agent no longer exists", { duration: 4000 });
          return;
        }
        toastManager.success(result.message, { duration: 2500 });
        if (expandedTask === name) setExpandedTask(null);
        if (historyTaskFilter === name) setHistoryTaskFilter("");
        await refreshAll();
      } catch (err) {
        toastManager.error(formatError(err), { duration: 5000 });
      }
    });
  };

  const handleCreateAgent = async () => {
    setCreatingAgent(true);
    try {
      // Prefer SWR cache / revalidation so we don't race a parallel getAgentTypes fetch.
      const types = agentTypes.data ?? (await agentTypes.mutate()) ?? [];
      const preferred = types.find(t => t.type === "code") ?? types.find(t => t.category?.toLowerCase().includes("interactive")) ?? types[0];
      if (!preferred) {
        toastManager.error("No agent types available", { duration: 4000 });
        return;
      }
      const { id } = await agentRPCClient.createAgent({ agentType: preferred.type, headless: false });
      await agents.mutate();
      setSelectedAgentId(id);
      toastManager.success(`Created agent for scheduling (${preferred.displayName})`, { duration: 3000 });
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setCreatingAgent(false);
    }
  };

  const agentList = agents.data ?? [];
  const selectedAgent = agentList.find(a => a.id === selectedAgentId);
  const isLoadingAgentData = Boolean(selectedAgentId) && (tasksQuery.isLoading || statusQuery.isLoading) && !tasksQuery.data;

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Scheduler"
        subtitle="Schedule and monitor recurring agent tasks"
        icon={<Timer className="w-4 h-4" />}
        iconGradient="from-indigo-500 to-violet-600"
      >
        <button
          type="button"
          onClick={() => void refreshAll()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", (tasksQuery.isValidating || statusQuery.isValidating || historyQuery.isValidating) && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {agents.isLoading && agentList.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 text-muted animate-spin" />
            </div>
          ) : agents.error && agentList.length === 0 ? (
            <ErrorState title="Unable to load agents" error={agents.error} onRetry={() => void agents.mutate()} variant="page" />
          ) : agentList.length === 0 ? (
            <EmptyState
              variant="card"
              icon={Timer}
              title="No agents available"
              hint="Scheduled tasks run on a specific agent. Create an agent first, then add recurring prompts."
              ctaLabel="Create agent"
              ctaIcon={User}
              ctaVariant="indigo"
              ctaLoading={creatingAgent}
              onCta={() => void handleCreateAgent()}
            />
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryStat
                  label="Tasks"
                  value={String(taskCount)}
                  sub={selectedAgent ? selectedAgent.displayName : "Select an agent"}
                  icon={<Timer className="w-4 h-4" />}
                  accentClass="text-indigo-500"
                  size="lg"
                  iconPosition="right"
                />
                <SummaryStat
                  label="Scheduler"
                  value={schedulerRunning ? "Enabled" : "Disabled"}
                  sub={statusQuery.data?.autoStart ? "Auto-start enabled" : "Auto-start off"}
                  icon={schedulerRunning ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  accentClass={schedulerRunning ? "text-emerald-500" : "text-muted"}
                  size="lg"
                  iconPosition="right"
                />
                <SummaryStat
                  label="Running now"
                  value={String(runningTaskCount)}
                  sub={runningTaskCount === 1 ? "1 task executing" : `${runningTaskCount} tasks executing`}
                  icon={<Activity className="w-4 h-4" />}
                  accentClass="text-amber-500"
                  size="lg"
                  iconPosition="right"
                />
                <SummaryStat
                  label="History"
                  value={String(historyEntries.length)}
                  sub="In-memory run log"
                  icon={<History className="w-4 h-4" />}
                  accentClass="text-violet-500"
                  size="lg"
                  iconPosition="right"
                />
              </div>

              {/* Agent picker + controls */}
              <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="flex-1 min-w-0 space-y-1">
                    <span className="text-xs font-bold text-muted uppercase tracking-widest">Agent</span>
                    <select
                      value={selectedAgentId ?? ""}
                      onChange={e => {
                        setSelectedAgentId(e.target.value || null);
                      }}
                      className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-accent"
                    >
                      {agentList.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.displayName}
                          {a.idle ? " (idle)" : " (active)"} — {a.agentType}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-wrap items-center gap-2 sm:pt-5">
                    <StatusBadge status={schedulerRunning ? "enabled" : "disabled"} statuses={SCHEDULER_STATUS_BADGES} gap="md" />
                    <button
                      type="button"
                      disabled={!selectedAgentId || busyAction === "start" || busyAction === "stop" || (!schedulerRunning && taskCount === 0)}
                      onClick={() => void handleStartStop()}
                      title={
                        !schedulerRunning && taskCount === 0
                          ? "Add a task before enabling the scheduler"
                          : schedulerRunning
                            ? "Disable scheduler (pause all tasks)"
                            : "Enable scheduler so pending tasks can fire"
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
                        schedulerRunning
                          ? "bg-tertiary border border-primary text-primary hover:bg-hover"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm",
                      )}
                    >
                      {busyAction === "start" || busyAction === "stop" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : schedulerRunning ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {schedulerRunning ? "Disable" : "Enable"}
                    </button>
                    {selectedAgentId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/agent/${selectedAgentId}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer"
                      >
                        Open chat
                      </button>
                    ) : null}
                  </div>
                </div>

                {!schedulerRunning && taskCount > 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400/90 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Scheduler is disabled. Tasks will not fire until you enable it (or auto-start after adding a task).
                  </p>
                ) : null}
              </div>

              {isLoadingAgentData ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-muted animate-spin" />
                </div>
              ) : tasksQuery.error && !tasksQuery.data ? (
                <ErrorState title="Unable to load schedule" error={tasksQuery.error} onRetry={() => void refreshAll()} variant="page" />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <FilterTabs tabs={tabs.length ? tabs : MAIN_TABS} value={tab} onChange={setTab} className="flex-1" tabClassName="flex-none px-4" />
                    {tab === "tasks" ? (
                      <button
                        type="button"
                        onClick={() => setShowAddForm(v => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg focus-ring cursor-pointer shadow-sm shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add task
                      </button>
                    ) : null}
                  </div>

                  {tab === "tasks" && showAddForm && selectedAgentId ? (
                    <AddTaskForm
                      agentId={selectedAgentId}
                      existingNames={taskEntries.map(t => t.name)}
                      onCancel={() => setShowAddForm(false)}
                      onCreated={() => {
                        setShowAddForm(false);
                        void refreshAll();
                      }}
                    />
                  ) : null}

                  {tab === "tasks" && taskEntries.length === 0 && !showAddForm ? (
                    <EmptyState
                      variant="card"
                      icon={Clock}
                      title="No scheduled tasks"
                      hint="Add a recurring prompt—health checks, daily briefs, cleanup, monitoring—to this agent."
                      ctaLabel="Add your first task"
                      ctaVariant="indigo"
                      onCta={() => setShowAddForm(true)}
                    />
                  ) : null}

                  {tab === "tasks" && taskEntries.length > 0 ? (
                    <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden divide-y divide-primary">
                      {taskEntries.map(entry => {
                        const isExpanded = expandedTask === entry.name;
                        return (
                          <div key={entry.name} className="px-4 py-3 hover:bg-hover/30 transition-colors">
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => setExpandedTask(isExpanded ? null : entry.name)}
                                className="mt-0.5 p-0.5 text-muted hover:text-primary rounded focus-ring cursor-pointer shrink-0"
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
                              >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-sm font-medium text-primary truncate">{entry.name}</span>
                                  <StatusBadge status={entry.status} statuses={TASK_STATUS_BADGES} variant="inline" />
                                </div>
                                <p className="text-xs text-muted mb-1.5" title={entry.task.message}>
                                  {isExpanded ? entry.task.message : truncateMessage(entry.task.message)}
                                </p>
                                <p className="text-xs text-muted/90 mb-2">{formatScheduleSummary(entry.task)}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                  {entry.status === "running" ? (
                                    <span className="text-muted">
                                      Started:{" "}
                                      <span className="text-primary font-medium" title={formatScheduleTime(entry.startTime)}>
                                        {entry.startTime ? `${formatScheduleTime(entry.startTime)} (${formatRelativeTime(entry.startTime)})` : "just now"}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-muted">
                                      Next:{" "}
                                      <span className="text-primary font-medium" title={formatScheduleTime(entry.nextRunTime)}>
                                        {entry.nextRunTime ? `${formatScheduleTime(entry.nextRunTime)} (${formatRelativeTime(entry.nextRunTime)})` : "—"}
                                      </span>
                                    </span>
                                  )}
                                  <span className="text-muted">
                                    Last:{" "}
                                    <span className="text-primary font-medium" title={formatScheduleTime(entry.task.lastRunTime)}>
                                      {entry.task.lastRunTime
                                        ? `${formatScheduleTime(entry.task.lastRunTime)} (${formatRelativeTime(entry.task.lastRunTime)})`
                                        : "Never"}
                                    </span>
                                  </span>
                                </div>
                                {isExpanded ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openHistoryForTask(entry.name)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer"
                                    >
                                      <History className="w-3 h-3" />
                                      View run history
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!selectedAgentId) return;
                                  void handleRemove(selectedAgentId, entry.name);
                                }}
                                disabled={!selectedAgentId || busyAction === `remove:${entry.name}`}
                                className="p-1.5 text-muted hover:text-red-500 transition-colors rounded-md focus-ring cursor-pointer disabled:opacity-50 shrink-0"
                                aria-label={`Remove task ${entry.name}`}
                                title="Remove task"
                              >
                                {busyAction === `remove:${entry.name}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {tab === "history" && historyQuery.isLoading && !historyQuery.data ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 text-muted animate-spin" />
                    </div>
                  ) : null}

                  {tab === "history" && historyQuery.error && !historyQuery.data ? (
                    <ErrorState title="Unable to load history" error={historyQuery.error} onRetry={() => void historyQuery.mutate()} variant="page" />
                  ) : null}

                  {tab === "history" && historyQuery.data && historyEntries.length === 0 ? (
                    <EmptyState
                      variant="card"
                      icon={History}
                      title="No runs yet"
                      hint="Execution history is kept in memory for this session. Completed and failed runs will appear here."
                    />
                  ) : null}

                  {tab === "history" && historyEntries.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        <label className="flex-1 min-w-0 space-y-1">
                          <span className="text-xs font-medium text-muted">Task</span>
                          <select
                            value={historyTaskFilter}
                            onChange={e => setHistoryTaskFilter(e.target.value)}
                            className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-accent"
                            aria-label="Filter history by task"
                          >
                            <option value="">All tasks</option>
                            {historyTaskNames.map(name => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="sm:w-40 space-y-1">
                          <span className="text-xs font-medium text-muted">Status</span>
                          <select
                            value={historyStatusFilter}
                            onChange={e => setHistoryStatusFilter(e.target.value as HistoryStatusFilter)}
                            className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-accent"
                            aria-label="Filter history by status"
                          >
                            <option value="all">All statuses</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                          </select>
                        </label>
                        {historyTaskFilter || historyStatusFilter !== "all" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryTaskFilter("");
                              setHistoryStatusFilter("all");
                            }}
                            className="px-3 py-2 text-xs text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer sm:mb-0"
                          >
                            Clear filters
                          </button>
                        ) : null}
                      </div>

                      {filteredHistory.length === 0 ? (
                        <EmptyState variant="card" icon={Search} title="No matching runs" hint="Try a different task or status filter." />
                      ) : (
                        <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden divide-y divide-primary">
                          {filteredHistory.map((run, idx) => (
                            <HistoryRunRow
                              key={`${run.taskName}-${run.startTime}-${idx}`}
                              id={`${run.taskName}-${run.startTime}-${idx}`}
                              entityName={run.taskName}
                              onEntityClick={() => setHistoryTaskFilter(run.taskName)}
                              status={run.status === "completed" ? "completed" : "failed"}
                              startTime={run.startTime}
                              endTime={run.endTime}
                              message={run.message}
                              timestampOptions={{ weekday: true }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog />
    </div>
  );
}
