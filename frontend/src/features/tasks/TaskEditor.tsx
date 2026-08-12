import Editor from "@monaco-editor/react";
import { Plus, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import AutoResizeTextarea from "../workflows/AutoResizeTextarea.tsx";
import type { AgentTypeOption, TaskDraft, TaskPriority, TaskStatus } from "./types.ts";

const FIELD_CLASS = "w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent";
const LABEL_CLASS = "text-xs font-semibold text-muted uppercase tracking-wide";

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [entry, setEntry] = useState("");

  const commit = () => {
    const tag = entry.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setEntry("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-accent-muted text-accent text-xs rounded-full">
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter(existing => existing !== tag))}
            className="hover:text-red-500 cursor-pointer focus-ring rounded"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={entry}
        onChange={event => setEntry(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          }
        }}
        placeholder="Add tag…"
        aria-label="Add tag"
        className="bg-transparent border-none text-xs text-primary placeholder-muted focus:outline-none min-w-24 py-0.5"
      />
    </div>
  );
}

function StepsEditor({ steps, onChange }: { steps: string[]; onChange: (steps: string[]) => void }) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2 border border-dashed border-primary rounded-lg px-3 py-2.5">
        <p className="text-xs text-muted">The instructions below are sent as a single message.</p>
        <button
          type="button"
          onClick={() => onChange([""])}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-accent hover:bg-accent-muted rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
        >
          <Plus className="w-3 h-3" /> Use steps
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {steps.map((step, index) => (
        <div key={index} className="flex items-start gap-1.5">
          <span className="text-xs text-muted pt-2 w-4 shrink-0 text-right">{index + 1}.</span>
          <AutoResizeTextarea
            value={step}
            onChange={event => onChange(steps.map((existing, at) => (at === index ? event.target.value : existing)))}
            minRows={1}
            maxRows={10}
            placeholder="What the agent should do in this step"
            className={FIELD_CLASS}
          />
          <button
            type="button"
            onClick={() => onChange(steps.filter((_, at) => at !== index))}
            className="p-1.5 mt-0.5 text-muted hover:text-red-500 rounded transition-colors cursor-pointer focus-ring shrink-0"
            aria-label={`Remove step ${index + 1}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...steps, ""])}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-accent hover:bg-accent-muted rounded-lg transition-colors cursor-pointer focus-ring"
      >
        <Plus className="w-3 h-3" /> Add step
      </button>
    </div>
  );
}

export default function TaskEditor({
  draft,
  onChange,
  agentTypes,
  statuses,
  priorities,
  defaultAgentType,
  theme,
}: {
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
  agentTypes: AgentTypeOption[];
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  defaultAgentType: string;
  theme: string;
}) {
  const unknownAgentType = draft.agentType !== "" && agentTypes.length > 0 && !agentTypes.some(option => option.type === draft.agentType);
  const usesSteps = draft.steps.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="task-title" className={LABEL_CLASS}>
            Title
          </label>
          <input
            id="task-title"
            type="text"
            value={draft.title}
            onChange={event => onChange({ ...draft, title: event.target.value })}
            placeholder="Extract the argument parser"
            className={FIELD_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="task-agent-type" className={LABEL_CLASS}>
            Agent type
          </label>
          <select
            id="task-agent-type"
            value={draft.agentType}
            onChange={event => onChange({ ...draft, agentType: event.target.value })}
            className={`${FIELD_CLASS} cursor-pointer`}
          >
            <option value="">Default ({defaultAgentType || "unset"})</option>
            {unknownAgentType && <option value={draft.agentType}>{draft.agentType} (not installed)</option>}
            {agentTypes.map(option => (
              <option key={option.type} value={option.type}>
                {option.displayName} ({option.type})
              </option>
            ))}
          </select>
          {unknownAgentType && (
            <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <TriangleAlert className="w-3 h-3 shrink-0" /> This agent type is not currently configured.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="task-status" className={LABEL_CLASS}>
            Status
          </label>
          <select
            id="task-status"
            value={draft.status}
            onChange={event => onChange({ ...draft, status: event.target.value as TaskStatus })}
            className={`${FIELD_CLASS} cursor-pointer`}
          >
            {statuses.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="task-priority" className={LABEL_CLASS}>
            Priority
          </label>
          <select
            id="task-priority"
            value={draft.priority}
            onChange={event => onChange({ ...draft, priority: event.target.value as TaskPriority })}
            className={`${FIELD_CLASS} cursor-pointer`}
          >
            {priorities.map(priority => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className={LABEL_CLASS}>Tags</span>
          <div className="bg-input border border-primary rounded-lg px-2 py-1.5 min-h-[2.25rem]">
            <TagEditor tags={draft.tags} onChange={tags => onChange({ ...draft, tags })} />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="task-description" className={LABEL_CLASS}>
          Description
        </label>
        <AutoResizeTextarea
          id="task-description"
          value={draft.description}
          onChange={event => onChange({ ...draft, description: event.target.value })}
          minRows={1}
          maxRows={6}
          placeholder="One-line summary shown in listings"
          className={FIELD_CLASS}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className={LABEL_CLASS}>Steps</span>
          <span className="text-xs text-muted">Optional — sent one message at a time</span>
        </div>
        <StepsEditor steps={draft.steps} onChange={steps => onChange({ ...draft, steps })} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="task-body" className={LABEL_CLASS}>
            Instructions
          </label>
          <span className="text-xs text-muted">{usesSteps ? "Reference material — steps drive the run" : "Sent to the agent as its only message"}</span>
        </div>
        <div className="border border-primary rounded-lg overflow-hidden" id="task-body">
          <Editor
            height="360px"
            language="markdown"
            value={draft.body}
            onChange={value => onChange({ ...draft, body: value ?? "" })}
            theme={theme === "light" ? "vs-light" : "vs-dark"}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "off",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              padding: { top: 8 },
            }}
          />
        </div>
        <p className="text-xs text-muted">
          The agent starts with no conversation history and cannot ask questions — include every file path, spec, and piece of context it needs.
        </p>
      </div>
    </div>
  );
}
