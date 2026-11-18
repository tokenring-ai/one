import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";
import { useTick } from "../../hooks/useTick.ts";
import { copyToClipboard } from "../../lib/clipboard.ts";
import Button from "../../ui/button.tsx";
import ModalShell from "../ui/ModalShell.tsx";
import QrCode from "./QrCode.tsx";

export interface IssuedLink {
  url: string;
  expiresAt: number;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

function formatExpiry(expiresAt: number): string {
  const date = new Date(expiresAt);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export interface AccessLinkResultDialogProps {
  username: string;
  link: IssuedLink;
  /** Called by Done, the X and Escape. The owner must drop the link from its state. */
  onDone: () => void;
  title?: string;
  /** Extra content above the link (for example the role chosen for a new user). */
  children?: React.ReactNode;
}

/**
 * Shows a freshly made access link once: as a QR code, as text to copy, and on paper. The link exists only in the
 * `link` prop; nothing here writes it to storage, the URL, a DOM attribute or the console, and the QR's accessible
 * name does not contain it. Closing the dialog is the only way out, and it hands control back so the owner can discard it.
 */
export default function AccessLinkResultDialog({ username, link, onDone, title = "Access link created", children }: AccessLinkResultDialogProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  useTick(1000, true);
  const remaining = link.expiresAt - Date.now();
  const expired = remaining <= 0;

  const copy = async () => {
    // Silent: no toast, no console. The visible message below is the feedback.
    const ok = await copyToClipboard(link.url, { silent: true });
    setCopyState(ok ? "copied" : "failed");
  };

  return (
    <ModalShell
      title={title}
      onClose={onDone}
      width="w-full max-w-md max-h-[90dvh] overflow-y-auto"
      footer={
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" icon={Printer} onClick={() => window.print()} disabled={expired}>
            Print
          </Button>
          <span className="flex-1" />
          <Button type="button" variant="primary" onClick={onDone}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {children}
        <div className="print-access-link space-y-3">
          <p className="print-only text-base font-semibold">TokenRing sign-in link for {username}</p>
          <div role="alert" className="rounded-md border border-warning bg-warning-subtle px-3 py-2 text-sm text-primary">
            <p>
              This link signs in as <strong>{username}</strong>. Treat it like a password. It works once and expires at{" "}
              <strong>{formatExpiry(link.expiresAt)}</strong>
              {expired ? "." : <> (in {formatRemaining(remaining)}).</>}
            </p>
            {expired && <p className="mt-1 font-medium">This link has expired. Make a new one.</p>}
          </div>
          <div className="mx-auto w-full max-w-64 rounded-md">
            <QrCode value={link.url} label={`QR code that signs in as ${username}. Scan it with a phone camera.`} className="block h-auto w-full" />
          </div>
        </div>
        <div className="no-print space-y-2">
          <p className="text-xs font-medium text-primary">Link</p>
          <code className="block select-all break-all rounded-md border border-line bg-sunken p-2 text-xs text-primary">{link.url}</code>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" icon={copyState === "copied" ? Check : Copy} onClick={() => void copy()}>
              {copyState === "copied" ? "Copied" : "Copy link"}
            </Button>
            {copyState === "failed" && (
              <p role="alert" className="text-xs text-danger">
                This browser would not let the page copy. Select the link above and copy it by hand.
              </p>
            )}
          </div>
          <p className="text-xs text-muted">Shown only once. It cannot be displayed again. If you lose it, make a new one.</p>
        </div>
      </div>
    </ModalShell>
  );
}
