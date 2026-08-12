import { formatDurationMs } from "@tokenring-ai/utility/date/formatDuration";
import { formatRelativeTime } from "@tokenring-ai/utility/date/formatRelativeTime";
import formatError from "@tokenring-ai/utility/error/formatError";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  GitBranch,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import SidebarCategoryAccordion from "../../components/layout/SidebarCategoryAccordion.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ConfirmModal from "../../components/ui/ConfirmModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import HistoryRunRow, { type HistoryRunStatus } from "../../components/ui/HistoryRunRow.tsx";
import LaunchButton from "../../components/ui/LaunchButton.tsx";
import ListItemWithActions from "../../components/ui/ListItemWithActions.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import StatusBadge, { type StatusBadgeDefinition } from "../../components/ui/StatusBadge.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import AutoResizeTextarea from "../../features/workflows/AutoResizeTextarea.tsx";
import type { AvailableAgentCommand, WorkflowStep } from "../../features/workflows/commandStep.ts";
import { formatStepLabel, isStepFilled, normalizeSteps } from "../../features/workflows/commandStep.ts";
import StepEditor from "../../features/workflows/StepEditor.tsx";
import { useEntityDelete } from "../../hooks/useEntityDelete.ts";
import { useStaleRouteRedirect } from "../../hooks/useStaleRouteRedirect.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { useAgentList, useAgentTypes, useAvailableCommands, useTypedSWR, useWorkflowRuns, useWorkflows, workflowRPCClient } from "../../rpc.ts";

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
/** Draft key for the not-yet-created workflow; can never collide with a real name. */
const NEW_DRAFT_KEY = "__new__";
/** Matches the workflow schema's default category. */
const DEFAULT_CATEGORY = "User-Created Workflows";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SubAgentSettings {
  forwardChatOutput: boolean;
  forwardStatusMessages: boolean;
  forwardSystemOutput: boolean;
  forwardHumanRequests: boolean;
  forwardReasoning: boolean;
  forwardInputCommands: boolean;
  timeout: number;
  maxResponseLength: number;
  minContextLength: number;
}

interface WorkflowDraft {
  displayName: string;
  category: string;
  description: string;
  agentType: string;
  steps: WorkflowStep[];
  subAgent: SubAgentSettings;
}

interface Workflow extends WorkflowDraft {
  name: string;
  updatedAt: string;
}

type WorkflowRunStatus = "starting" | "running" | "completed" | "failed" | "cancelled";

/** One tracked execution of a workflow, as reported by the backend's WorkflowState. */
interface WorkflowRun {
  id: string;
  workflowName: string;
  displayName: string;
  agentType: string;
  agentId: string | null;
  steps: WorkflowStep[];
  currentStep: number;
  status: WorkflowRunStatus;
  message: string;
  startedAt: number;
  finishedAt: number | null;
}

function isRunActive(run: WorkflowRun): boolean {
  return run.status === "starting" || run.status === "running";
}

function isRunFinished(run: WorkflowRun): boolean {
  return run.status === "completed" || run.status === "failed" || run.status === "cancelled";
}

/** Newest first; keeps active runs at the top, then finished by finish/start time. */
function sortRunsNewestFirst(runs: WorkflowRun[]): WorkflowRun[] {
  return [...runs].sort((a, b) => {
    const aActive = isRunActive(a);
    const bActive = isRunActive(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    const aTime = a.finishedAt ?? a.startedAt;
    const bTime = b.finishedAt ?? b.startedAt;
    return bTime - aTime;
  });
}

function runDurationLabel(run: WorkflowRun): string | null {
  if (run.finishedAt == null) return null;
  return formatDurationMs(Math.max(0, run.finishedAt - run.startedAt));
}

function toHistoryRunStatus(status: WorkflowRunStatus): HistoryRunStatus {
  if (status === "completed" || status === "failed" || status === "cancelled") return status;
  return "custom";
}

const RUN_STATUS_BADGES: Record<WorkflowRunStatus, StatusBadgeDefinition> = {
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
    icon: <X className="w-3 h-3" />,
    colorClass: "text-muted",
  },
};

function RunStatusBadge({ status }: { status: WorkflowRunStatus }) {
  return <StatusBadge status={status} statuses={RUN_STATUS_BADGES} variant="inline" />;
}

const DEFAULT_SUB_AGENT: SubAgentSettings = {
  forwardChatOutput: false,
  forwardStatusMessages: true,
  forwardSystemOutput: false,
  forwardHumanRequests: true,
  forwardReasoning: false,
  forwardInputCommands: true,
  timeout: 0,
  maxResponseLength: 10000,
  minContextLength: 1000,
};

