import formatError from "@tokenring-ai/utility/error/formatError";
import { Send, X } from "lucide-react";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import FormActionBar from "../../../components/ui/FormActionBar.tsx";
import { KeyValueRow } from "../../../components/ui/KeyValueMetadata.tsx";
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

  // Reset fields when parent swaps the draft without unmounting (e.g. Compose while already composing)
  useEffect(() => {
    setTo(initial.to);
    setCc(initial.cc);
    setBcc(initial.bcc);
    setSubject(initial.subject);
    setBody(initial.body);
    setShowCcBcc(Boolean(initial.cc || initial.bcc));
    setSending(false);

    // Focus To for new/forward; body for replies (recipients already filled)
    requestAnimationFrame(() => {
      if (initial.mode === "reply" || initial.mode === "replyAll") {
        bodyRef.current?.focus();
        // Place caret at start so user types above the quote
        bodyRef.current?.setSelectionRange(0, 0);
      } else {
        toRef.current?.focus();
      }
    });
  }, [initial]);

  const handleSubmit = async (e: SubmitEvent) => {
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
      // ensureAgent already toasts on create failure
      if (!agentId) return;

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

      // createDraft RPC omits threadId; attach it via update so replies stay in-thread
      if (initial.relatedThreadId) {
        const updated = await emailRPCClient.updateDraft({
          agentId,
          updatedData: { threadId: initial.relatedThreadId },
        });
        if (updated.status === "agentNotFound") {
          toastManager.error("Email agent is no longer available. Try again.", { duration: 4000 });
          return;
        }
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
        <KeyValueRow
          as="label"
          label="To"
          labelWidth="w-10"
          align="center"
          truncate={false}
          labelClassName="text-xs text-muted"
          valueClassName="text-inherit"
          value={
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
          }
        />

        {!showCcBcc ? (
          <button type="button" onClick={() => setShowCcBcc(true)} className="text-xs text-muted hover:text-primary transition-colors cursor-pointer ml-12">
            Add Cc / Bcc
          </button>
        ) : (
          <>
            <KeyValueRow
              as="label"
              label="Cc"
              labelWidth="w-10"
              align="center"
              truncate={false}
              labelClassName="text-xs text-muted"
              valueClassName="text-inherit"
              value={<input type="text" value={cc} onChange={e => setCc(e.target.value)} placeholder="optional" className={inputClass} autoComplete="off" />}
            />
            <KeyValueRow
              as="label"
              label="Bcc"
              labelWidth="w-10"
              align="center"
              truncate={false}
              labelClassName="text-xs text-muted"
              valueClassName="text-inherit"
              value={<input type="text" value={bcc} onChange={e => setBcc(e.target.value)} placeholder="optional" className={inputClass} autoComplete="off" />}
            />
          </>
        )}

        <KeyValueRow
          as="label"
          label="Subject"
          labelWidth="w-10"
          align="center"
          truncate={false}
          labelClassName="text-xs text-muted"
          valueClassName="text-inherit"
          value={
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className={inputClass} autoComplete="off" />
          }
        />

        <textarea
          ref={bodyRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write your message…"
          rows={12}
          className={cn(inputClass, "resize-y min-h-[12rem] font-sans leading-relaxed")}
        />
      </div>

      <FormActionBar onCancel={onClose} submitLabel="Send" submitIcon={Send} loading={sending} variant="red" separated size="md" />
    </form>
  );
}
