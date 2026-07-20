import type { ParsedTextQuestion } from "@tokenring-ai/agent/question";
import { Send, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { sendInteractionResponse } from "../sendInteractionResponse.ts";

interface TextInlineProps {
  question: ParsedTextQuestion;
  agentId: string;
  requestId: string;
  interactionId: string;
  onClose: () => void;
  autoFocus?: boolean;
}

export default function TextInlineQuestion({
  question: { label, required, defaultValue, expectedLines, masked },
  agentId,
  requestId,
  interactionId,
  onClose,
  autoFocus = true,
}: TextInlineProps) {
  const [value, setValue] = useState(defaultValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = async () => {
    if (required && !value.trim()) return;
    setIsSubmitting(true);
    // Disable input immediately for visual feedback
    if (inputRef.current) {
      inputRef.current.blur();
    }
    await sendInteractionResponse({
      agentId,
      requestId,
      interactionId,
      result: value,
    });
    onClose();
  };

  const handleCancel = async () => {
    await sendInteractionResponse({
      agentId,
      requestId,
      interactionId,
      result: null,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    } else if (e.key === "Escape") {
      void handleCancel();
    }
  };

  return (
    <div className="p-4 space-y-3">
      {label && (
        <label className="block text-sm text-primary">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {expectedLines > 1 ? (
          <div className="relative">
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={Math.min(expectedLines, 4)}
              style={masked ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties & { WebkitTextSecurity: string }) : {}}
              placeholder={required ? "Required..." : "Optional..."}
              disabled={isSubmitting}
              className={`w-full bg-primary border border-primary rounded-md text-primary text-sm p-2.5 outline-none transition-colors resize-none disabled:opacity-50 focus:border-accent focus:ring-1 focus:ring-accent/20 ${
                isSubmitting ? "border-accent animate-pulse" : ""
              }`}
              aria-required={required}
              aria-busy={isSubmitting}
            />
          </div>
        ) : (
          <div className="relative">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              type={masked ? "password" : "text"}
              placeholder={required ? "Required..." : "Optional..."}
              disabled={isSubmitting}
              className={`w-full bg-primary border border-primary rounded-md text-primary text-sm p-2.5 outline-none transition-colors disabled:opacity-50 focus:border-accent focus:ring-1 focus:ring-accent/20 ${
                isSubmitting ? "border-accent animate-pulse" : ""
              }`}
              aria-required={required}
              aria-busy={isSubmitting}
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 p-1.5 rounded-md text-xs text-muted hover:text-primary transition-colors disabled:opacity-50 focus-ring"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || (required && !value.trim())}
          className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
        >
          {isSubmitting ? "Sending..." : "Submit"}
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
