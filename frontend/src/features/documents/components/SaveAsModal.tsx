import formatError from "@tokenring-ai/utility/error/formatError";
import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ModalShell from "../../../components/ui/ModalShell.tsx";

export interface SaveAsModalProps {
  initialPath: string;
  onSave: (path: string) => Promise<void>;
  onClose: () => void;
}

function ensureMarkdownExtension(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (/\.md$/i.test(trimmed)) return trimmed;
  // Don't append if path ends with a slash (directory)
  if (trimmed.endsWith("/")) return `${trimmed}untitled.md`;
  return `${trimmed}.md`;
}

export default function SaveAsModal({ initialPath, onSave, onClose }: SaveAsModalProps) {
  const [path, setPath] = useState(initialPath);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = async () => {
    const finalPath = ensureMarkdownExtension(path);
    if (!finalPath) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(finalPath);
    } catch (e: unknown) {
      setError(formatError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Save As"
      onClose={onClose}
      busy={saving}
      width="w-full max-w-sm"
      backdropClassName="p-4"
      error={error}
      footerClassName="mt-3 pt-1"
      confirmLabel="Save"
      confirmIcon={Save}
      confirmDisabled={!path.trim()}
      confirmClassName="bg-accent hover:bg-accent-hover text-white"
      onConfirm={() => void handleSubmit()}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">File path</label>
          <input
            ref={inputRef}
            type="text"
            value={path}
            onChange={e => {
              setPath(e.target.value);
              setError(null);
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !saving) void handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            placeholder="documents/my-file.md"
            className="w-full bg-input border border-control rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
          />
          <p className="text-xs text-dim">.md is added automatically if omitted</p>
        </div>
      </div>
    </ModalShell>
  );
}
