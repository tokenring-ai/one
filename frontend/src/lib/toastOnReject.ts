import formatError from "@tokenring-ai/utility/error/formatError";
import { toastManager } from "../components/ui/toast.tsx";

export type ToastOnRejectOptions = {
  /** Error toast message. Defaults to `formatError(error)`. */
  message?: string | ((error: unknown) => string);
  duration?: number;
  /** Toast type; defaults to `"error"`. */
  type?: "error" | "warning";
};

/**
 * Fire-and-forget a promise and surface rejections as toasts.
 * Prefer this over `void promise.catch(() => {})` so failures are never silent.
 */
export function toastOnReject(promise: PromiseLike<unknown>, options?: ToastOnRejectOptions): void {
  void Promise.resolve(promise).catch((error: unknown) => {
    const message = typeof options?.message === "function" ? options.message(error) : (options?.message ?? formatError(error));
    const duration = options?.duration ?? 5000;
    if (options?.type === "warning") {
      toastManager.warning(message, { duration });
    } else {
      toastManager.error(message, { duration });
    }
  });
}
