import { type ConfigScope, configScopeLabels } from "@tokenring-ai/app/config/scopes";
import formatError from "@tokenring-ai/utility/error/formatError";
import { isPlainObject } from "@tokenring-ai/utility/object/isPlainObject";
import { ChevronRight, Loader2, Plus, SlidersHorizontal, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDebounce } from "../hooks/useDebounce.ts";
import { formatConfigIssues, updateConfigLayer } from "../lib/configWrites.ts";
import { isAdminRequiredError } from "../lib/rpcErrors.ts";
import { cn } from "../lib/utils.ts";
import { useChatModelsByProvider, useConfigValues, useToolApprovalLevels } from "../rpc.ts";
import SegmentedControl from "../ui/segmented-control.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx";
import EnableToggle from "./ui/EnableToggle.tsx";
import { toastManager } from "./ui/toast.tsx";

export const CHAT_CONFIG_HREF = `/configuration/${encodeURIComponent("@tokenring-ai/chat")}`;

type ToolApprovalMode = "ask" | "reject" | "auto";
type CompactionPolicy = "automatic" | "ask" | "never";

type ChatPatch = {
  defaultModels?: string[];
  defaultTranscriptionModels?: string[];
  agentDefaults?: Record<string, unknown>;
};

const COMPACTION_POLICIES: { value: CompactionPolicy; label: string }[] = [
  { value: "automatic", label: "Auto" },
  { value: "ask", label: "Ask" },
  { value: "never", label: "Never" },
];

const APPROVAL_MODES: { value: ToolApprovalMode; label: string }[] = [
  { value: "ask", label: "Ask" },
  { value: "reject", label: "Reject" },
  { value: "auto", label: "Auto" },
];

/** Level 0 is not part of the server's 1–10 classification scale; it means "approve nothing automatically". */
const LEVEL_ZERO_DESCRIPTION = "Nothing goes ahead without asking, every action uses the choice above";

const inputClass = "px-2 py-1.5 bg-tertiary border border-control rounded-lg text-xs text-primary placeholder:text-muted focus-ring min-w-0 w-full";

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Merge a chat-slice patch onto one override layer without clobbering sibling keys. */
export function mergeChatOverrides(overrides: Record<string, unknown>, patch: ChatPatch): Record<string, unknown> {
  const chat = { ...asRecord(overrides.chat) };

  if (patch.defaultModels !== undefined) chat.defaultModels = patch.defaultModels;
  if (patch.defaultTranscriptionModels !== undefined) chat.defaultTranscriptionModels = patch.defaultTranscriptionModels;

  if (patch.agentDefaults) {
    const agentDefaults = { ...asRecord(chat.agentDefaults) };
    for (const [key, value] of Object.entries(patch.agentDefaults)) {
      if (key === "compaction" && isPlainObject(value)) {
        const compaction = { ...asRecord(agentDefaults.compaction), ...value };
        for (const [compactionKey, compactionValue] of Object.entries(compaction)) {
          if (compactionValue === undefined) delete compaction[compactionKey];
        }
        agentDefaults.compaction = compaction;
      } else if (value === undefined) {
        delete agentDefaults[key];
      } else {
        agentDefaults[key] = value;
      }
    }
    chat.agentDefaults = agentDefaults;
  }

  return { ...overrides, chat };
}

function SettingsRow({
  title,
  description,
  children,
  stacked = false,
  border = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  stacked?: boolean;
  border?: boolean;
}) {
  return (
    <div className={cn("flex gap-3 px-3 py-2.5", stacked ? "flex-col" : "items-center justify-between", border && "border-b border-primary")}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary">{title}</p>
        {description ? <p className="text-xs text-muted mt-0.5">{description}</p> : null}
      </div>
      <div className={cn(stacked ? "w-full" : "shrink-0")}>{children}</div>
    </div>
  );
}

