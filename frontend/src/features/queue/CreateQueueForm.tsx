import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { queueRPCClient, useAgentTypes } from "../../rpc.ts";

type CreateQueueFormProps = {
  existingNames: string[];
  /** Called with the new queue name after a successful create. */
  onCreated: (name: string) => void;
  onCancel: () => void;
};

export default function CreateQueueForm({ existingNames, onCreated, onCancel }: CreateQueueFormProps) {
  const agentTypes = useAgentTypes();
  const typeList = useMemo(() => agentTypes.data ?? [], [agentTypes.data]);
  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState("");
  const [concurrency, setConcurrency] = useState("1");
  const [maxSize, setMaxSize] = useState("");
  const [maxResults, setMaxResults] = useState("");
  const [saving, setSaving] = useState(false);

  // Prefer "code" when available; otherwise first registered type once the list loads.
  useEffect(() => {
    if (typeList.length === 0) return;
    setAgentType(prev => {
      if (prev && typeList.some(t => t.type === prev)) return prev;
      return typeList.find(t => t.type === "code")?.type ?? typeList[0]!.type;
    });
  }, [typeList]);

  const effectiveAgentType = agentType.trim();
  const typesLoading = agentTypes.isLoading && typeList.length === 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toastManager.error("A queue name is required", { duration: 3000 });
      return;
    }
    if (existingNames.includes(trimmedName)) {
      toastManager.error(`A queue named "${trimmedName}" already exists`, { duration: 4000 });
      return;
    }
    if (!effectiveAgentType) {
      toastManager.error(typesLoading ? "Still loading agent types" : "Select or enter an agent type", { duration: 3000 });
      return;
    }
    const conc = Number.parseInt(concurrency, 10);
    if (!Number.isFinite(conc) || conc < 1) {
      toastManager.error("Concurrency must be a positive number", { duration: 3000 });
      return;
    }
    const size = maxSize.trim() ? Number.parseInt(maxSize, 10) : undefined;
    if (size != null && (!Number.isFinite(size) || size < 1)) {
      toastManager.error("Max size must be a positive number", { duration: 3000 });
      return;
    }
    const resultsCap = maxResults.trim() ? Number.parseInt(maxResults, 10) : undefined;
    if (resultsCap != null && (!Number.isFinite(resultsCap) || resultsCap < 1)) {
      toastManager.error("Results kept must be a positive number", { duration: 3000 });
      return;
    }

    setSaving(true);
    try {
      const result = await queueRPCClient.createQueue({
        name: trimmedName,
        agentType: effectiveAgentType,
        concurrency: conc,
        ...(size != null ? { maxSize: size } : {}),
        ...(resultsCap != null ? { maxResults: resultsCap } : {}),
      });
      switch (result.status) {
        case "queueExists":
          toastManager.error(`A queue named "${trimmedName}" already exists`, { duration: 4000 });
          return;
        case "invalidAgentType":
          toastManager.error(`Agent type "${effectiveAgentType}" is not registered`, { duration: 4000 });
          return;
        case "success":
          toastManager.success(result.message, { duration: 2500 });
          onCreated(trimmedName);
      }
    } catch (err) {
      toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent transition-all";

  return (
    <form onSubmit={e => void handleSubmit(e)} className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-primary">Create a queue</h3>
          <p className="text-2xs text-muted mt-0.5">Each queue dispatches work to a specific agent type</p>
        </div>
        <button type="button" onClick={onCancel} className="p-1.5 text-muted hover:text-primary rounded-md focus-ring cursor-pointer" aria-label="Cancel">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Queue name</span>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="research" className={inputClass} autoFocus required />
        </label>

        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Agent type</span>
          {typesLoading ? (
            <div className="flex items-center gap-2 text-2xs text-muted px-3 py-2 border border-primary rounded-lg">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading agent types…
            </div>
          ) : typeList.length === 0 ? (
            <>
              <input
                type="text"
                value={agentType}
                onChange={e => setAgentType(e.target.value)}
                placeholder="code"
                className={inputClass}
                required
                spellCheck={false}
                autoComplete="off"
              />
              <span className="block text-2xs text-muted">
                {agentTypes.error ? (
                  <>
                    Could not load agent types.{" "}
                    <button
                      type="button"
                      onClick={() => void agentTypes.mutate()}
                      className="text-sky-600 dark:text-sky-400 hover:underline focus-ring rounded cursor-pointer"
                    >
                      Retry
                    </button>{" "}
                    or enter a type id manually.
                  </>
                ) : (
                  "No agent types listed — enter a registered type id (e.g. code)."
                )}
              </span>
            </>
          ) : (
            <select value={agentType} onChange={e => setAgentType(e.target.value)} className={inputClass} required>
              {typeList.map(t => (
                <option key={t.type} value={t.type}>
                  {t.displayName} ({t.type})
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Concurrency</span>
          <input type="number" min={1} value={concurrency} onChange={e => setConcurrency(e.target.value)} className={inputClass} required />
        </label>

        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Max pending (optional)</span>
          <input type="number" min={1} value={maxSize} onChange={e => setMaxSize(e.target.value)} placeholder="unlimited" className={inputClass} />
        </label>

        <label className="block space-y-1 sm:col-span-2">
          <span className="text-2xs font-medium text-muted">Results kept (optional)</span>
          <input type="number" min={1} value={maxResults} onChange={e => setMaxResults(e.target.value)} placeholder="service default" className={inputClass} />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || typesLoading || !effectiveAgentType}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg focus-ring cursor-pointer disabled:opacity-50 shadow-sm",
          )}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Create queue
        </button>
      </div>
    </form>
  );
}
