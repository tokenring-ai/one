import type { InteractionResponseMessage } from "../../../../types/agent-events.ts";

export default function InteractionResponseDisplay({ msg }: { msg: InteractionResponseMessage }) {
  const result = msg.result;

  let displayText: string;

  if (result === null) {
    displayText = "Cancelled";
  } else if (Array.isArray(result)) {
    if (result.length === 0) {
      displayText = "Nothing selected";
    } else if (result.length === 1) {
      displayText = String(result[0]);
    } else {
      displayText = result.map(item => String(item)).join(", ");
    }
  } else if (typeof result === "string") {
    displayText = result;
  } else if (typeof result === "object") {
    displayText = JSON.stringify(result, null, 2);
  } else {
    displayText = `Unknown result: ${typeof result}`;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted font-mono">
        <span>Interaction ID:</span>
        <code className="bg-tertiary border border-primary px-1.5 py-0.5 rounded text-xs">{msg.interactionId}</code>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted font-mono">
        <span>Request ID:</span>
        <code className="bg-tertiary border border-primary px-1.5 py-0.5 rounded text-xs">{msg.requestId}</code>
      </div>
      <div className="mt-2 p-3 bg-secondary border border-primary rounded-lg">
        <div className="text-xs text-success font-medium mb-1">Response Result:</div>
        <div className="text-sm text-primary font-mono wrap-break-word whitespace-pre-wrap">{displayText}</div>
      </div>
    </div>
  );
}
