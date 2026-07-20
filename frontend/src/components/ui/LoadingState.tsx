import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils.ts";

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const spinnerSizes = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
} as const;

export default function LoadingState({ message, size = "md", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-8", className)} role="status" aria-live="polite">
      <Loader2 className={cn(spinnerSizes[size], "text-muted animate-spin")} />
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}
