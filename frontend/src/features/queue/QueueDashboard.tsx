import formatError from "@tokenring-ai/utility/error/formatError";
import {
  Activity,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eraser,
  ExternalLink,
  History,
  Layers,
  ListOrdered,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
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
type ResultFilter = "all" | "completed" | "failed" | "cancelled";

export default function QueueDashboard() {
  const navigate = useNavigate();
  const queues = useQueues();
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  /** Name to select once the live stream includes a newly created queue. */
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [tab, setTab] = useState<MainTab>("pending");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [, setTick] = useState(0);

  const allQueues = queues.data?.queues ?? {};
  const queueNames = useMemo(() => Object.keys(allQueues).sort((a, b) => a.localeCompare(b)), [allQueues]);

  // Resolve selection during render so the first frame with data is not blank
  // (effect-only selection left tabs/content missing until the next paint).
  const selectedQueueName = useMemo(() => {
    if (pendingSelect && queueNames.includes(pendingSelect)) return pendingSelect;
    if (selectedQueue && queueNames.includes(selectedQueue)) return selectedQueue;
    if (queueNames.length === 0) return null;
    return queueNames.includes("default") ? "default" : (queueNames[0] ?? null);
  }, [pendingSelect, selectedQueue, queueNames]);

  // Persist resolved selection into state once stream/create catches up
  useEffect(() => {
    if (pendingSelect && queueNames.includes(pendingSelect)) {
      setSelectedQueue(pendingSelect);
      setPendingSelect(null);
      return;
    }
    if (pendingSelect) return;
    if (selectedQueueName !== selectedQueue) {
      setSelectedQueue(selectedQueueName);
    }
  }, [pendingSelect, queueNames, selectedQueueName, selectedQueue]);

  const queueData = selectedQueueName ? allQueues[selectedQueueName] : undefined;
  const pending = useMemo(() => queueData?.items.filter(i => i.status === "pending") ?? [], [queueData]);
  const running = useMemo(() => queueData?.items.filter(i => i.status === "running") ?? [], [queueData]);
  // Stream stores oldest→newest; show newest first for a usable results feed.
  const results = useMemo(() => [...(queueData?.results ?? [])].reverse(), [queueData]);
  const filteredResults = useMemo(() => (resultFilter === "all" ? results : results.filter(r => r.status === resultFilter)), [results, resultFilter]);

  const totalPending = useMemo(() => Object.values(allQueues).reduce((n, q) => n + q.items.filter(i => i.status === "pending").length, 0), [allQueues]);
  const totalRunning = useMemo(() => Object.values(allQueues).reduce((n, q) => n + q.items.filter(i => i.status === "running").length, 0), [allQueues]);
  const totalResults = useMemo(() => Object.values(allQueues).reduce((n, q) => n + q.results.length, 0), [allQueues]);

  // Live-tick running durations only when there is active work
  useEffect(() => {
    if (running.length === 0) return;
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, [running.length]);

  // Reset expand state when switching queues/tabs so rows don't stay open with stale ids
  useEffect(() => {
    setExpandedIds(new Set());
  }, [selectedQueueName, tab]);

  const tabs = useMemo<FilterTabOption<MainTab>[]>(
    () => [
      { id: "pending", label: "Pending", count: pending.length },
      { id: "running", label: "Running", count: running.length },
      { id: "results", label: "Results", count: results.length },
    ],
    [pending.length, running.length, results.length],
  );

  const resultFilterTabs = useMemo<FilterTabOption<ResultFilter>[]>(
    () => [
      { id: "all", label: "All", count: results.length },
      { id: "completed", label: "Completed", count: results.filter(r => r.status === "completed").length },
      { id: "failed", label: "Failed", count: results.filter(r => r.status === "failed").length },
      { id: "cancelled", label: "Cancelled", count: results.filter(r => r.status === "cancelled").length },
    ],
    [results],
  );

  const refresh = () => void queues.mutate();

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCancel = async () => {
    if (!selectedQueueName || !confirmCancel) return;
    const itemId = confirmCancel;
    setConfirmCancel(null);
    setBusyAction(`cancel:${itemId}`);
    try {
      const result = await queueRPCClient.cancelItem({ queueName: selectedQueueName, itemId });
      if (!result.cancelled) {
        toastManager.warning(result.message, { duration: 3000 });
      } else {
        toastManager.success(result.message, { duration: 2500 });
      }
      // Live stream already reflects state mutations; reconnect only on failure recovery paths.
    } catch (err) {
      toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const handleClear = async () => {
    if (!selectedQueueName) return;
    setConfirmClear(false);
    setBusyAction("clear");
    try {
      const result = await queueRPCClient.clear({ queueName: selectedQueueName });
      if (result.status === "queueNotFound") {
        toastManager.error(`Queue "${selectedQueueName}" no longer exists`, { duration: 4000 });
        return;
      }
      toastManager.success(result.message, { duration: 2500 });
    } catch (err) {
      toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
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

      <WorkspaceShell
        appId="queue"
        title="Queue"
        navigationLabel="Queues"
        hasSelection={selectedQueueName !== null || showCreateForm}
        className="flex-1"
        navigation={
          <div className="h-full flex flex-col min-h-0 bg-secondary">
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-primary">
              <span className="flex-1 text-2xs font-bold uppercase tracking-widest text-muted">Queues</span>
              <span className="text-2xs text-muted">{queueNames.length}</span>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(true);
                  setShowAddForm(false);
                }}
                className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-hover focus-ring"
                aria-label="Create queue"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Queues">
              {queueNames.map(name => {
                const queue = allQueues[name];
                const pendingCount = queue?.items.filter(item => item.status === "pending").length ?? 0;
                const runningCount = queue?.items.filter(item => item.status === "running").length ?? 0;
                const active = name === selectedQueueName;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setSelectedQueue(name);
                      setPendingSelect(null);
                      setShowAddForm(false);
                      setShowCreateForm(false);
                      setTab("pending");
                      setResultFilter("all");
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left focus-ring ${active ? "bg-active text-primary" : "text-secondary hover:text-primary hover:bg-hover"}`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-500 grid place-items-center shrink-0">
                      <ListOrdered className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium truncate">{name}</span>
                      <span className="block text-2xs text-muted truncate">{queue?.config.agentType ?? "Queue"}</span>
                    </span>
                    {(pendingCount > 0 || runningCount > 0) && (
                      <span className="text-2xs text-muted tabular-nums">
                        {pendingCount}/{runningCount}
                      </span>
                    )}
                  </button>
                );
              })}
              {!isLoading && queueNames.length === 0 && <p className="px-2 py-6 text-center text-2xs text-muted">No queues configured</p>}
            </nav>
          </div>
        }
      >
        <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
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
                {showCreateForm ? (
                  <div className="max-w-lg mx-auto text-left">
                    <CreateQueueForm
                      existingNames={queueNames}
                      onCancel={() => setShowCreateForm(false)}
                      onCreated={name => {
                        setShowCreateForm(false);
                        setPendingSelect(name);
                        setSelectedQueue(name);
                        setTab("pending");
                        setShowAddForm(false);
                      }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors focus-ring cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Create queue
                  </button>
                )}
              </div>
            ) : (
              <>
                {queues.error ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-2xs text-amber-800 dark:text-amber-200">
                    <span>Live queue updates interrupted. Showing the last snapshot.</span>
                    <button
                      type="button"
                      onClick={refresh}
                      className="inline-flex items-center gap-1 font-medium text-amber-900 dark:text-amber-100 hover:underline focus-ring rounded cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3 h-3", queues.isValidating && "animate-spin")} />
                      Reconnect
                    </button>
                  </div>
                ) : null}

                {/* Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <SummaryStat label="Queues" value={String(queueNames.length)} icon={<Layers className="w-4 h-4" />} accentClass="text-sky-500" />
                  <SummaryStat label="Pending" value={String(totalPending)} icon={<Clock className="w-4 h-4" />} accentClass="text-indigo-500" />
                  <SummaryStat label="Running" value={String(totalRunning)} icon={<Activity className="w-4 h-4" />} accentClass="text-amber-500" />
                  <SummaryStat label="Results" value={String(totalResults)} icon={<History className="w-4 h-4" />} accentClass="text-violet-500" />
                </div>

                {/* Queue picker + controls */}
                <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="flex-1 min-w-0 space-y-1">
                      <span className="text-2xs font-bold text-muted uppercase tracking-widest">Queue</span>
                      <select
                        value={selectedQueueName ?? ""}
                        onChange={e => {
                          setSelectedQueue(e.target.value || null);
                          setPendingSelect(null);
                          setShowAddForm(false);
                          setShowCreateForm(false);
                          setTab("pending");
                          setResultFilter("all");
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
                        onClick={() => {
                          setShowCreateForm(v => !v);
                          setShowAddForm(false);
                        }}
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
                    onCreated={name => {
                      setShowCreateForm(false);
                      setPendingSelect(name);
                      setSelectedQueue(name);
                      setTab("pending");
                      setShowAddForm(false);
                    }}
                  />
                ) : null}

                {selectedQueueName && queueData ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <FilterTabs
                        tabs={tabs}
                        value={tab}
                        onChange={next => {
                          setTab(next);
                          setShowAddForm(false);
                        }}
                        className="flex-1"
                        tabClassName="flex-none px-4"
                      />
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
                            onClick={() => {
                              setShowAddForm(v => !v);
                              setShowCreateForm(false);
                            }}
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
                        queueName={selectedQueueName}
                        onCancel={() => setShowAddForm(false)}
                        onCreated={() => {
                          setShowAddForm(false);
                        }}
                      />
                    ) : null}

                    {tab === "pending" ? (
                      pending.length === 0 && !showAddForm ? (
                        <EmptyState
                          icon={<Clock className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                          title="No pending items"
                          hint="Add a task to this queue and a fresh agent will pick it up."
                          ctaLabel="Add your first task"
                          onCta={() => setShowAddForm(true)}
                        />
                      ) : pending.length === 0 ? null : (
                        <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden divide-y divide-primary">
                          {pending.map((item, index) => {
                            const expanded = expandedIds.has(item.id);
                            return (
                              <div key={item.id} className="px-4 py-3 hover:bg-hover/30 transition-colors">
                                <div className="flex items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(item.id)}
                                    className="mt-0.5 p-0.5 text-muted hover:text-primary rounded focus-ring cursor-pointer shrink-0"
                                    aria-expanded={expanded}
                                    aria-label={expanded ? "Collapse details" : "Expand details"}
                                  >
                                    {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <span className="text-2xs text-muted tabular-nums">#{index + 1}</span>
                                      <span className="text-sm font-medium text-primary truncate">{item.name}</span>
                                      <span className="inline-flex items-center gap-1 text-2xs text-indigo-600 dark:text-indigo-400 shrink-0">
                                        <Clock className="w-3 h-3" /> Pending
                                      </span>
                                    </div>
                                    <p className="text-2xs text-muted mb-1.5" title={item.input.message}>
                                      {expanded ? null : truncateText(item.input.message)}
                                    </p>
                                    {expanded ? (
                                      <div className="mt-1 mb-2 space-y-2">
                                        <DetailBlock label="Task / prompt" value={item.input.message} />
                                        {item.input.attachments?.length ? (
                                          <DetailBlock label="Attachments" value={item.input.attachments.map(a => a.name).join(", ")} />
                                        ) : null}
                                        <p className="text-2xs text-muted">
                                          Id: <span className="font-mono text-secondary">{item.id}</span>
                                        </p>
                                      </div>
                                    ) : null}
                                    <p className="text-2xs text-muted/90">
                                      Queued {formatRelativeTime(item.createdAt)} · from {item.input.from}
                                    </p>
                                  </div>
                                  <CancelButton itemId={item.id} busy={busyAction === `cancel:${item.id}`} onClick={() => setConfirmCancel(item.id)} />
                                </div>
                              </div>
                            );
                          })}
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
                          {running.map(item => {
                            const expanded = expandedIds.has(item.id);
                            return (
                              <div key={item.id} className="px-4 py-3 hover:bg-hover/30 transition-colors">
                                <div className="flex items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(item.id)}
                                    className="mt-0.5 p-0.5 text-muted hover:text-primary rounded focus-ring cursor-pointer shrink-0"
                                    aria-expanded={expanded}
                                    aria-label={expanded ? "Collapse details" : "Expand details"}
                                  >
                                    {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <span className="text-sm font-medium text-primary truncate">{item.name}</span>
                                      <span className="inline-flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400 shrink-0">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Running
                                      </span>
                                    </div>
                                    {!expanded ? (
                                      <p className="text-2xs text-muted mb-1.5" title={item.input.message}>
                                        {truncateText(item.input.message)}
                                      </p>
                                    ) : (
                                      <div className="mt-1 mb-2 space-y-2">
                                        <DetailBlock label="Task / prompt" value={item.input.message} />
                                        {item.input.attachments?.length ? (
                                          <DetailBlock label="Attachments" value={item.input.attachments.map(a => a.name).join(", ")} />
                                        ) : null}
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted">
                                      <span>Started {item.startedAt ? formatRelativeTime(item.startedAt) : "—"}</span>
                                      <span>
                                        Elapsed{" "}
                                        <span className="text-primary font-medium tabular-nums">{formatDurationBetween(item.startedAt, Date.now())}</span>
                                      </span>
                                      {item.agentId ? (
                                        <button
                                          type="button"
                                          onClick={() => openAgent(item.agentId)}
                                          className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline focus-ring rounded cursor-pointer"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          Open agent
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                  <CancelButton itemId={item.id} busy={busyAction === `cancel:${item.id}`} onClick={() => setConfirmCancel(item.id)} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : results.length === 0 ? (
                      <EmptyState
                        icon={<History className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                        title="No results yet"
                        hint="Completed, failed, and cancelled items will appear here."
                      />
                    ) : (
                      <div className="space-y-3">
                        <FilterTabs tabs={resultFilterTabs} value={resultFilter} onChange={setResultFilter} tabClassName="flex-none px-3" />
                        {filteredResults.length === 0 ? (
                          <EmptyState
                            icon={<History className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                            title={`No ${resultFilter} results`}
                            hint="Try another status filter to see more history."
                          />
                        ) : (
                          <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden divide-y divide-primary">
                            {filteredResults.map(item => {
                              const expanded = expandedIds.has(item.id);
                              return (
                                <div key={item.id} className="px-4 py-3 hover:bg-hover/30 transition-colors">
                                  <div className="flex items-start gap-3">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpanded(item.id)}
                                      className="mt-0.5 p-0.5 text-muted hover:text-primary rounded focus-ring cursor-pointer shrink-0"
                                      aria-expanded={expanded}
                                      aria-label={expanded ? "Collapse details" : "Expand details"}
                                    >
                                      {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </button>
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
                                      {!expanded && item.resultMessage ? (
                                        <p className="text-2xs text-secondary line-clamp-3 whitespace-pre-wrap" title={item.resultMessage}>
                                          {item.resultMessage}
                                        </p>
                                      ) : null}
                                      {expanded ? (
                                        <div className="mt-2 space-y-2">
                                          <DetailBlock label="Task / prompt" value={item.input.message} />
                                          {item.input.attachments?.length ? (
                                            <DetailBlock label="Attachments" value={item.input.attachments.map(a => a.name).join(", ")} />
                                          ) : null}
                                          {item.resultMessage ? <DetailBlock label="Result" value={item.resultMessage} /> : null}
                                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted">
                                            <span>
                                              From <span className="text-secondary">{item.input.from}</span>
                                            </span>
                                            <span>Queued {formatQueueTime(item.createdAt)}</span>
                                            {item.startedAt ? <span>Started {formatQueueTime(item.startedAt)}</span> : null}
                                            <span className="font-mono">id {item.id}</span>
                                            {/* Worker agents are deleted when the item finishes; keep id as metadata only. */}
                                            {item.agentId ? <span className="font-mono">agent {item.agentId}</span> : null}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </WorkspaceShell>

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
          message={`Remove all pending items from queue "${selectedQueueName}"? Running items will not be affected. This cannot be undone.`}
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

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-primary bg-tertiary/40 px-3 py-2">
      <p className="text-2xs font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xs text-secondary whitespace-pre-wrap break-words">{value}</p>
    </div>
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
