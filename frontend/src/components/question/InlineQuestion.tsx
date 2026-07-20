import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { InteractionResponseMessage, QuestionInteraction } from "../../types/agent-events.ts";
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

  return (
    <div ref={containerRef} className="not-prose mb-2" role="region" aria-labelledby={`question-title-${request.interactionId}`}>
      {/* Header - always visible */}
      <button
        type="button"
        ref={headerRef}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        className={`flex items-center gap-2 py-1 px-1.5 w-full text-left cursor-pointer group/header hover:opacity-80 transition-opacity rounded-md focus-ring ${
          autoSubmitted ? "bg-emerald-500/10" : ""
        }`}
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`question-content-${request.interactionId}`}
        id={`question-title-${request.interactionId}`}
      >
        <div className={`transition-transform duration-150 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
          <ChevronDown className="w-3.5 h-3.5 text-muted" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isUrgent && <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" title="Urgent - auto-submit pending" />}
          <span className="text-sm font-medium text-primary truncate leading-none flex-1">{request.message}</span>
          <span className="text-2xs font-mono text-muted opacity-0 group-hover/header:opacity-100 transition-opacity leading-none pt-0.5 shrink-0">
            {question.type}
          </span>
          {countdown !== null && countdown > 0 && (
            <>
              <span
                className={`text-2xs font-medium leading-none pt-0.5 shrink-0 ${
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
                  className="w-8 h-0.5 bg-primary/30 dark:bg-primary/20 rounded-full overflow-hidden shrink-0"
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
            <span className="text-2xs text-amber-600 dark:text-amber-400 font-medium leading-none pt-0.5 animate-pulse shrink-0">Submitting...</span>
          )}
          {autoSubmitted && (
            <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium leading-none pt-0.5 shrink-0 flex items-center gap-0.5">
              <Check className="w-3 h-3 inline" />
              Auto-submitted
            </span>
          )}
        </div>
      </button>

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