const BOOLEAN_SUB_AGENT_FIELDS = [
  { key: "forwardChatOutput", label: "Forward chat output", hint: "Show the sub-agent's chat output in the parent agent" },
  { key: "forwardStatusMessages", label: "Forward status messages", hint: "Show status updates from the sub-agent" },
  { key: "forwardSystemOutput", label: "Forward system output", hint: "Show system messages from the sub-agent" },
  { key: "forwardHumanRequests", label: "Forward human requests", hint: "Relay questions the sub-agent asks a human" },
  { key: "forwardReasoning", label: "Forward reasoning", hint: "Show the sub-agent's reasoning output" },
  { key: "forwardInputCommands", label: "Forward input commands", hint: "Echo the commands sent to the sub-agent" },
] as const satisfies ReadonlyArray<{ key: keyof SubAgentSettings; label: string; hint: string }>;

const NUMBER_SUB_AGENT_FIELDS = [
  { key: "timeout", label: "Timeout", unit: "seconds", hint: "0 disables the timeout" },
  { key: "maxResponseLength", label: "Max response length", unit: "characters", hint: "Longest response forwarded to the parent" },
  { key: "minContextLength", label: "Min context length", unit: "characters", hint: "Context kept when trimming the sub-agent's history" },
] as const satisfies ReadonlyArray<{ key: keyof SubAgentSettings; label: string; unit: string; hint: string }>;

function emptyDraft(): WorkflowDraft {
  return {
    displayName: "",
    category: "",
    description: "",
    agentType: "",
    steps: [""],
    subAgent: { ...DEFAULT_SUB_AGENT },
  };
}

function toDraft(workflow: Workflow): WorkflowDraft {
  return {
    displayName: workflow.displayName,
    category: workflow.category,
    description: workflow.description,
    agentType: workflow.agentType,
    steps: workflow.steps.length > 0 ? [...workflow.steps] : [""],
    subAgent: { ...DEFAULT_SUB_AGENT, ...workflow.subAgent },
  };
}

/** Deep-ish copy of a draft so the clone can be edited independently of the source. */
function cloneDraft(draft: WorkflowDraft): WorkflowDraft {
  return {
    displayName: draft.displayName,
    category: draft.category,
    description: draft.description,
    agentType: draft.agentType,
    steps: draft.steps.map(step => (typeof step === "string" ? step : { command: step.command, arguments: { ...step.arguments }, remainder: step.remainder })),
    subAgent: { ...draft.subAgent },
  };
}

/** Picks a free file name for a clone of `baseName` (e.g. bugHunter → bugHunter-copy). */
function uniqueCloneName(baseName: string, existingNames: Iterable<string>): string {
  const taken = new Set(existingNames);
  const candidate = `${baseName}-copy`;
  if (!taken.has(candidate)) return candidate;
  let n = 2;
  while (taken.has(`${baseName}-copy${n}`)) n += 1;
  return `${baseName}-copy${n}`;
}

/** Drops blank steps so a stray editor row is never persisted, and fills in an empty category. */
function normalizeDraft(draft: WorkflowDraft): WorkflowDraft {
  return {
    ...draft,
    displayName: draft.displayName.trim(),
    category: draft.category.trim() || DEFAULT_CATEGORY,
    description: draft.description.trim(),
    steps: normalizeSteps(draft.steps),
  };
}

function isSameDraft(a: WorkflowDraft, b: WorkflowDraft): boolean {
  return JSON.stringify(normalizeDraft(a)) === JSON.stringify(normalizeDraft(b));
}

