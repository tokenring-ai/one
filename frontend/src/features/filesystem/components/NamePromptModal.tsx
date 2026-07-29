import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface NamePromptModalProps {
  title: string;
  label?: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  /** Optional validator; return error message or null if valid. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}

export default function NamePromptModal({
  title,
  label = "Name",
  initialValue = "",
  placeholder = "",
  confirmText = "Create",
  validate,
  onSubmit,
  onClose,
}: NamePromptModalProps) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (initialValue) inputRef.current?.select();
  }, [initialValue]);

  const trimmed = value.trim();
  const validationError = trimmed && validate ? validate(trimmed) : null;
  const canSubmit = Boolean(trimmed) && !validationError && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-secondary border border-primary rounded-xl p-5 w-96 max-w-[calc(100vw-2rem)] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="name-prompt-title" className="text-sm font-semibold text-primary">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary focus-ring rounded" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted uppercase tracking-wide">{label}</label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && canSubmit) void handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder={placeholder}
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
            />
          </div>
          {(validationError || error) && <p className="text-2xs text-red-500">{validationError || error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
