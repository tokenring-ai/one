import { cn } from "../lib/utils.ts";

/** Shared chrome for text inputs, textareas, and native selects. */
export function controlClassName(options?: { size?: "sm" | "md"; mono?: boolean; error?: boolean }): string {
  const size = options?.size ?? "sm";
  return cn(
    "w-full bg-input border border-control rounded-md text-primary placeholder-muted focus-ring disabled:opacity-50 disabled:cursor-not-allowed",
    size === "md" ? "px-3 py-2 text-sm" : "px-3 py-1.5 text-xs",
    options?.mono && "font-mono",
    options?.error && "border-danger",
  );
}
