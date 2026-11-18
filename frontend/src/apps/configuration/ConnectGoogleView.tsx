import formatError from "@tokenring-ai/utility/error/formatError";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Loader2, Mail, Unplug } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ConfirmModal from "../../components/ui/ConfirmModal.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import PasswordInput from "../../components/ui/PasswordInput.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { googleRPCClient } from "../../rpc.ts";
import Badge from "../../ui/badge.tsx";
import Button from "../../ui/button.tsx";
import Checkbox from "../../ui/checkbox.tsx";
import Field from "../../ui/field.tsx";
import TextField from "../../ui/text-field.tsx";
import { usePanelTitle } from "../panelHooks.ts";
import { VaultUnlockCallout } from "./AIProvidersView.tsx";

type Setup = Awaited<ReturnType<typeof googleRPCClient.getSetup>>;
type Attempt = NonNullable<Awaited<ReturnType<typeof googleRPCClient.getConnectStatus>>["attempt"]>;
type Account = Setup["accounts"][number];
type ServiceName = "gmail" | "calendar" | "drive";

/** Shown to the person for each Google service, with what Google is asked to allow, said plainly. */
const SERVICES: { service: ServiceName; label: string; summary: string; permission: string }[] = [
  {
    service: "gmail",
    label: "Email (Gmail)",
    summary: "Lets TokenRing work with your mail: read it, prepare replies, and send and tidy up messages when you ask.",
    permission: "Permission asked: read, write drafts, send and organise your mail.",
  },
  {
    service: "calendar",
    label: "Calendar",
    summary: "Lets TokenRing see your schedule and add or change events when you ask.",
    permission: "Permission asked: read and change your calendar events.",
  },
  {
    service: "drive",
    label: "Files (Google Drive)",
    summary: "Lets TokenRing browse and open your files, and change them.",
    permission: "Permission asked: read and change ALL files in your Google Drive, not just some folders.",
  },
];
const SERVICE_LABEL = Object.fromEntries(SERVICES.map(item => [item.service, item.label])) as Record<ServiceName, string>;
const DEFAULT_SERVICES: ServiceName[] = ["gmail", "calendar"];
const NO_SERVICE_HINT = "Choose at least one.";

const servicesOf = (account: Account): ServiceName[] => SERVICES.map(item => item.service).filter(service => account[service]);

/** How often the sign-in's progress is checked while waiting for Google. */
export const CONNECT_POLL_MS = 1000;

const GOOGLE_CONSOLE_URL = "https://console.cloud.google.com/";

/** Only used if the server could not report its own address: the web app is served by the same server. */
function fallbackRedirect(): string {
  return `http://127.0.0.1:${window.location.port || "80"}/oauth/google/callback`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label, copiedLabel = "Copied" }: { text: string; label: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Button
      variant="secondary"
      icon={Copy}
      onClick={() => {
        void copyText(text).then(ok => {
          setCopied(ok);
          setFailed(!ok);
        });
      }}
    >
      {copied ? copiedLabel : failed ? "Select the text and copy it" : label}
    </Button>
  );
}

