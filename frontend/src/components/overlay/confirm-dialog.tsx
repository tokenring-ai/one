import { FocusTrap } from "focus-trap-react";
import { X } from "lucide-react";
import type React from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info";
}

export default function ConfirmDialog({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "danger",
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: "bg-red-600 hover:bg-red-500 shadow-red-500/20",
    warning: "bg-amber-600 hover:bg-amber-500 shadow-amber-500/20",
    info: "bg-accent hover:bg-accent-hover shadow-button-primary",
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <FocusTrap>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onKeyDown={handleKeyDown}
      >
        <div className="bg-secondary border border-primary rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-4 border-b border-primary">
            <h3 id="dialog-title" className="text-lg font-semibold text-primary">
              {title}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 text-muted hover:text-primary transition-colors focus-ring cursor-pointer rounded-md"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 py-4">
            <p className="text-sm text-secondary">{message}</p>
          </div>
          <div className="flex gap-3 px-4 pb-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-tertiary hover:bg-hover text-primary rounded-md border border-primary transition-colors focus-ring"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 text-white rounded-md shadow-lg transition-colors active:scale-[0.98] focus-ring ${variantStyles[variant]}`}
              autoFocus
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
