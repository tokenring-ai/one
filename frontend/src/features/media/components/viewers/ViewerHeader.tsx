import { X } from "lucide-react";
import type { ReactNode } from "react";

export default function ViewerHeader({
  title,
  subtitle,
  keywords,
  actions,
  onClose,
}: {
  title: string;
  subtitle?: string;
  keywords?: string[];
  actions?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="shrink-0 px-5 pt-5 pb-4 border-b border-primary space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted truncate font-mono">{title}</span>
          {subtitle && <span className="text-2xs text-muted shrink-0">{subtitle}</span>}
        </div>
        <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary transition-colors rounded focus-ring cursor-pointer shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {keywords && keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map(k => (
            <span key={k} className="px-2 py-0.5 bg-tertiary border border-primary rounded-full text-2xs text-muted">
              {k}
            </span>
          ))}
        </div>
      )}

      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
