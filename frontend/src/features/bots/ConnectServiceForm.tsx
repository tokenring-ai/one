import type { ConfigScope } from "@tokenring-ai/app";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, PlugZap, X } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import { formatConfigIssues, updateConfigLayer } from "../../lib/configWrites.ts";
import { cn } from "../../lib/utils.ts";

export type ConnectablePlatform = "telegram" | "slack" | "x" | "reddit";

type CredentialField = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  hint?: string;
};

type PlatformSpec = {
  label: string;
  /** Top-level configuration key the plugin owns. */
  configKey: ConnectablePlatform;
  defaultAccountName: string;
  setup: string;
  fields: CredentialField[];
};

export const PLATFORMS: Record<ConnectablePlatform, PlatformSpec> = {
  telegram: {
    label: "Telegram",
    configKey: "telegram",
    defaultAccountName: "telegram",
    setup: "Create a bot with @BotFather, then paste the token it gives you. Turn its privacy mode off if you want the bot to answer in groups.",
    fields: [{ key: "botToken", label: "Bot token", placeholder: "123456789:AAE…", required: true }],
  },
  slack: {
    label: "Slack",
    configKey: "slack",
    defaultAccountName: "slack",
    setup:
      "Create a Slack app with the app_mentions:read, channels:history, channels:read, chat:write, files:read, groups:read, im:history and im:write scopes, and subscribe it to member_joined_channel and member_left_channel.",
    fields: [
      { key: "botToken", label: "Bot OAuth token", placeholder: "xoxb-…", required: true },
      { key: "signingSecret", label: "Signing secret", placeholder: "", required: true },
      {
        key: "appToken",
        label: "App-level token",
        placeholder: "xapp-…",
        required: false,
        hint: "Optional. Enables Socket Mode, so the app needs no public HTTP endpoint.",
      },
    ],
  },
  x: {
    label: "X / Twitter",
    configKey: "x",
    defaultAccountName: "x",
    setup:
      "Create an X developer app and paste an OAuth 2.0 user-context access token for the account the bot should speak as. Typical scopes: tweet.read, tweet.write, users.read, dm.read, dm.write.",
    fields: [
      {
        key: "accessToken",
        label: "Access token",
        placeholder: "AAAA…",
        required: true,
        hint: "User-context Bearer token. Mentions and DMs are polled; no public webhook is required.",
      },
    ],
  },
  reddit: {
    label: "Reddit",
    configKey: "reddit",
    defaultAccountName: "reddit",
    setup:
      "Create a Reddit app and paste an OAuth access token for the account the bot should speak as. Typical scopes: identity, privatemessages, submit, read, edit. Inbox is polled for comment replies and private messages. Refresh-token auth can be added later under Configuration.",
    fields: [
      {
        key: "accessToken",
        label: "Access token",
        placeholder: "",
        required: true,
        hint: "Bearer access token for the Reddit account.",
      },
    ],
  },
};

type ConnectServiceFormProps = {
  /** Platforms whose plugin is installed, so nothing unusable is offered. */
  available: ConnectablePlatform[];
  initialPlatform?: ConnectablePlatform | undefined;
  /** Account names already configured, so an accidental overwrite is flagged. */
  existingAccounts: string[];
  onConnected: () => void;
  onCancel: () => void;
};

export default function ConnectServiceForm({ available, initialPlatform, existingAccounts, onConnected, onCancel }: ConnectServiceFormProps) {
  const [platform, setPlatform] = useState<ConnectablePlatform>(initialPlatform ?? available[0] ?? "telegram");
  const spec = PLATFORMS[platform];

  const [accountName, setAccountName] = useState(spec.defaultAccountName);
  const [scope, setScope] = useState<ConfigScope>("global");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const selectPlatform = (next: ConnectablePlatform) => {
    setPlatform(next);
    setAccountName(PLATFORMS[next].defaultAccountName);
    setCredentials({});
  };

  const trimmedName = accountName.trim();
  const overwriting = useMemo(() => existingAccounts.includes(trimmedName), [existingAccounts, trimmedName]);
  const missingRequired = spec.fields.some(field => field.required && !credentials[field.key]?.trim());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmedName) {
      toastManager.error("The account needs a name — it is what bots address, as in telegram:123456789", { duration: 4000 });
      return;
    }
    if (missingRequired) return;

    setSaving(true);
    try {
      const result = await updateConfigLayer(scope, overrides => {
        const plugin = (overrides[spec.configKey] ?? {}) as { accounts?: Record<string, unknown> };
        const accounts = plugin.accounts ?? {};
        const existing = (accounts[trimmedName] ?? {}) as Record<string, unknown>;

        // Blank optional fields are left alone rather than written as empty
        // strings, which the schema would take for a real credential.
        const entered: Record<string, string> = {};
        for (const field of spec.fields) {
          const value = credentials[field.key]?.trim();
          if (value) entered[field.key] = value;
        }

        return {
          ...overrides,
          [spec.configKey]: { ...plugin, accounts: { ...accounts, [trimmedName]: { ...existing, ...entered } } },
        };
      });

      if (!result.ok) {
        toastManager.error(formatConfigIssues(result.issues), { duration: 6000 });
        return;
      }

      toastManager.success(`${spec.label} account "${trimmedName}" connected`, { duration: 3000 });
      onConnected();
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
          <h3 className="text-sm font-semibold text-primary">Connect a messaging service</h3>
          <p className="text-2xs text-muted mt-0.5">Credentials are stored in your configuration and take effect immediately — no restart</p>
        </div>
        <button type="button" onClick={onCancel} className="p-1.5 text-muted hover:text-primary rounded-md focus-ring cursor-pointer" aria-label="Cancel">
          <X className="w-4 h-4" />
        </button>
      </div>

      {available.length > 1 ? (
        <div className="flex items-center gap-1.5">
          {available.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => selectPlatform(option)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors focus-ring cursor-pointer",
                platform === option ? "border-accent text-primary bg-accent/10 font-medium" : "border-primary text-muted hover:text-primary",
              )}
            >
              {PLATFORMS[option].label}
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-2xs text-muted bg-tertiary border border-primary rounded-lg px-3 py-2">{spec.setup}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Account name</span>
          <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} className={inputClass} spellCheck={false} autoComplete="off" />
          <span className="block text-2xs text-muted">
            {overwriting ? `Replaces the credentials of the existing "${trimmedName}" account` : `Bots address it as ${trimmedName || "name"}:userId`}
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-2xs font-medium text-muted">Save to</span>
          <select value={scope} onChange={e => setScope(e.target.value as ConfigScope)} className={inputClass}>
            <option value="user">User configuration — only you</option>
            <option value="project">Project configuration — everyone on this project</option>
          </select>
        </label>
      </div>

      {spec.fields.map(field => (
        <label key={field.key} className="block space-y-1">
          <span className="text-2xs font-medium text-muted">
            {field.label}
            {field.required ? "" : " (optional)"}
          </span>
          <input
            type="password"
            value={credentials[field.key] ?? ""}
            onChange={e => setCredentials(current => ({ ...current, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
            className={cn(inputClass, "font-mono")}
            spellCheck={false}
            autoComplete="off"
          />
          {field.hint ? <span className="block text-2xs text-muted">{field.hint}</span> : null}
        </label>
      ))}

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
          disabled={saving || missingRequired || !trimmedName}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg focus-ring cursor-pointer shadow-sm"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
          Connect {spec.label}
        </button>
      </div>
    </form>
  );
}
