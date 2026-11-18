import type { ReactNode } from "react";
import { cn } from "../lib/utils.ts";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-sunken border-default text-muted",
  accent: "bg-accent-subtle border-accent text-accent-soft",
  success: "bg-success-subtle border-success text-success",
  warning: "bg-warning-subtle border-warning text-warning",
  danger: "bg-danger-subtle border-danger text-danger",
  info: "bg-info-subtle border-info text-info",
};

const dots: Record<BadgeTone, string> = {
  neutral: "bg-tertiary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-error",
  info: "bg-info",
};

export interface BadgeProps {
  tone?: BadgeTone;
  layout?: "pill" | "inline";
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

export default function Badge({ tone = "neutral", layout = "pill", dot = false, pulse = false, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 shrink-0 text-xs",
        layout === "pill" && "px-2 py-0.5 rounded-full font-medium border",
        tones[tone],
        layout === "inline" && "border-0 bg-transparent px-0 py-0",
        className,
      )}
    >
      {dot ? <span className={cn("w-1.5 h-1.5 rounded-full", dots[tone], pulse && "animate-pulse")} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
