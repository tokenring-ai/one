import formatError from "@tokenring-ai/utility/error/formatError";
import { Activity, AlertCircle, CheckCircle2, Clock, History, Loader2, Pause, Play, Plus, RefreshCw, Timer, Trash2, User, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, schedulerRPCClient, useAgentList, useAgentTypes, useSchedulerHistory, useSchedulerStatus, useSchedulerTasks } from "../../rpc.ts";
import AddTaskForm from "./AddTaskForm.tsx";
import { formatDuration, formatRelativeTime, formatScheduleSummary, formatScheduleTime, truncateMessage } from "./formatters.ts";

type MainTab = "tasks" | "history";

const MAIN_TABS: FilterTabOption<MainTab>[] = [
  { id: "tasks", label: "Tasks" },
  { id: "history", label: "History" },
];

function StatusPill({ running }: { running: boolean }) {
  return running ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Scheduler running
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-tertiary text-muted border border-primary">
      <Pause className="w-3 h-3" />
      Scheduler stopped
    </span>
  );
}

function TaskStatusBadge({ status }: { status: "pending" | "running" | "idle" }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400 shrink-0">
        <Activity className="w-3 h-3 animate-pulse" /> Running
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-indigo-600 dark:text-indigo-400 shrink-0">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-muted shrink-0">
      <Pause className="w-3 h-3" /> Not scheduled
    </span>
  );
}

