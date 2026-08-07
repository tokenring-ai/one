import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import type React from "react";
import type { ReactNode } from "react";
import { isValidElement, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { InteractionResponseMessage, QuestionInteraction } from "../../types/agent-events.ts";
import { markdownLinkComponents } from "../chat/MarkdownLink.tsx";
import FileInlineQuestion from "./inputs/file-inline.tsx";
import FormInlineQuestion from "./inputs/form-inline.tsx";
import TextInlineQuestion from "./inputs/text-inline.tsx";
import TreeInlineQuestion from "./inputs/tree-inline.tsx";

interface InlineQuestionProps {
  request: QuestionInteraction;
  agentId: string;
  requestId: string;
  response?: InteractionResponseMessage;
  autoScroll?: boolean;
  isUrgent?: boolean;
  urgencyLevel?: number | null;
}

function formatResponseResult(result: unknown) {
  if (result === null) return "Cancelled";

  if (Array.isArray(result)) {
    if (result.length === 0) return "Nothing selected";
    if (result.length === 1) result = result[0];
  }

  if (typeof result === "string") return `Response: ${result}`;
  return `Response: ${JSON.stringify(result)}`;
}

function getNodeText(node: ReactNode): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node) && node.props.children) {
    return getNodeText(node.props.children);
  }
  return "";
}

/** Compact markdown for question prompts (same pipeline as chat messages). */
function QuestionMessageMarkdown({ message, className }: { message: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ...markdownLinkComponents,
          // Keep header/list layout tight so prompts sit cleanly in the question chrome
          p: ({ children }) => <span className="block leading-snug">{children}</span>,
          ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          code: ({ children, className: codeClassName }) => {
            const text = getNodeText(children).replace(/\n$/, "");
            if (codeClassName || text.includes("\n")) {
              return <code className={`${codeClassName ?? ""} block whitespace-pre-wrap text-xs font-mono`.trim()}>{text}</code>;
            }
            return <code className="rounded bg-tertiary px-1 py-0.5 text-xs font-mono">{text}</code>;
          },
        }}
      >
        {message}
      </ReactMarkdown>
    </div>
  );
}

export default function InlineQuestion({ request, agentId, requestId, response, autoScroll = true, isUrgent = false }: InlineQuestionProps) {
  const [isExpanded, setIsExpanded] = useState(!response);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const question = request.question;
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);

  // Focus on the header when the question is rendered
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [autoScroll]);

  // Countdown timer
  useEffect(() => {
    const autoSubmitAt = request.autoSubmitAt;
    if (!autoSubmitAt) return;

    // Calculate total timeout duration on first render
    if (totalTime === null) {
      const timeoutDuration = Math.ceil((autoSubmitAt - Date.now()) / 1000);
      setTotalTime(timeoutDuration > 0 ? timeoutDuration : 60);
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((autoSubmitAt - Date.now()) / 1000));
      setCountdown(remaining);
      // Detect when auto-submit occurs
      if (remaining === 0 && !autoSubmitted) {
        setAutoSubmitted(true);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [request.autoSubmitAt, autoSubmitted, totalTime]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && isExpanded) {
      setIsExpanded(false);
      headerRef.current?.focus();
    }
  };

  const toggleExpanded = () => setIsExpanded(prev => !prev);

  return (
    <div ref={containerRef} className="not-prose mb-2" role="region" aria-labelledby={`question-title-${request.interactionId}`}>
      {/* Header - chevron toggles; message is markdown (not inside the button so links stay valid) */}
      <div className={`flex items-start gap-2 py-1 px-1.5 w-full group/header rounded-md ${autoSubmitted ? "bg-emerald-500/10" : ""}`}>
        <button
          type="button"
          ref={headerRef}
          onClick={toggleExpanded}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleExpanded();
            }
          }}
          className="mt-0.5 shrink-0 cursor-pointer hover:opacity-80 transition-opacity rounded-md focus-ring"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-controls={`question-content-${request.interactionId}`}
          aria-label={isExpanded ? "Collapse question" : "Expand question"}
        >
          <div className={`transition-transform duration-150 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
            <ChevronDown className="w-3.5 h-3.5 text-muted" />
          </div>
        </button>
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {isUrgent && <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0 mt-1.5" title="Urgent - auto-submit pending" />}
          {/* Message is outside the expand button so markdown links remain valid HTML */}
          <div
            id={`question-title-${request.interactionId}`}
            className="flex-1 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity"
            onClick={e => {
              // Don't collapse/expand when the user clicks a link inside the markdown
              if ((e.target as HTMLElement).closest("a")) return;
              toggleExpanded();
            }}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleExpanded();
              }
            }}
            role="button"
            tabIndex={-1}
          >
            <QuestionMessageMarkdown
              message={request.message}
              className="text-sm font-medium text-primary prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            />
          </div>
          <span className="text-xs font-mono text-muted opacity-0 group-hover/header:opacity-100 transition-opacity leading-none pt-1.5 shrink-0">
            {question.type}
          </span>
          {countdown !== null && countdown > 0 && (
            <>
              <span
                className={`text-xs font-medium leading-none pt-1.5 shrink-0 ${
                  countdown <= 5
                    ? "text-red-500 dark:text-red-400 font-bold animate-pulse"
                    : countdown <= 15
                      ? "text-orange-500 dark:text-orange-400"
                      : "text-accent"
                }`}
              >
                {countdown}s
              </span>
              {/* Visual progress indicator for urgency */}
              {totalTime !== null && totalTime > 0 && (
                <div
                  className="w-8 h-0.5 bg-primary/30 dark:bg-primary/20 rounded-full overflow-hidden shrink-0 mt-2"
                  title={`Time remaining: ${countdown}s of ${totalTime}s`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      countdown <= 5 ? "bg-red-500" : countdown <= 15 ? "bg-orange-500" : "bg-accent"
                    }`}
                    style={{ width: `${(countdown / totalTime) * 100}%` }}
                  />
                </div>
              )}
            </>
          )}
          {countdown !== null && countdown === 0 && !autoSubmitted && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium leading-none pt-1.5 animate-pulse shrink-0">Submitting...</span>
          )}
          {autoSubmitted && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium leading-none pt-1.5 shrink-0 flex items-center gap-0.5">
              <Check className="w-3 h-3 inline" />
              Auto-submitted
            </span>
          )}
        </div>
      </div>

      {/* Content - expandable */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            id={`question-content-${request.interactionId}`}
            role="region"
            aria-labelledby={`question-title-${request.interactionId}`}
            onKeyDown={handleKeyDown}
          >
            {question.type === "treeSelect" && (
              <TreeInlineQuestion
                question={question}
                agentId={agentId}
                requestId={requestId}
                interactionId={request.interactionId}
                onClose={() => setIsExpanded(false)}
              />
            )}
            {question.type === "text" && (
              <TextInlineQuestion
                question={question}
                agentId={agentId}
                requestId={requestId}
                interactionId={request.interactionId}
                onClose={() => setIsExpanded(false)}
              />
            )}
            {question.type === "fileSelect" && (
              <FileInlineQuestion
                question={question}
                agentId={agentId}
                requestId={requestId}
                interactionId={request.interactionId}
                onClose={() => setIsExpanded(false)}
              />
            )}
            {question.type === "form" && (
              <FormInlineQuestion
                question={question}
                agentId={agentId}
                requestId={requestId}
                interactionId={request.interactionId}
                onClose={() => setIsExpanded(false)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {response && <span className="text-muted text-sm truncate block mt-1">{formatResponseResult(response.result)}</span>}
    </div>
  );
}
