import type { EmailAddress, EmailMessage } from "@tokenring-ai/email";
import { BOX_META, DEFAULT_BOX_META } from "./constants.ts";
import type { ComposeDraft, ComposeMode, EmailBoxRecord } from "./types.ts";

export function senderName(msg: EmailMessage): string {
  return msg.from.name || msg.from.email;
}

export function formatAddress(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

export function formatAddressList(addrs: EmailAddress[] | undefined): string {
  if (!addrs?.length) return "";
  return addrs.map(a => a.name || a.email).join(", ");
}

export function getBoxPresentation(box: EmailBoxRecord) {
  const normalized = box.id.toLowerCase();
  const meta = BOX_META[normalized] ?? DEFAULT_BOX_META;
  return {
    ...meta,
    label: box.name,
  };
}

/**
 * Parse a free-text recipient field into EmailAddress objects.
 * Supports: "alice@ex.com", "Alice <alice@ex.com>", comma/semicolon separated.
 */
export function parseEmailAddresses(input: string): EmailAddress[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(/[,;]+/)
    .map(p => p.trim())
    .filter(Boolean);

  const results: EmailAddress[] = [];
  for (const part of parts) {
    const angle = part.match(/^(.*?)\s*<([^>]+)>$/);
    if (angle) {
      const name = angle[1]!.trim().replace(/^["']|["']$/g, "");
      const email = angle[2]!.trim();
      if (email.includes("@")) {
        results.push(name ? { email, name } : { email });
      }
      continue;
    }
    if (part.includes("@")) {
      results.push({ email: part });
    }
  }
  return results;
}

export function isValidEmailList(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const parts = trimmed
    .split(/[,;]+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every(part => {
    const angle = part.match(/^(.*?)\s*<([^>]+)>$/);
    const email = angle ? angle[2]!.trim() : part;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  });
}

function ensureReSubject(subject: string): string {
  const s = subject.trim() || "(no subject)";
  return /^re:\s/i.test(s) ? s : `Re: ${s}`;
}

function ensureFwdSubject(subject: string): string {
  const s = subject.trim() || "(no subject)";
  return /^(fwd|fw):\s/i.test(s) ? s : `Fwd: ${s}`;
}

function formatReceivedAt(receivedAt: number | undefined): string {
  return receivedAt != null ? new Date(receivedAt).toLocaleString() : "—";
}

function quoteOriginal(msg: EmailMessage): string {
  const from = formatAddress(msg.from);
  const date = formatReceivedAt(msg.receivedAt);
  const body = msg.textBody?.trim() || msg.snippet?.trim() || "";
  const quoted = body
    .split("\n")
    .map(line => `> ${line}`)
    .join("\n");
  return `\n\n---\nOn ${date}, ${from} wrote:\n${quoted}`;
}

function forwardBody(msg: EmailMessage): string {
  const lines = [
    "",
    "---------- Forwarded message ----------",
    `From: ${formatAddress(msg.from)}`,
    `Date: ${formatReceivedAt(msg.receivedAt)}`,
    `Subject: ${msg.subject || "(no subject)"}`,
    `To: ${formatAddressList(msg.to)}`,
  ];
  if (msg.cc?.length) lines.push(`Cc: ${formatAddressList(msg.cc)}`);
  lines.push("", msg.textBody?.trim() || msg.snippet?.trim() || "");
  return lines.join("\n");
}

/** Build a compose draft for reply / reply-all / forward from a message. */
export function draftFromMessage(msg: EmailMessage, mode: ComposeMode): ComposeDraft {
  if (mode === "compose") {
    return { mode, to: "", cc: "", bcc: "", subject: "", body: "" };
  }

  if (mode === "forward") {
    return {
      mode,
      to: "",
      cc: "",
      bcc: "",
      subject: ensureFwdSubject(msg.subject),
      body: forwardBody(msg),
      relatedMessageId: msg.id,
      ...(msg.threadId ? { relatedThreadId: msg.threadId } : {}),
    };
  }

  const to = formatAddress(msg.from);
  let cc = "";
  if (mode === "replyAll") {
    const others = [...msg.to, ...(msg.cc ?? [])].filter(a => a.email.toLowerCase() !== msg.from.email.toLowerCase());
    // Deduplicate by email
    const seen = new Set<string>();
    const unique: EmailAddress[] = [];
    for (const a of others) {
      const key = a.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(a);
    }
    cc = unique.map(formatAddress).join(", ");
  }

  return {
    mode,
    to,
    cc,
    bcc: "",
    subject: ensureReSubject(msg.subject),
    body: quoteOriginal(msg),
    relatedMessageId: msg.id,
    ...(msg.threadId ? { relatedThreadId: msg.threadId } : {}),
  };
}

export function emptyComposeDraft(): ComposeDraft {
  return { mode: "compose", to: "", cc: "", bcc: "", subject: "", body: "" };
}
