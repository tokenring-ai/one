import type { ReactNode } from "react";
import { cn } from "../lib/utils.ts";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export default function Checkbox({ checked, onChange, label, disabled, id, className }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn("inline-flex items-center gap-2 text-xs text-primary cursor-pointer", disabled && "opacity-50 cursor-not-allowed", className)}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="accent-accent cursor-pointer disabled:cursor-not-allowed"
      />
      {label}
    </label>
  );
}
