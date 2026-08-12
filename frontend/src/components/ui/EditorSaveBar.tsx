import { Loader2, Save } from "lucide-react";
import type { ReactNode } from "react";
import { DirtyIndicator } from "../../hooks/useDirtyState.tsx";
import { cn } from "../../lib/utils.ts";

export type EditorSaveBarVariant = "subtle" | "accent";

export interface EditorSaveBarProps {
  /** Whether the document has unsaved changes */
  isDirty: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Whether the document is associated with an existing item (vs. a new draft) */
  hasItem: boolean;
  /** Called to save the document. For drafts, this may open a save dialog. */
  onSave: () => void | Promise<void>;
  /** Called to open the "Save As" dialog. Only rendered when `hasItem` is true. */
  onSaveAs?: (() => void) | undefined;
  /** Additional action buttons rendered after the save controls */
  actions?: ReactNode | undefined;
  /** Extra condition that disables the save button (e.g., binary files) */
  disabled?: boolean | undefined;
  /** Label on the save button when item exists and has changes (default: "Save") */
  saveLabel?: string;
  /** Label on the save button when item exists and is clean (default: "Saved") */
  savedLabel?: string;
  /** Label on the save button when no item exists (default: "Save…") */
  draftLabel?: string;
  /** Tooltip for the save button when item exists (default: "Save (Ctrl/⌘+S)") */
  saveTooltip?: string;
  /** Tooltip for the save button when no item exists (default: "Save…") */
  draftTooltip?: string;
  /** "Save As" button label (default: "Save As…") */
  saveAsLabel?: string;
  /** Save button styling variant */
  variant?: EditorSaveBarVariant;
  /** Container className override */
  className?: string;
  "data-testid"?: string;
}

const saveButtonVariants: Record<EditorSaveBarVariant, string> = {
  subtle:
    "px-2.5 py-1 text-xs font-medium text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
  accent:
    "px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
};

/**
 * Compact toolbar group for document save operations.
 *
 * Renders a dirty-state indicator, save button with loading/tri-state labels,
 * optional Save As, and optional trailing actions. Presentational only —
 * keyboard shortcuts and save loading state are owned by the parent.
 */
export default function EditorSaveBar({
  isDirty,
  isSaving,
  hasItem,
  onSave,
  onSaveAs,
  actions,
  disabled = false,
  saveLabel = "Save",
  savedLabel = "Saved",
  draftLabel = "Save…",
  saveTooltip = "Save (Ctrl/⌘+S)",
  draftTooltip = "Save…",
  saveAsLabel = "Save As…",
  variant = "subtle",
  className,
  "data-testid": testId,
}: EditorSaveBarProps) {
  const saveDisabled = disabled || isSaving || (!isDirty && hasItem);
  const buttonLabel = hasItem ? (isDirty ? saveLabel : savedLabel) : draftLabel;
  const buttonTitle = hasItem ? saveTooltip : draftTooltip;
  const showSaveAs = hasItem && onSaveAs != null;

  return (
    <div className={cn("flex items-center gap-1 shrink-0", className)} data-testid={testId}>
      {isDirty ? <DirtyIndicator /> : null}

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saveDisabled}
        title={buttonTitle}
        className={cn("flex items-center gap-1.5", saveButtonVariants[variant])}
      >
        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        {buttonLabel}
      </button>

      {showSaveAs ? (
        <button
          type="button"
          onClick={onSaveAs}
          title={saveAsLabel}
          className="px-2 py-1 text-xs text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer"
        >
          {saveAsLabel}
        </button>
      ) : null}

      {actions}
    </div>
  );
}
