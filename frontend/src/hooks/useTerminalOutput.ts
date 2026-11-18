import { useRef } from "react";
import { terminalRPCClient } from "../rpc.ts";
import { useRPCStreamSWR } from "./useRPCStreamSWR.ts";

export type TerminalOutputState = {
  /** The latest output, at most MAX_TERMINAL_OUTPUT_CHARS: older text is dropped from the front. */
  output: string;
  position: number;
  complete: boolean;
  /**
   * How many characters have ever been appended. Once `output` is capped its length stops
   * changing, so a view tells new text apart by this count instead (see XTermView's outputEnd).
   */
  outputEnd?: number;
};

/**
 * Cap the client-side output buffer to avoid unbounded memory growth (and the
 * O(n²) cost of repeated full-string concatenation) during long sessions.
 * Views track new text by `outputEnd`, which keeps counting after the cap.
 */
const MAX_TERMINAL_OUTPUT_CHARS = 512 * 1024;

function capOutput(output: string): string {
  return output.length > MAX_TERMINAL_OUTPUT_CHARS ? output.slice(-MAX_TERMINAL_OUTPUT_CHARS) : output;
}

export function useTerminalOutput(terminalName: string | null, resume?: TerminalOutputState) {
  const positionRef = useRef(resume?.position ?? 0);
  const baseOutputRef = useRef(resume?.output ?? "");
  const nameRef = useRef(terminalName);

  // Rebase during render, before the stream below reseeds itself: an effect would run after the
  // stream had already resumed the new terminal from the previous terminal's buffer and position.
  // Only a change of terminal rebases — within one session the reducer owns these.
  if (nameRef.current !== terminalName) {
    nameRef.current = terminalName;
    positionRef.current = resume?.position ?? 0;
    baseOutputRef.current = resume?.output ?? "";
  }

  return useRPCStreamSWR({
    key: terminalName ? `terminal-output:${terminalName}` : null,
    initialData: (): TerminalOutputState => ({
      output: baseOutputRef.current,
      position: positionRef.current,
      complete: resume?.complete ?? false,
    }),
    subscribe: signal =>
      terminalRPCClient.streamTerminalOutput(
        {
          terminalName: terminalName!,
          fromPosition: positionRef.current,
        },
        signal,
      ),
    // Non-success statuses end the subscription; complete means the process exited and
    // the server closed the stream — without stopping here useRPCStream would
    // reconnect in a tight loop and re-yield the same terminal-exited chunk.
    shouldStop: chunk => chunk.status !== "success" || chunk.complete,
    reduce: (prev, chunk) => {
      if (chunk.status !== "success") {
        return (
          prev ?? {
            output: baseOutputRef.current,
            position: positionRef.current,
            complete: resume?.complete ?? false,
          }
        );
      }

      positionRef.current = chunk.position;
      const prior = prev ?? {
        output: baseOutputRef.current,
        position: positionRef.current,
        complete: resume?.complete ?? false,
      };

      return {
        output: capOutput(prior.output + chunk.output),
        position: chunk.position,
        complete: chunk.complete,
        outputEnd: (prior.outputEnd ?? prior.output.length) + chunk.output.length,
      };
    },
  });
}
