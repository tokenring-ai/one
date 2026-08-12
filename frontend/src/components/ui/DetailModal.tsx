import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { type ComponentType, type ReactNode, useEffect, useId, useState } from "react";
import { cn } from "../../lib/utils.ts";

export type DetailModalIcon = ComponentType<{ size?: number; className?: string }>;

export interface DetailModalMetadataItem {
  /** Optional leading icon for the row */
  icon?: DetailModalIcon;
  /** Optional label shown before the value (e.g. "Provider") */
  label?: string;
  /** Row content */
  value: ReactNode;
}

export interface DetailModalProps {
  /** Modal header icon */
  icon: DetailModalIcon;
  /** Modal title */
  title: string;
  /** Metadata rows to display */
  metadata: DetailModalMetadataItem[];
  /** Optional description text (rendered as pre-wrapped text) */
  description?: string;
  /** Whether a destructive action is in progress (OR'd with internal busy state) */
  destructiveBusy?: boolean;
  /** Close handler */
  onClose: () => void;
  /** Optional edit action */
  onEdit?: () => void;
  /** Optional destructive action (e.g., delete) */
  onDestructive?: () => void | Promise<void>;
  /** Label for the destructive action button (default: "Delete") */
  destructiveLabel?: string;
  /** Icon for the destructive action (default: Trash2) */
  destructiveIcon?: ComponentType<{ size?: number; className?: string }>;
  /** Label for the edit action button (default: "Edit") */
  editLabel?: string;
  /** Icon for the edit action (default: Pencil) */
  editIcon?: ComponentType<{ size?: number; className?: string }>;
  /** Confirmation message for destructive action (uses window.confirm when set) */
  destructiveConfirmMessage?: string;
  /** Additional footer actions rendered between destructive and close/edit */
  footerActions?: ReactNode;
  /** Max width of the modal (default: "max-w-sm") */
  maxWidth?: string;
  /** Additional className for the modal content */
  className?: string;
}

/**
 * Compact modal for entity details: icon header, metadata body, action footer.
 * Closes on backdrop click / Escape when not mid-destructive action.
 */
export default function DetailModal({
  icon: HeaderIcon,
  title,
  metadata,
  description,
  destructiveBusy = false,
  onClose,
  onEdit,
  onDestructive,
  destructiveLabel = "Delete",
  destructiveIcon: DestructiveIcon = Trash2,
  editLabel = "Edit",
  editIcon: EditIcon = Pencil,
  destructiveConfirmMessage,
  footerActions,
  maxWidth = "max-w-sm",
  className,
}: DetailModalProps) {
  const [busyInternal, setBusyInternal] = useState(false);
  const busy = destructiveBusy || busyInternal;
  const titleId = useId();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, busy]);

  const handleDestructive = async () => {
    if (!onDestructive || busy) return;
    if (destructiveConfirmMessage) {
      const ok = window.confirm(destructiveConfirmMessage);
      if (!ok) return;
    }
    setBusyInternal(true);
    try {
      await onDestructive();
    } finally {
      setBusyInternal(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onClose();
      }}
      data-testid="detail-modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("bg-primary border border-primary rounded-2xl shadow-2xl w-full mx-4 overflow-hidden", maxWidth, className)}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <HeaderIcon size={16} className="shrink-0 text-accent" />
            <h2 id={titleId} className="text-base font-bold text-primary truncate">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 p-1 rounded-lg hover:bg-hover transition-colors text-muted hover:text-primary cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-3 space-y-2">
          {metadata.map((item, index) => {
            const RowIcon = item.icon;
            const key = item.label ?? `meta-${index}`;

            if (RowIcon) {
              return (
                <div key={key} className="flex items-start gap-2 text-sm text-muted">
                  <RowIcon size={14} className="shrink-0 mt-0.5" />
                  <span>
                    {item.label != null && item.label !== "" ? (
                      <>
                        <span className="font-medium">{item.label}: </span>
                        {item.value}
                      </>
                    ) : (
                      item.value
                    )}
                  </span>
                </div>
              );
            }

            if (item.label != null && item.label !== "") {
              return (
                <p key={key} className="text-xs text-muted">
                  {item.label}: {item.value}
                </p>
              );
            }

            return (
              <div key={key} className="text-sm text-muted">
                {item.value}
              </div>
            );
          })}

          {description ? <p className="text-xs text-primary/80 pt-1 whitespace-pre-wrap">{description}</p> : null}
        </div>

        <div className="px-5 pb-5 flex items-center gap-2">
          {onDestructive ? (
            <button
              type="button"
              onClick={() => void handleDestructive()}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 border border-rose-500/40 hover:bg-rose-500/10 text-rose-500 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <DestructiveIcon size={13} />}
              {destructiveLabel}
            </button>
          ) : null}

          {footerActions}

          <div className="flex-1" />

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Close
          </button>

          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <EditIcon size={13} /> {editLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
