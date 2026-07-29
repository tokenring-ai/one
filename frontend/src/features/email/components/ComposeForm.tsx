import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, Send, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toastManager } from "../../../components/ui/toast.tsx";
import { cn } from "../../../lib/utils.ts";
import { emailRPCClient } from "../../../rpc.ts";
import type { ComposeDraft } from "../types.ts";
import { isValidEmailList, parseEmailAddresses } from "../utils.ts";

const inputClass =
  "w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all";

const MODE_LABELS: Record<ComposeDraft["mode"], string> = {
  compose: "New message",
  reply: "Reply",
  replyAll: "Reply all",
  forward: "Forward",
};

export default function ComposeForm({
  provider,
  initial,
  ensureAgent,
  onClose,
  onSent,
}: {
  provider: string;
  initial: ComposeDraft;
  ensureAgent: () => string | Promise<string | null>;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(initial.to);
  const [cc, setCc] = useState(initial.cc);
  const [bcc, setBcc] = useState(initial.bcc);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [showCcBcc, setShowCcBcc] = useState(Boolean(initial.cc || initial.bcc));
  const [sending, setSending] = useState(false);
  const toRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus To for new/forward; body for replies (recipients already filled)
    if (initial.mode === "reply" || initial.mode === "replyAll") {
      bodyRef.current?.focus();
      // Place caret at start so user types above the quote
      bodyRef.current?.setSelectionRange(0, 0);
    } else {
      toRef.current?.focus();
    }
  }, [initial.mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmailList(to)) {
      toastManager.error("Enter at least one valid recipient in To", { duration: 3500 });
      return;
    }
    if (cc.trim() && !isValidEmailList(cc)) {
      toastManager.error("Cc contains an invalid address", { duration: 3500 });
      return;
    }
    if (bcc.trim() && !isValidEmailList(bcc)) {
      toastManager.error("Bcc contains an invalid address", { duration: 3500 });
      return;
    }

    setSending(true);
    try {
      const agentId = await ensureAgent();
      if (!agentId) {
        toastManager.error("Could not start an email agent to send", { duration: 4000 });
        return;
      }

      await emailRPCClient.updateEmailState({ agentId, selectedProvider: provider });

      const toAddrs = parseEmailAddresses(to);
      const ccAddrs = parseEmailAddresses(cc);
      const bccAddrs = parseEmailAddresses(bcc);

      const created = await emailRPCClient.createDraft({
        agentId,
        subject: subject.trim() || "(no subject)",
        to: toAddrs,
        ...(ccAddrs.length > 0 && { cc: ccAddrs }),
        ...(bccAddrs.length > 0 && { bcc: bccAddrs }),
        textBody: body,
      });

      if (created.status === "agentNotFound") {
        toastManager.error("Email agent is no longer available. Try again.", { duration: 4000 });
        return;
      }

      const sent = await emailRPCClient.sendCurrentDraft({ agentId });
      if (sent.status === "agentNotFound") {
        toastManager.error("Email agent is no longer available. Try again.", { duration: 4000 });
        return;
      }

      toastManager.success(sent.message || "Email sent", { duration: 2500 });
      onSent();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={e => void handleSubmit(e)} className="h-full flex flex-col overflow-hidden bg-primary">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-primary bg-secondary">
        <h2 className="text-sm font-semibold text-primary">{MODE_LABELS[initial.mode]}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring cursor-pointer"
          aria-label="Close compose"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        <label className="flex items-center gap-2">
          <span className="text-2xs font-medium text-muted w-10 shrink-0">To</span>
          <input
            ref={toRef}
            type="text"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className={inputClass}
            required
            autoComplete="off"
          />
        </label>

        {!showCcBcc ? (
          <button type="button" onClick={() => setShowCcBcc(true)} className="text-2xs text-muted hover:text-primary transition-colors cursor-pointer ml-12">
            Add Cc / Bcc
          </button>
        ) : (
          <>
            <label className="flex items-center gap-2">
              <span className="text-2xs font-medium text-muted w-10 shrink-0">Cc</span>
              <input type="text" value={cc} onChange={e => setCc(e.target.value)} placeholder="optional" className={inputClass} autoComplete="off" />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-2xs font-medium text-muted w-10 shrink-0">Bcc</span>
              <input type="text" value={bcc} onChange={e => setBcc(e.target.value)} placeholder="optional" className={inputClass} autoComplete="off" />
            </label>
          </>
        )}

        <label className="flex items-center gap-2">
          <span className="text-2xs font-medium text-muted w-10 shrink-0">Subject</span>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className={inputClass} autoComplete="off" />
        </label>

        <textarea
          ref={bodyRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write your message…"
          rows={12}
          className={cn(inputClass, "resize-y min-h-[12rem] font-sans leading-relaxed")}
        />
      </div>

      <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-primary bg-secondary">
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="px-3 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-lg focus-ring cursor-pointer shadow-button-primary"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Send
        </button>
      </div>
    </form>
  );
}
