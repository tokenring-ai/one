import { toastManager } from "../components/ui/toast.tsx";

export interface CopyToClipboardOptions {
  /** Label for the toast success message (e.g., "package name" → "Copied package name") */
  label?: string;
  /** Custom success handler (overrides default toast) */
  onSuccess?: (text: string) => void;
  /** Custom error handler (overrides default toast) */
  onError?: (error: unknown) => void;
  /** Duration of the success toast in ms (default: 2000) */
  successDuration?: number;
  /** Duration of the error toast in ms (default: 3000) */
  errorDuration?: number;
  /**
   * When true, suppress default success/error toasts.
   * `onSuccess` / `onError` still run if provided.
   */
  silent?: boolean;
}

/**
 * Copy text to the clipboard via the modern Clipboard API, with an
 * `execCommand("copy")` fallback for older browsers.
 *
 * @returns Whether the copy succeeded
 */
export async function copyToClipboard(text: string, options?: CopyToClipboardOptions): Promise<boolean> {
  const { label, onSuccess, onError, successDuration = 2000, errorDuration = 3000, silent = false } = options ?? {};

  const reportSuccess = () => {
    if (onSuccess) {
      onSuccess(text);
      return;
    }
    if (!silent) {
      const message = label != null && label !== "" ? `Copied ${label}` : "Copied to clipboard";
      toastManager.success(message, { duration: successDuration });
    }
  };

  const reportError = (error: unknown) => {
    if (onError) {
      onError(error);
      return;
    }
    if (!silent) {
      toastManager.error("Could not copy to clipboard", { duration: errorDuration });
    }
  };

  let primaryError: unknown;

  try {
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      reportSuccess();
      return true;
    }
  } catch (error) {
    primaryError = error;
    // fall through to execCommand fallback
  }

  // execCommand is missing in some environments (e.g. jsdom); treat as unsupported.
  // oxlint-disable-next-line typescript/no-deprecated
  if (typeof document.execCommand !== "function") {
    reportError(primaryError ?? new Error("Clipboard API unavailable"));
    return false;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.setAttribute("readonly", "");
  document.body.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    // oxlint-disable-next-line typescript/no-deprecated
    const ok = document.execCommand("copy");
    if (ok) {
      reportSuccess();
      return true;
    }
    reportError(primaryError ?? new Error("execCommand copy returned false"));
    return false;
  } catch (error) {
    reportError(primaryError ?? error);
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}
