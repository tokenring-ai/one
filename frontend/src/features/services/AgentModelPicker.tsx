import formatError from "@tokenring-ai/utility/error/formatError";
import { Cpu, Plug } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AI_PROVIDERS_PATH } from "../../apps/configuration/manifest.ts";
import BusySpinner from "../../components/ui/BusySpinner.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { chatRPCClient, useChatModelsByProvider, useModel } from "../../rpc.ts";
import Select from "../../ui/select.tsx";

/** One provider's models, sorted, as the select's option groups. */
export function groupModelsByProvider(modelsByProvider: Record<string, Record<string, { available: boolean }>> | undefined) {
  return Object.entries(modelsByProvider ?? {})
    .map(([provider, record]) => ({
      provider,
      models: Object.entries(record)
        .map(([modelId, info]) => ({ modelId, available: info.available }))
        .sort((a, b) => a.modelId.localeCompare(b.modelId)),
    }))
    .filter(group => group.models.length > 0)
    .sort((a, b) => a.provider.localeCompare(b.provider));
}

/**
 * The selected agent's chat model, changeable in place.
 *
 * The same `streamModel` / `setModel` pair the chat footer's ModelSelector
 * uses, rendered as a labelled select so it fits a settings panel rather than
 * a toolbar. Unreachable models stay listed (disabled) so the current choice is
 * never silently missing from the list.
 */
export default function AgentModelPicker({ agentId, onAgentGone }: { agentId: string; onAgentGone?: () => void }) {
  const currentModel = useModel(agentId);
  const models = useChatModelsByProvider();
  const [pendingModel, setPendingModel] = useState<string | null>(null);

  const current = currentModel.data?.status === "success" ? currentModel.data.model : null;
  const groups = useMemo(() => groupModelsByProvider(models.data?.modelsByProvider), [models.data]);
  const known = useMemo(() => new Set(groups.flatMap(g => g.models.map(m => m.modelId))), [groups]);
  const value = pendingModel ?? current ?? "";

  const change = async (model: string) => {
    if (!model || model === current || pendingModel) return;
    setPendingModel(model);
    try {
      const result = await chatRPCClient.setModel({ agentId, model });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        onAgentGone?.();
        return;
      }
      if (result.status === "modelNotFound") {
        toastManager.error(`${model} is not available. Pick another model.`, { duration: 5000 });
        return;
      }
      await currentModel.mutate();
      toastManager.success(`Model changed to ${model.split("/").pop()}`, { duration: 3000 });
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setPendingModel(null);
    }
  };

  const loading = (currentModel.isLoading && !currentModel.data) || (models.isLoading && !models.data);
  const hint = currentModel.error
    ? `Could not load the agent's model: ${formatError(currentModel.error)}`
    : models.error
      ? `Could not load models: ${formatError(models.error)}`
      : currentModel.data?.status === "modelNotFound"
        ? "This agent has no model yet — pick one."
        : undefined;
  const noModels = groups.length === 0 && !loading && !models.error;

  return (
    <div className="bg-secondary border border-primary rounded-xl px-4 py-3 mb-4" data-testid="agent-model-picker">
      <div className="flex items-start gap-3">
        <Select
          label={
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
              Agent model
            </span>
          }
          hint={hint}
          value={value}
          onChange={model => void change(model)}
          disabled={loading || pendingModel !== null || groups.length === 0}
          className="flex-1 min-w-0"
        >
          {value === "" ? (
            <option value="" disabled>
              {loading ? "Loading…" : "Select a model"}
            </option>
          ) : null}
          {value !== "" && !known.has(value) ? <option value={value}>{value}</option> : null}
          {groups.map(group => (
            <optgroup key={group.provider} label={group.provider}>
              {group.models.map(model => (
                <option key={model.modelId} value={model.modelId} disabled={!model.available && model.modelId !== value}>
                  {model.modelId}
                  {model.available ? "" : " (unavailable)"}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        {pendingModel ? <BusySpinner className="mt-7" label="Changing model" /> : null}
      </div>
      {noModels ? (
        <p className="mt-2 text-xs text-muted">
          No models are available yet.{" "}
          <Link to={AI_PROVIDERS_PATH} className="inline-flex items-center gap-1 font-medium text-accent-soft hover:underline focus-ring rounded">
            <Plug className="w-3 h-3" aria-hidden="true" />
            Connect a provider
          </Link>
        </p>
      ) : null}
    </div>
  );
}
