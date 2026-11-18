import { Plus, X } from "lucide-react";

/**
 * Editable list of single-line strings — used for an agent's enabled tools and initial commands.
 * Rows are positional, so the index is a stable enough key while the list is being edited.
 */
export default function StringListEditor({
  values,
  onChange,
  label,
  placeholder,
  addLabel,
  disabled = false,
  mono = false,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  /** Used to build each row's accessible name, e.g. "tool" → "Remove tool 2". */
  label: string;
  placeholder?: string;
  addLabel: string;
  disabled?: boolean;
  mono?: boolean;
}) {
  const setAt = (index: number, value: string) => onChange(values.map((existing, i) => (i === index ? value : existing)));
  const removeAt = (index: number) => onChange(values.filter((_, i) => i !== index));

  return (
    <div className="space-y-1.5">
      {values.map((value, index) => (
        // Rows are positional and have no stable id, so the index is the key.
        <div key={index} className="flex items-center gap-1.5">
          <input
            type="text"
            value={value}
            onChange={event => setAt(index, event.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            spellCheck={false}
            aria-label={`${label} ${index + 1}`}
            className={`flex-1 min-w-0 bg-input border border-control rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent disabled:opacity-60 ${
              mono ? "font-mono" : ""
            }`}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="shrink-0 p-1.5 text-muted hover:text-red-500 rounded transition-colors cursor-pointer focus-ring"
              aria-label={`Remove ${label} ${index + 1}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {values.length === 0 && <p className="text-xs text-muted italic">None configured.</p>}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...values, ""])}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
        >
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      )}
    </div>
  );
}
