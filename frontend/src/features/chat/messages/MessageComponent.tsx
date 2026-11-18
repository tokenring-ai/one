import { motion, type Variants } from "framer-motion";
import { Check, Info, RotateCcw, Square } from "lucide-react";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AttachmentChip from "../../../components/chat/AttachmentChip";
import { markdownLinkComponents } from "../../../components/chat/MarkdownLink.tsx";
import type { TurnUsage } from "../../../hooks/usePerTurnUsage.ts";
import type { ChatMessage, InteractionResponseMessage, QuestionPromptMessage } from "../../../types/agent-events.ts";
import CodeBlock from "./components/CodeBlock.tsx";
import InteractionResponseDisplay from "./components/InteractionResponseDisplay.tsx";
import MessageDetails from "./components/MessageDetails.tsx";
import MessageFooter from "./components/MessageFooter.tsx";
import QuestionWithResponseDisplay from "./components/QuestionWithResponseDisplay.tsx";
import SessionEvent from "./components/SessionEvent.tsx";
import ThinkingBlock from "./components/ThinkingBlock.tsx";
import ToolCallDisplay from "./components/ToolCallDisplay.tsx";
import TurnEnd, { isTurnCompleteMessage } from "./components/TurnEnd.tsx";
import UserMessage from "./components/UserMessage.tsx";
import { events } from "./eventConfig.tsx";
import { getInputSource, getMessageDetails, getMessageText } from "./messageUtils.ts";

interface MessageComponentProps {
  msg: ChatMessage;
  agentId: string;
  question?: QuestionPromptMessage;
  response?: InteractionResponseMessage;
  /** Per-turn cost/tokens for a completed response. */
  usage?: TurnUsage;
  /** Resend this (failed) turn's input. Only offered for error responses. */
  onRetry?: () => void;
  /** Load this user message back into the composer. */
  onEdit?: () => void;
  /** True while the retry triggered from this message is in flight. */
  retrying?: boolean;
  /** Start a new agent from this point of the conversation (before a message you sent, after a finished reply). */
  onBranch?: () => void;
}

const messageVariants = {
  hidden: { opacity: 0, x: -4 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
} satisfies Variants;

export default function MessageComponent({ msg, question, response, usage, onRetry, onEdit, onBranch, retrying = false }: MessageComponentProps) {
  const messageIcon = useMemo(() => {
    if (msg.type === "agent.response") {
      if (msg.status === "success") return <Check className="w-[1em] text-success" />;
      if (msg.status === "cancelled") return <Square className="w-[1em] text-warning" />;
      return <Info className="w-[1em] text-error/70" />;
    }
    return events[msg.type].icon;
  }, [msg]);

  const messageStyle = useMemo(() => {
    if (msg.type !== "agent.response") return events[msg.type].style;
    // The answer itself reads as prose; the check mark carries the outcome.
    if (msg.status === "success") return "text-primary";
    if (msg.status === "cancelled") return "text-warning font-medium";
    return "text-error font-medium";
  }, [msg]);

  const attachments = useMemo(() => {
    if (msg.type === "input.received") return msg.input.attachments ?? [];
    if (msg.type === "agent.response" && "attachments" in msg) return msg.attachments ?? [];
    return [];
  }, [msg]);

  const messageText = getMessageText(msg);
  const messageDetails = getMessageDetails(msg);
  const inputSource = getInputSource(msg);
  const hasAttachments = attachments.length > 0;
  const pairedQuestion = question ?? (msg.type === "question" ? msg : undefined);
  const isQuestionWithResponse = Boolean(pairedQuestion && response);

  const markdown = messageText ? (
    <div className="prose prose-sm dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ...markdownLinkComponents,
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const text = String(children as string).trim();
            if (text.includes("\n")) {
              return <CodeBlock {...(className !== undefined && { className })}>{text}</CodeBlock>;
            } else {
              return (
                <code {...(className !== undefined && { className })} {...props}>
                  {text}
                </code>
              );
            }
          },
        }}
      >
        {messageText}
      </ReactMarkdown>
    </div>
  ) : null;

  // Sessions starting, relaunching, branching or stopping: a band across the transcript, not a chat row.
  if (msg.type === "agent.created" || msg.type === "agent.stopped") {
    return <SessionEvent message={msg.message} details={getMessageDetails(msg)} timestamp={msg.timestamp} ended={msg.type === "agent.stopped"} />;
  }

  // The chat command's "Response Complete [Tokens …]" status ends a turn; it is not something the agent said.
  if (msg.type === "agent.response" && msg.status === "success" && isTurnCompleteMessage(msg.message)) {
    return <TurnEnd message={msg.message} timestamp={msg.timestamp} usage={usage} onBranch={onBranch} />;
  }

  if (msg.type === "input.received") {
    return (
      <motion.div variants={messageVariants} initial="hidden" animate="visible">
        <UserMessage
          text={msg.input.message}
          source={inputSource}
          timestamp={msg.timestamp}
          attachments={attachments}
          body={markdown}
          onEdit={onEdit}
          onBranch={onBranch}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={`group relative flex flex-row items-start gap-3 px-3 ${msg.type === "toolCall" ? "py-1" : "py-3"} transition-colors border-l-2 ${
        isQuestionWithResponse
          ? "bg-accent-tint border-accent-line"
          : msg.type === "input.interaction"
            ? "bg-success/10 border-success"
            : "hover:bg-hover border-transparent hover:border-primary"
      }`}
    >
      <div className="shrink-0 w-6 flex justify-center items-center prose prose-sm">
        {isQuestionWithResponse ? <span className="text-accent-soft font-bold flex items-center">?</span> : messageIcon}
      </div>

      <div className={`${messageStyle} w-full min-w-0`}>
        {msg.type === "toolCall" ? (
          <ToolCallDisplay msg={msg} />
        ) : isQuestionWithResponse ? (
          <QuestionWithResponseDisplay question={pairedQuestion!} {...(response !== undefined && { response })} />
        ) : msg.type === "input.interaction" ? (
          <InteractionResponseDisplay msg={msg as InteractionResponseMessage} />
        ) : msg.type === "output.reasoning" ? (
          <ThinkingBlock message={msg.message} />
        ) : messageText ? (
          <>
            {markdown}

            <MessageDetails details={messageDetails} />

            {hasAttachments && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Attachments">
                {attachments.map((attachment, index) => (
                  <AttachmentChip key={`${attachment.name}-${index}`} attachment={attachment} variant="pill" />
                ))}
              </ul>
            )}
          </>
        ) : null}
        {onRetry && (
          <div className="flex flex-row items-center gap-2 pt-1.5">
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-hover hover:text-primary focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
              title="Resend this message to the agent"
              aria-label="Retry failed message"
            >
              <RotateCcw className={`w-3 h-3 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}
        <MessageFooter msg={msg} {...(usage !== undefined && { usage })} {...(onBranch !== undefined && { onBranch })} />
      </div>
    </motion.div>
  );
}
