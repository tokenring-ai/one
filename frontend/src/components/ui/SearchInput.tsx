import { Loader2, Search, X } from "lucide-react";
import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils.ts";

export interface SearchInputProps {
  /** Current search value */
  value: string;
  /** Change handler (receives the input value, not the event) */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Accessibility label for the input */
  "aria-label"?: string;
  /** Size variant: sm (default) uses compact padding and text-xs; md is larger */
  size?: "sm" | "md";
  /**
   * Whether to show the clear button.
   * Defaults to true when value is non-empty; set false to never show it.
   */
  showClear?: boolean;
  /** Called when the clear button is clicked (after clearing the value via onChange) */
  onClear?: () => void;
  /** Accessibility label for the clear button */
  clearAriaLabel?: string;
  /** When true, replaces the leading search icon with a spinner */
  loading?: boolean;
  /** Forwarded to the underlying input (disabled, onKeyDown, autoFocus, etc.) */
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "className" | "placeholder" | "aria-label" | "ref">;
  /** Ref for the underlying input element */
  inputRef?: Ref<HTMLInputElement>;
  /** Extra classes for the outer wrapper */
  className?: string;
}

const sizeStyles = {
  sm: {
    input: "py-1.5 pl-8 pr-8 text-xs",
    icon: "left-2.5 w-3.5 h-3.5",
    clearIcon: "w-3.5 h-3.5",
    clearButton: "right-2",
  },
  md: {
    input: "py-2 pl-9 pr-9 text-sm",
    icon: "left-3 w-4 h-4",
    clearIcon: "w-4 h-4",
    clearButton: "right-2.5",
  },
} as const;

/**
 * Search field with a leading search icon and trailing clear button.
 * The clear button appears only when the field has content (unless showClear is false).
 */
export default function SearchInput({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel = "Search",
  size = "sm",
  showClear,
  onClear,
  clearAriaLabel = "Clear search",
  loading = false,
  inputProps,
  inputRef,
  className,
}: SearchInputProps) {
  const styles = sizeStyles[size];
  const shouldShowClear = showClear !== false && value.length > 0;

  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  const LeadingIcon = loading ? Loader2 : Search;

  return (
    <div className={cn("relative", className)}>
      <LeadingIcon
        className={cn("absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none", styles.icon, loading && "animate-spin")}
        aria-hidden="true"
      />
      <input
        {...inputProps}
        ref={inputRef}
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn("w-full bg-input border border-primary rounded-md text-primary placeholder-muted focus-ring", styles.input)}
      />
      {shouldShowClear && (
        <button
          type="button"
          onClick={handleClear}
          className={cn("absolute top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-primary rounded focus-ring cursor-pointer", styles.clearButton)}
          aria-label={clearAriaLabel}
        >
          <X className={styles.clearIcon} />
        </button>
      )}
    </div>
  );
}
