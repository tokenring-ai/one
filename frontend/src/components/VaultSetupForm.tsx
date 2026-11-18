import formatError from "@tokenring-ai/utility/error/formatError";
import { MIN_VAULT_PASSWORD_LENGTH } from "@tokenring-ai/vault/schema";
import { KeyRound } from "lucide-react";
import { useId, useState } from "react";
import { vaultRPCClient } from "../rpc.ts";
import Button from "../ui/button.tsx";
import Field from "../ui/field.tsx";
import PasswordInput from "./ui/PasswordInput.tsx";
import { toastManager } from "./ui/toast.tsx";

export type VaultCreated = { message: string; passwordStored: boolean };

/**
 * Asks for a new vault password twice and creates the vault. Neither password is kept in state once the
 * form is submitted, and the server's reply never contains it. When the password could not be saved on this
 * computer the reply says so in plain words (it is needed at every start), shown here and as a lasting toast,
 * because the page around the form usually goes away as soon as the vault is unlocked.
 */
export default function VaultSetupForm({ onCreated }: { onCreated: (created: VaultCreated) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<VaultCreated | null>(null);
  const passwordId = useId();
  const confirmId = useId();
  const hintId = useId();

  const submit = async () => {
    if (busy) return;
    if (password.length < MIN_VAULT_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_VAULT_PASSWORD_LENGTH} characters for the vault password.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match. Type the same password in both boxes.");
      return;
    }
    const chosen = password;
    setPassword("");
    setConfirm("");
    setBusy(true);
    setError(null);
    try {
      const result = await vaultRPCClient.createVault({ password: chosen });
      if (!result.success) {
        setError(result.message || "Could not create the vault");
        return;
      }
      const outcome = { message: result.message, passwordStored: result.passwordStored };
      setCreated(outcome);
      if (outcome.passwordStored) toastManager.success(outcome.message);
      else toastManager.warning(outcome.message, { duration: 20_000 });
      onCreated(outcome);
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <p role="status" className="text-xs text-primary" data-testid="vault-created">
        {created.message}
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2.5"
      aria-label="Create vault"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-wrap gap-2">
        <Field label="New vault password" htmlFor={passwordId} className="flex-1 min-w-48">
          <PasswordInput
            id={passwordId}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            spellCheck={false}
            disabled={busy}
            aria-describedby={hintId}
          />
        </Field>
        <Field label="Confirm vault password" htmlFor={confirmId} className="flex-1 min-w-48">
          <PasswordInput
            id={confirmId}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            spellCheck={false}
            disabled={busy}
            aria-describedby={hintId}
          />
        </Field>
      </div>
      <p id={hintId} className="text-xs text-muted">
        At least {MIN_VAULT_PASSWORD_LENGTH} characters. TokenRing cannot recover this password: if you lose it, the keys in the vault are gone, so write it
        down somewhere safe.
      </p>
      <div>
        <Button type="submit" icon={KeyRound} busy={busy} disabled={!password || !confirm || busy}>
          Create vault
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
