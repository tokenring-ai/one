import { FocusTrap } from "focus-trap-react";
import { Loader2, Plus, X } from "lucide-react";
import { type ElementType, useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/utils.ts";

export interface CreateItemModalProps {
  /** Dialog title (e.g., "New Topic", "New Flow", "New Category") */
  title: string;
  /** Placeholder text for the input */
  placeholder: string;
  /** Regex pattern for name validation */
  pattern: RegExp;
  /** Error message shown when validation fails */
  validationError: string;
  /** Called with the validated name when create is confirmed */
  onCreate: (name: string) => Promise<void>;
  /** Called when the user cancels or the modal is dismissed */
  onClose: () => void;
  /** Label on the create button (default: "Create") */
  createLabel?: string;
  /** Leading icon on the create button when not creating (default: Plus) */
  createIcon?: ElementType;
  /** Initial value for the input (default: "") */
  initialValue?: string;
  /** Modal card width class (default: "w-80") */
  width?: string;
  /** Whether to trap focus inside the dialog (default: true) */
  focusTrap?: boolean;
}

export default function CreateItemModal({
  title,
  placeholder,
  pattern,
  validationError,
  onCreate,
  onClose,
  createLabel = "Create",
  createIcon: CreateIcon = Plus,
  initialValue = "",
  width = "w-80",
  focusTrap = true,
}: CreateItemModalProps) {
  const [nameValue, setNameValue] = useState(initialValue);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape dismisses when not mid-create
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creating) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, creating]);

  const trimmed = nameValue.trim();
  const isValid = pattern.test(trimmed);
  const showError = Boolean(trimmed) && !isValid;

  const handleSubmit = async () => {
    if (!isValid || creating) return;
    setCreating(true);
    try {
      await onCreate(trimmed);
    } finally {
      setCreating(false);
    }
  };

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn("bg-secondary border border-primary rounded-xl p-5 shadow-xl", width)}>
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="text-sm font-semibold text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="p-1 text-muted hover:text-primary focus-ring rounded disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !creating) void handleSubmit();
            }}
            placeholder={placeholder}
            aria-invalid={showError}
            aria-describedby={showError ? errorId : undefined}
            disabled={creating}
            className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent disabled:opacity-40"
          />
          {showError && (
            <p id={errorId} className="text-xs text-red-500" role="alert">
              {validationError}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!isValid || creating}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreateIcon className="w-3.5 h-3.5" />}
              {createLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!focusTrap) return dialog;
  return <FocusTrap>{dialog}</FocusTrap>;
}
