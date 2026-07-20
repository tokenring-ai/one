import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { queueRPCClient, useAgentTypes } from "../../rpc.ts";

type CreateQueueFormProps = {
  existingNames: string[];
  onCreated: () => void;
  onCancel: () => void;
};

export default function CreateQueueForm({ existingNames, onCreated, onCancel }: CreateQueueFormProps) {
  const agentTypes = useAgentTypes();
  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState("code");
  const [concurrency, setConcurrency] = useState("1");
  const [maxSize, setMaxSize] = useState("");
  const [saving, setSaving] = useState(false);

  const typeList = agentTypes.data ?? [];

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

    setSaving(true);
    try {
      const result = await queueRPCClient.createQueue({
        name: trimmedName,
        agentType,
        concurrency: conc,
        ...(size != null ? { maxSize: size } : {}),
      });
      switch (result.status) {
        case "queueExists":
          toastManager.error(`A queue named "${trimmedName}" already exists`, { duration: 4000 });
          return;
        case "invalidAgentType":
          toastManager.error(`Agent type "${agentType}" is not registered`, { duration: 4000 });
          return;
        case "success":
          toastManager.success(result.message, { duration: 2500 });
          onCreated();
      }
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
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
          <select value={agentType} onChange={e => setAgentType(e.target.value)} className={inputClass}>
            {typeList.length === 0 ? (
              <option value={agentType}>{agentType}</option>
            ) : (
              typeList.map(t => (
                <option key={t.type} value={t.type}>
                  {t.displayName} ({t.type})
                </option>
              ))
            )}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Concurrency</span>
          <input type="number" min={1} value={concurrency} onChange={e => setConcurrency(e.target.value)} className={inputClass} required />
        </label>

        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Max pending (optional)</span>
          <input type="number" min={1} value={maxSize} onChange={e => setMaxSize(e.target.value)} placeholder="unlimited" className={inputClass} />
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
          disabled={saving}
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
