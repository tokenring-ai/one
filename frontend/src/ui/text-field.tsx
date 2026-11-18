import { type InputHTMLAttributes, type ReactNode, type Ref, useId } from "react";
import { cn } from "../lib/utils.ts";
import { controlClassName } from "./control.ts";
import Field from "./field.tsx";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size" | "children"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  mono?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  /** Classes for the outer field, not the input. */
  className?: string;
}

export default function TextField({
  label,
  hint,
  error,
  value,
  onChange,
  size = "sm",
  mono = false,
  leading,
  trailing,
  inputRef,
  className,
  id,
  type = "text",
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <div className="relative">
        {leading ? <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">{leading}</span> : null}
        <input
          {...rest}
          ref={inputRef}
          id={inputId}
          type={type}
          value={value}
          onChange={event => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(controlClassName({ size, mono, error: Boolean(error) }), leading && "pl-8", trailing && "pr-8")}
        />
        {trailing ? <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">{trailing}</span> : null}
      </div>
    </Field>
  );
}
