import formatError from "@tokenring-ai/utility/error/formatError";
import { Activity, Ban, CheckCircle2, Clock, Eraser, History, Layers, ListOrdered, Loader2, Plus, RefreshCw, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { queueRPCClient, useQueues } from "../../rpc.ts";
import AddItemForm from "./AddItemForm.tsx";
import CreateQueueForm from "./CreateQueueForm.tsx";
import { formatDurationBetween, formatDurationMs, formatQueueTime, formatRelativeTime, truncateText } from "./formatters.ts";

type MainTab = "pending" | "running" | "results";

export default function QueueDashboard() {
  const navigate = useNavigate();
  const queues = useQueues();
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [tab, setTab] = useState<MainTab>("pending");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const allQueues = queues.data?.queues ?? {};
  const queueNames = useMemo(() => Object.keys(allQueues), [allQueues]);

  // Auto-select the "default" queue (or the first available)
  useEffect(() => {
    if (queueNames.length === 0) {
      setSelectedQueue(null);
      return;
    }
    if (!selectedQueue || !queueNames.includes(selectedQueue)) {
      setSelectedQueue(queueNames.includes("default") ? "default" : (queueNames[0] ?? null));
    }
  }, [queueNames, selectedQueue]);

  const queueData = selectedQueue ? allQueues[selectedQueue] : undefined;
  const pending = useMemo(() => queueData?.items.filter(i => i.status === "pending") ?? [], [queueData]);
  const running = useMemo(() => queueData?.items.filter(i => i.status === "running") ?? [], [queueData]);
  const results = useMemo(() => queueData?.results ?? [], [queueData]);

  const totalPending = useMemo(() => Object.values(allQueues).reduce((n, q) => n + q.items.filter(i => i.status === "pending").length, 0), [allQueues]);
  const totalRunning = useMemo(() => Object.values(allQueues).reduce((n, q) => n + q.items.filter(i => i.status === "running").length, 0), [allQueues]);
  const totalResults = useMemo(() => Object.values(allQueues).reduce((n, q) => n + q.results.length, 0), [allQueues]);

  // Live-tick running durations only when there is active work
  useEffect(() => {
    if (running.length === 0) return;
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, [running.length]);

  const tabs = useMemo<FilterTabOption<MainTab>[]>(
    () => [
      { id: "pending", label: "Pending", count: pending.length },
      { id: "running", label: "Running", count: running.length },
      { id: "results", label: "Results", count: results.length },
    ],
    [pending.length, running.length, results.length],
  );

  const refresh = () => void queues.mutate();

  const handleCancel = async () => {
    if (!selectedQueue || !confirmCancel) return;
    const itemId = confirmCancel;
    setConfirmCancel(null);
    setBusyAction(`cancel:${itemId}`);
    try {
      const result = await queueRPCClient.cancelItem({ queueName: selectedQueue, itemId });
      if (!result.cancelled) {
        toastManager.warning(result.message, { duration: 3000 });
      } else {
        toastManager.success(result.message, { duration: 2500 });
      }
      await queues.mutate();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const handleClear = async () => {
    if (!selectedQueue) return;
    setConfirmClear(false);
    setBusyAction("clear");
    try {
      const result = await queueRPCClient.clear({ queueName: selectedQueue });
      if (result.status === "queueNotFound") {
        toastManager.error(`Queue "${selectedQueue}" no longer exists`, { duration: 4000 });
        return;
      }
      toastManager.success(result.message, { duration: 2500 });
      await queues.mutate();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const isLoading = queues.isLoading && !queues.data;
  const concurrency = queueData?.config.concurrency ?? 0;

  const openAgent = (agentId: string | null | undefined) => {
    if (!agentId) return;
    void navigate(`/agent/${agentId}`);
  };

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Queue"
        subtitle="Dispatch work to agents and track results"
        icon={<ListOrdered className="w-4 h-4" />}
        iconGradient="from-sky-500 to-blue-600"
      >
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", queues.isValidating && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 text-muted animate-spin" />
            </div>
          ) : queues.error && !queues.data ? (
            <ErrorState title="Unable to load queues" error={queues.error} onRetry={refresh} variant="page" />
          ) : queueNames.length === 0 ? (
            <div className="px-6 py-14 text-center bg-secondary border border-primary border-dashed rounded-xl">
              <Layers className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-primary mb-1">No queues available</p>
              <p className="text-2xs text-muted max-w-sm mx-auto mb-5">
                The queue service is running but no queues are configured. Create a queue to start dispatching work.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors focus-ring cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create queue
              </button>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryStat label="Queues" value={String(queueNames.length)} icon={<Layers className="w-4 h-4" />} accentClass="text-sky-500" />
                <SummaryStat label="Pending" value={String(totalPending)} icon={<Clock className="w-4 h-4" />} accentClass="text-indigo-500" />
                <SummaryStat label="Running" value={String(totalRunning)} icon={<Activity className="w-4 h-4" />} accentClass="text-amber-500" />
                <SummaryStat label="Completed" value={String(totalResults)} icon={<History className="w-4 h-4" />} accentClass="text-violet-500" />
              </div>

              {/* Queue picker + controls */}
              <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="flex-1 min-w-0 space-y-1">
                    <span className="text-2xs font-bold text-muted uppercase tracking-widest">Queue</span>
                    <select
                      value={selectedQueue ?? ""}
                      onChange={e => {
                        setSelectedQueue(e.target.value || null);
                        setShowAddForm(false);
                        setTab("pending");
                      }}
                      className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-accent"
                    >
                      {queueNames.map(name => (
                        <option key={name} value={name}>
                          {name} — {allQueues[name]?.config.agentType}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-wrap items-center gap-2 sm:pt-5">
                    {queueData ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-tertiary text-muted border border-primary">
                        <Activity className="w-3 h-3" />
                        {running.length} / {concurrency} active
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(v => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-tertiary border border-primary text-primary hover:bg-hover rounded-lg focus-ring cursor-pointer transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      New queue
                    </button>
                  </div>
                </div>

                {queueData ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted">
                    <span>
                      Agent type: <span className="text-primary font-medium">{queueData.config.agentType}</span>
                    </span>
                    <span>
                      Concurrency: <span className="text-primary font-medium">{queueData.config.concurrency}</span>
                    </span>
                    <span>
                      Max pending: <span className="text-primary font-medium">{queueData.config.maxSize ?? "unlimited"}</span>
                    </span>
                    <span>
                      Results kept: <span className="text-primary font-medium">{queueData.config.maxResults}</span>
                    </span>
                  </div>
                ) : null}
              </div>

              {showCreateForm ? (
                <CreateQueueForm
                  existingNames={queueNames}
                  onCancel={() => setShowCreateForm(false)}
                  onCreated={() => {
                    setShowCreateForm(false);
                    void queues.mutate();
                  }}
                />
              ) : null}

              {selectedQueue && queueData ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <FilterTabs tabs={tabs} value={tab} onChange={setTab} className="flex-1" tabClassName="flex-none px-4" />
                    {tab === "pending" ? (
                      <div className="flex items-center gap-2 shrink-0">
                        {pending.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setConfirmClear(true)}
                            disabled={busyAction === "clear"}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-error border border-primary hover:bg-error/5 rounded-lg focus-ring cursor-pointer transition-colors"
                          >
                            {busyAction === "clear" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" />}
                            Clear
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setShowAddForm(v => !v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg focus-ring cursor-pointer shadow-sm shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add task
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {tab === "pending" && showAddForm ? (
                    <AddItemForm
                      queueName={selectedQueue}
                      onCancel={() => setShowAddForm(false)}
                      onCreated={() => {
                        setShowAddForm(false);
                        void queues.mutate();
                      }}
                    />
                  ) : null}

                  {tab === "pending" ? (
                    pending.length === 0 ? (
                      <EmptyState
                        icon={<Clock className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                        title="No pending items"
                        hint="Add a task to this queue and a fresh agent will pick it up."
                        ctaLabel="Add your first task"
                        onCta={() => setShowAddForm(true)}
                      />
                    ) : (
                      <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden divide-y divide-primary">
                        {pending.map((item, index) => (
                          <div key={item.id} className="px-4 py-3 hover:bg-hover/30 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-2xs text-muted tabular-nums">#{index + 1}</span>
                                  <span className="text-sm font-medium text-primary truncate">{item.name}</span>
                                  <span className="inline-flex items-center gap-1 text-2xs text-indigo-600 dark:text-indigo-400 shrink-0">
                                    <Clock className="w-3 h-3" /> Pending
                                  </span>
                                </div>
                                <p className="text-2xs text-muted mb-1.5" title={item.input}>
                                  {truncateText(item.input)}
                                </p>
                                <p className="text-2xs text-muted/90">
                                  Queued {formatRelativeTime(item.createdAt)} · from {item.from}
                                </p>
                              </div>
                              <CancelButton itemId={item.id} busy={busyAction === `cancel:${item.id}`} onClick={() => setConfirmCancel(item.id)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : tab === "running" ? (
                    running.length === 0 ? (
                      <EmptyState
                        icon={<Activity className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                        title="Nothing running"
                        hint="Items currently being processed by worker agents will appear here."
                      />
                    ) : (
                      <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden divide-y divide-primary">
                        {running.map(item => (
                          <div
                            key={item.id}
                            role={item.agentId ? "button" : undefined}
                            tabIndex={item.agentId ? 0 : undefined}
                            onClick={() => openAgent(item.agentId)}
                            onKeyDown={e => {
                              if (!item.agentId) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openAgent(item.agentId);
                              }
                            }}
                            className={cn("px-4 py-3 transition-colors", item.agentId ? "hover:bg-hover/50 cursor-pointer focus-ring" : "hover:bg-hover/30")}
                            title={item.agentId ? "Open agent chat" : undefined}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-sm font-medium text-primary truncate">{item.name}</span>
                                  <span className="inline-flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400 shrink-0">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Running
                                  </span>
                                </div>
                                <p className="text-2xs text-muted mb-1.5" title={item.input}>
                                  {truncateText(item.input)}
                                </p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted">
                                  <span>Started {item.startedAt ? formatRelativeTime(item.startedAt) : "—"}</span>
                                  <span>
                                    Elapsed <span className="text-primary font-medium tabular-nums">{formatDurationBetween(item.startedAt, Date.now())}</span>
                                  </span>
                                  {item.agentId ? <span className="truncate">Agent: {item.agentId}</span> : null}
                                </div>
                              </div>
                              <CancelButton itemId={item.id} busy={busyAction === `cancel:${item.id}`} onClick={() => setConfirmCancel(item.id)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : results.length === 0 ? (
                    <EmptyState
                      icon={<History className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                      title="No results yet"
                      hint="Completed, failed, and cancelled items will appear here."
                    />
                  ) : (
                    <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden divide-y divide-primary">
                      {results.map(item => (
                        <div
                          key={item.id}
                          role={item.agentId ? "button" : undefined}
                          tabIndex={item.agentId ? 0 : undefined}
                          onClick={() => openAgent(item.agentId)}
                          onKeyDown={e => {
                            if (!item.agentId) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openAgent(item.agentId);
                            }
                          }}
                          className={cn("px-4 py-3 transition-colors", item.agentId ? "hover:bg-hover/50 cursor-pointer focus-ring" : "hover:bg-hover/30")}
                          title={item.agentId ? "Open agent chat" : undefined}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">
                              {item.status === "completed" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : item.status === "failed" ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <Ban className="w-4 h-4 text-muted" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-sm font-medium text-primary">{item.name}</span>
                                <ResultStatusBadge status={item.status} />
                                <span className="text-2xs text-muted tabular-nums">{formatDurationMs(item.durationMs)}</span>
                              </div>
                              <p className="text-2xs text-muted mb-1">{formatQueueTime(item.completedAt, { withSeconds: true })}</p>
                              {item.resultMessage ? (
                                <p className="text-2xs text-secondary line-clamp-3 whitespace-pre-wrap" title={item.resultMessage}>
                                  {item.resultMessage}
                                </p>
                              ) : null}
                              {item.agentId ? <p className="text-2xs text-muted mt-1 truncate">Agent: {item.agentId}</p> : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {confirmCancel ? (
        <ConfirmDialog
          title="Cancel queue item"
          message="Cancel this item? If it is running, its agent will be aborted. This cannot be undone."
          confirmText="Cancel item"
          cancelText="Keep"
          variant="warning"
          onConfirm={() => void handleCancel()}
          onCancel={() => setConfirmCancel(null)}
        />
      ) : null}

      {confirmClear ? (
        <ConfirmDialog
          title="Clear pending items"
          message={`Remove all pending items from queue "${selectedQueue}"? Running items will not be affected. This cannot be undone.`}
          confirmText="Clear all"
          cancelText="Keep"
          variant="danger"
          onConfirm={() => void handleClear()}
          onCancel={() => setConfirmClear(false)}
        />
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value, icon, accentClass }: { label: string; value: string; icon: ReactNode; accentClass?: string }) {
  return (
    <div className="px-4 py-3.5 bg-secondary rounded-xl border border-primary shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-bold text-muted uppercase tracking-widest">{label}</span>
        <span className={cn("opacity-80", accentClass)}>{icon}</span>
      </div>
      <div className={cn("text-xl font-semibold tabular-nums tracking-tight", accentClass ?? "text-primary")}>{value}</div>
    </div>
  );
}

function ResultStatusBadge({ status }: { status: "completed" | "failed" | "cancelled" }) {
  if (status === "completed") {
    return (
      <span className="text-2xs px-1.5 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">completed</span>
    );
  }
  if (status === "failed") {
    return <span className="text-2xs px-1.5 py-0.5 rounded-md border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">failed</span>;
  }
  return <span className="text-2xs px-1.5 py-0.5 rounded-md border bg-tertiary text-muted border-primary">cancelled</span>;
}

function CancelButton({ itemId, busy, onClick }: { itemId: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      disabled={busy}
      className="p-1.5 text-muted hover:text-error transition-colors rounded-md focus-ring cursor-pointer disabled:opacity-50 shrink-0"
      aria-label={`Cancel item ${itemId}`}
      title="Cancel item"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
    </button>
  );
}

function EmptyState({ icon, title, hint, ctaLabel, onCta }: { icon: ReactNode; title: string; hint: string; ctaLabel?: string; onCta?: () => void }) {
  return (
    <div className="px-6 py-12 text-center bg-secondary border border-primary border-dashed rounded-xl">
      {icon}
      <p className="text-sm font-medium text-secondary mb-1">{title}</p>
      <p className="text-2xs text-muted max-w-xs mx-auto mb-4">{hint}</p>
      {ctaLabel && onCta ? (
        <button
          type="button"
          onClick={onCta}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg focus-ring cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
