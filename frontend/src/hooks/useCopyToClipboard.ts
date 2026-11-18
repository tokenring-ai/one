import { useCallback, useEffect, useRef, useState } from "react";
import { type CopyToClipboardOptions, copyToClipboard } from "../lib/clipboard.ts";

export interface UseCopyToClipboardOptions {
  /** Duration the "copied" state stays true (default: 2000ms) */
  feedbackDuration?: number;
  /** Label for toast messages (when set, success toast is shown) */
  label?: string;
  /**
   * Show success/error toasts. Defaults to `true` when `label` is set,
   * otherwise `false` (icon-feedback-only pattern).
   */
  showToast?: boolean;
  /** Duration of the success toast in ms (default: 2000) */
  successDuration?: number;
  /** Duration of the error toast in ms (default: 3000) */
  errorDuration?: number;
  /** Custom success handler (overrides default toast) */
  onSuccess?: CopyToClipboardOptions["onSuccess"];
  /** Custom error handler (overrides default toast) */
  onError?: CopyToClipboardOptions["onError"];
}

export interface UseCopyToClipboardReturn {
  /** Copy text to clipboard; returns whether it succeeded */
  copy: (text: string) => Promise<boolean>;
  /** Whether the last copy succeeded and is still within the feedback window */
  copied: boolean;
  /** Force the "copied" feedback window (e.g. after a custom ClipboardItem write) */
  markCopied: () => void;
}

/**
 * Clipboard copy with automatic "copied" state for icon feedback (Copy → Check).
 * Cleans up the feedback timeout on unmount.
 */
export function useCopyToClipboard(options?: UseCopyToClipboardOptions): UseCopyToClipboardReturn {
  const { feedbackDuration = 2000, label, showToast = label !== undefined, successDuration, errorDuration, onSuccess, onError } = options ?? {};

  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedbackTimeout = useCallback(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const markCopied = useCallback(() => {
    clearFeedbackTimeout();
    setCopied(true);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, feedbackDuration);
  }, [clearFeedbackTimeout, feedbackDuration]);

  useEffect(() => {
    return () => {
      clearFeedbackTimeout();
    };
  }, [clearFeedbackTimeout]);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const copyOptions: CopyToClipboardOptions = { silent: !showToast };
      if (label !== undefined) copyOptions.label = label;
      if (successDuration !== undefined) copyOptions.successDuration = successDuration;
      if (errorDuration !== undefined) copyOptions.errorDuration = errorDuration;
      if (onSuccess !== undefined) copyOptions.onSuccess = onSuccess;
      if (onError !== undefined) copyOptions.onError = onError;

      const ok = await copyToClipboard(text, copyOptions);

      if (ok) {
        markCopied();
      } else {
        clearFeedbackTimeout();
        setCopied(false);
      }
      return ok;
    },
    [label, showToast, successDuration, errorDuration, onSuccess, onError, markCopied, clearFeedbackTimeout],
  );

  return { copy, copied, markCopied };
}
