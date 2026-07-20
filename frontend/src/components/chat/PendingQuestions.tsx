import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { QuestionPromptMessage } from "../../types/agent-events.ts";
import InlineQuestion from "../question/InlineQuestion.tsx";

interface PendingQuestionsProps {
  questions: QuestionPromptMessage[];
  agentId: string;
}

export default function PendingQuestions({ questions, agentId }: PendingQuestionsProps) {
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

      // Format as mm:ss or just seconds if less than a minute
      if (remaining < 60) {
        setTimeRemaining(`${remaining}s`);
      } else {
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [earliestAutoSubmit]);

  if (questions.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-primary bg-secondary/50 shadow-card">
      <div className="px-4 py-2.5 border-b border-primary">
        <div className={`flex items-center gap-2 text-sm font-medium ${hasAutoSubmit ? "text-warning" : "text-primary"}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${hasAutoSubmit ? "bg-warning" : "bg-accent"}`} />
          <span>Active Questions ({questions.length})</span>
          {hasAutoSubmit && (
            <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-md">
              <span className="inline-block w-1.5 h-1.5 bg-warning rounded-full animate-pulse shrink-0" />
              <span>
                {urgentCount} urgent{urgentCount > 1 ? "s" : ""}
              </span>
              {timeRemaining && <span className="ml-1 text-[10px] font-bold bg-warning/20 px-1.5 py-0.5 rounded-md">{timeRemaining}</span>}
            </span>
          )}
        </div>
      </div>
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
              requestId={question.requestId}
              autoScroll={false}
              isUrgent={hasPendingAutoSubmit(question.autoSubmitAt)}
              urgencyLevel={question.autoSubmitAt && question.autoSubmitAt > Date.now() ? Math.ceil((question.autoSubmitAt - Date.now()) / 1000) : null}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
