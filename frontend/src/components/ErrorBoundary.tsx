import { AlertTriangle, Check, ChevronDown, Copy, Loader2 } from "lucide-react";
import type React from "react";
import { Component, type ReactNode, useState } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error | undefined;
  errorInfo?: React.ErrorInfo | undefined;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-primary">
          <AlertTriangle className="w-16 h-16 text-amber-600 dark:text-amber-400 mb-4" aria-hidden="true" />
          <h1 className="text-lg font-bold text-primary mb-2">Oops! Something went wrong</h1>
          <p className="text-sm text-muted mb-2 max-w-md">We encountered an unexpected error while processing your request.</p>
          <p className="text-sm text-muted mb-6 max-w-md">{this.state.error?.message || "An unexpected error occurred"}</p>

          {/* Expandable error details */}
          <ErrorDetails error={this.state.error} errorInfo={this.state.errorInfo} />

          <ResetButton onReset={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })} />
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper component for the reset button with immediate feedback
function ResetButton({ onReset }: { onReset: () => void }) {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = () => {
    setIsResetting(true);
    try {
      onReset();
    } finally {
      // Reset loading state after a brief moment to show feedback
      setTimeout(() => setIsResetting(false), 200);
    }
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={isResetting}
      className="px-4 py-2 btn-accent rounded-lg transition-all mt-4 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isResetting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Resetting...</span>
        </>
      ) : (
        <span>Try Again</span>
      )}
    </button>
  );
}

function ErrorDetails({ error, errorInfo }: { error?: Error | undefined; errorInfo?: React.ErrorInfo | undefined }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!error) return;

    const errorText = errorInfo
      ? `${error.message}\n\nStack:\n${error.stack}\n\nComponent Stack:\n${errorInfo.componentStack}`
      : `${error.message}\n\nStack:\n${error.stack}`;

    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy error details:", err);
    }
  };

  if (!error) return null;

  return (
    <div className="mt-4 w-full max-w-2xl text-left">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors focus-ring rounded-md px-2 py-1 -ml-2"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        <span>{isExpanded ? "Hide error details" : "Show error details"}</span>
      </button>

      {isExpanded && (
        <div className="mt-3 p-4 bg-secondary border border-primary rounded-lg text-left shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-muted">Error Details</span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-hover transition-colors focus-ring"
              title={copied ? "Copied!" : "Copy error details"}
              aria-label={copied ? "Error details copied" : "Copy error details to clipboard"}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted" />}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs font-mono text-muted mb-1">Message:</div>
              <code className="text-sm text-red-500 font-mono wrap-break-word whitespace-pre-wrap">{error.message}</code>
            </div>

            {error.stack && (
              <div>
                <div className="text-xs font-mono text-muted mb-1">Stack trace:</div>
                <pre className="text-xs font-mono text-secondary bg-tertiary p-2 rounded-md overflow-auto max-h-48 border border-primary/20">{error.stack}</pre>
              </div>
            )}

            {errorInfo && (
              <div>
                <div className="text-xs font-mono text-muted mb-1">Component stack:</div>
                <pre className="text-xs font-mono text-secondary bg-tertiary p-2 rounded-md overflow-auto max-h-48 border border-primary/20">
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
