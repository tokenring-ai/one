import formatError from "@tokenring-ai/utility/error/formatError";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  KeyRound,
  ListChecks,
  Loader2,
  Lock,
  LockOpen,
  Plug,
  Plus,
  Search,
  Server,
  Unplug,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ModalShell from "../../components/ui/ModalShell.tsx";
import PasswordInput from "../../components/ui/PasswordInput.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import VaultSetupForm from "../../components/VaultSetupForm.tsx";
import { PaneLink } from "../../layout/links.tsx";
import { cn } from "../../lib/utils.ts";
import { aiRPCClient, useProviderStatuses, vaultRPCClient } from "../../rpc.ts";
import Badge from "../../ui/badge.tsx";
import Button from "../../ui/button.tsx";
import Checkbox from "../../ui/checkbox.tsx";
import Field from "../../ui/field.tsx";
import Select from "../../ui/select.tsx";
import TextField from "../../ui/text-field.tsx";
import { usePanelTitle } from "../panelHooks.ts";
import ProviderModelEditor, { type CustomModels, type DiscoveredModel, type ModelRow, rowFromDiscovered, rowsFromModels } from "./ProviderModelEditor.tsx";
import { AI_CLIENT_PLUGIN, CONFIGURATION_PLUGIN_VIEW } from "./shared.tsx";

type ProvidersData = NonNullable<ReturnType<typeof useProviderStatuses>["data"]>;
export type ProviderStatus = ProvidersData["providers"][number];
export type ProviderTemplate = ProvidersData["templates"][number];
type ConnectInput = Parameters<typeof aiRPCClient.connectProvider>[0];
type ConnectResult = Awaited<ReturnType<typeof aiRPCClient.connectProvider>>;
type CatalogUpdateResult = Awaited<ReturnType<typeof aiRPCClient.updateCatalog>>;
type EndpointType = "openai" | "anthropic";

/** How long a just-connected provider shows "Connecting…" while waiting for its models to come online. */
const CONNECTING_GRACE_MS = 20_000;
const VAULT_PATH = "/vault";
/** Where the custom-server form's own failures are shown (its name may clash with an existing card). */
const CUSTOM_NOTICE_KEY = "\u0000custom-server";

type Notice = { tone: "success" | "warning" | "danger"; text: string };