function matchesWorkflowFilter(workflow: Workflow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    workflow.displayName.toLowerCase().includes(q) ||
    workflow.name.toLowerCase().includes(q) ||
    workflow.description.toLowerCase().includes(q) ||
    workflow.category.toLowerCase().includes(q) ||
    workflow.agentType.toLowerCase().includes(q)
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

function WorkflowSidebar({
  workflows,
  isLoading,
  loadError,
  onRetryLoad,
  selectedName,
  creating,
  dirtyNames,
  activeRuns,
  recentFinishedRuns,
  launchingName,
  onSelect,
  onNew,
  onRun,
  onOpenAgent,
  onSelectRunWorkflow,
}: {
  workflows: Workflow[];
  isLoading: boolean;
  loadError: unknown;
  onRetryLoad: () => void;
  selectedName: string | null;
  creating: boolean;
  dirtyNames: Set<string>;
  activeRuns: WorkflowRun[];
  recentFinishedRuns: WorkflowRun[];
  launchingName: string | null;
  onSelect: (name: string) => void;
  onNew: () => void;
  onRun: (name: string) => void;
  onOpenAgent: (id: string) => void;
  onSelectRunWorkflow: (workflowName: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-secondary border-r border-primary">
      <NavigationSidebarHeader
        title="Workflows"
        actions={[
          {
            icon: <Plus className="w-3.5 h-3.5" />,
            label: "New workflow",
            title: "New workflow",
            onClick: onNew,
          },
        ]}
      />

      <div className="flex-1 overflow-y-auto">
        {activeRuns.length > 0 && (
          <div className="border-b border-primary/50">
            <span className="block px-3 pt-2.5 pb-1 text-xs font-bold text-amber-600 dark:text-amber-500/90 uppercase tracking-widest">Running</span>
            {activeRuns.map(run => (
              <button
                type="button"
                key={run.id}
                onClick={() => (run.agentId ? onOpenAgent(run.agentId) : onSelectRunWorkflow(run.workflowName))}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-hover transition-colors cursor-pointer focus-ring"
                aria-label={run.agentId ? `Open agent running ${run.displayName || run.workflowName}` : `View workflow ${run.displayName || run.workflowName}`}
                title={run.steps[run.currentStep] != null ? formatStepLabel(run.steps[run.currentStep]!) : ""}
              >
                <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-primary truncate">{run.displayName || run.workflowName}</div>
                  <div className="text-xs text-muted truncate">
                    {run.status === "starting"
                      ? "Starting agent…"
                      : `Step ${run.currentStep + 1} of ${run.steps.length}: ${run.steps[run.currentStep] != null ? formatStepLabel(run.steps[run.currentStep]!) : ""}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {recentFinishedRuns.length > 0 && (
          <div className="border-b border-primary/50">
            <span className="flex items-center gap-1 px-3 pt-2.5 pb-1 text-xs font-bold text-muted uppercase tracking-widest">
              <History className="w-3 h-3" /> Recent runs
            </span>
            {recentFinishedRuns.map(run => {
              const when = run.finishedAt ?? run.startedAt;
              return (
                <button
                  type="button"
                  key={run.id}
                  onClick={() => onSelectRunWorkflow(run.workflowName)}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-hover transition-colors cursor-pointer focus-ring"
                  aria-label={`View runs for ${run.displayName || run.workflowName}`}
                  title={run.message || undefined}
                >
                  <div className="mt-0.5 shrink-0">
                    {run.status === "completed" ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : run.status === "failed" ? (
                      <XCircle className="w-3 h-3 text-red-500" />
                    ) : (
                      <X className="w-3 h-3 text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-primary truncate">{run.displayName || run.workflowName}</div>
                    <div className="text-xs text-muted truncate">
                      {run.status} · {formatRelativeTime(when)}
                      {runDurationLabel(run) ? ` · ${runDurationLabel(run)}` : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {creating && (
          <div className="flex items-center gap-1.5 px-2 py-2 bg-accent-muted text-accent border-b border-primary/50">
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-xs font-medium">New workflow</span>
          </div>
        )}

        <SidebarCategoryAccordion
          className="py-2"
          items={workflows}
          getCategory={workflow => workflow.category || DEFAULT_CATEGORY}
          getItemKey={workflow => workflow.name}
          defaultCategory={DEFAULT_CATEGORY}
          isLoading={isLoading}
          error={loadError}
          search={{
            placeholder: "Filter workflows…",
            ariaLabel: "Filter workflows",
            clearAriaLabel: "Clear workflow filter",
            match: matchesWorkflowFilter,
          }}
          loadingState={
            <div className="px-3 py-6 flex justify-center">
              <Loader2 className="w-4 h-4 text-muted animate-spin" />
            </div>
          }
          errorState={<ErrorState title="Unable to load workflows" error={loadError} onRetry={onRetryLoad} />}
          emptyState={
            <div className="px-3 py-6 text-center">
              <GitBranch className="w-6 h-6 text-muted mx-auto mb-2 opacity-60" />
              <p className="text-xs text-muted">No workflows yet</p>
            </div>
          }
          noMatchState={query => <div className="px-3 py-4 text-center text-muted text-xs italic">No workflows match “{query}”</div>}
          renderItem={workflow => {
            const isSelected = selectedName === workflow.name && !creating;
            const isLaunching = launchingName === workflow.name;
            const hasActiveRun = activeRuns.some(run => run.workflowName === workflow.name);
            return (
              <ListItemWithActions
                id={workflow.name}
                selected={isSelected}
                onPrimary={() => onSelect(workflow.name)}
                alwaysShowAction={isSelected}
                primaryProps={{ title: workflow.displayName }}
                className={`gap-0.5 pl-5 pr-1.5 py-1 rounded-none ${isSelected ? "bg-accent-muted text-accent" : "text-primary"}`}
                action={
                  <LaunchButton
                    loading={isLaunching}
                    onClick={() => onRun(workflow.name)}
                    variant="icon"
                    iconSize="sm"
                    title={`Run ${workflow.displayName || workflow.name}`}
                    aria-label={`Run ${workflow.displayName || workflow.name}`}
                    bgClassName={isSelected ? "text-accent hover:bg-accent/15" : "text-muted hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-500/10"}
                  />
                }
              >
                <span className="flex items-center gap-1.5 py-0.5 min-w-0">
                  <GitBranch className="w-3 h-3 shrink-0 opacity-70" />
                  <span className="flex-1 min-w-0 truncate text-xs">{workflow.displayName || workflow.name}</span>
                  {hasActiveRun && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" title="Running" />}
                  {dirtyNames.has(workflow.name) && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Unsaved changes" />}
                </span>
              </ListItemWithActions>
            );
          }}
        />
      </div>
    </div>
  );
}

// ─── SubAgentSettingsEditor ────────────────────────────────────────────────────

function SubAgentSettingsEditor({ value, onChange }: { value: SubAgentSettings; onChange: (value: SubAgentSettings) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-primary rounded-xl bg-secondary/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-hover transition-colors cursor-pointer focus-ring"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />}
        <Settings2 className="w-3.5 h-3.5 text-muted shrink-0" />
        <span className="flex-1 text-xs font-medium text-primary">Sub-agent settings</span>
        <span className="text-xs text-muted">Used when this workflow is spawned from another agent</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-primary/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-2">
            {BOOLEAN_SUB_AGENT_FIELDS.map(field => (
              <label key={field.key} className="flex items-start gap-2 py-1 cursor-pointer" title={field.hint}>
                <input
                  type="checkbox"
                  checked={value[field.key] as boolean}
                  onChange={e => onChange({ ...value, [field.key]: e.target.checked })}
                  className="mt-0.5 accent-accent cursor-pointer"
                />
                <span className="text-xs text-secondary">{field.label}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {NUMBER_SUB_AGENT_FIELDS.map(field => (
              <div key={field.key} className="space-y-1">
                <label className="text-xs font-semibold text-muted uppercase tracking-wide" htmlFor={`sub-agent-${field.key}`}>
                  {field.label} <span className="font-normal lowercase tracking-normal">({field.unit})</span>
                </label>
                <input
                  id={`sub-agent-${field.key}`}
                  type="number"
                  min={0}
                  value={value[field.key] as number}
                  onChange={e => onChange({ ...value, [field.key]: Number(e.target.value) || 0 })}
                  title={field.hint}
                  className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-accent"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RunMonitor ────────────────────────────────────────────────────────────────

/** Live step checklist for an in-flight (or just-finished) run, plus open-agent action. */
function ActiveRunPanel({ run, onOpenAgent }: { run: WorkflowRun; onOpenAgent: (id: string) => void }) {
  const active = isRunActive(run);

  return (
    <div
      role="region"
      aria-label="Workflow run progress"
      className={`border rounded-xl overflow-hidden ${
        active
          ? "border-amber-500/40 bg-amber-500/5"
          : run.status === "completed"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : run.status === "failed"
              ? "border-red-500/30 bg-red-500/5"
              : "border-primary bg-secondary/40"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-primary/50">
        <RunStatusBadge status={run.status} />
        <span className="flex-1 min-w-0 text-xs text-muted truncate">
          {active
            ? run.status === "starting"
              ? "Spawning agent…"
              : `Step ${Math.min(run.currentStep + 1, run.steps.length)} of ${run.steps.length}`
            : run.message || run.status}
        </span>
        {run.agentId && (
          <button
            type="button"
            onClick={() => onOpenAgent(run.agentId!)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
          >
            <ExternalLink className="w-3 h-3" /> Open agent
          </button>
        )}
      </div>

      <ol className="px-3 py-2 space-y-1.5">
        {run.steps.map((step, index) => {
          let state: "done" | "current" | "pending" | "failed" | "cancelled" = "pending";
          // During "starting" the agent is still spawning — no step has begun yet.
          if (run.status === "starting") {
            state = "pending";
          } else if (run.status === "completed" || (isRunActive(run) && index < run.currentStep) || (isRunFinished(run) && index < run.currentStep)) {
            state = "done";
          } else if (isRunActive(run) && index === run.currentStep) {
            state = "current";
          } else if (isRunFinished(run) && index === run.currentStep) {
            state = run.status === "cancelled" ? "cancelled" : "failed";
          }

          return (
            <li key={index} className="flex items-start gap-2 min-w-0">
              <span className="mt-0.5 shrink-0">
                {state === "done" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : state === "current" ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                ) : state === "failed" ? (
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                ) : state === "cancelled" ? (
                  <X className="w-3.5 h-3.5 text-muted" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted/50" />
                )}
              </span>
              <span
                className={`flex-1 min-w-0 text-xs font-mono truncate ${
                  state === "current"
                    ? "text-primary font-medium"
                    : state === "done"
                      ? "text-muted"
                      : state === "failed"
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted/70"
                }`}
                title={formatStepLabel(step)}
              >
                <span className="text-muted mr-1.5 not-italic font-sans">{index + 1}.</span>
                {formatStepLabel(step)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function WorkflowRunHistory({
  runs,
  emptyMessage,
  onOpenAgent,
}: {
  runs: WorkflowRun[];
  /** Shown only when `runs` is empty. Pass null to render nothing in that case. */
  emptyMessage: string | null;
  onOpenAgent: (id: string) => void;
}) {
  if (runs.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className="border border-dashed border-primary rounded-xl px-3 py-4 text-center">
        <History className="w-5 h-5 text-muted mx-auto mb-1.5 opacity-50" />
        <p className="text-xs text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Workflow run history"
      className="border border-primary rounded-xl bg-secondary/40 overflow-hidden divide-y divide-primary/60"
    >
      {runs.map(run => {
        const when = run.finishedAt ?? run.startedAt;
        const duration = runDurationLabel(run);
        return (
          <HistoryRunRow
            key={run.id}
            id={run.id}
            status={toHistoryRunStatus(run.status)}
            statusLabel={run.status}
            statusBadge={<RunStatusBadge status={run.status} />}
            startTime={when}
            endTime={run.finishedAt ?? undefined}
            duration={duration ?? undefined}
            message={run.message}
            showIcon={false}
            showTimestamp={false}
            className="px-3 py-2.5"
            action={
              run.agentId ? (
                <button
                  type="button"
                  onClick={() => onOpenAgent(run.agentId!)}
                  className="p-1 text-muted hover:text-cyan-600 dark:hover:text-cyan-400 rounded transition-colors cursor-pointer focus-ring shrink-0"
                  title="Open agent"
                  aria-label="Open agent for this run"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : undefined
            }
          >
            {isRunActive(run) && run.steps.length > 0 ? (
              <p className="text-xs text-muted truncate">
                {run.status === "starting"
                  ? "Starting agent…"
                  : `Step ${run.currentStep + 1}/${run.steps.length}: ${run.steps[run.currentStep] != null ? formatStepLabel(run.steps[run.currentStep]!) : ""}`}
              </p>
            ) : null}
          </HistoryRunRow>
        );
      })}
    </div>
  );
}

// ─── WorkflowsEmptyState ───────────────────────────────────────────────────────

function WorkflowsEmptyState({ hasWorkflows, directory, onNew }: { hasWorkflows: boolean; directory: string | undefined; onNew: () => void }) {
  return (
    <EmptyState
      variant="page"
      className="bg-primary"
      icon={GitBranch}
      iconBadgeClassName="bg-linear-to-br from-cyan-500 to-blue-600"
      title={hasWorkflows ? "Select a workflow" : "No workflows yet"}
      hint={
        hasWorkflows
          ? "Pick a workflow from the list to view its steps and settings, edit it, or launch it on a new agent."
          : "Workflows are ordered lists of commands run by an agent. Create one to get started."
      }
      ctaLabel="New workflow"
      onCta={onNew}
    >
      {directory && (
        <p className="text-xs text-muted mt-2">
          Stored as YAML files in <code className="font-mono text-secondary">{directory}</code>
        </p>
      )}
    </EmptyState>
  );
}

// ─── WorkflowEditor ────────────────────────────────────────────────────────────

function WorkflowEditor({
  workflowName,
  creating,
  nameValue,
  onNameChange,
  draft,
  onDraftChange,
  savedWorkflow,
  isDirty,
  activeRun,
  workflowRuns,
  categories,
  agentTypes,
  commands,
  saving,
  launching,
  onSave,
  onRevert,
  onDelete,
  onClone,
  onLaunch,
  onCancelCreate,
  onOpenAgent,
}: {
  workflowName: string | null;
  creating: boolean;
  nameValue: string;
  onNameChange: (value: string) => void;
  draft: WorkflowDraft;
  onDraftChange: (draft: WorkflowDraft) => void;
  savedWorkflow: Workflow | null;
  isDirty: boolean;
  activeRun: WorkflowRun | null;
  /** All tracked runs for this workflow (active + finished), newest first. */
  workflowRuns: WorkflowRun[];
  categories: string[];
  agentTypes: { type: string; displayName: string; category?: string }[];
  commands: AvailableAgentCommand[];
  saving: boolean;
  launching: boolean;
  onSave: () => void;
  onRevert: () => void;
  onDelete: () => void;
  onClone: () => void;
  onLaunch: () => void;
  onCancelCreate: () => void;
  onOpenAgent: (id: string) => void;
}) {
  const trimmedName = nameValue.trim();
  const nameError = creating && trimmedName !== "" && !NAME_PATTERN.test(trimmedName);
  const hasSteps = draft.steps.some(isStepFilled);
  const canSave =
    !saving && draft.displayName.trim() !== "" && draft.agentType.trim() !== "" && hasSteps && (creating ? NAME_PATTERN.test(trimmedName) : isDirty);
  const unknownAgentType = draft.agentType !== "" && agentTypes.length > 0 && !agentTypes.some(a => a.type === draft.agentType);

  const title = creating ? "New workflow" : draft.displayName || workflowName || "";
  // Prefer the live run; otherwise feature the most recent finished run with its step checklist.
  const featuredRunId = activeRun?.id ?? (workflowRuns[0] && isRunFinished(workflowRuns[0]) ? workflowRuns[0]!.id : null);
  const featuredRun = featuredRunId ? (activeRun ?? workflowRuns.find(run => run.id === featuredRunId) ?? null) : null;
  const historyRuns = useMemo(() => workflowRuns.filter(run => run.id !== featuredRunId).slice(0, 10), [workflowRuns, featuredRunId]);

  return (
    <div className="h-full flex flex-col bg-primary">
      <AppPageHeader
        title={title}
        subtitle={
          creating ? (
            "Define the steps this workflow runs"
          ) : (
            <span className="flex items-center gap-2 flex-wrap">
              <code className="font-mono">{workflowName}.yaml</code>
              {savedWorkflow && <span className="text-muted">· updated {new Date(savedWorkflow.updatedAt).toLocaleString()}</span>}
              {isDirty && <span className="text-amber-600 dark:text-amber-500 font-medium">· unsaved changes</span>}
              {activeRun && (
                <span className="text-amber-600 dark:text-amber-500 font-medium">
                  · {activeRun.status === "starting" ? "starting agent…" : `running step ${activeRun.currentStep + 1} of ${activeRun.steps.length}`}
                </span>
              )}
            </span>
          )
        }
        icon={<GitBranch />}
        iconGradient="from-cyan-500 to-blue-600"
        size="compact"
      >
        {creating ? (
          <button
            type="button"
            onClick={onCancelCreate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        ) : (
          <>
            {activeRun?.agentId && (
              <button
                type="button"
                onClick={() => onOpenAgent(activeRun.agentId!)}
                title="Open the agent running this workflow"
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open agent
              </button>
            )}
            <LaunchButton loading={launching} onClick={onLaunch} title="Run this workflow on a new agent" bgClassName="bg-cyan-600 hover:bg-cyan-500" />
            <button
              type="button"
              onClick={onClone}
              title="Clone this workflow as a new draft"
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
            >
              <Copy className="w-3.5 h-3.5" /> Clone
            </button>
            <button
              type="button"
              onClick={onRevert}
              disabled={!isDirty}
              title="Discard unsaved changes"
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Revert
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete this workflow"
              className="p-1.5 text-muted hover:text-red-500 border border-primary rounded-lg transition-colors cursor-pointer focus-ring"
              aria-label="Delete workflow"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {creating ? "Create" : "Save"}
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-5">
          {!creating && (
            <section className="space-y-2" aria-label="Run monitoring">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">Runs</span>
                <span className="text-xs text-muted">Live progress and recent history</span>
              </div>
              {featuredRun && <ActiveRunPanel run={featuredRun} onOpenAgent={onOpenAgent} />}
              <WorkflowRunHistory
                runs={historyRuns}
                emptyMessage={featuredRun ? null : "No runs yet for this workflow. Launch it to see progress here."}
                onOpenAgent={onOpenAgent}
              />
            </section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="workflow-name" className="text-xs font-semibold text-muted uppercase tracking-wide">
                Name {creating ? "" : "(file name, fixed)"}
              </label>
              <input
                id="workflow-name"
                type="text"
                value={creating ? nameValue : (workflowName ?? "")}
                onChange={e => onNameChange(e.target.value)}
                disabled={!creating}
                placeholder="myWorkflow"
                spellCheck={false}
                className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs font-mono text-primary placeholder-muted focus-accent disabled:opacity-60 disabled:cursor-not-allowed"
              />
              {nameError && <p className="text-xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="workflow-display-name" className="text-xs font-semibold text-muted uppercase tracking-wide">
                Display name
              </label>
              <input
                id="workflow-display-name"
                type="text"
                value={draft.displayName}
                onChange={e => onDraftChange({ ...draft, displayName: e.target.value })}
                placeholder="All-Package Bug Hunter"
                className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="workflow-category" className="text-xs font-semibold text-muted uppercase tracking-wide">
                Category
              </label>
              <input
                id="workflow-category"
                type="text"
                list="workflow-category-options"
                value={draft.category}
                onChange={e => onDraftChange({ ...draft, category: e.target.value })}
                placeholder={DEFAULT_CATEGORY}
                className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
              />
              <datalist id="workflow-category-options">
                {categories.map(category => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label htmlFor="workflow-agent-type" className="text-xs font-semibold text-muted uppercase tracking-wide">
                Agent type
              </label>
              <select
                id="workflow-agent-type"
                value={draft.agentType}
                onChange={e => onDraftChange({ ...draft, agentType: e.target.value })}
                className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-accent cursor-pointer"
              >
                <option value="">Select an agent type…</option>
                {unknownAgentType && <option value={draft.agentType}>{draft.agentType} (not installed)</option>}
                {agentTypes.map(agentType => (
                  <option key={agentType.type} value={agentType.type}>
                    {agentType.displayName} ({agentType.type})
                  </option>
                ))}
              </select>
              {unknownAgentType && (
                <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                  <TriangleAlert className="w-3 h-3 shrink-0" /> This agent type is not currently configured.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="workflow-description" className="text-xs font-semibold text-muted uppercase tracking-wide">
              Description
            </label>
            <AutoResizeTextarea
              id="workflow-description"
              value={draft.description}
              onChange={e => onDraftChange({ ...draft, description: e.target.value })}
              minRows={2}
              maxRows={20}
              placeholder="What this workflow does"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Steps</span>
              <span className="text-xs text-muted">Chat messages or structured agent commands</span>
            </div>
            <StepEditor steps={draft.steps} onChange={steps => onDraftChange({ ...draft, steps })} commands={commands} />
            {!hasSteps && <p className="text-xs text-red-500">Add at least one step.</p>}
          </div>

          <SubAgentSettingsEditor value={draft.subAgent} onChange={subAgent => onDraftChange({ ...draft, subAgent })} />
        </div>
      </div>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export default function WorkflowsApp() {
  const navigate = useNavigate();
  const { workflowName: routeWorkflowName } = useParams<{ workflowName?: string }>();
  const workflows = useWorkflows();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const availableCommands = useAvailableCommands();
  const workflowRuns = useWorkflowRuns();
  const workflowDirectory = useTypedSWR("/workflow/getWorkflowDirectory", () => workflowRPCClient.getWorkflowDirectory({}));
  const commandList = useMemo(() => availableCommands.data ?? [], [availableCommands.data]);

  const [drafts, setDrafts] = useState<Record<string, WorkflowDraft>>({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const workflowList = (workflows.data ?? []) as Workflow[];
  const selectedWorkflow = useMemo(
    () => (routeWorkflowName ? (workflowList.find(w => w.name === routeWorkflowName) ?? null) : null),
    [workflowList, routeWorkflowName],
  );

  const categories = useMemo(() => [...new Set(workflowList.map(w => w.category).filter(Boolean))].sort(), [workflowList]);

  const allRuns = useMemo(() => sortRunsNewestFirst((workflowRuns.data?.runs ?? []) as WorkflowRun[]), [workflowRuns.data]);
  const activeRuns = useMemo(() => allRuns.filter(isRunActive), [allRuns]);
  const recentFinishedRuns = useMemo(() => allRuns.filter(isRunFinished).slice(0, 8), [allRuns]);
  const selectedWorkflowRuns = useMemo(
    () => (selectedWorkflow ? allRuns.filter(run => run.workflowName === selectedWorkflow.name) : []),
    [allRuns, selectedWorkflow],
  );

  const dirtyNames = useMemo(() => {
    const names = new Set<string>();
    for (const workflow of workflowList) {
      const draft = drafts[workflow.name];
      if (draft && !isSameDraft(draft, toDraft(workflow))) names.add(workflow.name);
    }
    return names;
  }, [drafts, workflowList]);

  // A route pointing at a workflow that no longer exists (deleted elsewhere, bad deep-link) resets to the empty state.
  useStaleRouteRedirect({
    routeParam: routeWorkflowName,
    entity: selectedWorkflow,
    isLoading: workflows.isLoading,
    hasError: !!workflows.error,
    navigate,
    fallbackPath: "/workflows",
    entityLabel: "Workflow",
  });

  const draftKey = creating ? NEW_DRAFT_KEY : (selectedWorkflow?.name ?? null);
  const savedDraft = useMemo(() => (creating ? emptyDraft() : selectedWorkflow ? toDraft(selectedWorkflow) : null), [creating, selectedWorkflow]);
  const draft = draftKey !== null ? (drafts[draftKey] ?? savedDraft) : null;
  const isDirty = draft !== null && savedDraft !== null && !isSameDraft(draft, savedDraft);

  const setDraft = useCallback(
    (next: WorkflowDraft) => {
      if (draftKey === null) return;
      setDrafts(prev => ({ ...prev, [draftKey]: next }));
    },
    [draftKey],
  );

  const clearDraft = useCallback((key: string) => {
    setDrafts(prev => {
      if (!(key in prev)) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleSelect = useCallback(
    (name: string) => {
      setCreating(false);
      void navigate(`/workflows/${encodeURIComponent(name)}`);
    },
    [navigate],
  );

  // Keeps any in-progress new-workflow draft (including its name) so switching away and back doesn't lose it.
  const handleNew = useCallback(() => {
    setCreating(true);
    void navigate("/workflows");
  }, [navigate]);

  const handleCancelCreate = useCallback(() => {
    setCreating(false);
    clearDraft(NEW_DRAFT_KEY);
    setNewName("");
    void navigate("/workflows", { replace: true });
  }, [clearDraft, navigate]);

  /** Opens the create form pre-filled from the currently viewed workflow (including unsaved edits). */
  const handleClone = useCallback(() => {
    if (!draft || !selectedWorkflow) return;
    const cloned = cloneDraft(draft);
    const baseDisplay = cloned.displayName.trim();
    cloned.displayName = baseDisplay ? `${baseDisplay} (copy)` : "";
    const name = uniqueCloneName(
      selectedWorkflow.name,
      workflowList.map(workflow => workflow.name),
    );
    setDrafts(prev => ({ ...prev, [NEW_DRAFT_KEY]: cloned }));
    setNewName(name);
    setCreating(true);
    void navigate("/workflows");
  }, [draft, navigate, selectedWorkflow, workflowList]);

  const refreshWorkflows = useCallback(() => {
    // List refresh is best-effort; a failed revalidate must not undo a successful save/delete.
    toastOnReject(Promise.resolve(workflows.mutate()), {
      message: err => `Failed to refresh workflow list: ${formatError(err)}`,
      duration: 4000,
    });
  }, [workflows]);

  const entityDelete = useEntityDelete({
    currentRouteId: routeWorkflowName ?? null,
    navigateToOverview: () => void navigate("/workflows"),
    refreshList: refreshWorkflows,
    clearLocalState: clearDraft,
    successMessage: name => `Workflow "${name}" deleted`,
  });

  const handleSave = useCallback(async () => {
    if (!draft) return;
    const name = creating ? newName.trim() : (selectedWorkflow?.name ?? "");
    if (!name) return;
    if (creating && !NAME_PATTERN.test(name)) return;
    if (creating && workflowList.some(workflow => workflow.name === name)) {
      toastManager.error(`A workflow named "${name}" already exists`, { duration: 4000 });
      return;
    }

    setSaving(true);
    try {
      const payload = normalizeDraft(draft);
      if (creating) {
        await workflowRPCClient.createWorkflow({ name, workflow: payload });
      } else {
        await workflowRPCClient.updateWorkflow({ name, workflow: payload });
      }
      // RPC succeeded — clear draft and navigate before revalidating the list.
      clearDraft(creating ? NEW_DRAFT_KEY : name);
      if (creating) {
        setCreating(false);
        setNewName("");
        void navigate(`/workflows/${encodeURIComponent(name)}`);
      }
      toastManager.success(`Workflow "${name}" saved`, { duration: 3000 });
      refreshWorkflows();
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }, [clearDraft, creating, draft, navigate, newName, refreshWorkflows, selectedWorkflow, workflowList]);

  const handleDelete = useCallback(
    async (name: string) => {
      setDeleteTarget(null);
      await entityDelete.deleteEntity(name, name, async () => {
        const { success } = await workflowRPCClient.deleteWorkflow({ name });
        if (!success) throw new Error(`Workflow "${name}" could not be deleted`);
      });
    },
    [entityDelete],
  );

  const handleLaunch = useCallback(
    async (name: string) => {
      setLaunching(name);
      try {
        const { id } = await workflowRPCClient.spawnWorkflow({ name, headless: false });
        // Refresh the agent list in the background; don't block navigation if reconnect is slow.
        toastOnReject(Promise.resolve(agents.mutate()), {
          message: err => `Failed to refresh agent list: ${formatError(err)}`,
          duration: 4000,
        });
        void navigate(`/agent/${id}`);
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setLaunching(null);
      }
    },
    [agents, navigate],
  );

  const openAgent = useCallback(
    (id: string) => {
      void navigate(`/agent/${id}`);
    },
    [navigate],
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <WorkspaceShell
        appId="workflows"
        title="Workflows"
        navigationLabel="Workflows and runs"
        hasSelection={creating || selectedWorkflow !== null}
        className="flex-1"
        navigation={
          <WorkflowSidebar
            workflows={workflowList}
            isLoading={workflows.isLoading}
            loadError={workflows.error}
            onRetryLoad={() => void workflows.mutate()}
            selectedName={selectedWorkflow?.name ?? null}
            creating={creating}
            dirtyNames={dirtyNames}
            activeRuns={activeRuns}
            recentFinishedRuns={recentFinishedRuns}
            launchingName={launching}
            onSelect={handleSelect}
            onNew={handleNew}
            onRun={name => void handleLaunch(name)}
            onOpenAgent={openAgent}
            onSelectRunWorkflow={handleSelect}
          />
        }
      >
        {draft && (creating || selectedWorkflow) ? (
          <WorkflowEditor
            workflowName={creating ? null : (selectedWorkflow?.name ?? null)}
            creating={creating}
            nameValue={newName}
            onNameChange={setNewName}
            draft={draft}
            onDraftChange={setDraft}
            savedWorkflow={creating ? null : selectedWorkflow}
            isDirty={isDirty}
            activeRun={creating ? null : (activeRuns.find(run => run.workflowName === selectedWorkflow?.name) ?? null)}
            workflowRuns={creating ? [] : selectedWorkflowRuns}
            categories={categories}
            agentTypes={agentTypes.data ?? []}
            commands={commandList}
            saving={saving}
            launching={launching === selectedWorkflow?.name}
            onSave={() => void handleSave()}
            onRevert={() => draftKey !== null && clearDraft(draftKey)}
            onDelete={() => selectedWorkflow && setDeleteTarget(selectedWorkflow.name)}
            onClone={handleClone}
            onLaunch={() => selectedWorkflow && void handleLaunch(selectedWorkflow.name)}
            onCancelCreate={handleCancelCreate}
            onOpenAgent={openAgent}
          />
        ) : workflows.isLoading && workflowList.length === 0 ? (
          <div className="h-full flex flex-col bg-primary">
            <LoadingState message="Loading workflows…" className="flex-1" />
          </div>
        ) : workflows.error && workflowList.length === 0 ? (
          <ErrorState title="Unable to load workflows" error={workflows.error} onRetry={() => void workflows.mutate()} variant="page" />
        ) : (
          <WorkflowsEmptyState hasWorkflows={workflowList.length > 0} directory={workflowDirectory.data?.directory} onNew={handleNew} />
        )}
      </WorkspaceShell>

      {deleteTarget && (
        <ConfirmModal
          title="Delete workflow"
          message={`Delete "${deleteTarget}"? Its YAML file will be removed from disk.`}
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          closeOnBackdrop
        />
      )}
    </div>
  );
}
