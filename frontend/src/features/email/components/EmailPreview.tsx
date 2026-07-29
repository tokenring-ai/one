import type { EmailMessage } from "@tokenring-ai/email";
import { Mail, X } from "lucide-react";
import type { ComposeDraft, ComposeMode } from "../types.ts";
import { draftFromMessage } from "../utils.ts";
import ComposeForm from "./ComposeForm.tsx";
import MessageViewer from "./MessageViewer.tsx";

export default function EmailPreview({
  provider,
  selectedMessageId,
  composeDraft,
  onComposeChange,
  onSendToAgent,
  ensureAgent,
  onSent,
  onClose,
}: {
  provider: string;
  selectedMessageId: string | null;
  composeDraft: ComposeDraft | null;
  onComposeChange: (draft: ComposeDraft | null) => void;
  onSendToAgent: (message: string) => void | Promise<void>;
  ensureAgent: () => string | Promise<string | null>;
  onSent: () => void;
  onClose: () => void;
}) {
  if (composeDraft) {
    return (
      <ComposeForm
        provider={provider}
        initial={composeDraft}
        ensureAgent={ensureAgent}
        onClose={() => onComposeChange(null)}
        onSent={() => {
          onComposeChange(null);
          onSent();
        }}
      />
    );
  }

  if (selectedMessageId) {
    const startCompose = (mode: Exclude<ComposeMode, "compose">, message: EmailMessage) => {
      onComposeChange(draftFromMessage(message, mode));
    };

    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 flex justify-end px-3 py-1.5 border-b border-primary bg-secondary">
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring cursor-pointer"
            aria-label="Close email"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <MessageViewer provider={provider} messageId={selectedMessageId} onReply={onSendToAgent} onCompose={startCompose} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center text-muted">
      <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
        <Mail className="w-7 h-7 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-primary">No message selected</p>
        <p className="text-xs mt-1 max-w-xs">Select a message from the list to preview it, or compose a new email.</p>
      </div>
    </div>
  );
}
