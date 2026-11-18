import { usernameProblem } from "@tokenring-ai/web-host/usernames";
import { Check, Copy } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useAnnouncer } from "../../hooks/useAnnouncer.tsx";
import { copyToClipboard } from "../../lib/clipboard.ts";
import { describeRpcError } from "../../lib/rpcErrors.ts";
import { usersRPCClient } from "../../rpc.ts";
import Button from "../../ui/button.tsx";
import Select from "../../ui/select.tsx";
import TextField from "../../ui/text-field.tsx";
import ModalShell from "../ui/ModalShell.tsx";
import AccessLinkResultDialog, { type IssuedLink } from "./AccessLinkResultDialog.tsx";
import { ADMIN_LINK_DEFAULT_MINUTES, LINK_EXPIRY_OPTIONS } from "./constants.ts";
import RemoteAccessNotices, { type RemoteAccessFacts } from "./RemoteAccessNotices.tsx";

export type Role = "admin" | "member";
export const MIN_PASSWORD_LENGTH = 8;

export const ROLE_EXPLANATIONS: Record<Role, { label: string; text: string }> = {
  admin: { label: "Administrator", text: "Can manage users, settings, providers, secrets, permissions and schedules." },
  member: {
    label: "Member",
    text: "Can chat with agents and do everyday work, but cannot change settings or manage users. A member can still ask the assistant to do most things an administrator can, subject to approvals.",
  },
};

