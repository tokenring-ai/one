import formatError from "@tokenring-ai/utility/error/formatError";
import { Bot, Loader2, X } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import { formatConfigIssues } from "../../lib/configWrites.ts";
import { cn } from "../../lib/utils.ts";
import { botRPCClient, useAgentTypes } from "../../rpc.ts";

type CreateBotFormProps = {
  /** Names already taken, so a clash is caught before the round trip. */
  existingNames: string[];
  /** Connected messaging services, used to suggest what an admin target looks like. */
  services: string[];
  onCreated: (name: string) => void;
  onCancel: () => void;
};

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const TARGET_PATTERN = /^[^:]+:.+/;

export default function CreateBotForm({ existingNames, services, onCreated, onCancel }: CreateBotFormProps) {
  const agentTypes = useAgentTypes();

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agentType, setAgentType] = useState("");
  const [directMessages, setDirectMessages] = useState<"listed" | "anyone" | "none">("listed");
  const [requireMention, setRequireMention] = useState(true);
  const [joinPolicy, setJoinPolicy] = useState<"manual" | "whenInvitedByAdmin" | "whenInvited">("manual");
  const [joinMessage, setJoinMessage] = useState("");
  const [adminTarget, setAdminTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const types = useMemo(() => agentTypes.data ?? [], [agentTypes.data]);
  const effectiveAgentType = agentType || types[0]?.type || "";
  const trimmedName = name.trim();
  const trimmedAdmin = adminTarget.trim();

  const nameError = !trimmedName
    ? null
    : !NAME_PATTERN.test(trimmedName)
      ? "Letters, numbers, dashes and underscores only"
      : existingNames.includes(trimmedName)
        ? "A bot with this name already exists"
        : null;
  const adminError = trimmedAdmin && !TARGET_PATTERN.test(trimmedAdmin) ? "Looks like service:userId, e.g. slack:U123ABC" : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmedName || nameError || adminError || !effectiveAgentType) return;

    setSaving(true);
    try {
      const result = await botRPCClient.createBot({
        name: trimmedName,
        agentType: effectiveAgentType,
        directMessages,
        requireMention,
        joinPolicy,
        ...(displayName.trim() && { displayName: displayName.trim() }),
        ...(joinMessage.trim() && { joinMessage: joinMessage.trim() }),
        // Seeded here so the bot has somebody who may DM it and run commands
        // from the moment it starts.
        ...(trimmedAdmin && { users: { [trimmedAdmin]: "admin" as const } }),
      });

      if (result.status === "botExists") {
        toastManager.error(`A bot named "${trimmedName}" already exists`, { duration: 4000 });
        return;
      }
      if (result.status === "configRejected") {
        toastManager.error(formatConfigIssues(result.issues), { duration: 6000 });
        return;
      }

      toastManager.success(`Bot "${trimmedName}" created`, { duration: 3000 });
      onCreated(trimmedName);
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent transition-all";
  const targetExample = services.length > 0 ? `${services[0]}:U123ABC` : "slack:U123ABC";

  return (
    <form onSubmit={e => void handleSubmit(e)} className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-primary">New bot</h3>
          <p className="text-2xs text-muted mt-0.5">Starts answering as soon as it is created — no restart</p>
        </div>
        <button type="button" onClick={onCancel} className="p-1.5 text-muted hover:text-primary rounded-md focus-ring cursor-pointer" aria-label="Cancel">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Name</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="helper"
            className={cn(inputClass, nameError && "border-rose-500/60")}
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
          <span className={cn("block text-2xs", nameError ? "text-rose-500" : "text-muted")}>{nameError ?? "How you refer to the bot in commands"}</span>
        </label>

        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Display name (optional)</span>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={trimmedName || "Helper"} className={inputClass} />
          <span className="block text-2xs text-muted">Shown in this dashboard</span>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-2xs font-medium text-muted">Agent type</span>
        {agentTypes.isLoading && types.length === 0 ? (
          <div className="flex items-center gap-2 text-2xs text-muted px-3 py-2 border border-primary rounded-lg">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading agent types…
          </div>
        ) : types.length === 0 ? (
          <input type="text" value={agentType} onChange={e => setAgentType(e.target.value)} placeholder="assistant" className={inputClass} />
        ) : (
          <select value={effectiveAgentType} onChange={e => setAgentType(e.target.value)} className={inputClass}>
            {types.map(type => (
              <option key={type.type} value={type.type}>
                {type.displayName} ({type.type})
              </option>
            ))}
          </select>
        )}
        <span className="block text-2xs text-muted">Gives the bot its personality and decides what it is allowed to do</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Who may DM it</span>
          <select value={directMessages} onChange={e => setDirectMessages(e.target.value as typeof directMessages)} className={inputClass}>
            <option value="listed">Only listed people</option>
            <option value="anyone">Anyone</option>
            <option value="none">Nobody — channels only</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">When invited to a group</span>
          <select value={joinPolicy} onChange={e => setJoinPolicy(e.target.value as typeof joinPolicy)} className={inputClass}>
            <option value="manual">Wait — join it from here</option>
            <option value="whenInvitedByAdmin">Join if one of its admins invited it</option>
            <option value="whenInvited">Join whoever invites it</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-2xs font-medium text-muted">First admin (optional)</span>
        <input
          type="text"
          value={adminTarget}
          onChange={e => setAdminTarget(e.target.value)}
          placeholder={targetExample}
          className={cn(inputClass, "font-mono", adminError && "border-rose-500/60")}
          spellCheck={false}
          autoComplete="off"
        />
        <span className={cn("block text-2xs", adminError ? "text-rose-500" : "text-muted")}>
          {adminError ??
            (directMessages === "listed"
              ? "Without someone listed here, nobody can DM this bot. Admins may also run slash commands."
              : "Admins may run slash commands against the bot's agent.")}
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-2xs font-medium text-muted">Join message (optional)</span>
        <input type="text" value={joinMessage} onChange={e => setJoinMessage(e.target.value)} placeholder="Helper reporting for duty." className={inputClass} />
        <span className="block text-2xs text-muted">Announced once in each channel the bot joins</span>
      </label>

      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={requireMention} onChange={e => setRequireMention(e.target.checked)} className="mt-0.5 cursor-pointer" />
        <span className="text-2xs text-muted">
          <span className="text-primary font-medium">Only answer when mentioned</span> in a channel. Turn this off and it replies to everything said in every
          channel it has joined.
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
          disabled={saving || !trimmedName || !!nameError || !!adminError || !effectiveAgentType}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg focus-ring cursor-pointer shadow-sm"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
          Create bot
        </button>
      </div>
    </form>
  );
}
