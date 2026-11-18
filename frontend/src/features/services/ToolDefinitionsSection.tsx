import type { ToolDefinition, ToolItemInput } from "@tokenring-ai/chat/toolSchema";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Plus, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useAsyncActionGuard } from "../../hooks/useAsyncActionGuard.ts";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { chatRPCClient, useAvailableTools, useToolDefinition, useToolDefinitions, useToolDirectory } from "../../rpc.ts";
import Button from "../../ui/button.tsx";
import TextArea from "../../ui/text-area.tsx";
import TextField from "../../ui/text-field.tsx";

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

interface ArgumentDraft {
  name: string;
  description: string;
  defaultValue: string;
}

interface ToolDraft {
  name: string;
  displayName: string;
  description: string;
  category: string;
  agentType: string;
  arguments: ArgumentDraft[];
  steps: string[];
}

const EMPTY_DRAFT: ToolDraft = {
  name: "",
  displayName: "",
  description: "",
  category: "User-Created Tools",
  agentType: "",
  arguments: [],
  steps: [""],
};

function draftFromTool(tool: ToolDefinition): ToolDraft {
  return {
    name: tool.name,
    displayName: tool.displayName,
    description: tool.description,
    category: tool.category,
    agentType: tool.agentType,
    arguments: Object.entries(tool.inputArguments).map(([name, argument]) => ({
      name,
      description: argument.description,
      defaultValue: argument.defaultValue ?? "",
    })),
    steps: tool.steps.length > 0 ? [...tool.steps] : [""],
  };
}

function validateDraft(draft: ToolDraft, creating: boolean): string | null {
  const name = draft.name.trim();
  if (creating && !NAME_PATTERN.test(name)) {
    return "Names start with a letter or number and use only letters, numbers, hyphens, and underscores.";
  }
  if (!draft.displayName.trim()) return "Display name is required.";
  if (!draft.agentType.trim()) return "Agent type is required.";
  if (draft.steps.every(step => step.trim().length === 0)) return "Add at least one step.";
  const argumentNames = draft.arguments.map(argument => argument.name.trim()).filter(argumentName => argumentName.length > 0);
  if (new Set(argumentNames).size !== argumentNames.length) return "Argument names must be unique.";
  if (
    draft.arguments.some(argument => argument.name.trim().length === 0 && (argument.description.trim().length > 0 || argument.defaultValue.trim().length > 0))
  ) {
    return "Every argument needs a name.";
  }
  return null;
}

function toToolItem(draft: ToolDraft, base: ToolDefinition | null): ToolItemInput {
  const inputArguments: ToolItemInput["inputArguments"] = {};
  for (const argument of draft.arguments) {
    const name = argument.name.trim();
    if (!name) continue;
    const description = argument.description;
    inputArguments[name] = argument.defaultValue.length > 0 ? { description, defaultValue: argument.defaultValue } : { description };
  }
  const steps = draft.steps.map(step => step.replace(/[ \t]+$/u, "")).filter(step => step.trim().length > 0);
  const category = draft.category.trim() || "User-Created Tools";
  const tool: ToolItemInput = {
    agentType: draft.agentType.trim(),
    displayName: draft.displayName.trim(),
    description: draft.description,
    category,
    inputArguments,
    steps,
  };
  if (base?.subAgent) tool.subAgent = base.subAgent;
  if (base?.installedFrom) tool.installedFrom = base.installedFrom;
  return tool;
}

