import { PanelBottom, PanelRight, PictureInPicture2, X } from "lucide-react";
import { cn } from "../../lib/utils.ts";

/** Where a docked chat panel sits relative to the app content. */
export type ChatDockMode = "bottom" | "right" | "float" | "closed";

export interface ChatDockControlsProps {
  mode: ChatDockMode;
  onModeChange: (mode: ChatDockMode) => void;
  onClose: () => void;
  className?: string;
}

const MODES: { mode: Exclude<ChatDockMode, "closed">; label: string; Icon: typeof PanelBottom }[] = [
  { mode: "float", label: "Float above content", Icon: PictureInPicture2 },
  { mode: "right", label: "Dock to the right", Icon: PanelRight },
  { mode: "bottom", label: "Dock to the bottom", Icon: PanelBottom },
];

/** Dock/float/close buttons rendered in the top-right corner of the chat panel. */
export default function ChatDockControls({ mode, onModeChange, onClose, className }: ChatDockControlsProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {MODES.map(({ mode: value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onModeChange(value)}
          title={label}
          aria-label={label}
          aria-pressed={mode === value}
          className={cn(
            "hidden lg:block p-1 rounded-md transition-colors focus-ring cursor-pointer",
            mode === value ? "text-accent bg-accent-muted" : "text-muted hover:text-primary hover:bg-hover",
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}

      <button
        type="button"
        onClick={onClose}
        title="Close chat"
        aria-label="Close chat"
        className="grid h-11 w-11 place-items-center rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring cursor-pointer lg:h-auto lg:w-auto lg:p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
