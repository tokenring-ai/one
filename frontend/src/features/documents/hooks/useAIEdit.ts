import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useRef, useState } from "react";
import { toastManager } from "../../../components/ui/toast.tsx";
import { agentRPCClient } from "../../../rpc.ts";

export function useAIEdit(agentId: string | null) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendEdit = useCallback(
    async (selectedText: string, instruction: string) => {
      if (!agentId) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setResponse(null);

      const prompt = `You are a precise markdown document editor. Rewrite the following selected text based on the user's instruction.

Selected text:
\`\`\`
${selectedText}
\`\`\`

Instruction: ${instruction}

Respond with ONLY the rewritten text. No explanation, no preamble, no code fences around the response. Output exactly what should replace the selected text in the document.`;

      try {
        // Snapshot position before sending so we only read the new response
        const startResult = await agentRPCClient.getAgentEvents({ agentId, fromPosition: 0 });
        if (startResult.status !== "success") return;
        await agentRPCClient.sendInput({ agentId, input: { from: "Documents app", message: prompt } });

        let accumulated = "";
        let gotResponse = false;

        for await (const chunk of agentRPCClient.streamAgentEvents({ agentId, fromPosition: startResult.position }, ac.signal)) {
          if (chunk.status !== "success") continue;
          for (const event of chunk.events) {
            if (event.type === "output.chat") {
              accumulated += event.message;
              setResponse(accumulated);
              gotResponse = true;
            }
            if (event.type === "agent.status" && event.inputExecutionQueue.length === 0 && gotResponse) {
              setLoading(false);
              return;
            }
          }
        }
      } catch (e: unknown) {
        if (!ac.signal.aborted) toastManager.error(formatError(e), { duration: 4000 });
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [agentId],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const clear = useCallback(() => setResponse(null), []);

  return { loading, response, sendEdit, cancel, clear };
}
