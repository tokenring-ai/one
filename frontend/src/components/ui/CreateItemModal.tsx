import formatError from "@tokenring-ai/utility/error/formatError";
import { Plus } from "lucide-react";
import { type ElementType, useEffect, useId, useRef, useState } from "react";
import ModalShell from "./ModalShell.tsx";

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
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = nameValue.trim();
  const isValid = pattern.test(trimmed);
  const showError = Boolean(trimmed) && !isValid;

  const handleSubmit = async () => {
    if (!isValid || creating) return;
    setCreating(true);
    setError(null);
    try {
      await onCreate(trimmed);
    } catch (e: unknown) {
      setError(formatError(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      busy={creating}
      width={width}
      focusTrap={focusTrap}
      error={error}
      footerClassName="mt-3 pt-1"
      confirmLabel={createLabel}
      confirmIcon={CreateIcon}
      confirmDisabled={!isValid}
      onConfirm={() => void handleSubmit()}
    >
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
          className="w-full bg-input border border-control rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent disabled:opacity-40"
        />
        {showError && (
          <p id={errorId} className="text-xs text-red-500" role="alert">
            {validationError}
          </p>
        )}
      </div>
    </ModalShell>
  );
}
