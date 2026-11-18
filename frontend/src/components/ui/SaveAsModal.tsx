import formatError from "@tokenring-ai/utility/error/formatError";
import { Save } from "lucide-react";
import { type ElementType, type RefObject, useEffect, useId, useRef, useState } from "react";
import ModalShell from "./ModalShell.tsx";

export interface SaveAsField {
  /** Label for the field (e.g., "Topic", "Flow", "Category") */
  label: string;
  /** Placeholder text */
  placeholder: string;
  /** Initial value */
  initialValue: string;
  /** Regex pattern for validation */
  pattern: RegExp;
  /** Error message shown when validation fails */
  validationError: string;
  /** Existing values for datalist autocomplete */
  options: { value: string; label?: string }[];
  /** Whether this field should auto-focus on mount (only one field should be true) */
  autoFocus?: boolean;
  /** Whether to select all text on focus (default: false) */
  selectOnFocus?: boolean;
}

export interface SaveAsModalProps {
  /** Dialog title (e.g., "Save Research Item", "Save As") */
  title: string;
  /** Configuration for the first (container) field */
  containerField: SaveAsField;
  /** Configuration for the second (item) field */
  itemField: SaveAsField;
  /** Called with both field values when save is confirmed */
  onSave: (containerValue: string, itemValue: string) => Promise<void>;
  /** Called when the user cancels or the modal is dismissed */
  onClose: () => void;
  /** Label on the save button (default: "Save") */
  saveLabel?: string;
  /** Leading icon on the save button when not saving (default: Save) */
  saveIcon?: ElementType;
  /** Modal card width class (default: "w-96") */
  width?: string;
  /** Whether to trap focus inside the dialog (default: true) */
  focusTrap?: boolean;
}

function FieldInput({
  field,
  value,
  onChange,
  onSubmit,
  saving,
  datalistId,
  errorId,
  inputRef,
}: {
  field: SaveAsField;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  saving: boolean;
  datalistId: string;
  errorId: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const trimmed = value.trim();
  const showError = Boolean(trimmed) && !field.pattern.test(trimmed);
  const hasOptions = field.options.length > 0;

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted uppercase tracking-wide">{field.label}</label>
      <input
        ref={inputRef}
        type="text"
        list={hasOptions ? datalistId : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !saving) onSubmit();
        }}
        placeholder={field.placeholder}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : undefined}
        disabled={saving}
        className="w-full bg-input border border-control rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent disabled:opacity-40"
      />
      {hasOptions && (
        <datalist id={datalistId}>
          {field.options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </datalist>
      )}
      {showError && (
        <p id={errorId} className="text-xs text-red-500" role="alert">
          {field.validationError}
        </p>
      )}
    </div>
  );
}

export default function SaveAsModal({
  title,
  containerField,
  itemField,
  onSave,
  onClose,
  saveLabel = "Save",
  saveIcon: SaveIcon = Save,
  width = "w-96",
  focusTrap = true,
}: SaveAsModalProps) {
  const [containerValue, setContainerValue] = useState(containerField.initialValue);
  const [itemValue, setItemValue] = useState(itemField.initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);
  const containerDatalistId = useId();
  const itemDatalistId = useId();
  const containerErrorId = useId();
  const itemErrorId = useId();

  useEffect(() => {
    // Prefer explicitly auto-focused field; default to the item field (Save As UX).
    const focusContainer = Boolean(containerField.autoFocus) && !itemField.autoFocus;
    const ref = focusContainer ? containerInputRef : itemInputRef;
    const shouldSelect = focusContainer ? Boolean(containerField.selectOnFocus) : Boolean(itemField.selectOnFocus ?? true);

    ref.current?.focus();
    if (shouldSelect) ref.current?.select();
  }, [containerField.autoFocus, containerField.selectOnFocus, itemField.autoFocus, itemField.selectOnFocus]);

  const trimmedContainer = containerValue.trim();
  const trimmedItem = itemValue.trim();
  const isValid = containerField.pattern.test(trimmedContainer) && itemField.pattern.test(trimmedItem);

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmedContainer, trimmedItem);
    } catch (e: unknown) {
      setError(formatError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      busy={saving}
      width={width}
      focusTrap={focusTrap}
      error={error}
      footerClassName="mt-3 pt-1"
      confirmLabel={saveLabel}
      confirmIcon={SaveIcon}
      confirmDisabled={!isValid}
      onConfirm={() => void handleSubmit()}
    >
      <div className="space-y-3">
        <FieldInput
          field={containerField}
          value={containerValue}
          onChange={setContainerValue}
          onSubmit={() => void handleSubmit()}
          saving={saving}
          datalistId={containerDatalistId}
          errorId={containerErrorId}
          inputRef={containerInputRef}
        />
        <FieldInput
          field={itemField}
          value={itemValue}
          onChange={setItemValue}
          onSubmit={() => void handleSubmit()}
          saving={saving}
          datalistId={itemDatalistId}
          errorId={itemErrorId}
          inputRef={itemInputRef}
        />
      </div>
    </ModalShell>
  );
}
