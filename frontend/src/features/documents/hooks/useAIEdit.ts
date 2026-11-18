import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useRef, useState } from "react";
import { toastManager } from "../../../components/ui/toast.tsx";
import { agentRPCClient } from "../../../rpc.ts";

const CANCEL_MESSAGE = "User cancelled the document AI edit";

/**
 * Aborting the local event stream only stops this panel from reading. The writer
 * keeps running until we cancel that input (if it is still queued) and abort the
 * operation that is already executing. A late cancel must not abort a newer edit.
 */
async function stopWriter(agentId: string, requestId: string | null, isCurrent: () => boolean): Promise<void> {
  try {
    if (requestId) {
      const cancelled = await agentRPCClient.cancelInput({ agentId, requestId });
      if (cancelled.status === "agentNotFound") {
        toastManager.error("AI agent is no longer available", { duration: 4000 });
        return;
      }
    }
  } catch (error: unknown) {
    toastManager.error(formatError(error), { duration: 4000 });
  }
  if (!isCurrent()) return;
  try {
    const aborted = await agentRPCClient.abortCurrentOperation({ agentId, message: CANCEL_MESSAGE });
    if (aborted.status === "agentNotFound") {
      toastManager.error("AI agent is no longer available", { duration: 4000 });
    }
  } catch (error: unknown) {
    toastManager.error(formatError(error), { duration: 4000 });
  }
}

export function useAIEdit(agentId: string | null) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const generation = useRef(0);

  const sendEdit = useCallback(
    async (selectedText: string, instruction: string) => {
      if (!agentId) return;
      const previousId = requestIdRef.current;
      const previousInFlight = inFlightRef.current;
      const previousGen = generation.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      // A call, not a property read: TypeScript would otherwise narrow the signal to "not aborted" after the first check.
      const isAborted = () => ac.signal.aborted;
      abortRef.current = ac;
      const gen = ++generation.current;
      inFlightRef.current = true;
      requestIdRef.current = null;
      if (previousInFlight) void stopWriter(agentId, previousId, () => generation.current === previousGen);
      setLoading(true);
      setResponse(null);

      const prompt = `You are a precise markdown document editor. Rewrite the following selected text based on the user's instruction.

Selected text:
\`\`\`
${selectedText}
\`\`\`

Instruction: ${instruction}

Respond with ONLY the rewritten text. No explanation, no preamble, no code fences around the response. Output exactly what should replace the selected text in the document.`;

      const isCurrent = () => generation.current === gen;

      try {
        // Snapshot position before sending so we only read the new response
        const startResult = await agentRPCClient.getAgentEvents({ agentId, fromPosition: 0 });
        if (isAborted()) return;
        if (startResult.status !== "success") {
          toastManager.error("Could not connect to the AI agent", { duration: 4000 });
          return;
        }
        const sent = await agentRPCClient.sendInput({ agentId, input: { from: "Documents app", message: prompt } });
        if (sent.status !== "success") {
          if (!isAborted()) toastManager.error("AI agent is no longer available", { duration: 4000 });
          return;
        }
        // Cancel can land while sendInput is in flight, before we know the request id.
        if (isAborted()) {
          void stopWriter(agentId, sent.requestId, isCurrent);
          return;
        }
        requestIdRef.current = sent.requestId;

        let accumulated = "";
        let gotResponse = false;

        for await (const chunk of agentRPCClient.streamAgentEvents({ agentId, fromPosition: startResult.position }, ac.signal)) {
          switch (chunk.status) {
            case "agentNotFound":
              if (!isAborted()) toastManager.error("AI agent is no longer available", { duration: 4000 });
              return;
            case "success":
              break;
            default: {
              const { status } = chunk satisfies never as { status: string };
              throw new Error(`Unexpected agent event stream status: ${status}`);
            }
          }
          for (const event of chunk.events) {
            if (event.type === "output.chat") {
              accumulated += event.message;
              setResponse(accumulated);
              gotResponse = true;
            }
            // Definitive completion (success / error / cancel) — stream stays open forever otherwise
            if (event.type === "agent.response") {
              if (event.status === "error" && !isAborted()) {
                toastManager.error(event.message || "AI edit failed", { duration: 4000 });
              } else if (event.status === "success" && !gotResponse && !isAborted()) {
                toastManager.warning("AI returned no text to apply", { duration: 3000 });
              }
              setLoading(false);
              return;
            }
            if (event.type === "agent.status" && event.inputExecutionQueue.length === 0 && gotResponse) {
              setLoading(false);
              return;
            }
          }
        }
      } catch (e: unknown) {
        if (!isAborted()) toastManager.error(formatError(e), { duration: 4000 });
      } finally {
        if (abortRef.current === ac) {
          inFlightRef.current = false;
          requestIdRef.current = null;
        }
        if (!isAborted()) setLoading(false);
      }
    },
    [agentId],
  );

  const cancel = useCallback(() => {
    const requestId = requestIdRef.current;
    const gen = generation.current;
    const stop = inFlightRef.current;
    inFlightRef.current = false;
    requestIdRef.current = null;
    const ac = abortRef.current;
    abortRef.current = null;
    ac?.abort();
    setLoading(false);
    setResponse(null);
    if (stop && agentId) void stopWriter(agentId, requestId, () => generation.current === gen);
  }, [agentId]);

  const clear = useCallback(() => setResponse(null), []);

  return { loading, response, sendEdit, cancel, clear };
}