function ModelSelect({
  value,
  modelsByProvider,
  onChange,
  ariaLabel,
}: {
  value: string | undefined;
  modelsByProvider: Record<string, Record<string, { available: boolean }>>;
  onChange: (next: string | undefined) => void;
  ariaLabel: string;
}) {
  const providers = Object.keys(modelsByProvider).sort();
  const knownIds = new Set(providers.flatMap(provider => Object.keys(modelsByProvider[provider] ?? {})));
  const includeCurrent = value !== undefined && !knownIds.has(value);

  return (
    <select
      className={cn(inputClass, "cursor-pointer")}
      value={value ?? ""}
      onChange={event => onChange(event.target.value === "" ? undefined : event.target.value)}
      aria-label={ariaLabel}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      <option value="">(not set)</option>
      {includeCurrent ? <option value={value}>{value}</option> : null}
      {providers.map(provider => (
        <optgroup key={provider} label={provider}>
          {Object.keys(modelsByProvider[provider] ?? {})
            .sort()
            .map(modelId => (
              <option key={modelId} value={modelId}>
                {modelId.split("/").pop() ?? modelId}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

function DebouncedNumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  placeholder,
  ariaLabel,
  unit,
  emptyAs = "clear",
}: {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
  ariaLabel: string;
  unit?: string;
  emptyAs?: "clear" | 0;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");
  const [dirty, setDirty] = useState(false);
  const debounced = useDebounce(text, 400);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (!dirty) setText(value != null ? String(value) : "");
  }, [value, dirty]);

  const commit = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") {
        onCommitRef.current(emptyAs === 0 ? 0 : undefined);
        return;
      }
      const next = Number(trimmed);
      if (Number.isNaN(next)) return;
      onCommitRef.current(next);
    },
    [emptyAs],
  );

  useEffect(() => {
    if (!dirty) return;
    commit(debounced);
  }, [commit, debounced, dirty]);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        className={cn(inputClass, "sm:w-24")}
        value={text}
        min={min}
        max={max}
        step={step ?? "any"}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={event => {
          setDirty(true);
          setText(event.target.value);
        }}
        onBlur={() => {
          commit(text);
          setDirty(false);
        }}
        onPointerDown={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}
      />
      {unit ? <span className="text-xs text-muted">{unit}</span> : null}
    </div>
  );
}

function BlurTextInput({
  value,
  onCommit,
  placeholder,
  ariaLabel,
}: {
  value: string | undefined;
  onCommit: (next: string | undefined) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [text, setText] = useState(value ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setText(value ?? "");
  }, [value, dirty]);

  return (
    <input
      type="text"
      className={inputClass}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={event => {
        setDirty(true);
        setText(event.target.value);
      }}
      onBlur={() => {
        const next = text.trim() === "" ? undefined : text.trim();
        if (next !== value) onCommit(next);
        setDirty(false);
      }}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    />
  );
}

function StringListField({
  items,
  onChange,
  ariaLabel,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [pending, setPending] = useState("");

  const addPending = () => {
    const trimmed = pending.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setPending("");
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center gap-1">
        <input
          type="text"
          className={cn(inputClass, "flex-1")}
          value={pending}
          placeholder={placeholder ?? "Add item…"}
          aria-label={ariaLabel}
          onChange={event => setPending(event.target.value)}
          onKeyDown={event => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              addPending();
            }
          }}
          onPointerDown={event => event.stopPropagation()}
        />
        <button type="button" onClick={addPending} className="p-1.5 text-muted hover:text-primary cursor-pointer focus-ring rounded-md" aria-label="Add item">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {items.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-tertiary border border-primary rounded-full text-secondary font-mono"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                className="text-muted hover:text-red-400 cursor-pointer"
                aria-label={`Remove ${item}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ChatSettingsDropdown() {
  const values = useConfigValues();
  const modelsData = useChatModelsByProvider();
  const approvalLevels = useToolApprovalLevels();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ConfigScope>("workspace");
  const [pending, setPending] = useState(false);
  const writeChain = useRef(Promise.resolve());

  const chat = asRecord(values.data?.effective.chat);
  const agentDefaults = asRecord(chat.agentDefaults);
  const compaction = asRecord(agentDefaults.compaction);
  const overrides = values.data?.overrides;
  const workspaceHasChat = overrides ? "chat" in asRecord(overrides.workspace) : false;
  const globalHasChat = overrides ? "chat" in asRecord(overrides.global) : false;

  const model = asOptionalString(agentDefaults.model);
  const transcriptionModel = asOptionalString(agentDefaults.transcriptionModel);
  const parallelTools = asBoolean(agentDefaults.parallelTools, false);
  const allowRemoteAttachments = asBoolean(agentDefaults.allowRemoteAttachments, true);
  const maxSteps = asOptionalNumber(agentDefaults.maxSteps) ?? 0;
  const maxCost = asOptionalNumber(agentDefaults.maxCost);
  const maxRuntime = asOptionalNumber(agentDefaults.maxRuntime);
  const maxInputTokens = asOptionalNumber(agentDefaults.maxInputTokens);
  const maxOutputTokens = asOptionalNumber(agentDefaults.maxOutputTokens);
  const autoToolApprovalLevel = asOptionalNumber(agentDefaults.autoToolApprovalLevel) ?? 6;
  const toolApprovalMode: ToolApprovalMode =
    agentDefaults.toolApprovalMode === "ask" || agentDefaults.toolApprovalMode === "reject" || agentDefaults.toolApprovalMode === "auto"
      ? agentDefaults.toolApprovalMode
      : "auto";
  const compactionPolicy: CompactionPolicy =
    compaction.policy === "automatic" || compaction.policy === "ask" || compaction.policy === "never" ? compaction.policy : "ask";
  const compactionThreshold = asOptionalNumber(compaction.compactionThreshold) ?? 0.5;
  const applyThreshold = asOptionalNumber(compaction.applyThreshold);
  const compactionBackground = asBoolean(compaction.background, false);
  const defaultModels = asStringArray(chat.defaultModels);
  const defaultTranscriptionModels = asStringArray(chat.defaultTranscriptionModels);

  const modelsByProvider = modelsData.data?.modelsByProvider ?? {};
  const levels = useMemo(() => [{ level: 0, description: LEVEL_ZERO_DESCRIPTION }, ...(approvalLevels.data?.levels ?? [])], [approvalLevels.data?.levels]);
  const currentLevelDescription = levels.find(level => level.level === autoToolApprovalLevel)?.description;

  const applyPatch = useCallback(
    (patch: ChatPatch) => {
      const run = async () => {
        setPending(true);
        try {
          const result = await updateConfigLayer(scope, current => mergeChatOverrides(current, patch));
          if (!result.ok) {
            toastManager.error(formatConfigIssues(result.issues), { duration: 6000 });
            return;
          }
          await values.mutate();
        } catch (error: unknown) {
          toastManager.error(formatError(error), { duration: 5000 });
        } finally {
          setPending(false);
        }
      };
      writeChain.current = writeChain.current.then(run, run);
      return writeChain.current;
    },
    [scope, values],
  );

  const setAgentDefault = useCallback((key: string, value: unknown) => void applyPatch({ agentDefaults: { [key]: value } }), [applyPatch]);

  // Reading and changing these defaults are administrator-only: a member would see invented defaults and fail on every change.
  if (isAdminRequiredError(values.error)) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 p-2 rounded-md hover:bg-hover transition-colors focus-ring cursor-pointer text-muted hover:text-primary"
          aria-label="Chat defaults"
          title="Chat defaults for new agents"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />}
          <span className="hidden md:block text-xs font-medium">Chat</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        role="dialog"
        aria-label="Chat default settings"
        align="end"
        className="p-0 overflow-hidden flex flex-col bg-secondary border-primary shadow-card"
        style={{ width: "400px", maxHeight: "min(32rem, calc(100dvh - 4rem))" }}
        onCloseAutoFocus={event => event.preventDefault()}
      >
        <div className="flex items-start justify-between gap-3 px-3 pt-3 pb-2 shrink-0 border-b border-primary">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">Chat defaults</p>
            <p className="text-xs text-muted mt-0.5">Applies to new agents</p>
          </div>
          <SegmentedControl value={scope} onChange={setScope} options={configScopesAsOptions} ariaLabel="Configuration scope" />
        </div>

        {scope === "global" && workspaceHasChat ? (
          <p className="px-3 py-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border-b border-primary" role="status">
            Workspace configuration overrides these values
          </p>
        ) : null}
        {scope === "workspace" && !workspaceHasChat && globalHasChat ? (
          <p className="px-3 py-2 text-xs text-muted border-b border-primary" role="status">
            Saving here overrides {configScopeLabels.global.toLowerCase()} chat settings for this workspace
          </p>
        ) : null}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <SettingsRow title="Default model" description="Model new agents use by default" stacked>
            <ModelSelect value={model} modelsByProvider={modelsByProvider} onChange={next => setAgentDefault("model", next)} ariaLabel="Default model" />
          </SettingsRow>

          <SettingsRow title="Compaction" description="When to compact long conversation history">
            <SegmentedControl
              value={compactionPolicy}
              onChange={next => void applyPatch({ agentDefaults: { compaction: { policy: next } } })}
              options={COMPACTION_POLICIES}
              ariaLabel="Compaction policy"
            />
          </SettingsRow>

          <SettingsRow title="When an action needs approval" description="What to do with actions above the safety level set below">
            <SegmentedControl
              value={toolApprovalMode}
              onChange={next => setAgentDefault("toolApprovalMode", next)}
              options={APPROVAL_MODES}
              ariaLabel="When an action needs approval"
            />
          </SettingsRow>

          <SettingsRow
            title="Go ahead without asking, up to safety level"
            description={currentLevelDescription ?? "Actions at or below this safety level (0–10) go ahead without asking"}
            stacked
          >
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={autoToolApprovalLevel}
                onChange={event => setAgentDefault("autoToolApprovalLevel", Number(event.target.value))}
                aria-label="Go ahead without asking up to this safety level"
                className="flex-1 cursor-pointer"
              />
              <span className="text-xs font-mono tabular-nums text-secondary w-6 text-right">{autoToolApprovalLevel}</span>
            </div>
          </SettingsRow>

          <SettingsRow title="Parallel tools" description="Allow tools to be executed in parallel">
            <EnableToggle
              enabled={parallelTools}
              onToggle={() => setAgentDefault("parallelTools", !parallelTools)}
              itemName="parallel tool execution"
              size="sm"
            />
          </SettingsRow>

          <SettingsRow title="Remote attachments" description="Allow agents to fetch attachments from remote URLs">
            <EnableToggle
              enabled={allowRemoteAttachments}
              onToggle={() => setAgentDefault("allowRemoteAttachments", !allowRemoteAttachments)}
              itemName="remote attachments"
              size="sm"
            />
          </SettingsRow>

          <SettingsRow title="Max cost" description="Maximum estimated cost in USD per turn; empty is unlimited">
            <DebouncedNumberInput
              value={maxCost}
              onCommit={next => setAgentDefault("maxCost", next)}
              min={0}
              placeholder="∞"
              ariaLabel="Maximum cost per turn"
              unit="USD"
            />
          </SettingsRow>

          <SettingsRow title="Max steps" description="Maximum tool-call steps per turn (0 = unlimited)">
            <DebouncedNumberInput
              value={maxSteps}
              onCommit={next => setAgentDefault("maxSteps", next ?? 0)}
              min={0}
              step={1}
              placeholder="0"
              ariaLabel="Maximum tool-call steps per turn"
              emptyAs={0}
            />
          </SettingsRow>

          <SettingsRow title="Max runtime" description="Maximum runtime in seconds per turn; empty is unlimited" border={false}>
            <DebouncedNumberInput
              value={maxRuntime}
              onCommit={next => setAgentDefault("maxRuntime", next)}
              min={0}
              step={1}
              placeholder="∞"
              ariaLabel="Maximum runtime per turn"
              unit="s"
            />
          </SettingsRow>

          <details className="group/adv border-t border-primary">
            <summary className="flex items-center gap-1 text-xs font-semibold text-muted uppercase tracking-widest cursor-pointer select-none px-3 py-2">
              <ChevronRight className="w-3 h-3 transition-transform group-open/adv:rotate-90" />
              Advanced
            </summary>
            <div className="border-t border-primary">
              <SettingsRow title="Model fallback chain" description="Tried when no model is specified" stacked>
                <StringListField
                  items={defaultModels}
                  onChange={next => void applyPatch({ defaultModels: next })}
                  ariaLabel="Add default model pattern"
                  placeholder="provider/model or pattern"
                />
              </SettingsRow>

              <SettingsRow title="Transcription model" description="Model used to transcribe audio attachments" stacked>
                <BlurTextInput
                  value={transcriptionModel}
                  onCommit={next => setAgentDefault("transcriptionModel", next)}
                  placeholder="(not set)"
                  ariaLabel="Transcription model"
                />
              </SettingsRow>

              <SettingsRow title="Transcription fallback chain" description="Transcription model fallback chain" stacked>
                <StringListField
                  items={defaultTranscriptionModels}
                  onChange={next => void applyPatch({ defaultTranscriptionModels: next })}
                  ariaLabel="Add transcription model pattern"
                  placeholder="provider/model or pattern"
                />
              </SettingsRow>

              <SettingsRow title="Max input tokens" description="Cumulative input tokens per turn; empty is unlimited">
                <DebouncedNumberInput
                  value={maxInputTokens}
                  onCommit={next => setAgentDefault("maxInputTokens", next)}
                  min={0}
                  step={1}
                  placeholder="∞"
                  ariaLabel="Maximum input tokens per turn"
                />
              </SettingsRow>

              <SettingsRow title="Max output tokens" description="Cumulative output tokens per turn; empty is unlimited">
                <DebouncedNumberInput
                  value={maxOutputTokens}
                  onCommit={next => setAgentDefault("maxOutputTokens", next)}
                  min={0}
                  step={1}
                  placeholder="∞"
                  ariaLabel="Maximum output tokens per turn"
                />
              </SettingsRow>

              <SettingsRow title="Compaction threshold" description="Context usage fraction that triggers compaction">
                <DebouncedNumberInput
                  value={compactionThreshold}
                  onCommit={next => void applyPatch({ agentDefaults: { compaction: { compactionThreshold: next ?? 0.5 } } })}
                  min={0}
                  max={1}
                  step="any"
                  placeholder="0.5"
                  ariaLabel="Compaction threshold"
                />
              </SettingsRow>

              <SettingsRow title="Apply threshold" description="Context usage fraction at which compaction is applied">
                <DebouncedNumberInput
                  value={applyThreshold}
                  onCommit={next => void applyPatch({ agentDefaults: { compaction: { applyThreshold: next } } })}
                  min={0}
                  max={1}
                  step="any"
                  placeholder="(not set)"
                  ariaLabel="Compaction apply threshold"
                />
              </SettingsRow>

              <SettingsRow title="Background compaction" description="Run compaction in the background instead of blocking the turn" border={false}>
                <EnableToggle
                  enabled={compactionBackground}
                  onToggle={() => void applyPatch({ agentDefaults: { compaction: { background: !compactionBackground } } })}
                  itemName="background compaction"
                  size="sm"
                />
              </SettingsRow>
            </div>
          </details>
        </div>

        <div className="shrink-0 border-t border-primary px-3 py-2">
          <Link to={CHAT_CONFIG_HREF} className="text-xs text-accent hover:text-accent-soft focus-ring rounded" onClick={() => setOpen(false)}>
            Open full chat configuration
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const configScopesAsOptions: { value: ConfigScope; label: string }[] = [
  { value: "workspace", label: configScopeLabels.workspace },
  { value: "global", label: configScopeLabels.global },
];