function StepCard({ number, title, done, children }: { number: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <section aria-label={`Step ${number}: ${title}`} className="rounded-lg border border-primary bg-secondary/40 px-4 py-3.5 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
        <span
          aria-hidden="true"
          className="flex w-5 h-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent text-xs font-medium tabular-nums"
        >
          {number}
        </span>
        <span className="min-w-0 flex-1">{title}</span>
        {done && (
          <span className="flex items-center gap-1 text-xs font-normal text-success">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Done
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

function ServicePicker({
  legend,
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  legend: string;
  value: ServiceName[];
  onChange: (next: ServiceName[]) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-xs font-medium text-primary">{legend}</legend>
      {SERVICES.map(item => (
        <div key={item.service} className="rounded-md border border-primary bg-primary/40 px-3 py-2 space-y-0.5">
          <Checkbox
            id={`${idPrefix}-${item.service}`}
            label={<span className="font-medium">{item.label}</span>}
            checked={value.includes(item.service)}
            disabled={disabled ?? false}
            onChange={checked => onChange(SERVICES.map(entry => entry.service).filter(name => (name === item.service ? checked : value.includes(name))))}
          />
          <p className="pl-6 text-xs text-primary">{item.summary}</p>
          <p className={`pl-6 text-xs ${item.service === "drive" ? "text-warning font-medium" : "text-muted"}`}>{item.permission}</p>
        </div>
      ))}
      {value.length === 0 && (
        <p role="alert" className="text-xs text-danger">
          {NO_SERVICE_HINT}
        </p>
      )}
    </fieldset>
  );
}

function Progress({ attempt, popupBlocked, onCancel }: { attempt: Attempt; popupBlocked: boolean; onCancel: () => void }) {
  return (
    <div className="space-y-2" role="status" data-testid="connect-google-progress">
      <p className="flex items-center gap-2 text-xs text-primary">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        {attempt.state === "finishing"
          ? "Finishing up…"
          : "Waiting for you to finish signing in on Google's page. A new tab should have opened; this page updates by itself."}
      </p>
      {attempt.state === "waiting" && attempt.authorizationUrl && (
        <p className="text-xs text-muted">
          {popupBlocked ? "Your browser blocked the new tab. " : "Nothing opened? "}
          <a href={attempt.authorizationUrl} target="_blank" rel="noopener noreferrer" className="text-accent-soft hover:underline focus-ring rounded">
            Open Google sign-in
          </a>
        </p>
      )}
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function SignInFailure({ attempt, onRetry }: { attempt: Attempt; onRetry: () => void }) {
  const error = attempt.error;
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-3 space-y-2"
      data-testid="connect-google-failure"
      data-code={error.code}
    >
      <p className="flex items-start gap-2 text-sm font-medium text-primary">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-danger" aria-hidden="true" />
        {error.title}
      </p>
      {error.code === "unknown" ? (
        <p className="text-xs text-primary break-words font-mono">{error.message}</p>
      ) : (
        <p className="text-xs text-primary">
          <span className="font-medium">Most likely cause: </span>
          {error.message}
        </p>
      )}
      <div className="text-xs text-primary">
        <p className="font-medium">What to try</p>
        <ol className="list-decimal pl-5 mt-1 space-y-0.5">
          {error.tryThis.map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetry}>Try again</Button>
        <CopyButton text={error.details} label="Copy details" />
      </div>
    </div>
  );
}

export default function ConnectGoogleView() {
  usePanelTitle("Connect Google");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [vaultLockedSeen, setVaultLockedSeen] = useState(false);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [services, setServices] = useState<ServiceName[]>(DEFAULT_SERVICES);
  /** The sign-in that is adding services to an account that is already connected (shown with that account). */
  const [consentId, setConsentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ name: string; services: ServiceName[]; saving: boolean; error: string | null } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; message: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState<Account | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const [nextSetup, status] = await Promise.all([googleRPCClient.getSetup({}), googleRPCClient.getConnectStatus({})]);
      if (!mounted.current) return;
      setSetup(nextSetup);
      setLoadError(null);
      // Pick up a sign-in that is still going on (or that failed) after a reload.
      const current = status.attempt;
      if (current && current.state !== "cancelled" && current.state !== "connected") {
        setAttempt(current);
        setEmail(current.email);
        if (current.services) setServices(current.services);
      }
    } catch (error: unknown) {
      if (mounted.current) setLoadError(error);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const attemptState = attempt?.state;
  useEffect(() => {
    if (attemptState !== "waiting" && attemptState !== "finishing") return;
    const timer = setInterval(() => {
      googleRPCClient
        .getConnectStatus({})
        .then(({ attempt: next }) => {
          if (!mounted.current || !next) return;
          setAttempt(current => (current && current.id === next.id ? next : current));
          if (next.state === "connected") void googleRPCClient.getSetup({}).then(fresh => mounted.current && setSetup(fresh));
        })
        .catch(() => {
          // A missed check is retried on the next tick.
        });
    }, CONNECT_POLL_MS);
    return () => clearInterval(timer);
  }, [attemptState]);

  const saveCredentials = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await googleRPCClient.saveCredentials({ clientId, clientSecret });
      // The secret is dropped from the page as soon as it is sent, whatever the answer.
      setClientSecret("");
      if (result.status === "success") {
        setSetup(result.setup);
        setClientId("");
        setReplacing(false);
        setVaultLockedSeen(false);
      } else if (result.status === "vaultLocked") {
        setVaultLockedSeen(true);
        setSaveError(result.message);
      } else {
        setSaveError(result.message);
      }
    } catch (error: unknown) {
      setClientSecret("");
      setSaveError(formatError(error));
    } finally {
      setSaving(false);
    }
  };

  const connect = async () => {
    setStarting(true);
    setEmailError(null);
    setPopupBlocked(false);
    // Opened now, during the click, so the browser does not take it for an unwanted pop-up.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await googleRPCClient.startConnect({ email, services });
      if (result.status === "started") {
        setAttempt(result.attempt);
        const url = result.attempt.authorizationUrl;
        if (tab && url) tab.location.href = url;
        else setPopupBlocked(true);
        return;
      }
      tab?.close();
      if (result.status === "vaultLocked") setVaultLockedSeen(true);
      setEmailError(result.message);
    } catch (error: unknown) {
      tab?.close();
      setEmailError(formatError(error));
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    try {
      await googleRPCClient.cancelConnect({});
    } catch {
      // The attempt ends on its own after a few minutes anyway.
    }
    setAttempt(null);
    setConsentId(null);
    void load();
  };

  /** Saves a change of services for a connected account. Adding one sends the person to Google to agree again. */
  const requestChange = async (account: Account, next: ServiceName[]) => {
    const needsConsent = next.some(service => !account[service]);
    setEditing({ name: account.name, services: next, saving: true, error: null });
    setNotice(null);
    setPopupBlocked(false);
    const tab = needsConsent ? window.open("about:blank", "_blank") : null;
    if (tab) tab.opener = null;
    try {
      const result = await googleRPCClient.updateAccountServices({ name: account.name, services: next });
      if (result.status === "saved") {
        tab?.close();
        setEditing(null);
        setSetup(current => (current ? { ...current, accounts: result.accounts } : current));
        setNotice({ tone: "success", message: result.message });
        return;
      }
      if (result.status === "needsConsent") {
        setEditing(null);
        setAttempt(result.attempt);
        setConsentId(result.attempt.id);
        const url = result.attempt.authorizationUrl;
        if (tab && url) tab.location.href = url;
        else setPopupBlocked(true);
        return;
      }
      tab?.close();
      if (result.status === "vaultLocked") setVaultLockedSeen(true);
      setEditing({ name: account.name, services: next, saving: false, error: result.message });
    } catch (error: unknown) {
      tab?.close();
      setEditing({ name: account.name, services: next, saving: false, error: formatError(error) });
    }
  };

  const disconnect = async (account: Account) => {
    const result = await googleRPCClient.disconnectAccount({ name: account.name });
    if (result.status === "disconnected") {
      setDisconnecting(null);
      setEditing(current => (current?.name === account.name ? null : current));
      setSetup(current => (current ? { ...current, accounts: result.accounts } : current));
      setNotice({ tone: result.revoke === "confirmed" ? "success" : "warning", message: result.message });
      return;
    }
    if (result.status === "vaultLocked") setVaultLockedSeen(true);
    throw new Error(result.message);
  };

  // A sign-in that added services finished: say so, and let go of it.
  useEffect(() => {
    if (!attempt || attempt.id !== consentId || attempt.state !== "connected") return;
    setNotice({ tone: "success", message: `Services updated for ${attempt.connectedEmail ?? attempt.email}. Google agreed, and the new services are linked.` });
    setAttempt(null);
    setConsentId(null);
  }, [attempt, consentId]);

  const onUnlocked = () => {
    setVaultLockedSeen(false);
    void load();
  };

  if (!setup) {
    return (
      <ViewShell pad="page" width="prose" data-testid="connect-google-view">
        {loadError ? (
          <ErrorState title="Could not load the Google setup" error={loadError} onRetry={() => void load()} variant="inline" />
        ) : (
          <LoadingState message="Checking your Google setup…" size="sm" />
        )}
      </ViewShell>
    );
  }

  const redirectUris = setup.redirectUris.length > 0 ? setup.redirectUris : [fallbackRedirect()];
  const credentialsReady = setup.credentialsReady && !replacing;
  const vaultLocked = !setup.canSaveCredentials || vaultLockedSeen || attempt?.error?.code === "vaultLocked";
  const consentAttempt = attempt && attempt.id === consentId ? attempt : null;
  const connectAttempt = attempt && attempt.id !== consentId ? attempt : null;
  const busyAttempt = connectAttempt && (connectAttempt.state === "waiting" || connectAttempt.state === "finishing") ? connectAttempt : null;
  const busyConnecting = busyAttempt !== null;
  const sourceNote =
    setup.clientIdSource === "environment" || setup.clientSecretSource === "environment"
      ? "Your Google access was set up outside this screen (an environment variable)."
      : setup.clientIdSource === "settings" || setup.clientSecretSource === "settings"
        ? "Your Google access is set up in your settings file."
        : "Your Google access is saved in your encrypted vault.";

  return (
    <ViewShell pad="page" width="prose" data-testid="connect-google-view">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-primary">Connect Google</h2>
          <p className="text-xs text-muted mt-0.5">
            Connect your Google account and choose what TokenRing may use: your mail, your calendar, and your files. Nothing is linked unless you choose it.
          </p>
        </div>

        {notice && (
          <p
            role="status"
            data-testid="connect-google-notice"
            className={`rounded-lg border px-3 py-2 text-xs text-primary ${notice.tone === "success" ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}`}
          >
            {notice.message}
          </p>
        )}

        {setup.accounts.length > 0 && (
          <section
            aria-label="Connected accounts"
            data-testid="connect-google-accounts"
            className="rounded-lg border border-primary bg-secondary/40 px-4 py-3.5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-primary">Connected accounts</h3>
            <ul className="space-y-3">
              {setup.accounts.map(account => {
                const edit = editing?.name === account.name ? editing : null;
                const linked = servicesOf(account);
                const added = edit ? edit.services.filter(service => !account[service]) : [];
                const unchanged = edit ? edit.services.length === linked.length && edit.services.every(service => account[service]) : true;
                const consent = consentAttempt?.name === account.name ? consentAttempt : null;
                return (
                  <li
                    key={account.name}
                    data-testid={`connect-google-account-${account.name}`}
                    className="rounded-md border border-primary bg-primary/40 px-3 py-2.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-primary break-all">{account.email}</span>
                      <Badge tone={account.connected ? "success" : "warning"} dot>
                        {account.connected ? "Connected" : "Needs sign-in"}
                      </Badge>
                    </div>
                    <ul aria-label={`Services linked to ${account.email}`} className="flex flex-wrap gap-1.5">
                      {linked.map(service => (
                        <li key={service}>
                          <Badge tone="info">{SERVICE_LABEL[service]}</Badge>
                        </li>
                      ))}
                    </ul>
                    {!account.connected && (
                      <p className="text-xs text-muted">
                        Google's sign-in for this account has ended. Choose <strong>Change services</strong>, add a service, or connect it again below to sign
                        in again.
                      </p>
                    )}

                    {consent && (consent.state === "waiting" || consent.state === "finishing") && (
                      <Progress attempt={consent} popupBlocked={popupBlocked} onCancel={() => void cancel()} />
                    )}
                    {consent?.state === "failed" && <SignInFailure attempt={consent} onRetry={() => void requestChange(account, consent.services ?? linked)} />}

                    {edit ? (
                      <form
                        className="space-y-2"
                        aria-label={`Change services for ${account.email}`}
                        onSubmit={event => {
                          event.preventDefault();
                          if (edit.services.length > 0 && !unchanged && !edit.saving) void requestChange(account, edit.services);
                        }}
                      >
                        <ServicePicker
                          legend="Services to link"
                          idPrefix={`change-${account.name}`}
                          value={edit.services}
                          disabled={edit.saving}
                          onChange={next => setEditing({ ...edit, services: next, error: null })}
                        />
                        {added.length > 0 ? (
                          <p className="text-xs text-primary">
                            Adding {added.map(service => SERVICE_LABEL[service]).join(" and ")} means Google asks for your permission again. A new tab opens for
                            that.
                          </p>
                        ) : (
                          !unchanged && (
                            <p className="text-xs text-muted">
                              Taking a service away only stops TokenRing using it. Google keeps listing the permission until you disconnect the account.
                            </p>
                          )
                        )}
                        {edit.error && (
                          <p role="alert" className="text-xs text-danger">
                            {edit.error}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" busy={edit.saving} disabled={edit.services.length === 0 || unchanged}>
                            {added.length > 0 ? "Save and ask Google" : "Save"}
                          </Button>
                          <Button variant="ghost" disabled={edit.saving} onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          aria-label={`Change services for ${account.email}`}
                          disabled={Boolean(consent && (consent.state === "waiting" || consent.state === "finishing"))}
                          onClick={() => {
                            setNotice(null);
                            setEditing({ name: account.name, services: linked, saving: false, error: null });
                          }}
                        >
                          Change services
                        </Button>
                        <Button variant="ghost" icon={Unplug} aria-label={`Disconnect ${account.email}`} onClick={() => setDisconnecting(account)}>
                          Disconnect
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <StepCard number={1} title="What you will do, and why">
          <p className="text-xs text-primary">
            Google only lets an app into your mail and calendar if you first create a small private access pass for it on Google's website, which takes about
            ten minutes and only has to be done once. The pass is kept on this computer, in an encrypted file, and nobody else gets to use it.
          </p>
          <p className="text-xs text-muted mt-1.5">
            The next step happens on Google's own Cloud console website, where you sign in with the Google account you want to connect. If that is unfamiliar,
            ask whoever set up TokenRing for you to do it with you.
          </p>
        </StepCard>

        <StepCard number={2} title="Create your Google access" done={setup.credentialsReady}>
          <ol className="list-decimal pl-5 space-y-2 text-xs text-primary">
            <li>
              Open the Google Cloud console and sign in with the Google account you want to connect.
              <div className="mt-1.5">
                <Button variant="secondary" icon={ExternalLink} onClick={() => window.open(GOOGLE_CONSOLE_URL, "_blank", "noopener,noreferrer")}>
                  Open Google Cloud console
                </Button>
              </div>
            </li>
            <li>
              Click the project picker at the top of the page, choose <strong>New project</strong>, call it <strong>TokenRing</strong>, and create it. Make sure
              it is the project showing at the top.
            </li>
            <li>
              Turn on the services you plan to use: open <strong>APIs &amp; Services</strong>, then <strong>Library</strong>. Search for{" "}
              <strong>Gmail API</strong> and click <strong>Enable</strong>. Then do the same for <strong>Google Calendar API</strong>, and, only if you will
              link your files, for <strong>Google Drive API</strong>.
            </li>
            <li>
              Set up the consent screen: open <strong>APIs &amp; Services</strong>, then <strong>OAuth consent screen</strong> (Google may call it{" "}
              <strong>Google Auth Platform</strong>; if it shows a <strong>Get started</strong> button, click it). Fill in an app name such as TokenRing and
              your email address. For the user type (or Audience) choose <strong>External</strong>. Then find <strong>Test users</strong>, click{" "}
              <strong>Add users</strong>, and add the Google email address you want to connect. If Google asks you to choose scopes, you can skip that.
            </li>
            <li>
              Create the access: open <strong>Credentials</strong> (or <strong>Clients</strong>), click <strong>Create credentials</strong>, then{" "}
              <strong>OAuth client ID</strong>. For the application type choose <strong>Web application</strong> and call it TokenRing. Under{" "}
              <strong>Authorized redirect URIs</strong> click <strong>Add URI</strong> and paste the address below exactly as it is, then click{" "}
              <strong>Create</strong>.
              <ul className="mt-1.5 space-y-1.5" aria-label="Redirect addresses">
                {redirectUris.map(uri => (
                  <li key={uri} className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-xs break-all rounded bg-sunken px-1.5 py-1 text-primary">{uri}</code>
                    <CopyButton text={uri} label="Copy address" />
                  </li>
                ))}
              </ul>
            </li>
            <li>
              Google now shows a <strong>Client ID</strong> and a <strong>Client secret</strong>. Keep that window open and go to the next step.
            </li>
          </ol>
        </StepCard>

        <StepCard number={3} title="Paste your Client ID and Client secret" done={credentialsReady}>
          {vaultLocked && <VaultUnlockCallout onUnlocked={onUnlocked} />}
          {credentialsReady ? (
            <div className="space-y-2" data-testid="connect-google-credentials-saved">
              <p className="text-xs text-primary">{sourceNote}</p>
              {setup.clientId && (
                <p className="text-xs text-muted">
                  Client ID: <span className="font-mono text-primary break-all">{setup.clientId}</span>
                </p>
              )}
              <p className="text-xs text-muted">The Client secret is saved and is never shown again.</p>
              <Button variant="ghost" onClick={() => setReplacing(true)}>
                Use a different Client ID and secret
              </Button>
            </div>
          ) : (
            <form
              className="space-y-3"
              aria-label="Google client credentials"
              onSubmit={event => {
                event.preventDefault();
                if (clientId.trim() && clientSecret.trim()) void saveCredentials();
              }}
            >
              <TextField
                label="Client ID"
                hint="A long address ending in .apps.googleusercontent.com"
                value={clientId}
                onChange={setClientId}
                mono
                autoComplete="off"
                spellCheck={false}
                disabled={saving}
              />
              <Field
                label="Client secret"
                htmlFor="connect-google-secret"
                hint="Kept in the encrypted file on this computer (your vault). It is hidden as you type."
              >
                <PasswordInput
                  id="connect-google-secret"
                  value={clientSecret}
                  onChange={setClientSecret}
                  showToggle={false}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={saving}
                />
              </Field>
              {saveError && (
                <p role="alert" className="text-xs text-danger">
                  {saveError}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" busy={saving} disabled={!clientId.trim() || !clientSecret.trim()}>
                  Save
                </Button>
                {replacing && (
                  <Button variant="ghost" onClick={() => setReplacing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </StepCard>

        <StepCard number={4} title="What should TokenRing use?">
          <p className="text-xs text-primary">Tick what you want TokenRing to use from this Google account. TokenRing asks Google only for what you tick.</p>
          <ServicePicker legend="Google services" idPrefix="connect-service" value={services} onChange={setServices} disabled={busyConnecting || starting} />
        </StepCard>

        <StepCard number={5} title="Connect" done={connectAttempt?.state === "connected"}>
          {connectAttempt?.state === "connected" ? null : busyAttempt ? (
            <Progress attempt={busyAttempt} popupBlocked={popupBlocked} onCancel={() => void cancel()} />
          ) : (
            <form
              className="space-y-3"
              aria-label="Connect a Google account"
              noValidate
              onSubmit={event => {
                event.preventDefault();
                if (setup.credentialsReady && email.trim() && services.length > 0 && !starting) void connect();
              }}
            >
              <TextField
                label="Your Google email address"
                hint="The account you want to connect. It must be one you added as a test user."
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                disabled={starting}
                error={emailError}
              />
              {!setup.credentialsReady && <p className="text-xs text-muted">Finish step 3 first.</p>}
              {services.length === 0 && <p className="text-xs text-muted">Choose at least one thing in step 4 first.</p>}
              {connectAttempt?.state === "failed" && <SignInFailure attempt={connectAttempt} onRetry={() => void connect()} />}
              <Button type="submit" icon={Mail} busy={starting} disabled={!setup.credentialsReady || !email.trim() || services.length === 0}>
                Connect
              </Button>
            </form>
          )}
        </StepCard>

        {connectAttempt?.state === "connected" && (
          <StepCard number={6} title="You are connected" done>
            <div className="space-y-2" role="status" data-testid="connect-google-success">
              <p className="text-xs text-primary">
                Connected as <strong>{connectAttempt.connectedEmail ?? connectAttempt.email}</strong>. Linked:{" "}
                {(connectAttempt.services ?? DEFAULT_SERVICES).map(service => SERVICE_LABEL[service]).join(", ")}.
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {(connectAttempt.services ?? DEFAULT_SERVICES).includes("gmail") && (
                  <Link to="/email" className="text-accent-soft hover:underline focus-ring rounded">
                    Open Email →
                  </Link>
                )}
                {(connectAttempt.services ?? DEFAULT_SERVICES).includes("calendar") && (
                  <Link to="/calendar" className="text-accent-soft hover:underline focus-ring rounded">
                    Open Calendar →
                  </Link>
                )}
              </p>
              <p className="text-xs text-muted">
                Good to know: while your Google app is in testing mode, Google asks you to sign in again about every 7 days. If Email or Calendar stops working,
                come back here and press Connect. You can change the linked services, or disconnect, under Connected accounts.
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setAttempt(null);
                  setEmail("");
                }}
              >
                Connect another account
              </Button>
            </div>
          </StepCard>
        )}

        {disconnecting && (
          <ConfirmModal
            title={`Disconnect ${disconnecting.email}?`}
            message={`TokenRing will ask Google to take back its access to this account, delete the saved sign-in for it from your encrypted vault, remove the account from your settings, and stop using its Email, Calendar and Files. Nothing in your Google account is deleted. Your Client ID and Client secret stay, so other accounts keep working. If Google cannot be reached the account is still removed here, and you are told that Google did not confirm.`}
            confirmLabel="Disconnect"
            confirmIcon={Unplug}
            showDontAskAgain={false}
            onClose={() => setDisconnecting(null)}
            onConfirm={() => disconnect(disconnecting)}
          />
        )}
      </div>
    </ViewShell>
  );
}
