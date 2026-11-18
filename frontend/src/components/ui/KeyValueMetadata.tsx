import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export type KeyValueMetadataSize = "xs" | "sm";

export interface KeyValueRowProps {
  /** The label text (e.g., "From", "Date", "Size") */
  label: string;
  /** The value content */
  value: ReactNode;
  /** Width of the label column (default: "w-8") */
  labelWidth?: string;
  /**
   * Whether to truncate long values (default: true).
   * Ignored when `breakAll` is true.
   */
  truncate?: boolean;
  /** Whether to break long values instead of truncating (e.g., email addresses) */
  breakAll?: boolean;
  /**
   * Vertical alignment of label and value.
   * Use "center" for form field rows.
   */
  align?: "start" | "center";
  /**
   * Row element type. Use "label" when the value is a form control.
   * Default: "div".
   */
  as?: "div" | "label";
  /** Optional className for the label span */
  labelClassName?: string;
  /** Optional className for the value wrapper */
  valueClassName?: string;
  /** Additional className for the row */
  className?: string;
  "data-testid"?: string;
}

export interface KeyValueItem {
  /** The label text */
  label: string;
  /** The value content; `null` / `undefined` / `false` skips the row */
  value: ReactNode | null | undefined | false;
  /** Whether to truncate long values (inherits container default when omitted) */
  truncate?: boolean;
  /** Whether to break long values instead of truncating */
  breakAll?: boolean;
  /** Stable key for the row (defaults to label) */
  key?: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export interface KeyValueMetadataProps {
  /**
   * Array of key-value pairs to display.
   * Falsy items and items with a null/undefined/false `value` are omitted.
   */
  items: Array<KeyValueItem | null | undefined | false>;
  /** Width of the label column (default: "w-8") */
  labelWidth?: string;
  /** Gap between rows (default: "space-y-1") */
  gap?: string;
  /** Text size variant (default: "xs") */
  size?: KeyValueMetadataSize;
  /**
   * Default truncate for rows that do not set their own.
   * Default: true.
   */
  truncate?: boolean;
  /** Add a bottom border under the group */
  divider?: boolean;
  /** Additional className for the container */
  className?: string;
  "data-testid"?: string;
}

const sizeStyles: Record<KeyValueMetadataSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
};

/**
 * Single key-value metadata row: fixed-width label + flexible value column.
 * Use alone for form field labels, or via KeyValueMetadata for display groups.
 */
export function KeyValueRow({
  label,
  value,
  labelWidth = "w-8",
  truncate = true,
  breakAll = false,
  align = "start",
  as: Component = "div",
  labelClassName,
  valueClassName,
  className,
  "data-testid": testId,
}: KeyValueRowProps) {
  return (
    <Component className={cn("flex gap-2", align === "center" ? "items-center" : "items-start", className)} data-testid={testId}>
      <span className={cn("font-medium text-secondary shrink-0", labelWidth, labelClassName)}>{label}</span>
      <span className={cn("min-w-0 flex-1 text-muted", breakAll ? "break-all" : truncate ? "truncate" : undefined, valueClassName)}>{value}</span>
    </Component>
  );
}

/**
 * Group of key-value metadata rows with shared label width, spacing, and size.
 * Data-agnostic: pass rendered ReactNode values (text, icons, chips, inputs).
 */
export default function KeyValueMetadata({
  items,
  labelWidth = "w-8",
  gap = "space-y-1",
  size = "xs",
  truncate = true,
  divider = false,
  className,
  "data-testid": testId,
}: KeyValueMetadataProps) {
  const rows = items.filter((item): item is KeyValueItem => {
    if (!item) return false;
    return item.value != null && item.value !== false;
  });

  if (rows.length === 0) return null;

  return (
    <div className={cn(gap, sizeStyles[size], "text-muted", divider && "pb-3 border-b border-primary", className)} data-testid={testId}>
      {rows.map(item => (
        <KeyValueRow
          key={item.key ?? item.label}
          label={item.label}
          value={item.value as ReactNode}
          labelWidth={labelWidth}
          truncate={item.truncate ?? truncate}
          breakAll={item.breakAll ?? false}
          {...(item.className != null ? { className: item.className } : {})}
          {...(item.labelClassName != null ? { labelClassName: item.labelClassName } : {})}
          {...(item.valueClassName != null ? { valueClassName: item.valueClassName } : {})}
        />
      ))}
    </div>
  );
}
