import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, Send, X } from "lucide-react";
import type { SubmitEvent } from "react";
import { useMemo, useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { botRPCClient } from "../../rpc.ts";
import { splitTarget } from "./formatters.ts";

export type MessageTargetOption = {
  target: string;
  label: string;
  group: string;
};

type SendMessageFormProps = {
  /** Known targets, offered as a picker before falling back to free text. */
  options: MessageTargetOption[];
  initialTarget?: string | undefined;
  onSent: () => void;
  onCancel: () => void;
};

const CUSTOM_TARGET = "__custom__";
const TARGET_PATTERN = /^[^:]+:.+/;

export default function SendMessageForm({ options, initialTarget, onSent, onCancel }: SendMessageFormProps) {
  // Prefer a known option; if the caller prefilled something outside the list
  // (a live conversation key, an unlisted DM, a forum topic), fall back to free text
  // rather than silently swapping in the first picker entry.
  const knownTarget = initialTarget && options.some(option => option.target === initialTarget) ? initialTarget : undefined;
  const [selected, setSelected] = useState<string>(() => {
    if (knownTarget) return knownTarget;
    if (initialTarget) return CUSTOM_TARGET;
    return options.length > 0 ? options[0]!.target : CUSTOM_TARGET;
  });
  const [customTarget, setCustomTarget] = useState(knownTarget ? "" : (initialTarget ?? ""));
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const target = selected === CUSTOM_TARGET ? customTarget.trim() : selected;
  const groups = useMemo(() => [...new Set(options.map(option => option.group))], [options]);
  const selectedOption = options.find(option => option.target === selected);
  const serviceHint = useMemo(() => {
    if (!target || !TARGET_PATTERN.test(target)) return null;
    const { service } = splitTarget(target);
    return service || null;
  }, [target]);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const body = message.trim();
    if (!target) {
      toastManager.error("A target is required", { duration: 3000 });
      return;
    }
    if (!TARGET_PATTERN.test(target)) {
      toastManager.error("Targets look like service:userId, e.g. slack:U123ABC or group:dev-team", { duration: 4000 });
      return;
    }
    if (!body) {
      toastManager.error("A message is required", { duration: 3000 });
      return;
    }

    setSending(true);
    try {
      const result = await botRPCClient.sendMessage({ target, message: body });
      if (result.status === "providerNotFound") {
        const { service } = splitTarget(target);
        toastManager.error(`No messaging service is connected for "${service}"`, { duration: 5000 });
        return;
      }
      toastManager.success(`Message sent to ${target}`, { duration: 2500 });
      setMessage("");
      onSent();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSending(false);
    }
  };

  const inputClass = "w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent transition-all";

  return (
    <form onSubmit={e => void handleSubmit(e)} className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-primary">Send a message</h3>
          <p className="text-xs text-muted mt-0.5">Delivered by the messaging service, without involving an agent</p>
        </div>
        <button type="button" onClick={onCancel} className="p-1.5 text-muted hover:text-primary rounded-md focus-ring cursor-pointer" aria-label="Cancel">
          <X className="w-4 h-4" />
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">Target</span>
        <select value={selected} onChange={e => setSelected(e.target.value)} className={inputClass}>
          {groups.map(group => (
            <optgroup key={group} label={group}>
              {options
                .filter(option => option.group === group)
                .map(option => (
                  <option key={option.target} value={option.target}>
                    {option.label}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value={CUSTOM_TARGET}>Another target…</option>
        </select>
        {selected !== CUSTOM_TARGET && selectedOption ? <span className="block text-xs text-muted font-mono">{selectedOption.target}</span> : null}
      </label>

      {selected === CUSTOM_TARGET ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">service:userId or group:name</span>
          <input
            type="text"
            value={customTarget}
            onChange={e => setCustomTarget(e.target.value)}
            placeholder="slack:U123ABC"
            className={inputClass}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          <span className="block text-xs text-muted">Examples: slack:C0123ABCD, telegram:123456789, group:dev-team</span>
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">Message</span>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="What would you like to say?"
          rows={4}
          className={cn(inputClass, "resize-y min-h-[5rem]")}
          required
        />
        <span className="flex items-center justify-between text-xs text-muted">
          <span>{serviceHint ? `Via ${serviceHint}` : "Pick a target to send"}</span>
          <span className="tabular-nums">{message.length.toLocaleString()} chars</span>
        </span>
      </label>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={sending || !target || !message.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white rounded-lg focus-ring cursor-pointer shadow-sm"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Send
        </button>
      </div>
    </form>
  );
}
