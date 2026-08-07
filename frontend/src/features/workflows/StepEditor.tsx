import { ArrowDown, ArrowUp, MessageSquare, Plus, Terminal, X } from "lucide-react";
import { useMemo } from "react";
import type { AvailableAgentCommand, WorkflowCommandStep, WorkflowStep } from "./commandStep.ts";
import {
  defaultsForCommand,
  emptyChatStep,
  emptyCommandStep,
  formatStepLabel,
  isArgRequired,
  isChatStep,
  isCommandStep,
  isPositionalRequired,
  isRemainderRequired,
  missingRequiredFields,
} from "./commandStep.ts";

const fieldClass = "w-full bg-input border border-primary rounded-lg px-2.5 py-1.5 text-xs text-primary placeholder-muted focus-accent";
const labelClass = "text-xs font-medium text-muted";

function RequiredMark() {
  return (
    <span className="text-red-500 ml-0.5" title="Required">
      *
    </span>
  );
}

function CommandFields({
  command,
  step,
  onChange,
}: {
  command: AvailableAgentCommand;
  step: WorkflowCommandStep;
  onChange: (next: WorkflowCommandStep) => void;
}) {
  const schema = command.inputSchema;
  const argEntries = Object.entries(schema.args ?? {});
  const positionals = schema.positionals ?? [];
  const remainder = schema.remainder;
  const hasFields = argEntries.length > 0 || positionals.length > 0 || !!remainder;
  const values = step.arguments;

  const setArg = (name: string, value: string | number | boolean) => {
    onChange({ ...step, arguments: { ...values, [name]: value } });
  };

  if (!hasFields) {
    return <p className="text-xs text-muted italic">This command takes no arguments.</p>;
  }

  return (
    <div className="space-y-2.5">
      {argEntries.map(([name, argSchema]) => {
        const required = isArgRequired(argSchema);
        const id = `arg-${command.name}-${name}`;

        if (argSchema.type === "flag") {
          return (
            <label key={name} className="flex items-start gap-2 cursor-pointer" title={argSchema.description}>
              <input
                id={id}
                type="checkbox"
                checked={values[name] === true}
                onChange={e => setArg(name, e.target.checked)}
                className="mt-0.5 accent-accent cursor-pointer"
              />
              <span className="min-w-0">
                <span className="text-xs text-primary font-mono">--{name}</span>
                <span className="block text-xs text-muted">{argSchema.description}</span>
              </span>
            </label>
          );
        }

        if (argSchema.type === "enum") {
          return (
            <div key={name} className="space-y-1">
              <label htmlFor={id} className={labelClass}>
                <span className="font-mono">--{name}</span>
                {required && <RequiredMark />}
                <span className="font-normal ml-1.5 text-muted/80">{argSchema.description}</span>
              </label>
              <select id={id} value={String(values[name] ?? "")} onChange={e => setArg(name, e.target.value)} className={`${fieldClass} cursor-pointer`}>
                <option value="">{required ? "Select…" : "Default"}</option>
                {argSchema.values.map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        const inputType = argSchema.type === "number" ? "number" : argSchema.type === "date" ? "date" : "text";
        return (
          <div key={name} className="space-y-1">
            <label htmlFor={id} className={labelClass}>
              <span className="font-mono">--{name}</span>
              {required && <RequiredMark />}
              <span className="font-normal ml-1.5 text-muted/80">{argSchema.description}</span>
            </label>
            <input
              id={id}
              type={inputType}
              value={values[name] === undefined || values[name] === false ? "" : String(values[name])}
              onChange={e => setArg(name, argSchema.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)}
              min={argSchema.type === "number" || argSchema.type === "string" ? argSchema.minimum : undefined}
              max={argSchema.type === "number" || argSchema.type === "string" ? argSchema.maximum : undefined}
              placeholder={argSchema.defaultValue !== undefined ? String(argSchema.defaultValue) : undefined}
              className={fieldClass}
            />
          </div>
        );
      })}

      {positionals.map(positional => {
        const required = isPositionalRequired(positional);
        const id = `pos-${command.name}-${positional.name}`;
        return (
          <div key={positional.name} className="space-y-1">
            <label htmlFor={id} className={labelClass}>
              <span className="font-mono">{positional.name}</span>
              {required && <RequiredMark />}
              <span className="font-normal ml-1.5 text-muted/80">{positional.description}</span>
            </label>
            <input
              id={id}
              type="text"
              value={String(values[positional.name] ?? "")}
              onChange={e => setArg(positional.name, e.target.value)}
              placeholder={positional.defaultValue}
              className={fieldClass}
            />
          </div>
        );
      })}

      {remainder && (
        <div className="space-y-1">
          <label htmlFor={`rem-${command.name}`} className={labelClass}>
            <span className="font-mono">{remainder.name}</span>
            {isRemainderRequired(remainder) && <RequiredMark />}
            <span className="font-normal ml-1.5 text-muted/80">{remainder.description}</span>
          </label>
          <textarea
            id={`rem-${command.name}`}
            value={step.remainder}
            onChange={e => onChange({ ...step, remainder: e.target.value })}
            rows={Math.min(8, Math.max(2, remainder.name === "message" || remainder.name === "prompt" ? 3 : 2))}
            placeholder={remainder.defaultValue ?? remainder.description}
            className={`${fieldClass} font-mono resize-y`}
          />
        </div>
      )}
    </div>
  );
}

function StepKindToggle({ kind, onKindChange }: { kind: "chat" | "command"; onKindChange: (kind: "chat" | "command") => void }) {
  return (
    <div className="inline-flex rounded-lg border border-primary p-0.5 bg-primary/30">
      <button
        type="button"
        onClick={() => onKindChange("chat")}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer focus-ring ${
          kind === "chat" ? "bg-accent-muted text-accent" : "text-muted hover:text-primary"
        }`}
      >
        <MessageSquare className="w-3 h-3" /> Chat
      </button>
      <button
        type="button"
        onClick={() => onKindChange("command")}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer focus-ring ${
          kind === "command" ? "bg-accent-muted text-accent" : "text-muted hover:text-primary"
        }`}
      >
        <Terminal className="w-3 h-3" /> Command
      </button>
    </div>
  );
}

function StepRow({
  index,
  step,
  commands,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  index: number;
  step: WorkflowStep;
  commands: AvailableAgentCommand[];
  onChange: (value: WorkflowStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const kind: "chat" | "command" = isCommandStep(step) ? "command" : "chat";
  const commandStep = isCommandStep(step) ? step : null;
  const selectedCommand = useMemo(() => (commandStep ? commands.find(c => c.name === commandStep.command) : undefined), [commands, commandStep]);
  const missing = commandStep ? missingRequiredFields(commandStep, selectedCommand) : [];
  const preview = formatStepLabel(step);

  const setKind = (next: "chat" | "command") => {
    if (next === kind) return;
    if (next === "chat") {
      onChange(isCommandStep(step) && step.remainder ? step.remainder : emptyChatStep());
    } else {
      onChange(emptyCommandStep());
    }
  };

  const selectCommand = (name: string) => {
    if (name === "") {
      onChange(emptyCommandStep());
      return;
    }
    const command = commands.find(c => c.name === name);
    onChange(command ? defaultsForCommand(command) : emptyCommandStep(name));
  };

  return (
    <div className="border border-primary rounded-xl bg-secondary/30 overflow-hidden">
      <div className="flex items-start gap-2 px-2.5 pt-2.5 pb-2">
        <span className="mt-1.5 w-5 shrink-0 text-xs font-mono text-muted text-right">{index + 1}</span>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <StepKindToggle kind={kind} onKindChange={setKind} />
            <span className="text-xs text-muted">{kind === "chat" ? "Sent as a plain chat message" : "Runs a registered agent command"}</span>
          </div>

          {isChatStep(step) ? (
            <textarea
              value={step}
              onChange={e => onChange(e.target.value)}
              rows={Math.min(10, Math.max(2, step.split("\n").length))}
              placeholder="What should the agent do?"
              className={`${fieldClass} resize-y`}
              aria-label={`Step ${index + 1} chat message`}
            />
          ) : (
            <>
              <div className="space-y-1">
                <label htmlFor={`step-cmd-${index}`} className={labelClass}>
                  Command
                </label>
                <select
                  id={`step-cmd-${index}`}
                  value={step.command}
                  onChange={e => selectCommand(e.target.value)}
                  className={`${fieldClass} font-mono cursor-pointer`}
                  aria-label={`Step ${index + 1} command`}
                >
                  <option value="">Select a command…</option>
                  {commands.map(command => (
                    <option key={command.name} value={command.name}>
                      /{command.name} — {command.description}
                    </option>
                  ))}
                </select>
                {selectedCommand && <p className="text-xs text-muted">{selectedCommand.description}</p>}
              </div>

              {selectedCommand && <CommandFields command={selectedCommand} step={step} onChange={onChange} />}

              {step.command !== "" && (
                <div className="rounded-lg bg-primary/40 border border-primary/60 px-2.5 py-1.5">
                  <span className="block text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">Preview</span>
                  <code className="block text-xs font-mono text-primary break-all whitespace-pre-wrap">{preview}</code>
                  {missing.length > 0 && <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">Required: {missing.join(", ")}</p>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Move step up"
            className="p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            title="Move step down"
            className="p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Remove step"
            className="p-1 text-muted hover:text-red-500 rounded transition-colors cursor-pointer focus-ring"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StepEditor({
  steps,
  onChange,
  commands,
}: {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
  commands: AvailableAgentCommand[];
}) {
  const sortedCommands = useMemo(() => [...commands].sort((a, b) => a.name.localeCompare(b.name)), [commands]);

  const update = (index: number, value: WorkflowStep) => onChange(steps.map((step, i) => (i === index ? value : step)));
  const remove = (index: number) => {
    const next = steps.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [emptyChatStep()]);
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <StepRow
          key={index}
          index={index}
          step={step}
          commands={sortedCommands}
          onChange={value => update(index, value)}
          onRemove={() => remove(index)}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          isFirst={index === 0}
          isLast={index === steps.length - 1}
        />
      ))}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onChange([...steps, emptyChatStep()])}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
        >
          <Plus className="w-3 h-3" /> Add chat step
        </button>
        <button
          type="button"
          onClick={() => onChange([...steps, emptyCommandStep()])}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
        >
          <Plus className="w-3 h-3" /> Add command step
        </button>
      </div>
    </div>
  );
}
