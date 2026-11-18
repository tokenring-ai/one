import { cn } from "../lib/utils.ts";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name when there is no visible label beside the switch. */
  label: string;
  disabled?: boolean;
  className?: string;
}

/** On/off switch. Not the power-icon enable control — that stays `EnableToggle`. */
export default function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-accent" : "bg-tertiary border border-control",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")}
      />
    </button>
  );
}
