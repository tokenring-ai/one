import formatError from "@tokenring-ai/utility/error/formatError";
import { ListPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ModalShell from "../../../components/ui/ModalShell.tsx";

export interface AppendModalProps {
  filePath: string;
  onAppend: (text: string) => Promise<void>;
  onClose: () => void;
}

/** Confirms the text to append to the already-open file. Not a file browser. */
export default function AppendModal({ filePath, onAppend, onClose }: AppendModalProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAppend(text);
    } catch (e: unknown) {
      setError(formatError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Append"
      onClose={onClose}
      busy={saving}
      width="w-full max-w-md"
      backdropClassName="p-4"
      error={error}
      confirmLabel="Append"
      confirmIcon={ListPlus}
      confirmDisabled={text.length === 0}
      onConfirm={() => void handleSubmit()}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted break-all">
          Append to <span className="text-primary">{filePath}</span>
        </p>
        <div className="space-y-1">
          <label htmlFor="append-text" className="text-xs font-semibold text-muted uppercase tracking-wide">
            Text to append
          </label>
          <textarea
            id="append-text"
            ref={inputRef}
            value={text}
            onChange={event => {
              setText(event.target.value);
              setError(null);
            }}
            onKeyDown={event => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            rows={5}
            placeholder="Text to append to the file"
            className="w-full bg-input border border-control rounded-lg p-3 text-xs text-primary placeholder-muted resize-none focus-accent leading-relaxed"
          />
          <p className="text-xs text-dim">Ctrl/⌘+Enter to append. The text is added to the end of the file.</p>
        </div>
      </div>
    </ModalShell>
  );
}
