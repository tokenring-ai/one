import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { QuestionPromptMessage } from "../../types/agent-events.ts";
import InlineQuestion, { formatCountdown } from "../question/InlineQuestion.tsx";

interface PendingQuestionsProps {
  questions: QuestionPromptMessage[];
  agentId: string;
  /** Who is asking, for the question's accessible name. */
  agentName?: string;
}

export default function PendingQuestions({ questions, agentId, agentName }: PendingQuestionsProps) {
  const hasPendingAutoSubmit = (autoSubmitAt?: number) => autoSubmitAt !== undefined && autoSubmitAt > Date.now();

  // Check if any question has an upcoming auto-submit
  const hasAutoSubmit = questions.some(q => hasPendingAutoSubmit(q.autoSubmitAt));
  const urgentCount = questions.filter(q => hasPendingAutoSubmit(q.autoSubmitAt)).length;

  // Calculate time until earliest auto-submit
  const urgentQuestions = questions.filter(q => hasPendingAutoSubmit(q.autoSubmitAt));
  const earliestAutoSubmit = urgentQuestions.length > 0 ? Math.min(...urgentQuestions.map(q => q.autoSubmitAt!)) : null;

  // State for countdown timer
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!earliestAutoSubmit) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      if (!earliestAutoSubmit) {
        setTimeRemaining(null);
        return;
      }

      const remaining = Math.max(0, Math.ceil((earliestAutoSubmit - Date.now()) / 1000));

      if (remaining <= 0) {
        setTimeRemaining(null);
        return;
      }

      setTimeRemaining(formatCountdown(remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [earliestAutoSubmit]);

  if (questions.length === 0) return null;

  return (
    // Capped so a long approval never squeezes the transcript away; the questions scroll inside.
    <div className="shrink-0 flex max-h-[45%] flex-col border-t border-primary bg-secondary/50 shadow-card">
      <div className="shrink-0 px-4 py-2.5 border-b border-primary">
        <div className={`flex items-center gap-2 text-sm font-medium ${hasAutoSubmit ? "text-warning" : "text-primary"}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${hasAutoSubmit ? "bg-warning" : "bg-accent"}`} />
          <span>{questions.length === 1 ? "The agent needs your answer" : `The agent needs ${questions.length} answers`}</span>
          {hasAutoSubmit && (
            <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-md">
              <span className="inline-block w-1.5 h-1.5 bg-warning rounded-full animate-pulse shrink-0" />
              <span>
                {timeRemaining ? `Default answer in ${timeRemaining}` : urgentCount === 1 ? "Default answer soon" : `${urgentCount} default answers soon`}
              </span>
            </span>
          )}
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto">
        <AnimatePresence mode="sync">
          {questions.map(question => (
            <motion.div
              key={question.interactionId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="border-b border-primary last:border-b-0 p-2"
            >
              <InlineQuestion
                request={question}
                agentId={agentId}
                {...(agentName ? { agentName } : {})}
                requestId={question.requestId}
                autoScroll={false}
                isUrgent={hasPendingAutoSubmit(question.autoSubmitAt)}
                urgencyLevel={question.autoSubmitAt && question.autoSubmitAt > Date.now() ? Math.ceil((question.autoSubmitAt - Date.now()) / 1000) : null}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