export default function SchedulerDashboard() {
  const navigate = useNavigate();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [tab, setTab] = useState<MainTab>("tasks");
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);

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

  const taskCount = taskEntries.length;
  const runningTaskCount = taskEntries.filter(t => t.status === "running").length;
  const schedulerRunning = statusQuery.data?.running ?? false;

  const tabs = useMemo<FilterTabOption<MainTab>[]>(
    () => [
      { id: "tasks", label: "Tasks", count: taskCount },
      { id: "history", label: "History", count: historyEntries.length },
    ],
    [taskCount, historyEntries.length],
  );

  const refreshAll = async () => {
    await Promise.all([tasksQuery.mutate(), statusQuery.mutate(), historyQuery.mutate(), agents.mutate()]);
  };

  const handleStartStop = async () => {
    if (!selectedAgentId) return;
    const action = schedulerRunning ? "stop" : "start";
    setBusyAction(action);
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
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemove = async () => {
    if (!selectedAgentId || !confirmRemove) return;
    const name = confirmRemove;
    setConfirmRemove(null);
    setBusyAction(`remove:${name}`);
    try {
      const result = await schedulerRPCClient.removeTask({ agentId: selectedAgentId, name });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        return;
      }
      toastManager.success(result.message, { duration: 2500 });
      await refreshAll();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateAgent = async () => {
    setCreatingAgent(true);
    try {
      const types = agentTypes.data ?? (await agentRPCClient.getAgentTypes({}));
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
            <div className="px-6 py-14 text-center bg-secondary border border-primary border-dashed rounded-xl">
              <Timer className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-primary mb-1">No agents available</p>
              <p className="text-2xs text-muted max-w-sm mx-auto mb-5">
                Scheduled tasks run on a specific agent. Create an agent first, then add recurring prompts.
              </p>
              <button
                type="button"
                onClick={() => void handleCreateAgent()}
                disabled={creatingAgent}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {creatingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                Create agent
              </button>
            </div>
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
                />
                <SummaryStat
                  label="Scheduler"
                  value={schedulerRunning ? "On" : "Off"}
                  sub={statusQuery.data?.autoStart ? "Auto-start enabled" : "Auto-start off"}
                  icon={schedulerRunning ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  accentClass={schedulerRunning ? "text-emerald-500" : "text-muted"}
                />
                <SummaryStat
                  label="Running now"
                  value={String(runningTaskCount)}
                  sub={runningTaskCount === 1 ? "1 task executing" : "tasks executing"}
                  icon={<Activity className="w-4 h-4" />}
                  accentClass="text-amber-500"
                />
                <SummaryStat
                  label="History"
                  value={String(historyEntries.length)}
                  sub="In-memory run log"
                  icon={<History className="w-4 h-4" />}
                  accentClass="text-violet-500"
                />
              </div>

              {/* Agent picker + controls */}
              <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="flex-1 min-w-0 space-y-1">
                    <span className="text-2xs font-bold text-muted uppercase tracking-widest">Agent</span>
                    <select
                      value={selectedAgentId ?? ""}
                      onChange={e => {
                        setSelectedAgentId(e.target.value || null);
                        setShowAddForm(false);
                        setTab("tasks");
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
                    <StatusPill running={schedulerRunning} />
                    <button
                      type="button"
                      disabled={!selectedAgentId || busyAction === "start" || busyAction === "stop" || (!schedulerRunning && taskCount === 0)}
                      onClick={() => void handleStartStop()}
                      title={!schedulerRunning && taskCount === 0 ? "Add a task before starting" : undefined}
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
                      {schedulerRunning ? "Stop" : "Start"}
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
                  <p className="text-2xs text-amber-700 dark:text-amber-400/90 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Scheduler is stopped. Tasks will not fire until you start it (or auto-start after adding a task).
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

                  {tab === "tasks" ? (
                    taskEntries.length === 0 ? (
                      <div className="px-6 py-12 text-center bg-secondary border border-primary border-dashed rounded-xl">
                        <Clock className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium text-secondary mb-1">No scheduled tasks</p>
                        <p className="text-2xs text-muted max-w-xs mx-auto mb-4">
                          Add a recurring prompt—health checks, daily briefs, cleanup, monitoring—to this agent.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAddForm(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg focus-ring cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add your first task
                        </button>
                      </div>
                    ) : (
                      <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden divide-y divide-primary">
                        {taskEntries.map(entry => (
                          <div key={entry.name} className="px-4 py-3 hover:bg-hover/30 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-sm font-medium text-primary truncate">{entry.name}</span>
                                  <TaskStatusBadge status={entry.status} />
                                </div>
                                <p className="text-2xs text-muted mb-1.5" title={entry.task.message}>
                                  {truncateMessage(entry.task.message)}
                                </p>
                                <p className="text-2xs text-muted/90 mb-2">{formatScheduleSummary(entry.task)}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs">
                                  <span className="text-muted">
                                    Next:{" "}
                                    <span className="text-primary font-medium" title={formatScheduleTime(entry.nextRunTime)}>
                                      {entry.nextRunTime ? `${formatScheduleTime(entry.nextRunTime)} (${formatRelativeTime(entry.nextRunTime)})` : "—"}
                                    </span>
                                  </span>
                                  <span className="text-muted">
                                    Last:{" "}
                                    <span className="text-primary font-medium" title={formatScheduleTime(entry.task.lastRunTime)}>
                                      {entry.task.lastRunTime
                                        ? `${formatScheduleTime(entry.task.lastRunTime)} (${formatRelativeTime(entry.task.lastRunTime)})`
                                        : "Never"}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setConfirmRemove(entry.name)}
                                disabled={busyAction === `remove:${entry.name}`}
                                className="p-1.5 text-muted hover:text-red-500 transition-colors rounded-md focus-ring cursor-pointer disabled:opacity-50 shrink-0"
                                aria-label={`Remove task ${entry.name}`}
                                title="Remove task"
                              >
                                {busyAction === `remove:${entry.name}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : historyEntries.length === 0 ? (
                    <div className="px-6 py-12 text-center bg-secondary border border-primary border-dashed rounded-xl">
                      <History className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium text-secondary mb-1">No runs yet</p>
                      <p className="text-2xs text-muted max-w-xs mx-auto">
                        Execution history is kept in memory for this session. Completed and failed runs will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden divide-y divide-primary">
                      {historyEntries.map((run, idx) => (
                        <div key={`${run.taskName}-${run.startTime}-${idx}`} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">
                              {run.status === "completed" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-sm font-medium text-primary">{run.taskName}</span>
                                <span
                                  className={cn(
                                    "text-2xs px-1.5 py-0.5 rounded-md border",
                                    run.status === "completed"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                      : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
                                  )}
                                >
                                  {run.status}
                                </span>
                                <span className="text-2xs text-muted tabular-nums">{formatDuration(run.startTime, run.endTime)}</span>
                              </div>
                              <p className="text-2xs text-muted mb-1">{formatScheduleTime(run.startTime, { withSeconds: true })}</p>
                              {run.message ? (
                                <p className="text-2xs text-secondary line-clamp-2" title={run.message}>
                                  {run.message}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {confirmRemove ? (
        <ConfirmDialog
          title="Remove scheduled task"
          message={`Remove "${confirmRemove}" from this agent's schedule? This cannot be undone.`}
          confirmText="Remove"
          cancelText="Cancel"
          variant="danger"
          onConfirm={() => void handleRemove()}
          onCancel={() => setConfirmRemove(null)}
        />
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value, sub, icon, accentClass }: { label: string; value: string; sub?: string; icon: ReactNode; accentClass?: string }) {
  return (
    <div className="px-4 py-3.5 bg-secondary rounded-xl border border-primary shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-bold text-muted uppercase tracking-widest">{label}</span>
        <span className={cn("opacity-80", accentClass)}>{icon}</span>
      </div>
      <div className={cn("text-xl font-semibold tabular-nums tracking-tight", accentClass ?? "text-primary")}>{value}</div>
      {sub ? <p className="text-2xs text-muted mt-1 truncate">{sub}</p> : null}
    </div>
  );
}
