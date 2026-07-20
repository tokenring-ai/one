import { motion, type Variants } from "framer-motion";
import { Check, Info, Square } from "lucide-react";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AttachmentChip from "../../../components/chat/AttachmentChip";
import type { ChatMessage, InteractionResponseMessage, QuestionPromptMessage } from "../../../types/agent-events.ts";
import CodeBlock from "./components/CodeBlock.tsx";
import InteractionResponseDisplay from "./components/InteractionResponseDisplay.tsx";
import MessageDetails from "./components/MessageDetails.tsx";
import MessageFooter from "./components/MessageFooter.tsx";
import QuestionWithResponseDisplay from "./components/QuestionWithResponseDisplay.tsx";
import ThinkingBlock from "./components/ThinkingBlock.tsx";
import ToolCallDisplay from "./components/ToolCallDisplay.tsx";
import { events } from "./eventConfig.tsx";
import { getInputSource, getMessageDetails, getMessageText } from "./messageUtils.ts";

interface MessageComponentProps {
  msg: ChatMessage;
  agentId: string;
  question?: QuestionPromptMessage;
  response?: InteractionResponseMessage;
}

const messageVariants = {
  hidden: { opacity: 0, x: -4 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
} satisfies Variants;

export default function MessageComponent({ msg, question, response }: MessageComponentProps) {
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
    if (msg.status === "success") return "text-success font-medium";
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

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={`group relative flex flex-row items-start gap-3 px-3 py-3 transition-colors border-l-2 ${
        msg.type === "input.received"
          ? "bg-accent-subtle border-accent-strong"
          : isQuestionWithResponse
            ? "bg-cyan-50/30 dark:bg-cyan-500/5 border-cyan-500/30"
            : msg.type === "input.interaction"
              ? "bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-500/30"
              : "hover:bg-hover border-transparent hover:border-primary"
      }`}
    >
      <div className="shrink-0 w-6 flex justify-center items-center prose prose-sm">
        {isQuestionWithResponse ? <span className="text-cyan-500 font-bold flex items-center">?</span> : messageIcon}
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
            {inputSource && <div className="text-primary font-bold font-mono text-sm mb-1">From: {inputSource}</div>}
            <div className="prose prose-sm dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
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

            <MessageDetails details={messageDetails} />

            {hasAttachments && (
              <div
                className="mt-2 inline-block max-w-full rounded-md border border-primary bg-black/[0.05] px-2.5 py-2 shadow-sm dark:bg-white/[0.08]"
                role="group"
                aria-label="Attachments"
              >
                <div className="mb-1.5 text-2xs font-semibold uppercase tracking-widest text-muted">Attachments</div>
                <div className="flex flex-row flex-wrap items-start gap-x-4 gap-y-1" role="list">
                  {attachments.map((attachment, index) => (
                    <AttachmentChip key={`${attachment.name}-${index}`} attachment={attachment} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
        <MessageFooter msg={msg} />
      </div>
    </motion.div>
  );
}
