import type { EmailMessage } from "@tokenring-ai/email";
import { Mail, X } from "lucide-react";
import { useCallback } from "react";
import DetailViewerArea from "../../../components/ui/DetailViewerArea.tsx";
import type { ComposeDraft, ComposeMode } from "../types.ts";
import { draftFromMessage } from "../utils.ts";
import ComposeForm from "./ComposeForm.tsx";
import MessageViewer from "./MessageViewer.tsx";

/** When the provider key is an email address, use it to exclude self from reply-all. */
function currentEmailFromProvider(provider: string): string | undefined {
  return provider.includes("@") ? provider : undefined;
}

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
  const startCompose = useCallback(
    (mode: Exclude<ComposeMode, "compose">, message: EmailMessage) => {
      const currentEmail = currentEmailFromProvider(provider);
      onComposeChange(draftFromMessage(message, mode, currentEmail != null ? { currentEmail } : {}));
    },
    [onComposeChange, provider],
  );

  // Compose is a separate mode from master-detail selection — keep it outside the viewer state machine.
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

  return (
    <DetailViewerArea
      ready
      hasSelection={selectedMessageId != null}
      data={selectedMessageId}
      loading={false}
      emptyState={{
        icon: Mail,
        iconBadgeClassName: "bg-linear-to-br from-red-500 to-rose-600",
        title: "No message selected",
        hint: "Select a message from the list to preview it, or compose a new email.",
      }}
      renderContent={messageId => (
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
            <MessageViewer key={messageId} provider={provider} messageId={messageId} onReply={onSendToAgent} onCompose={startCompose} />
          </div>
        </div>
      )}
    />
  );
}
