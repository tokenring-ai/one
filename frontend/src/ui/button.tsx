import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ElementType, ReactNode } from "react";
import { cn } from "../lib/utils.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warning";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  /** Lucide icon rendered before the label. Replaced by a spinner while `busy`. */
  icon?: ElementType | undefined;
  busy?: boolean | undefined;
  /** Label shown in place of `children` while `busy`. */
  busyLabel?: string | undefined;
  fullWidth?: boolean | undefined;
  children?: ReactNode | undefined;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-button-primary",
  secondary: "border border-primary bg-transparent text-primary hover:bg-hover",
  ghost: "bg-transparent text-muted hover:text-primary hover:bg-hover",
  danger: "bg-danger-solid text-on-accent hover:opacity-90",
  warning: "bg-warning-solid text-on-accent hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export default function Button({
  variant = "primary",
  size = "sm",
  icon: Icon,
  busy = false,
  busyLabel,
  fullWidth = false,
  className,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-variant={variant}
      data-size={size}
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {busy ? <Loader2 className={cn(iconClass, "animate-spin")} aria-hidden="true" /> : Icon ? <Icon className={iconClass} aria-hidden="true" /> : null}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
