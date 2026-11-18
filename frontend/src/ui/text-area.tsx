import { type ReactNode, type TextareaHTMLAttributes, useId } from "react";
import { cn } from "../lib/utils.ts";
import { controlClassName } from "./control.ts";
import Field from "./field.tsx";

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "children"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  mono?: boolean;
  className?: string;
}

export default function TextArea({ label, hint, error, value, onChange, size = "sm", mono = false, className, id, rows = 4, ...rest }: TextAreaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <textarea
        {...rest}
        id={inputId}
        rows={rows}
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(controlClassName({ size, mono, error: Boolean(error) }), "resize-y")}
      />
    </Field>
  );
}