const MODEL_KINDS: readonly (keyof ProviderStatus["models"])[] = ["chat", "embedding", "image", "video", "speech", "transcription", "reranking"];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "12 chat models · 2 image models"; kinds with none are left out. */
export function describeModelCounts(models: ProviderStatus["models"]): string {
  const parts = MODEL_KINDS.filter(kind => models[kind] > 0).map(kind => `${models[kind]} ${kind} model${models[kind] === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(" · ") : "No models online";
}

/** Where the provider's key comes from, in words; null when there is nothing to say. */
export function describeKeySource(provider: ProviderStatus): string | null {
  switch (provider.keySource) {
    case "environment":
      return provider.keyEnv ? `Key from the ${provider.keyEnv} environment variable` : "Key from an environment variable";
    case "vault":
      return "Key saved in the vault";
    case "settings":
      return "Key in settings";
    default:
      return provider.kind === "cloud" ? null : provider.needsKey ? null : "No key needed";
  }
}

/** "OpenAI: 5 added, 12 changed, 3 removed" per provider, or that nothing changed. */
export function describeCatalogUpdate(providers: Extract<CatalogUpdateResult, { status: "success" }>["providers"]): string[] {
  if (providers.length === 0) return ["Already up to date"];
  return providers.map(({ name, added, changed, removed }) => {
    const parts = [
      added.length > 0 && `${added.length} added`,
      changed.length > 0 && `${changed.length} changed`,
      removed.length > 0 && `${removed.length} removed`,
    ].filter(Boolean);
    return `${name}: ${parts.length > 0 ? parts.join(", ") : "no changes"}`;
  });
}

const noticeClass: Record<Notice["tone"], string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

function NoticeLine({ notice }: { notice: Notice | undefined }) {
  if (!notice) return null;
  const Icon = notice.tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs", noticeClass[notice.tone])} role={notice.tone === "success" ? "status" : "alert"}>
      <Icon className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
      <span className="min-w-0">{notice.text}</span>
    </p>
  );
}

// ─── Vault ────────────────────────────────────────────────────────────────────

/** What the vault callout needs to know about where the vault password normally comes from. */
type VaultPasswordSource = "environment" | "other";

/**
 * The words for a locked vault, by where its password normally comes from. Never says "vault" without
 * saying what it is: the first sentence is always the plain one.
 */
export function describeLockedVault(source: VaultPasswordSource): { title: string; body: string; passwordHint: string } {
  const what = "Your keys are kept in an encrypted file on this computer (the vault).";
  const passwordHint = "Type the vault password you chose when you set up your vault. TokenRing cannot recover a lost password.";
  if (source === "environment") {
    return {
      title: "Your keys are locked",
      body: `${what} TokenRing was started with a vault password (the TR_VAULT_PASSWORD setting) that does not open it. Type the right password below, or fix that setting and restart TokenRing.`,
      passwordHint,
    };
  }
  return {
    title: "Unlock your keys to continue",
    body: `${what} TokenRing normally unlocks it for you, using a password kept in your computer's secure password store, so you shouldn't need to do anything. It is locked right now, either because it was locked on purpose or because that store was not available. Click Unlock to try again.`,
    passwordHint,
  };
}

/** The words for a vault that has never been created: what it is, and that the user picks its password. */
export const VAULT_SETUP_WORDS = {
  title: "Set up your vault",
  body: "Your keys and tokens are kept in an encrypted file on this computer (the vault). It does not exist yet: choose a password to create it.",
} as const;

/** Whether the server has no vault at all (not merely a locked one); false when that cannot be told. */
function useVaultNotSetUp(active: boolean): boolean {
  const [notSetUp, setNotSetUp] = useState(false);
  useEffect(() => {
    if (!active) {
      setNotSetUp(false);
      return;
    }
    const mounted = { current: true };
    void (async () => {
      try {
        const status = await vaultRPCClient.getStatus({});
        if (mounted.current) setNotSetUp(status.vaultExists === false && !status.unlocked);
      } catch {
        // Unknown: treat it as a locked vault.
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [active]);
  return notSetUp;
}

/**
 * Keys are saved to the vault, so a vault that is locked, or does not exist yet, blocks connecting. Unlock it
 * (or create it, when no vault file exists) here without leaving the screen. `onUnlocked` runs when the vault is open.
 */
export function VaultUnlockCallout({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "saved" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<VaultPasswordSource>("other");
  const [showPassword, setShowPassword] = useState(false);
  const [vaultExists, setVaultExists] = useState(true);
  const inputId = useId();
  const passwordHintId = useId();

  // Only tailors the wording; the callout works the same if the status can't be read.
  useEffect(() => {
    const mounted = { current: true };
    void (async () => {
      try {
        const status = await vaultRPCClient.getStatus({});
        if (!mounted.current) return;
        if (status.vaultExists === false && !status.unlocked) {
          setVaultExists(false);
          return;
        }
        if (status.passwordSource === "environment") {
          setSource("environment");
          setShowPassword(true);
        }
      } catch {
        // Keep the general wording.
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, []);

  const unlock = async (withPassword: boolean) => {
    setBusy(withPassword ? "password" : "saved");
    setError(null);
    try {
      const result = await vaultRPCClient.unlock(withPassword ? { password } : {});
      if (!result.success) {
        setError(result.message || "Could not unlock the vault");
        return;
      }
      setPassword("");
      onUnlocked();
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  };

  const words = describeLockedVault(source);

  if (!vaultExists) {
    return (
      <section
        className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 space-y-2.5"
        aria-label="Vault setup"
        data-testid="ai-providers-vault-setup"
      >
        <div className="flex items-start gap-2">
          <KeyRound className="w-4 h-4 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">{VAULT_SETUP_WORDS.title}</p>
            <p className="text-xs text-muted mt-0.5">{VAULT_SETUP_WORDS.body}</p>
          </div>
        </div>
        <VaultSetupForm onCreated={() => onUnlocked()} />
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 space-y-2.5"
      aria-label="Vault locked"
      data-testid="ai-providers-vault-locked"
    >
      <div className="flex items-start gap-2">
        <Lock className="w-4 h-4 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary">{words.title}</p>
          <p className="text-xs text-muted mt-0.5">
            {words.body}{" "}
            <Link to={VAULT_PATH} className="text-accent-soft hover:underline focus-ring rounded">
              Open the Vault
            </Link>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button icon={LockOpen} busy={busy === "saved"} disabled={busy !== null} onClick={() => void unlock(false)}>
          Unlock
        </Button>
        <Button variant="ghost" aria-expanded={showPassword} onClick={() => setShowPassword(open => !open)}>
          {showPassword ? "Hide password box" : "Use a password instead"}
        </Button>
      </div>
      {showPassword && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={event => {
            event.preventDefault();
            if (password) void unlock(true);
          }}
        >
          <Field label="Vault password" htmlFor={inputId} className="flex-1 min-w-48">
            <PasswordInput
              id={inputId}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              disabled={busy !== null}
              aria-describedby={passwordHintId}
            />
          </Field>
          <Button type="submit" icon={LockOpen} busy={busy === "password"} disabled={!password || busy !== null}>
            Unlock with password
          </Button>
          <p id={passwordHintId} className="basis-full text-xs text-muted">
            {words.passwordHint}
          </p>
        </form>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

// ─── Model lists ──────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function formatPrice(value: unknown): string {
  return typeof value === "number" ? `$${value}` : "—";
}

function formatContext(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : "—";
}

/** A catalog provider's copied model list, read-only: the catalog owns it. */
function CatalogModelList({ provider }: { provider: ProviderStatus }) {
  const [models, setModels] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    aiRPCClient
      .getProviderModels({ name: provider.name })
      .then(result => {
        if (cancelled) return;
        if (result.status === "success") setModels(result.models);
        else setError(result.message);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(formatError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [provider.name]);

  if (error) return <NoticeLine notice={{ tone: "danger", text: error }} />;
  if (!models) return <LoadingState message="Loading models…" size="sm" />;

  const sections = Object.entries(models).filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]) && Object.keys(entry[1]).length > 0);
  return (
    <div className="space-y-2" data-testid="catalog-model-list">
      <p className="text-xs text-muted">From the model catalog — updated with Update models.</p>
      {sections.length === 0 ? (
        <p className="text-xs text-muted">The catalog lists no models for {provider.name}.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-primary">
          <table className="w-full min-w-[28rem] text-xs" aria-label={`${provider.name} models`}>
            <thead className="bg-sunken text-muted text-left">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-medium">
                  Model
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium text-right">
                  Input $/M
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium text-right">
                  Output $/M
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium text-right">
                  Context
                </th>
              </tr>
            </thead>
            {sections.map(([kind, entries]) => (
              <tbody key={kind}>
                {sections.length > 1 && (
                  <tr className="border-t border-primary">
                    <th scope="rowgroup" colSpan={4} className="px-2 py-1 text-left font-medium text-secondary capitalize">
                      {kind}
                    </th>
                  </tr>
                )}
                {Object.entries(entries).map(([name, raw]) => {
                  const spec = isRecord(raw) ? raw : {};
                  return (
                    <tr key={name} className="border-t border-primary">
                      <td className="px-2 py-1 font-mono break-all">{name}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatPrice(spec.costPerMillionInputTokens)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatPrice(spec.costPerMillionOutputTokens)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatContext(spec.maxContextLength)}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}

async function discover(input: Parameters<typeof aiRPCClient.discoverModels>[0]): Promise<DiscoveredModel[] | string> {
  const result = await aiRPCClient.discoverModels(input);
  return result.status === "success" ? result.models : result.message;
}

/** A custom provider's own model list, loaded and opened in the editor. */
function CustomModelsPanel({ provider, onSaved, onClose }: { provider: ProviderStatus; onSaved: (provider: ProviderStatus) => void; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ rows: ModelRow[]; addServerModels: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    aiRPCClient
      .getProviderModels({ name: provider.name })
      .then(result => {
        if (cancelled) return;
        if (result.status === "success") setLoaded({ rows: rowsFromModels(result.models), addServerModels: result.addServerModels });
        else setError(result.message);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(formatError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [provider.name]);

  if (error) return <NoticeLine notice={{ tone: "danger", text: error }} />;
  if (!loaded) return <LoadingState message="Loading models…" size="sm" />;
  return (
    <ProviderModelEditor
      label={provider.name}
      initialRows={loaded.rows}
      initialAddServerModels={loaded.addServerModels}
      onRediscover={() => discover({ name: provider.name })}
      onCancel={onClose}
      onSave={async (models, addServerModels) => {
        const result = await aiRPCClient.updateProviderModels({ name: provider.name, models, addServerModels });
        if (result.status !== "success") return result.message;
        onSaved(result.provider);
        return null;
      }}
    />
  );
}

// ─── Connected ────────────────────────────────────────────────────────────────

function KeySourceLine({ provider }: { provider: ProviderStatus }) {
  const keySource = describeKeySource(provider);
  const showAddress = provider.kind !== "cloud" && provider.baseURL;
  if (!keySource && !showAddress) return null;
  return (
    <p className="text-xs text-muted truncate">
      {keySource}
      {keySource && showAddress ? " · " : null}
      {showAddress ? <span className="font-mono">{provider.baseURL}</span> : null}
      {provider.keySource === "settings" ? (
        <>
          {" · "}
          <PaneLink view={CONFIGURATION_PLUGIN_VIEW} params={{ plugin: AI_CLIENT_PLUGIN }} className="text-accent-soft hover:underline focus-ring rounded">
            Edit in settings
          </PaneLink>
        </>
      ) : null}
    </p>
  );
}

/** A new key or address for a connected provider that isn't working. */
function FixConnectionForm({ provider, onConnect }: { provider: ProviderStatus; onConnect: (input: ConnectInput) => Promise<boolean> }) {
  const hasAddress = provider.kind !== "cloud" && provider.baseURL !== undefined;
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState(provider.baseURL ?? "");
  const [busy, setBusy] = useState(false);
  const keyId = useId();
  const canSubmit = apiKey.trim() !== "" || (hasAddress && baseURL.trim() !== "");

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const key = apiKey.trim();
      const ok = await onConnect({ name: provider.name, ...(key && { apiKey: key }), ...(hasAddress && baseURL.trim() && { baseURL: baseURL.trim() }) });
      // The key lives in the vault now; don't keep a copy in the page.
      if (ok) setApiKey("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
      aria-label={`Fix ${provider.name}`}
    >
      {hasAddress && (
        <TextField
          label="Where it runs (server address)"
          value={baseURL}
          onChange={setBaseURL}
          mono
          aria-label={`${provider.name} server address`}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-48"
        />
      )}
      <Field label={provider.needsKey && provider.keySource === "none" ? "API key" : "New API key (optional)"} htmlFor={keyId} className="flex-1 min-w-48">
        <PasswordInput
          id={keyId}
          value={apiKey}
          onChange={setApiKey}
          aria-label={`${provider.name} API key`}
          autoComplete="off"
          spellCheck={false}
          placeholder={provider.keyEnv ? `Paste your ${provider.keyEnv}` : "Paste your key"}
        />
      </Field>
      <Button type="submit" icon={KeyRound} busy={busy} disabled={!canSubmit} aria-label={`Save ${provider.name}`}>
        {hasAddress ? "Retry" : "Save key"}
      </Button>
    </form>
  );
}

function ConnectedRow({
  provider,
  notice,
  connecting,
  busy,
  onConnect,
  onDisconnect,
  onModelsSaved,
}: {
  provider: ProviderStatus;
  notice: Notice | undefined;
  connecting: boolean;
  busy: boolean;
  onConnect: (input: ConnectInput) => Promise<boolean>;
  onDisconnect: () => void;
  onModelsSaved: (provider: ProviderStatus) => void;
}) {
  const [open, setOpen] = useState<"catalog" | "edit" | null>(null);
  const panelId = useId();
  const working = provider.state === "connected";
  const toggle = (panel: "catalog" | "edit") => setOpen(current => (current === panel ? null : panel));

  return (
    <li className="rounded-lg border border-primary bg-secondary px-3 py-2.5 space-y-2" aria-label={provider.name}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {working ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0 text-warning" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-40">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium text-primary truncate">{provider.name}</p>
            {connecting && !working ? (
              <Badge tone="info">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Connecting…
              </Badge>
            ) : provider.state === "offline" ? (
              <Badge tone="warning">Offline</Badge>
            ) : provider.state === "needsKey" ? (
              <Badge tone="warning">Needs a key</Badge>
            ) : null}
            {provider.kind === "custom" && <Badge tone="neutral">Custom</Badge>}
          </div>
          <p className="text-xs text-secondary">{describeModelCounts(provider.models)}</p>
          <KeySourceLine provider={provider} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {provider.catalog && !provider.editableModels && (
            <Button
              variant="ghost"
              icon={open === "catalog" ? ChevronDown : ChevronRight}
              aria-expanded={open === "catalog"}
              aria-controls={panelId}
              aria-label={`${provider.name} models`}
              onClick={() => toggle("catalog")}
            >
              Models
            </Button>
          )}
          {provider.editableModels && (
            <Button
              variant="ghost"
              icon={ListChecks}
              aria-expanded={open === "edit"}
              aria-controls={panelId}
              aria-label={`Edit ${provider.name} models`}
              onClick={() => toggle("edit")}
            >
              Edit models
            </Button>
          )}
          <Button variant="ghost" icon={Unplug} busy={busy} onClick={onDisconnect} aria-label={`Disconnect ${provider.name}`}>
            Disconnect
          </Button>
        </div>
      </div>
      {!working && !connecting && provider.message && <p className="text-xs text-warning">{provider.message}</p>}
      {!working && <FixConnectionForm provider={provider} onConnect={onConnect} />}
      <NoticeLine notice={notice} />
      {open && (
        <div id={panelId} className="pt-1">
          {open === "catalog" ? (
            <CatalogModelList provider={provider} />
          ) : (
            <CustomModelsPanel
              provider={provider}
              onClose={() => setOpen(null)}
              onSaved={saved => {
                setOpen(null);
                onModelsSaved(saved);
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

// ─── Add a provider ───────────────────────────────────────────────────────────

/** What a first-time user needs to know about the providers we point them to first. */
export const RECOMMENDED_PROVIDERS: Readonly<Record<string, string>> = {
  OpenAI: "Makes ChatGPT. Choose this if you have an OpenAI account.",
  Anthropic: "Makes Claude. Choose this if you have an Anthropic account.",
  Google: "Makes Gemini. Choose this if you have a Google AI Studio account.",
};
const RECOMMENDED_ORDER = Object.keys(RECOMMENDED_PROVIDERS);

/** Splits templates into the recommended few (in a fixed order) and the rest (in the server's order). */
export function groupTemplates(templates: readonly ProviderTemplate[]): { recommended: ProviderTemplate[]; more: ProviderTemplate[] } {
  const recommended = RECOMMENDED_ORDER.flatMap(name => templates.filter(template => template.name === name));
  return { recommended, more: templates.filter(template => !recommended.includes(template)) };
}

/** Whether a template matches what the user typed into the provider filter (name, maker or description). */
export function templateMatches(template: ProviderTemplate, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [template.name, template.provider, template.description].some(field => field.toLowerCase().includes(needle));
}

function TemplateCard({
  template,
  notice,
  onConnect,
  blurb,
}: {
  template: ProviderTemplate;
  notice: Notice | undefined;
  onConnect: (input: ConnectInput) => Promise<boolean>;
  /** A plain-language line about who this is for, shown first on recommended providers. */
  blurb?: string | undefined;
}) {
  const isLocal = template.kind === "local";
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState(template.baseURL ?? "");
  const [busy, setBusy] = useState(false);
  const keyId = useId();
  const keyRequired = template.needsKey && !template.keyInVault;

  const canSubmit = (!isLocal || baseURL.trim() !== "") && (!keyRequired || apiKey.trim() !== "");

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const key = apiKey.trim();
      const address = baseURL.trim();
      const ok = await onConnect({ template: template.name, ...(key && { apiKey: key }), ...(isLocal && address && { baseURL: address }) });
      // The key lives in the vault now; don't keep a copy in the page.
      if (ok) setApiKey("");
    } finally {
      setBusy(false);
    }
  };

  const keyLabel = keyRequired ? "API key" : "API key (optional)";
  const placeholder = template.keyInVault
    ? "Leave blank to use the saved key"
    : isLocal
      ? "Usually not needed"
      : template.keyEnv
        ? `Paste your ${template.keyEnv}`
        : "Paste your key";

  return (
    <li className="rounded-lg border border-primary bg-secondary p-3 flex flex-col gap-2.5" aria-label={template.name}>
      <div className="flex items-start gap-2">
        {isLocal ? (
          <Server className="w-4 h-4 shrink-0 mt-0.5 text-muted" aria-hidden="true" />
        ) : (
          <Plug className="w-4 h-4 shrink-0 mt-0.5 text-muted" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium text-primary">{template.name}</p>
            {template.keyInVault && (
              <Badge tone="success">
                <KeyRound className="w-3 h-3" aria-hidden="true" /> Key already in your vault
              </Badge>
            )}
          </div>
          {blurb && <p className="text-xs text-primary mt-0.5">{blurb}</p>}
          {template.description && <p className="text-xs text-muted mt-0.5">{template.description}</p>}
          {blurb && template.needsKey && (
            <p className="text-xs text-muted mt-0.5">
              The key is a long password that lets TokenRing use your account. You create it
              {template.keyUrl ? " on the provider's website" : " from your provider's account page"}; it is billed by use, separately from any chat
              subscription.
            </p>
          )}
          {template.catalogModels !== undefined && template.catalogModels > 0 && (
            <p className="text-xs text-muted mt-0.5">Copies {plural(template.catalogModels, "model")} from the catalog</p>
          )}
        </div>
      </div>

      <form
        className="flex flex-col gap-2 mt-auto"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
        aria-label={`Connect ${template.name}`}
      >
        {isLocal && (
          <TextField
            label="Where it runs (server address)"
            value={baseURL}
            onChange={setBaseURL}
            mono
            placeholder="http://127.0.0.1:11434/v1"
            aria-label={`${template.name} server address`}
            autoComplete="off"
            spellCheck={false}
          />
        )}
        <Field label={keyLabel} htmlFor={keyId}>
          <PasswordInput
            id={keyId}
            value={apiKey}
            onChange={setApiKey}
            aria-label={`${template.name} API key`}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" icon={Plug} busy={busy} disabled={!canSubmit} aria-label={`Connect ${template.name}`}>
            Connect
          </Button>
          {template.keyUrl && (
            <a
              href={template.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent-soft hover:underline focus-ring rounded"
            >
              Get a key <ExternalLink className="w-3 h-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
      </form>
      <NoticeLine notice={notice} />
    </li>
  );
}

// ─── Custom server ────────────────────────────────────────────────────────────

/**
 * Adding a custom server, step by step: where it is, then which of its models to use (found by asking it,
 * priced from the catalog where a model matches), then save. Or skip the list and use whatever it serves.
 */
function CustomServerForm({ onConnect }: { onConnect: (input: ConnectInput) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [endpointType, setEndpointType] = useState<EndpointType>("openai");
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [useAll, setUseAll] = useState(false);
  const [busy, setBusy] = useState<"find" | "save" | null>(null);
  const [findError, setFindError] = useState<string | null>(null);
  /** Set once the server has listed its models; the editor takes over from there. */
  const [found, setFound] = useState<{ rows: ModelRow[]; generation: number } | null>(null);
  /** Bumped by every connection edit and every find, so a reply about an older address is dropped. */
  const generation = useRef(0);
  const keyId = useId();
  const useAllId = useId();

  const canFind = name.trim() !== "" && baseURL.trim() !== "";

  const discoverInput = () => {
    const key = apiKey.trim();
    return { baseURL: baseURL.trim(), endpointType, ...(key && { apiKey: key }) };
  };

  const reset = () => {
    setName("");
    setBaseURL("");
    setApiKey("");
    setUseAll(false);
    setFound(null);
  };

  const save = async (models: CustomModels | undefined, addServerModels: boolean): Promise<boolean> => {
    const key = apiKey.trim();
    const ok = await onConnect({
      custom: {
        name: name.trim(),
        endpointType,
        baseURL: baseURL.trim(),
        ...(key && { apiKey: key }),
        ...(models && { models }),
        addServerModels,
      },
    });
    if (ok) reset();
    return ok;
  };

  const find = async () => {
    if (!canFind || busy) return;
    setBusy("find");
    setFindError(null);
    generation.current += 1;
    const asked = generation.current;
    try {
      const result = await discover(discoverInput());
      if (asked !== generation.current) return;
      if (typeof result === "string") {
        setFindError(result);
        return;
      }
      setFound({ rows: result.map(model => rowFromDiscovered(model, true)), generation: asked });
    } catch (err: unknown) {
      if (asked === generation.current) setFindError(formatError(err));
    } finally {
      setBusy(null);
    }
  };

  const saveWithoutList = async () => {
    if (!canFind || busy) return;
    setBusy("save");
    try {
      await save(undefined, true);
    } finally {
      setBusy(null);
    }
  };

  // Changing where the server is invalidates the list it gave.
  const editConnection =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      generation.current += 1;
      setFound(null);
    };
  const finding = busy === "find";

  return (
    <div className="rounded-lg border border-primary bg-secondary p-3 space-y-3">
      <form
        className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]"
        onSubmit={event => {
          event.preventDefault();
          void (useAll ? saveWithoutList() : find());
        }}
        aria-label="Add a custom server"
      >
        <TextField label="Name" value={name} onChange={setName} placeholder="My vLLM box" autoComplete="off" maxLength={64} />
        <Select
          label="Compatible with"
          value={endpointType}
          onChange={editConnection(value => setEndpointType(value === "anthropic" ? "anthropic" : "openai"))}
          disabled={finding}
        >
          <option value="openai">OpenAI API</option>
          <option value="anthropic">Anthropic API</option>
        </Select>
        <TextField
          label="Where it runs (server address)"
          value={baseURL}
          onChange={editConnection(setBaseURL)}
          mono
          placeholder="http://192.168.1.20:8000/v1"
          disabled={finding}
          autoComplete="off"
          spellCheck={false}
        />
        <Field label="API key (optional)" htmlFor={keyId}>
          <PasswordInput id={keyId} value={apiKey} onChange={editConnection(setApiKey)} disabled={finding} autoComplete="off" spellCheck={false} />
        </Field>
        <div className="col-span-full flex flex-wrap items-center gap-3">
          <Checkbox id={useAllId} checked={useAll} onChange={setUseAll} label="Use every model the server lists" />
          {useAll ? (
            <Button type="submit" icon={Plus} busy={busy === "save"} disabled={!canFind || busy !== null}>
              Add server
            </Button>
          ) : (
            <Button type="submit" icon={Search} busy={busy === "find"} disabled={!canFind || busy !== null}>
              Find models
            </Button>
          )}
        </div>
      </form>
      {findError && <NoticeLine notice={{ tone: "danger", text: findError }} />}
      {found && !useAll && (
        <section className="space-y-2" aria-label="Choose models">
          <p className="text-xs text-muted">
            The server lists {plural(found.rows.length, "model")}. Pick the ones to use, name them, and set prices — local servers can stay at $0.
          </p>
          <ProviderModelEditor
            key={found.generation}
            label={name.trim() || "Custom server"}
            initialRows={found.rows}
            initialAddServerModels={false}
            saveLabel="Add server"
            onRediscover={() => discover(discoverInput())}
            onCancel={() => setFound(null)}
            onSave={async (models, addServerModels) => {
              const ok = await save(models, addServerModels);
              // A failure is shown under the form.
              return ok ? null : "";
            }}
          />
        </section>
      )}
    </div>
  );
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

function DisconnectDialog({ provider, onClose, onConfirm }: { provider: ProviderStatus; onClose: () => void; onConfirm: (forgetKey: boolean) => void }) {
  const [forgetKey, setForgetKey] = useState(false);
  const forgetId = useId();
  const keyInVault = provider.keySource === "vault";
  return (
    <ModalShell
      title={`Disconnect ${provider.name}?`}
      onClose={onClose}
      showCloseButton={false}
      confirmLabel="Disconnect"
      confirmIcon={Unplug}
      tone="danger"
      onConfirm={() => onConfirm(keyInVault && forgetKey)}
    >
      <p className="text-xs text-muted mb-3">
        Remove {provider.name} from your settings. Agents using its models stop working until you connect it again.
        {keyInVault ? " Its key stays in the vault, so reconnecting needs no key." : ""}
      </p>
      {keyInVault && <Checkbox id={forgetId} checked={forgetKey} onChange={setForgetKey} label="Also delete the key from the vault" className="mb-4" />}
    </ModalShell>
  );
}

// ─── Catalog update ───────────────────────────────────────────────────────────

function UpdateModelsButton({ onUpdated }: { onUpdated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ lines: string[] } | { error: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const update = await aiRPCClient.updateCatalog({});
      if (update.status === "success") {
        setResult({ lines: describeCatalogUpdate(update.providers) });
        onUpdated();
      } else {
        setResult({ error: update.message });
      }
    } catch (err: unknown) {
      setResult({ error: formatError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Button variant="secondary" icon={Download} busy={busy} onClick={() => void run()}>
        Update models
      </Button>
      {result &&
        ("error" in result ? (
          <NoticeLine notice={{ tone: "danger", text: result.error }} />
        ) : (
          <ul className="text-xs text-secondary space-y-0.5" role="status" aria-label="Model update summary">
            {result.lines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ))}
    </div>
  );
}

// ─── Add a provider (recommended first, the rest folded away) ────────────────

function AddProviderSections({
  templates,
  notices,
  onConnect,
}: {
  templates: readonly ProviderTemplate[];
  notices: Record<string, Notice>;
  onConnect: (input: ConnectInput, failureKey: string) => Promise<boolean>;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");
  const moreId = useId();
  const { recommended, more } = groupTemplates(templates);
  const searching = query.trim() !== "";
  const shown = searching ? more.filter(template => templateMatches(template, query)) : more;
  const showMore = moreOpen || searching;

  if (templates.length === 0) {
    return (
      <Section title="Add a provider">
        <EmptyState variant="inline" title="Every provider is connected" hint="Add a custom server below." />
      </Section>
    );
  }

  return (
    <>
      {recommended.length > 0 && (
        <Section
          title="Start here"
          hint="A provider is the company whose AI you will use. If you have an account with one of these, paste a key and you are ready. Your key is saved in your vault."
        >
          <ul className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]" aria-label="Recommended providers">
            {recommended.map(template => (
              <TemplateCard
                key={template.name}
                template={template}
                notice={notices[template.name]}
                blurb={RECOMMENDED_PROVIDERS[template.name]}
                onConnect={input => onConnect(input, template.name)}
              />
            ))}
          </ul>
        </Section>
      )}

      {more.length > 0 && (
        <section className="space-y-2" aria-label="More providers">
          <Button
            variant="ghost"
            icon={showMore ? ChevronDown : ChevronRight}
            aria-expanded={showMore}
            aria-controls={moreId}
            onClick={() => setMoreOpen(open => !open)}
            disabled={searching}
          >
            More providers ({more.length})
          </Button>
          {showMore && (
            <div id={moreId} className="space-y-2">
              <p className="text-xs text-muted">Other AI companies, plus AI that runs on your own computer. You only need one provider to get started.</p>
              <TextField label="Find a provider" value={query} onChange={setQuery} placeholder="Name or what it does" autoComplete="off" />
              {shown.length === 0 ? (
                <p className="text-xs text-muted">{`No provider matches "${query.trim()}".`}</p>
              ) : (
                <ul className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]" aria-label="Available providers">
                  {shown.map(template => (
                    <TemplateCard
                      key={template.name}
                      template={template}
                      notice={notices[template.name]}
                      onConnect={input => onConnect(input, template.name)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

// ─── View ─────────────────────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2" aria-label={title}>
      <div>
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {hint ? <p className="text-xs text-muted mt-0.5">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Connect a model provider: what is connected (and its models), the providers that can be connected (each
 * copies its model list from the catalog), and any other OpenAI/Anthropic-compatible server with a model list
 * the user builds. Keys go to the vault, so a locked vault gets an inline unlock.
 */
export default function AIProvidersView() {
  usePanelTitle("AI providers");
  const providers = useProviderStatuses();
  const [notices, setNotices] = useState<Record<string, Notice>>({});
  /** Providers connected from this screen that have no models yet (a local server warming up). */
  const [pending, setPending] = useState<Record<string, true>>({});
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState<ProviderStatus | null>(null);
  /** Set when a save came back vaultLocked before the stream caught up. */
  const [vaultLockedSeen, setVaultLockedSeen] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const timer of pendingTimers.values()) clearTimeout(timer);
    };
  }, []);

  const setNotice = useCallback((name: string, notice: Notice | null) => {
    setNotices(current => {
      const next = { ...current };
      if (notice) next[name] = notice;
      else delete next[name];
      return next;
    });
  }, []);

  const markPending = useCallback((name: string) => {
    setPending(current => ({ ...current, [name]: true }));
    const existing = timers.current.get(name);
    if (existing) clearTimeout(existing);
    timers.current.set(
      name,
      setTimeout(() => {
        timers.current.delete(name);
        setPending(current => {
          const next = { ...current };
          delete next[name];
          return next;
        });
      }, CONNECTING_GRACE_MS),
    );
  }, []);

  const { mutate } = providers;
  const vaultLockedNow = !!providers.data && (!providers.data.canSaveKeys || vaultLockedSeen);
  const vaultNotSetUp = useVaultNotSetUp(vaultLockedNow);
  const calloutRef = useRef<HTMLDivElement>(null);

  const reportProvider = useCallback(
    (provider: ProviderStatus, warning: string | undefined, success: string) => {
      if (provider.state === "connected") {
        setNotice(provider.name, warning ? { tone: "warning", text: warning } : { tone: "success", text: success });
      } else {
        markPending(provider.name);
        setNotice(provider.name, warning ? { tone: "warning", text: warning } : null);
      }
      void mutate();
    },
    [markPending, mutate, setNotice],
  );

  const connect = useCallback(
    async (input: ConnectInput, failureKey: string): Promise<boolean> => {
      setNotice(failureKey, null);
      if (vaultNotSetUp && ("custom" in input ? input.custom.apiKey : input.apiKey)) {
        // A key cannot be saved yet: lead to the setup step instead of sending it to a vault that does not exist.
        setNotice(failureKey, { tone: "warning", text: "Set up your vault first (above), then connect: your key is saved there." });
        const callout = calloutRef.current;
        // jsdom (and very old browsers) have no scrollIntoView.
        if (callout && "scrollIntoView" in callout) callout.scrollIntoView({ block: "center" });
        return false;
      }
      let result: ConnectResult;
      try {
        result = await aiRPCClient.connectProvider(input);
      } catch (error: unknown) {
        setNotice(failureKey, { tone: "danger", text: formatError(error) });
        return false;
      }
      if (result.status !== "success") {
        if (result.status === "vaultLocked") setVaultLockedSeen(true);
        setNotice(failureKey, { tone: "danger", text: result.message });
        return false;
      }
      reportProvider(result.provider, result.warning, `Connected — ${describeModelCounts(result.provider.models)}.`);
      return true;
    },
    [reportProvider, setNotice, vaultNotSetUp],
  );

  const disconnect = useCallback(
    async (provider: ProviderStatus, forgetKey: boolean) => {
      setDisconnecting(provider.name);
      setNotice(provider.name, null);
      try {
        const result = await aiRPCClient.disconnectProvider({ name: provider.name, forgetKey });
        if (result.status === "success") {
          // The row goes away; its template card comes back and carries the message.
          setNotice(provider.name, { tone: "success", text: result.message });
          void mutate();
        } else {
          if (result.status === "vaultLocked") setVaultLockedSeen(true);
          setNotice(provider.name, { tone: result.status === "vaultLocked" ? "danger" : "warning", text: result.message });
        }
      } catch (error: unknown) {
        setNotice(provider.name, { tone: "danger", text: formatError(error) });
      } finally {
        setDisconnecting(null);
      }
    },
    [mutate, setNotice],
  );

  const onUnlocked = useCallback(() => {
    setVaultLockedSeen(false);
    void mutate();
  }, [mutate]);

  const data = providers.data;
  let body: ReactNode;
  if (!data && providers.isLoading) {
    body = <LoadingState message="Checking AI providers…" size="sm" />;
  } else if (!data) {
    body = <ErrorState title="Could not load AI providers" error={providers.error} onRetry={() => void mutate()} variant="inline" />;
  } else {
    const vaultLocked = !data.canSaveKeys || vaultLockedSeen;
    const anyWorking = data.providers.some(provider => provider.state === "connected");
    const catalogWarning = data.catalogWarning;
    body = (
      <>
        {catalogWarning && (
          <div
            className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5"
            role="alert"
            data-testid="ai-providers-catalog-warning"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
            <p className="text-xs text-primary min-w-0">{catalogWarning}</p>
          </div>
        )}
        {vaultLocked && (
          <div ref={calloutRef}>
            <VaultUnlockCallout onUnlocked={onUnlocked} />
          </div>
        )}

        <Section title="Connected">
          {!anyWorking && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5" data-testid="ai-providers-none-connected">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
              <p className="text-xs text-primary">
                {data.providers.length === 0
                  ? "No provider is connected yet. Pick one below and paste its API key, or use an AI that runs on your own computer."
                  : "No connected provider has models online yet."}
              </p>
            </div>
          )}
          {data.providers.length > 0 && (
            <ul className="space-y-2" aria-label="Connected providers">
              {data.providers.map(provider => (
                <ConnectedRow
                  key={provider.name}
                  provider={provider}
                  notice={notices[provider.name]}
                  connecting={pending[provider.name] === true}
                  busy={disconnecting === provider.name}
                  onConnect={input => connect(input, provider.name)}
                  onDisconnect={() => setConfirmingDisconnect(provider)}
                  onModelsSaved={saved => reportProvider(saved, undefined, `Models saved — ${describeModelCounts(saved.models)}.`)}
                />
              ))}
            </ul>
          )}
        </Section>

        <AddProviderSections templates={data.templates} notices={notices} onConnect={connect} />

        <Section
          title="Add a custom server"
          hint="For advanced setups: an AI server you or your company run yourself (on this computer or another one), as long as it works like OpenAI or Anthropic. Most people can skip this."
        >
          <CustomServerForm onConnect={input => connect(input, CUSTOM_NOTICE_KEY)} />
          <NoticeLine notice={notices[CUSTOM_NOTICE_KEY]} />
        </Section>
      </>
    );
  }

  return (
    <ViewShell pad="page" width="prose" data-testid="ai-providers-view">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-primary">AI providers</h2>
            <p className="text-xs text-muted mt-0.5">
              The assistants in TokenRing need an AI service to think with. Connect one by pasting a key from your account with it. Your key is kept in an
              encrypted file on this computer (the vault).
            </p>
          </div>
          {data && <UpdateModelsButton onUpdated={() => void mutate()} />}
        </div>
        {body}
      </div>
      {confirmingDisconnect && (
        <DisconnectDialog
          provider={confirmingDisconnect}
          onClose={() => setConfirmingDisconnect(null)}
          onConfirm={forgetKey => {
            const provider = confirmingDisconnect;
            setConfirmingDisconnect(null);
            void disconnect(provider, forgetKey);
          }}
        />
      )}
    </ViewShell>
  );
}
