import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { InteractionResponseMessage, QuestionPromptMessage } from "../../../../types/agent-events.ts";

export default function QuestionWithResponseDisplay({ question, response }: { question: QuestionPromptMessage; response?: InteractionResponseMessage }) {
  const formatResult = (result: unknown): string => {
    if (result === null || result === undefined) return "Cancelled";

    if (typeof result === "string") return result;

    if (Array.isArray(result)) {
      if (result.length === 0) return "Nothing selected";
      if (result.length === 1) {
        const item = result[0] as unknown;
        return typeof item === "string" ? item : JSON.stringify(item);
      }
      return result.map(item => String(item)).join(", ");
    }

    if (typeof result === "object") {
      return JSON.stringify(result, null, 2);
    }

    return String(result as string);
  };

  return (
    <div className="font-medium text-sm">
      <div className="text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.message}</ReactMarkdown>
      </div>

      {response && <div className="py-3 text-success">{formatResult(response.result)}</div>}
    </div>
  );
}