function RadioChoice<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string; description?: string }>;
}) {
  const name = useId();
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-xs font-medium text-primary">{legend}</legend>
      {options.map(option => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-2 rounded-md border border-control px-3 py-2 text-sm has-[:checked]:border-accent"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-1 cursor-pointer accent-accent"
          />
          <span className="min-w-0">
            <span className="block font-medium text-primary">{option.label}</span>
            {option.description && <span className="block text-xs text-muted">{option.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function RoleChoice({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <RadioChoice
      legend="Role"
      value={value}
      onChange={onChange}
      options={(["member", "admin"] as const).map(role => ({ value: role, label: ROLE_EXPLANATIONS[role].label, description: ROLE_EXPLANATIONS[role].text }))}
    />
  );
}

function ExpiryChoice({ value, onChange }: { value: string; onChange: (minutes: string) => void }) {
  return (
    <Select label="Link expires after" value={value} onChange={onChange} hint="It also stops working the first time it is opened.">
      {LINK_EXPIRY_OPTIONS.map(option => (
        <option key={option.minutes} value={String(option.minutes)}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/** A password the server made, shown once. */
export function GeneratedPasswordDialog({
  username,
  password,
  onDone,
  children,
}: {
  username: string;
  password: string;
  onDone: () => void;
  children?: ReactNode;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <ModalShell
      title="Password created"
      onClose={onDone}
      width="w-full max-w-md"
      footer={
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {children}
        <p className="text-sm text-secondary">
          This is the password for <strong>{username}</strong>. It is shown only once and cannot be displayed again. Give it to them safely, and ask them to
          keep it in a password manager. If it is lost, set a new one.
        </p>
        <code className="block select-all break-all rounded-md border border-line bg-sunken p-2 text-sm text-primary">{password}</code>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            icon={copyState === "copied" ? Check : Copy}
            onClick={() => void copyToClipboard(password, { silent: true }).then(ok => setCopyState(ok ? "copied" : "failed"))}
          >
            {copyState === "copied" ? "Copied" : "Copy password"}
          </Button>
          {copyState === "failed" && (
            <p role="alert" className="text-xs text-danger">
              This browser would not let the page copy. Select the password above and copy it by hand.
            </p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

type Created = { kind: "link"; username: string; link: IssuedLink } | { kind: "password"; username: string; password: string };

export function AddUserDialog({ facts, onClose, onChanged }: { facts: RemoteAccessFacts | null; onClose: () => void; onChanged: () => void }) {
  const { announce, region } = useAnnouncer();
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);
  const [role, setRole] = useState<Role>("member");
  const [method, setMethod] = useState<"accessLink" | "password">("accessLink");
  const [minutes, setMinutes] = useState(String(ADMIN_LINK_DEFAULT_MINUTES));
  const [passwordMode, setPasswordMode] = useState<"generate" | "type">("generate");
  const [typedPassword, setTypedPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const name = username.trim();
  const nameProblem = name ? usernameProblem(name) : touched ? "Enter a username." : null;
  const passwordProblem =
    method === "password" && passwordMode === "type" && typedPassword.length < MIN_PASSWORD_LENGTH
      ? `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`
      : null;
  const invalid = Boolean(usernameProblem(name)) || Boolean(passwordProblem);

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    setBusy(true);
    setError(null);
    try {
      const result = await usersRPCClient.createUser({
        username: name,
        role,
        method,
        ...(method === "accessLink" ? { expiresInMinutes: Number(minutes) } : {}),
        ...(method === "password" && passwordMode === "type" ? { password: typedPassword } : {}),
      });
      onChanged();
      setTypedPassword("");
      if (result.link) {
        setCreated({ kind: "link", username: result.user.username, link: { url: result.link.url, expiresAt: result.link.expiresAt } });
        announce("User created. Access link created");
      } else if (result.generatedPassword) {
        setCreated({ kind: "password", username: result.user.username, password: result.generatedPassword });
        announce("User created. Password created");
      } else {
        announce(`User ${result.user.username} created`);
        onClose();
      }
    } catch (caught) {
      setError(describeRpcError(caught));
    } finally {
      setBusy(false);
    }
  };

  if (created?.kind === "link") {
    const done = () => {
      setCreated(null);
      onClose();
    };
    return (
      <>
        {region}
        <AccessLinkResultDialog username={created.username} link={created.link} onDone={done} title="User created">
          {facts && <RemoteAccessNotices facts={facts} />}
        </AccessLinkResultDialog>
      </>
    );
  }
  if (created?.kind === "password") {
    const done = () => {
      setCreated(null);
      onClose();
    };
    return (
      <>
        {region}
        <GeneratedPasswordDialog username={created.username} password={created.password} onDone={done} />
      </>
    );
  }

  return (
    <>
      {region}
      <ModalShell
        title="Add user"
        description="Give someone their own sign-in."
        onClose={onClose}
        busy={busy}
        width="w-full max-w-lg max-h-[90dvh] overflow-y-auto"
        error={error}
        confirmLabel="Add user"
        onConfirm={() => void submit()}
        confirmDisabled={touched && invalid}
      >
        <div className="mb-4 space-y-4">
          <TextField
            label="Username"
            value={username}
            onChange={value => {
              setUsername(value);
              setTouched(true);
            }}
            error={nameProblem}
            hint="Lowercase letters, digits, - _ and . (2 to 32 characters)."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <RoleChoice value={role} onChange={setRole} />
          <RadioChoice
            legend="How they sign in"
            value={method}
            onChange={setMethod}
            options={[
              {
                value: "accessLink",
                label: "Give them an access link / QR code",
                description: "They scan it or open it once on their phone or computer. No password to manage.",
              },
              { value: "password", label: "Set a password", description: "You choose one, or have a strong one made for you." },
            ]}
          />
          {method === "accessLink" && (
            <>
              {facts && <RemoteAccessNotices facts={facts} />}
              <ExpiryChoice value={minutes} onChange={setMinutes} />
            </>
          )}
          {method === "password" && (
            <>
              <RadioChoice
                legend="Password"
                value={passwordMode}
                onChange={setPasswordMode}
                options={[
                  { value: "generate", label: "Make a strong one for me", description: "Shown once, right after you add the user." },
                  { value: "type", label: "I will type one" },
                ]}
              />
              {passwordMode === "type" && (
                <TextField
                  label="Password"
                  type="password"
                  value={typedPassword}
                  onChange={setTypedPassword}
                  error={typedPassword ? passwordProblem : null}
                  hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                  autoComplete="new-password"
                />
              )}
            </>
          )}
        </div>
      </ModalShell>
    </>
  );
}

/** An administrator makes a link for an existing person. */
export function NewLinkDialog({
  username,
  facts,
  onClose,
  onChanged,
}: {
  username: string;
  facts: RemoteAccessFacts | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { announce, region } = useAnnouncer();
  const [minutes, setMinutes] = useState(String(ADMIN_LINK_DEFAULT_MINUTES));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedLink | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await usersRPCClient.createAccessLink({ username, expiresInMinutes: Number(minutes) });
      setIssued({ url: result.url, expiresAt: result.expiresAt });
      onChanged();
      announce("Access link created");
    } catch (caught) {
      setError(describeRpcError(caught));
    } finally {
      setBusy(false);
    }
  };

  if (issued) {
    const done = () => {
      setIssued(null);
      onClose();
    };
    return (
      <>
        {region}
        <AccessLinkResultDialog username={username} link={issued} onDone={done}>
          {facts && <RemoteAccessNotices facts={facts} />}
        </AccessLinkResultDialog>
      </>
    );
  }

  return (
    <>
      {region}
      <ModalShell
        title={`New access link for ${username}`}
        onClose={onClose}
        busy={busy}
        width="w-full max-w-md"
        error={error}
        confirmLabel="Create link and QR code"
        onConfirm={() => void create()}
      >
        <div className="mb-4 space-y-3">
          <p className="text-sm text-secondary">
            The link signs in as <strong>{username}</strong>. Whoever opens it first is signed in as them, so treat it like a password.
          </p>
          {facts && <RemoteAccessNotices facts={facts} />}
          <ExpiryChoice value={minutes} onChange={setMinutes} />
        </div>
      </ModalShell>
    </>
  );
}

export function ResetPasswordDialog({ username, onClose, onChanged }: { username: string; onClose: () => void; onChanged: () => void }) {
  const { announce, region } = useAnnouncer();
  const [mode, setMode] = useState<"generate" | "type">("generate");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const problem = mode === "type" && typed.length < MIN_PASSWORD_LENGTH ? `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.` : null;

  const submit = async () => {
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      const result = await usersRPCClient.setPassword({ username, ...(mode === "type" ? { password: typed } : {}) });
      onChanged();
      setTyped("");
      if (result.generatedPassword) {
        setGenerated(result.generatedPassword);
        announce("Password created");
      } else {
        announce(`Password for ${username} changed`);
        onClose();
      }
    } catch (caught) {
      setError(describeRpcError(caught));
    } finally {
      setBusy(false);
    }
  };

  if (generated) {
    const done = () => {
      setGenerated(null);
      onClose();
    };
    return (
      <>
        {region}
        <GeneratedPasswordDialog username={username} password={generated} onDone={done} />
      </>
    );
  }

  return (
    <>
      {region}
      <ModalShell
        title={`Reset password for ${username}`}
        onClose={onClose}
        busy={busy}
        width="w-full max-w-md"
        error={error}
        confirmLabel="Reset password"
        onConfirm={() => void submit()}
        confirmDisabled={Boolean(problem)}
      >
        <div className="mb-4 space-y-3">
          <p className="text-sm text-secondary">{username} will be signed out everywhere and must sign in again with the new password.</p>
          <RadioChoice
            legend="New password"
            value={mode}
            onChange={setMode}
            options={[
              { value: "generate", label: "Make a strong one for me", description: "Shown once, after you reset." },
              { value: "type", label: "I will type one" },
            ]}
          />
          {mode === "type" && (
            <TextField
              label="Password"
              type="password"
              value={typed}
              onChange={setTyped}
              error={typed ? problem : null}
              hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
              autoComplete="new-password"
            />
          )}
        </div>
      </ModalShell>
    </>
  );
}

export function ChangeRoleDialog({ username, current, onClose, onChanged }: { username: string; current: Role; onClose: () => void; onChanged: () => void }) {
  const { announce, region } = useAnnouncer();
  const [role, setRole] = useState<Role>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await usersRPCClient.setRole({ username, role });
      onChanged();
      announce(`${username} is now ${ROLE_EXPLANATIONS[role].label.toLowerCase()}`);
      onClose();
    } catch (caught) {
      setError(describeRpcError(caught));
      setBusy(false);
    }
  };

  return (
    <>
      {region}
      <ModalShell
        title={`Change role for ${username}`}
        onClose={onClose}
        busy={busy}
        width="w-full max-w-md max-h-[90dvh] overflow-y-auto"
        error={error}
        confirmLabel="Change role"
        confirmDisabled={role === current}
        onConfirm={() => void submit()}
      >
        <div className="mb-4 space-y-3">
          <p className="text-sm text-secondary">{username} will be signed out everywhere and signs in again with the new role.</p>
          <RoleChoice value={role} onChange={setRole} />
        </div>
      </ModalShell>
    </>
  );
}
