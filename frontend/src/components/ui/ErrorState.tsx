import { AlertCircle } from "lucide-react";
import { describeRpcError, isAdminRequiredError } from "../../lib/rpcErrors.ts";
import { cn } from "../../lib/utils.ts";
import Button from "../../ui/button.tsx";

interface ErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: "inline" | "page";
  className?: string;
}

export default function ErrorState({
  title: titleProp = "Something went wrong",
  error,
  onRetry: onRetryProp,
  retryLabel = "Retry",
  variant = "inline",
  className,
}: ErrorStateProps) {
  // Prefer a short, user-facing message — never dump stack traces into the UI.
  // A member hitting an administrator-only method gets one plain sentence, not the server's raw refusal.
  const message = describeRpcError(error);
  const adminOnly = isAdminRequiredError(error);
  // Retrying cannot help, and "Failed to load X" would blame the app for what is a permission.
  const title = adminOnly ? "Administrators only" : titleProp;
  const onRetry = adminOnly ? undefined : onRetryProp;

  if (variant === "page") {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center", className)} role="alert">
        <div className="w-12 h-12 rounded-full bg-danger-subtle flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-danger" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-primary mb-1">{title}</h2>
          <p className="text-xs text-muted max-w-sm">{message}</p>
        </div>
        {onRetry && (
          <Button type="button" size="md" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("px-3 py-4 text-center", className)} role="alert">
      <p className="text-sm text-warning">{title}</p>
      <p className="text-xs text-muted mt-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 text-xs text-accent hover:text-accent-soft transition-colors focus-ring cursor-pointer">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
