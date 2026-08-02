import type { AgentCommandArgument, AgentCommandPositional, AgentCommandRemainder, AvailableAgentCommand } from "@tokenring-ai/agent/rpc/schema";
import type { WorkflowCommandStep, WorkflowStep } from "@tokenring-ai/workflow/schema";

export type { AvailableAgentCommand, WorkflowCommandStep, WorkflowStep };

export function isCommandStep(step: WorkflowStep): step is WorkflowCommandStep {
  return typeof step === "object" && "command" in step;
}

export function isChatStep(step: WorkflowStep): step is string {
  return typeof step === "string";
}

export function emptyChatStep(): string {
  return "";
}

export function emptyCommandStep(commandName = ""): WorkflowCommandStep {
  return {
    command: commandName,
    arguments: {},
    remainder: "",
  };
}

export function isArgRequired(schema: AgentCommandArgument): boolean {
  return "required" in schema && schema.required === true;
}

export function isPositionalRequired(schema: AgentCommandPositional): boolean {
  return schema.required === true;
}

export function isRemainderRequired(schema: AgentCommandRemainder): boolean {
  return schema.required === true;
}

/** Seed arguments / remainder for a newly selected command (schema defaults applied). */
export function defaultsForCommand(command: AvailableAgentCommand): WorkflowCommandStep {
  const args: Record<string, string | number | boolean> = {};
  for (const [name, schema] of Object.entries(command.inputSchema.args ?? {})) {
    if (schema.type === "flag") {
      args[name] = false;
    } else if (schema.type === "number" && schema.defaultValue !== undefined) {
      args[name] = schema.defaultValue;
    } else if (schema.type === "date" && schema.defaultValue !== undefined) {
      args[name] = new Date(schema.defaultValue).toISOString().slice(0, 10);
    } else if ((schema.type === "string" || schema.type === "enum") && schema.defaultValue !== undefined) {
      args[name] = schema.defaultValue;
    }
  }

  for (const positional of command.inputSchema.positionals ?? []) {
    if (positional.defaultValue !== undefined) {
      args[positional.name] = positional.defaultValue;
    }
  }

  return {
    command: command.name,
    arguments: args,
    remainder: command.inputSchema.remainder?.defaultValue ?? "",
  };
}

/** Compact label for run history and previews. */
export function formatStepLabel(step: WorkflowStep): string {
  if (typeof step === "string") return step;

  const parts: string[] = [`/${step.command}`];
  for (const [name, value] of Object.entries(step.arguments)) {
    if (typeof value === "boolean") {
      if (value) parts.push(`--${name}`);
      continue;
    }
    if (value === "") continue;
    parts.push(`--${name}`, String(value));
  }
  const remainder = step.remainder.trim();
  if (remainder) parts.push(remainder);
  return parts.join(" ");
}

/** Whether a step has enough content to be saved / run. */
export function isStepFilled(step: WorkflowStep): boolean {
  if (typeof step === "string") return step.trim() !== "";
  return step.command.trim() !== "";
}

export function missingRequiredFields(step: WorkflowCommandStep, command: AvailableAgentCommand | undefined): string[] {
  if (!command) return step.command.trim() === "" ? ["command"] : [];
  const missing: string[] = [];
  const values = step.arguments;

  for (const [name, schema] of Object.entries(command.inputSchema.args ?? {})) {
    if (schema.type === "flag") continue;
    if (!isArgRequired(schema)) continue;
    const value = values[name];
    if (value === undefined || value === false || String(value).trim() === "") {
      missing.push(name);
    }
  }

  for (const positional of command.inputSchema.positionals ?? []) {
    if (!isPositionalRequired(positional)) continue;
    const value = values[positional.name];
    if (value === undefined || String(value).trim() === "") {
      missing.push(positional.name);
    }
  }

  if (command.inputSchema.remainder && isRemainderRequired(command.inputSchema.remainder)) {
    if (step.remainder.trim() === "") {
      missing.push(command.inputSchema.remainder.name);
    }
  }

  return missing;
}

/**
 * Normalize steps for persistence: drop blank chat rows, trim strings, drop command
 * steps with no command name, and strip empty/false argument values.
 */
export function normalizeSteps(steps: WorkflowStep[]): WorkflowStep[] {
  const result: WorkflowStep[] = [];
  for (const step of steps) {
    if (typeof step === "string") {
      const text = step.trimEnd();
      if (text.trim() === "") continue;
      result.push(text);
      continue;
    }

    const command = step.command.trim();
    if (command === "") continue;

    const arguments_: Record<string, string | number | boolean> = {};
    for (const [name, value] of Object.entries(step.arguments)) {
      if (typeof value === "boolean") {
        if (value) arguments_[name] = true;
        continue;
      }
      if (typeof value === "number") {
        arguments_[name] = value;
        continue;
      }
      const text = String(value).trim();
      if (text !== "") arguments_[name] = text;
    }

    result.push({
      command,
      arguments: arguments_,
      remainder: step.remainder.trimEnd(),
    });
  }
  return result;
}
