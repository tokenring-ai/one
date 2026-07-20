import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { queueRPCClient } from "../../rpc.ts";

type AddItemFormProps = {
  queueName: string;
  onCreated: () => void;
  onCancel: () => void;
};

export default function AddItemForm({ queueName, onCreated, onCancel }: AddItemFormProps) {
  const [name, setName] = useState("");
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedInput = input.trim();
    if (!trimmedName) {
      toastManager.error("A description is required", { duration: 3000 });
      return;
    }
    if (!trimmedInput) {
      toastManager.error("Task content is required", { duration: 3000 });
      return;
    }

    setSaving(true);
    try {
      const result = await queueRPCClient.enqueue({ queueName, name: trimmedName, input: trimmedInput, from: "ui" });
      if (result.status === "queueNotFound") {
        toastManager.error(`Queue "${queueName}" no longer exists`, { duration: 4000 });
        return;
      }
      toastManager.success(result.message, { duration: 2500 });
      onCreated();
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
          <h3 className="text-sm font-semibold text-primary">Add to queue "{queueName}"</h3>
          <p className="text-2xs text-muted mt-0.5">A fresh agent will be spawned to run this task</p>
        </div>
        <button type="button" onClick={onCancel} className="p-1.5 text-muted hover:text-primary rounded-md focus-ring cursor-pointer" aria-label="Cancel">
          <X className="w-4 h-4" />
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-2xs font-medium text-muted">Description</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Refactor the auth module"
          className={inputClass}
          autoFocus
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-2xs font-medium text-muted">Task / prompt</span>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Describe the task in detail. This will be sent to the worker agent as its instructions."
          rows={4}
          className={cn(inputClass, "resize-y min-h-[5rem]")}
          required
        />
      </label>

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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg focus-ring cursor-pointer disabled:opacity-50 shadow-sm"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add to queue
        </button>
      </div>
    </form>
  );
}
