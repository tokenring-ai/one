import { Eye, EyeOff } from "lucide-react";
import { type InputHTMLAttributes, useState } from "react";
import { cn } from "../../lib/utils.ts";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  /** Current value */
  value: string;
  /** Change handler (receives the input value, not the event) */
  onChange: (value: string) => void;
  /** Whether to show the visibility toggle (default: true) */
  showToggle?: boolean;
  /** Controlled visibility state (optional — if omitted, component manages internally) */
  showValue?: boolean;
  /** Called when visibility is toggled (controlled mode) */
  onShowValueChange?: (show: boolean) => void;
  /** Extra classes for the outer wrapper */
  className?: string;
  /** Extra classes for the input element (merged with defaults) */
  inputClassName?: string;
}

/**
 * Text input with a built-in visibility toggle (Eye/EyeOff) that switches between
 * type="password" and type="text". Supports controlled or uncontrolled visibility.
 */
export default function PasswordInput({
  value,
  onChange,
  showToggle = true,
  showValue: showValueProp,
  onShowValueChange,
  placeholder,
  className,
  inputClassName,
  disabled,
  ...rest
}: PasswordInputProps) {
  const [uncontrolledShow, setUncontrolledShow] = useState(false);
  const isControlled = showValueProp !== undefined;
  const showValue = isControlled ? showValueProp : uncontrolledShow;

  const setShowValue = (next: boolean) => {
    if (!isControlled) setUncontrolledShow(next);
    onShowValueChange?.(next);
  };

  const toggle = () => setShowValue(!showValue);

  return (
    <div className={cn("relative", className)}>
      <input
        {...rest}
        type={showValue ? "text" : "password"}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full bg-input border border-primary rounded-lg py-1.5 pl-3 text-xs text-primary placeholder-muted focus-accent font-mono",
          showToggle ? "pr-8" : "pr-3",
          inputClassName,
        )}
      />
      {showToggle && (
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring rounded"
          title={showValue ? "Hide value" : "Show value"}
          aria-label={showValue ? "Hide value" : "Show value"}
          aria-pressed={showValue}
        >
          {showValue ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}
