import formatError from "@tokenring-ai/utility/error/formatError";
import { type SyntheticEvent, useState } from "react";
import ModalShell from "../components/ui/ModalShell.tsx";
import Button from "../ui/button.tsx";
import TextField from "../ui/text-field.tsx";

interface AppNameDialogProps {
  title: string;
  description: string;
  initialName: string;
  confirmLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

/** Asks for an app name (Save as new app, Rename app). */
export function AppNameDialog({ title, description, initialName, confirmLabel, onSubmit, onClose }: AppNameDialogProps) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const tooLong = trimmed.length > 60;

  const submit = async (e?: SyntheticEvent) => {
    e?.preventDefault();
    if (!trimmed || tooLong || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(`Could not save the app: ${formatError(err)}`);
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={title}
      description={description}
      onClose={onClose}
      busy={busy}
      width="w-96"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void submit()} disabled={!trimmed || tooLong || busy}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={e => void submit(e)}>
        <TextField
          label="App name"
          value={name}
          onChange={setName}
          autoFocus
          maxLength={80}
          placeholder="My agents"
          error={tooLong ? "Use 60 characters or fewer." : (error ?? undefined)}
        />
      </form>
    </ModalShell>
  );
}
