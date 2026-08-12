import { Loader2, Send } from "lucide-react";
import { type ElementType, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/utils.ts";

type ButtonVariant = "indigo" | "violet" | "emerald" | "accent";

export interface EmptyStateWithPromptProps {
  /** Icon component for the gradient badge */
  icon: ElementType;
  /** Gradient classes for the icon badge (e.g. "from-indigo-500 to-violet-600") */
  iconGradient: string;
  /** Page title */
  title: string;
  /** Description when the user has existing content to browse */
  descriptionWithContent: ReactNode;
  /** Description when the user has no existing content (first-time) */
  descriptionEmpty: ReactNode;
  /** Whether the user has existing content (controls which description shows) */
  hasContent: boolean;
  /** Message shown when an agent is already running */
  agentRunningMessage: ReactNode;
  /** Whether an agent is currently active */
  hasAgent: boolean;
  /** Label for the prompt textarea */
  promptLabel: string;
  /** Placeholder text for the prompt textarea */
  promptPlaceholder: string;
  /** Label on the submit button when idle */
  submitLabel: string;
  /** Leading icon for the submit button (default: Send) */
  submitIcon?: ElementType;
  /** Label on the submit button while submitting (default: "Starting…") */
  submittingLabel?: string;
  /** Button color variant (default: "indigo") */
  buttonVariant?: ButtonVariant;
  /** Called with the trimmed prompt text. Returns true on success to clear the form. */
  onSubmit: (prompt: string) => Promise<boolean>;
  /** Optional secondary action buttons rendered below the prompt form */
  secondaryActions?: ReactNode;
  /** Accessible name for the textarea (defaults to promptLabel) */
  promptAriaLabel?: string;
  /** Accessible name for the submit button (defaults to submitLabel) */
  submitAriaLabel?: string;
  /** Container className override */
  className?: string;
  "data-testid"?: string;
}

const buttonColors: Record<ButtonVariant, string> = {
  indigo: "bg-indigo-600 hover:bg-indigo-500",
  violet: "bg-violet-600 hover:bg-violet-500",
  emerald: "bg-emerald-600 hover:bg-emerald-500",
  accent: "bg-accent hover:bg-accent-hover",
};

/**
 * Full-page empty state with an agent-launch prompt.
 *
 * Manages local query/submit state, auto-focuses the textarea when no agent is
 * running, and supports ⌘/Ctrl+Enter submission. Distinct from the simpler
 * `EmptyState` which only handles icon/title/hint/CTA.
 */
export default function EmptyStateWithPrompt({
  icon: Icon,
  iconGradient,
  title,
  descriptionWithContent,
  descriptionEmpty,
  hasContent,
  agentRunningMessage,
  hasAgent,
  promptLabel,
  promptPlaceholder,
  submitLabel,
  submitIcon: SubmitIcon = Send,
  submittingLabel = "Starting…",
  buttonVariant = "indigo",
  onSubmit,
  secondaryActions,
  promptAriaLabel,
  submitAriaLabel,
  className,
  "data-testid": testId,
}: EmptyStateWithPromptProps) {
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generatedId = useId();
  const textareaId = `empty-state-prompt-${generatedId}`;

  useEffect(() => {
    if (!hasAgent) textareaRef.current?.focus();
  }, [hasAgent]);

  const handleSubmit = async () => {
    const trimmed = query.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit(trimmed);
      if (ok) setQuery("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn("h-full flex flex-col items-center justify-center gap-6 p-6 sm:p-8 bg-primary", className)} data-testid={testId}>
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-3">
          <div className={cn("w-14 h-14 rounded-2xl bg-linear-to-br flex items-center justify-center shadow-lg mx-auto", iconGradient)}>
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-primary">{title}</h2>
            <p className="text-sm text-muted mt-1.5 max-w-md mx-auto leading-relaxed">{hasContent ? descriptionWithContent : descriptionEmpty}</p>
          </div>
        </div>

        {hasAgent ? (
          <div className="bg-secondary border border-primary rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-muted leading-relaxed">{agentRunningMessage}</p>
          </div>
        ) : (
          <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-3">
            <label htmlFor={textareaId} className="text-xs font-semibold text-muted uppercase tracking-wide">
              {promptLabel}
            </label>
            <textarea
              id={textareaId}
              ref={textareaRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              rows={4}
              placeholder={promptPlaceholder}
              disabled={submitting}
              className="w-full bg-input border border-primary rounded-xl px-3 py-2.5 text-sm text-primary placeholder-muted focus-accent resize-y min-h-[96px] disabled:opacity-60"
              aria-label={promptAriaLabel ?? promptLabel}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">⌘/Ctrl + Enter to send</p>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !query.trim()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-button-primary",
                  buttonColors[buttonVariant],
                )}
                aria-label={submitAriaLabel ?? submitLabel}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> {submittingLabel}
                  </>
                ) : (
                  <>
                    <SubmitIcon className="w-4 h-4" /> {submitLabel}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {secondaryActions}
      </div>
    </div>
  );
}
