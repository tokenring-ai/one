import formatError from "@tokenring-ai/utility/error/formatError";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils.ts";

interface ErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: "inline" | "page";
  className?: string;
}

export default function ErrorState({ title = "Something went wrong", error, onRetry, retryLabel = "Retry", variant = "inline", className }: ErrorStateProps) {
  const message = formatError(error);

  if (variant === "page") {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center", className)} role="alert">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-primary mb-1">{title}</h2>
          <p className="text-xs text-muted max-w-sm">{message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors focus-ring cursor-pointer"
          >
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("px-3 py-4 text-center", className)} role="alert">
      <p className="text-sm text-warning">{title}</p>
      <p className="text-2xs text-muted mt-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 text-2xs text-accent hover:text-accent-soft transition-colors focus-ring cursor-pointer">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
