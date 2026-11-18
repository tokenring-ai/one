import { type ReactNode, type SelectHTMLAttributes, useId } from "react";
import { cn } from "../lib/utils.ts";
import { controlClassName } from "./control.ts";
import Field from "./field.tsx";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "size" | "children"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}

export default function Select({ label, hint, error, value, onChange, size = "sm", className, id, children, ...rest }: SelectProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <select
        {...rest}
        id={inputId}
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(controlClassName({ size, error: Boolean(error) }), "cursor-pointer")}
      >
        {children}
      </select>
    </Field>
  );
}