/** Editable YAML tools from the tool directory, under the runtime tool catalog. */
export default function ToolDefinitionsSection() {
  const directory = useToolDirectory();
  const definitions = useToolDefinitions();
  const availableTools = useAvailableTools();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draft, setDraft] = useState<ToolDraft>(EMPTY_DRAFT);
  const [loadedTool, setLoadedTool] = useState<ToolDefinition | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { activeKey, execute } = useAsyncActionGuard();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();

  const definitionQuery = useToolDefinition(mode === "edit" ? editingName : null);
  const definitionRef = useRef(definitionQuery.data);
  definitionRef.current = definitionQuery.data;
  const loadedKey =
    definitionQuery.data?.status === "success"
      ? `${definitionQuery.data.tool.name}:${definitionQuery.data.tool.updatedAt}`
      : definitionQuery.data?.status === "toolNotFound"
        ? `missing:${editingName ?? ""}`
        : "";

  useEffect(() => {
    if (mode !== "edit" || !editingName) return;
    const result = definitionRef.current;
    if (!result) return;
    if (result.status === "toolNotFound") {
      toastManager.error(`Tool “${editingName}” was not found`, { duration: 4000 });
      setMode("idle");
      setEditingName(null);
      setLoadedTool(null);
      return;
    }
    setDraft(draftFromTool(result.tool));
    setLoadedTool(result.tool);
  }, [loadedKey, mode, editingName]);

  const tools = definitions.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      tool => tool.name.toLowerCase().includes(q) || tool.displayName.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q),
    );
  }, [query, tools]);

  const startCreate = () => {
    setMode("create");
    setEditingName(null);
    setLoadedTool(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
  };

  const startEdit = (tool: ToolDefinition) => {
    setMode("edit");
    setEditingName(tool.name);
    setLoadedTool(tool);
    setDraft(draftFromTool(tool));
    setFormError(null);
  };

  const save = () => {
    const error = validateDraft(draft, mode === "create");
    if (error) {
      setFormError(error);
      return;
    }
    const name = mode === "create" ? draft.name.trim() : editingName;
    if (!name) return;
    const tool = toToolItem(draft, mode === "edit" ? loadedTool : null);
    void execute("save", async () => {
      try {
        if (mode === "create") {
          await chatRPCClient.createToolDefinition({ name, tool });
          toastManager.success(`Created ${name}`, { duration: 3000 });
          setMode("idle");
          setDraft(EMPTY_DRAFT);
          setLoadedTool(null);
        } else {
          await chatRPCClient.updateToolDefinition({ name, tool });
          toastManager.success(`Updated ${name}`, { duration: 3000 });
        }
        setFormError(null);
        await definitions.mutate();
        await availableTools.mutate();
      } catch (caught: unknown) {
        toastManager.error(formatError(caught), { duration: 5000 });
      }
    });
  };

  const remove = async () => {
    if (!editingName) return;
    const confirmed = await openConfirm({
      id: `services:delete-tool:${editingName}`,
      title: `Delete ${editingName}?`,
      message: "This removes the tool definition file. Agents will no longer be able to call it.",
      confirmText: "Delete",
      variant: "danger",
      dontAskAgain: false,
    });
    if (!confirmed) return;
    const name = editingName;
    await execute("delete", async () => {
      try {
        await chatRPCClient.deleteToolDefinition({ name });
        toastManager.success(`Deleted ${name}`, { duration: 3000 });
        setMode("idle");
        setEditingName(null);
        setLoadedTool(null);
        setDraft(EMPTY_DRAFT);
        await definitions.mutate();
        await availableTools.mutate();
      } catch (caught: unknown) {
        toastManager.error(formatError(caught), { duration: 5000 });
      }
    });
  };

  const directoryPath = directory.data?.directory;

  return (
    <section className="mt-8 space-y-4 border-t border-primary pt-6" aria-label="Tool definitions" data-testid="tool-definitions">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest">Tool definitions</h2>
          <p className="text-xs font-mono text-muted truncate mt-1" title={directoryPath}>
            {directoryPath ?? (directory.isLoading ? "Loading tool directory…" : "Tool directory unavailable")}
          </p>
        </div>
        <Button type="button" variant="secondary" icon={Plus} onClick={startCreate}>
          New tool
        </Button>
      </div>

      {directory.error ? (
        <ErrorState
          title="Failed to load the tool directory"
          error={directory.error}
          onRetry={() => void directory.mutate()}
          variant="inline"
          className="py-3"
        />
      ) : null}
      {definitions.isLoading && !definitions.data ? <LoadingState message="Loading tool definitions…" className="py-8" /> : null}
      {definitions.error ? (
        <ErrorState
          title="Failed to load tool definitions"
          error={definitions.error}
          onRetry={() => void definitions.mutate()}
          variant="inline"
          className="py-3"
        />
      ) : null}

      {definitions.data && tools.length > 0 ? (
        <SearchInput value={query} onChange={setQuery} placeholder="Filter saved tools…" aria-label="Filter tool definitions" className="w-full max-w-xs" />
      ) : null}

      {definitions.data && tools.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Wrench}
          title="No tool definitions"
          hint="Saved tools are YAML files agents can run. They live in the tool directory, separate from the plugin tools above."
        />
      ) : null}

      {filtered.length > 0 ? (
        <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
          {filtered.map(tool => {
            const selected = mode === "edit" && editingName === tool.name;
            return (
              <button
                key={tool.name}
                type="button"
                onClick={() => startEdit(tool)}
                aria-pressed={selected}
                className={`w-full text-left px-4 py-2.5 border-b border-primary last:border-b-0 hover:bg-hover transition-colors focus-ring ${selected ? "bg-violet-500/10" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-primary truncate">{tool.displayName || tool.name}</span>
                  <span className="text-xs font-mono text-muted shrink-0">{tool.name}</span>
                </div>
                {tool.description ? <p className="text-xs text-muted truncate mt-0.5">{tool.description}</p> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {definitions.data && tools.length > 0 && filtered.length === 0 ? (
        <EmptyState variant="card" icon={Wrench} title={`No tool definitions match “${query}”`} />
      ) : null}

      {mode !== "idle" ? (
        <section
          className="bg-secondary border border-primary rounded-xl p-4 space-y-3"
          aria-label={mode === "create" ? "New tool definition" : `Edit ${editingName ?? "tool"}`}
        >
          <TextField
            label="Name"
            value={draft.name}
            onChange={name => setDraft(current => ({ ...current, name }))}
            mono
            disabled={mode === "edit"}
            hint={mode === "edit" ? "The file name is the tool name and cannot be changed." : "Used as the tool file name."}
          />
          <TextField label="Display name" value={draft.displayName} onChange={displayName => setDraft(current => ({ ...current, displayName }))} />
          <TextArea label="Description" value={draft.description} onChange={description => setDraft(current => ({ ...current, description }))} rows={2} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Category" value={draft.category} onChange={category => setDraft(current => ({ ...current, category }))} />
            <TextField label="Agent type" value={draft.agentType} onChange={agentType => setDraft(current => ({ ...current, agentType }))} mono />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-primary">Arguments</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft(current => ({ ...current, arguments: [...current.arguments, { name: "", description: "", defaultValue: "" }] }))}
              >
                Add argument
              </Button>
            </div>
            {draft.arguments.length === 0 ? <p className="text-xs text-muted">This tool takes no arguments.</p> : null}
            {draft.arguments.map((argument, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_1fr_auto] gap-2 items-end">
                <TextField
                  label={index === 0 ? "Argument name" : undefined}
                  aria-label={`Argument ${index + 1} name`}
                  value={argument.name}
                  onChange={name =>
                    setDraft(current => ({
                      ...current,
                      arguments: current.arguments.map((item, itemIndex) => (itemIndex === index ? { ...item, name } : item)),
                    }))
                  }
                  mono
                />
                <TextField
                  label={index === 0 ? "Argument description" : undefined}
                  aria-label={`Argument ${index + 1} description`}
                  value={argument.description}
                  onChange={description =>
                    setDraft(current => ({
                      ...current,
                      arguments: current.arguments.map((item, itemIndex) => (itemIndex === index ? { ...item, description } : item)),
                    }))
                  }
                />
                <TextField
                  label={index === 0 ? "Default" : undefined}
                  aria-label={`Argument ${index + 1} default`}
                  value={argument.defaultValue}
                  onChange={defaultValue =>
                    setDraft(current => ({
                      ...current,
                      arguments: current.arguments.map((item, itemIndex) => (itemIndex === index ? { ...item, defaultValue } : item)),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remove argument ${index + 1}`}
                  onClick={() => setDraft(current => ({ ...current, arguments: current.arguments.filter((_, itemIndex) => itemIndex !== index) }))}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-primary">Steps</h3>
              <Button type="button" variant="ghost" onClick={() => setDraft(current => ({ ...current, steps: [...current.steps, ""] }))}>
                Add step
              </Button>
            </div>
            {draft.steps.map((step, index) => (
              <div key={index} className="flex items-start gap-2">
                <TextArea
                  label={`Step ${index + 1}`}
                  value={step}
                  onChange={value => setDraft(current => ({ ...current, steps: current.steps.map((item, itemIndex) => (itemIndex === index ? value : item)) }))}
                  rows={2}
                  mono
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-5"
                  aria-label={`Remove step ${index + 1}`}
                  disabled={draft.steps.length === 1}
                  onClick={() => setDraft(current => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index) }))}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          {formError ? (
            <p className="text-xs text-danger" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="button" onClick={save} busy={activeKey === "save"} busyLabel="Saving…" disabled={activeKey !== null}>
              Save tool
            </Button>
            {mode === "edit" ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => void remove()}
                busy={activeKey === "delete"}
                busyLabel="Deleting…"
                disabled={activeKey !== null}
              >
                Delete tool
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMode("idle");
                setEditingName(null);
                setLoadedTool(null);
                setFormError(null);
              }}
              disabled={activeKey !== null}
            >
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
      <ConfirmDialog />
    </section>
  );
}
