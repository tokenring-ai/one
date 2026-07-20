import { useEffect, useRef } from "react";
import { terminalRPCClient } from "../rpc.ts";
import { useRPCStreamSWR } from "./useRPCStreamSWR.ts";

export type TerminalOutputState = {
  output: string;
  position: number;
  complete: boolean;
};

export function useTerminalOutput(terminalName: string | null, resume?: TerminalOutputState) {
  const positionRef = useRef(resume?.position ?? 0);
  const baseOutputRef = useRef(resume?.output ?? "");

  useEffect(() => {
    positionRef.current = resume?.position ?? 0;
    baseOutputRef.current = resume?.output ?? "";
  }, [terminalName, resume?.position, resume?.output]);

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
    shouldStop: chunk => chunk.status === "terminalNotFound",
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
        output: prior.output + chunk.output,
        position: chunk.position,
        complete: chunk.complete,
      };
    },
  });
}
