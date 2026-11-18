import type { ReactNode } from "react";
import { cn } from "../lib/utils.ts";

export interface FieldProps {
  label?: ReactNode | undefined;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  htmlFor?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}

/** Label, control, and either a hint or an error. Not used on its own. */
export default function Field({ label, hint, error, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
      {label != null && label !== "" ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-primary">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
