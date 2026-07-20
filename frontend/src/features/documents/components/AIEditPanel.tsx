import { Bot, Check, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "../../../lib/utils.ts";
import type { TextSelection } from "../types.ts";

export interface AIEditPanelProps {
  selection: TextSelection | null;
  agentId: string | null;
  initError: string | null;
  initialising: boolean;
  prompt: string;
  onPromptChange: (v: string) => void;
  loading: boolean;
  response: string | null;
  onSubmit: () => void;
  onCancel: () => void;
  onApply: () => void;
  onClearResponse: () => void;
}

export default function AIEditPanel({
  selection,
  agentId,
  initError,
  initialising,
  prompt,
  onPromptChange,
  loading,
  response,
  onSubmit,
  onCancel,
  onApply,
  onClearResponse,
}: AIEditPanelProps) {
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Focus prompt when selection changes
  useEffect(() => {
    if (selection && promptRef.current) {
      promptRef.current.focus();
    }
  }, [selection?.start, selection?.end, selection]);

  if (initialising) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="w-5 h-5 text-muted animate-spin" />
        <p className="text-xs text-muted">Starting AI editor…</p>
      </div>
    );
  }

  if (!agentId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Bot className="w-10 h-10 text-muted opacity-30" />
        <p className="text-sm text-muted">AI editing unavailable</p>
        <p className="text-2xs text-dim">{initError ?? "No writer agent could be started"}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Panel header */}
      <div className="shrink-0 px-4 py-3 border-b border-primary flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent-soft shrink-0" />
        <span className="text-sm font-semibold text-primary">AI Edit</span>
        {loading && <Loader2 className="w-3.5 h-3.5 text-accent-soft animate-spin ml-auto" />}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4 min-h-0">
        {/* No selection hint */}
        {!selection ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-accent-subtle flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent-soft opacity-50" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary mb-1">Select text to edit with AI</p>
              <p className="text-xs text-muted">Highlight any part of your document in the editor</p>
            </div>
            <div className="flex items-center gap-1 text-2xs text-dim mt-1">
              <span className="font-medium text-muted">1.</span> Highlight text
              <ChevronRight className="w-3 h-3 opacity-50" />
              <span className="font-medium text-muted">2.</span> Type instruction
              <ChevronRight className="w-3 h-3 opacity-50" />
              <span className="font-medium text-muted">3.</span> Apply
            </div>
          </div>
        ) : (
          <>
            {/* Selected text preview */}
            <div className="space-y-1.5">
              <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Selected text ({selection.end - selection.start} chars)</label>
              <div className="bg-tertiary border border-primary rounded-lg p-3 max-h-32 overflow-y-auto">
                <pre className="text-2xs text-primary font-mono whitespace-pre-wrap wrap-break-word leading-relaxed">{selection.text}</pre>
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-1.5">
              <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Instruction</label>
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={e => onPromptChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (prompt.trim() && !loading) onSubmit();
                  }
                }}
                placeholder="e.g. Make this more concise, Fix the grammar, Convert to a bullet list, Make it more formal..."
                rows={3}
                disabled={loading}
                className="w-full bg-input border border-primary rounded-lg p-3 text-xs text-primary placeholder-muted resize-none focus-accent disabled:opacity-50 transition-all leading-relaxed"
                aria-label="AI instruction"
              />
              <p className="text-2xs text-dim">Ctrl/⌘+Enter to submit</p>
            </div>

            {/* AI Response */}
            {response !== null && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-2xs font-semibold text-muted uppercase tracking-wide">{loading ? "Generating…" : "AI Response"}</label>
                  {!loading && (
                    <button
                      type="button"
                      onClick={onClearResponse}
                      className="p-0.5 text-muted hover:text-primary focus-ring rounded cursor-pointer"
                      aria-label="Clear response"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div
                  className={cn(
                    "bg-tertiary border rounded-lg p-3 overflow-y-auto transition-colors",
                    loading ? "border-accent/40" : "border-green-500/40",
                    response.length > 400 ? "max-h-52" : "",
                  )}
                >
                  <pre className="text-2xs text-primary font-mono whitespace-pre-wrap wrap-break-word leading-relaxed">
                    {response}
                    {loading && <span className="inline-block w-1.5 h-3 bg-accent-soft animate-pulse ml-0.5 align-text-bottom" />}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action bar — only when selection is active */}
      {selection && (
        <div className="shrink-0 border-t border-primary p-3 flex flex-col gap-2">
          {response && !loading && (
            <button
              type="button"
              onClick={onApply}
              className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-colors focus-ring shadow-sm cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" /> Apply Changes
            </button>
          )}
          {loading ? (
            <button
              type="button"
              onClick={onCancel}
              className="w-full flex items-center justify-center gap-2 py-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!prompt.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {response ? "Re-generate" : "Ask AI"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
