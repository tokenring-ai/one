import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useRef, useState } from "react";
import { toastManager } from "../ui/toast.tsx";

/** Which answer is in flight: a submit or a cancel. */
export type QuestionAnswerKind = "submit" | "cancel";

/**
 * Sends one answer to a question at a time. While a submit or cancel is in flight
 * both are refused, so a question can never be answered twice. A failed answer is
 * reported (toast + `error`) and the question is re-enabled so the user can retry
 * or cancel; a successful one closes the question.
 *
 * `stayBusyAfterSuccess` keeps the inputs disabled after a successful answer, for a
 * question that is answered for good (the agent's reply event, not this component,
 * retires it). A field nested in a form passes false: the form moves on to the next
 * field and the inputs must work again.
 */
export function useQuestionAnswer({ onClose, stayBusyAfterSuccess = true }: { onClose: () => void; stayBusyAfterSuccess?: boolean }) {
  const [pending, setPending] = useState<QuestionAnswerKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const answer = useCallback(
    async (kind: QuestionAnswerKind, send: () => unknown): Promise<boolean> => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setPending(kind);
      setError(null);
      try {
        await send();
      } catch (err) {
        const message = formatError(err);
        setError(message);
        toastManager.error(`${kind === "cancel" ? "Failed to cancel the question" : "Failed to send your answer"}: ${message}`, { duration: 5000 });
        inFlightRef.current = false;
        setPending(null);
        return false;
      }
      if (!stayBusyAfterSuccess) {
        inFlightRef.current = false;
        setPending(null);
      }
      onClose();
      return true;
    },
    [onClose, stayBusyAfterSuccess],
  );

  /** True while an answer is in flight; read synchronously, so it also guards same-tick double clicks. */
  const isBusy = useCallback(() => inFlightRef.current, []);

  return { answer, busy: pending !== null, pending, error, isBusy };
}
