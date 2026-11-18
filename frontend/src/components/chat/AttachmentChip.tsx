import type { ChatAttachment, ImageMimeTypes, SupportedMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import { imageMimeTypes, mimeTypeClassifications } from "@tokenring-ai/agent/AgentEvents";
import formatError from "@tokenring-ai/utility/error/formatError";
import { FocusTrap } from "focus-trap-react";
import {
  Check,
  Copy,
  Download,
  Eye,
  FileAudio,
  FileCode,
  FileDiff,
  FileJson,
  FileText,
  FileVideo,
  Image as ImageIcon,
  type LucideIcon,
  Mail,
  X,
} from "lucide-react";
import type React from "react";
import { type MouseEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.ts";
import { useLightbox } from "../../hooks/useLightbox.ts";
import { copyToClipboard } from "../../lib/clipboard.ts";
import { toastManager } from "../ui/toast.tsx";

interface AttachmentChipProps {
  attachment: ChatAttachment;
  onRemove?: () => void;
  showRemove?: boolean;
  /**
   * `row` (default): name plus preview/copy/download buttons, for the composer.
   * `pill`: a compact chip in a sent message; clicking it opens the preview,
   * which carries copy and download.
   */
  variant?: "row" | "pill";
}

const actionButtonClassName =
  "cursor-pointer rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-ring";

const mimeTypeIcons: Record<SupportedMimeTypes, LucideIcon> = {
  "audio/wav": FileAudio,
  "audio/mpeg": FileAudio,
  "audio/webm": FileAudio,
  "video/mp4": FileVideo,
  "video/webm": FileVideo,
  "image/png": ImageIcon,
  "image/webp": ImageIcon,
  "image/jpeg": ImageIcon,
  "text/plain": FileText,
  "text/markdown": FileText,
  "text/html": FileCode,
  "text/x-diff": FileDiff,
  "application/json": FileJson,
  "message/rfc822": Mail,
};

function getMimeTypeClassification(mimeType: SupportedMimeTypes) {
  return mimeTypeClassifications.get(mimeType);
}

function getAttachmentIcon(mimeType: SupportedMimeTypes): LucideIcon {
  return mimeTypeIcons[mimeType];
}

function decodeAttachmentText(attachment: ChatAttachment): string {
  if (attachment.encoding === "base64") {
    return atob(attachment.body);
  }
  return attachment.body;
}

/**
 * Only http:, https:, data: (for image/video attachments), and relative
 * references may reach an element src/href; anything else (e.g. javascript:)
 * is treated as unavailable.
 */
function isSafeAttachmentHref(attachment: ChatAttachment): boolean {
  if (attachment.encoding !== "href") return true;
  let parsed: URL;
  try {
    // The base resolves relative paths; the scheme check below only inspects the protocol.
    parsed = new URL(attachment.body, "https://tokenring.invalid");
  } catch {
    return false;
  }
  if (parsed.protocol === "http:" || parsed.protocol === "https:") return true;
  if (parsed.protocol === "data:") {
    const classification = mimeTypeClassifications.get(attachment.mimeType);
    return classification === "image" || classification === "video";
  }
  return false;
}

function getMediaSrc(attachment: ChatAttachment): string | null {
  if (attachment.encoding === "href") {
    return isSafeAttachmentHref(attachment) ? attachment.body : null;
  }
  if (attachment.encoding === "base64") {
    return `data:${attachment.mimeType};base64,${attachment.body}`;
  }
  return `data:${attachment.mimeType};charset=utf-8,${encodeURIComponent(attachment.body)}`;
}

function getImagePreviewSrc(attachment: ChatAttachment): string | null {
  if (!imageMimeTypes.includes(attachment.mimeType as ImageMimeTypes)) return null;

  return getMediaSrc(attachment);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  // Uint8Array.buffer is typed as ArrayBufferLike; this view always owns a plain ArrayBuffer.
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function downloadAttachment(attachment: ChatAttachment) {
  if (attachment.encoding === "href") {
    if (!isSafeAttachmentHref(attachment)) {
      throw new Error(`"${attachment.name}" links to an unsupported URL scheme and cannot be downloaded.`);
    }
    const a = document.createElement("a");
    a.href = attachment.body;
    a.download = attachment.name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  const blob =
    attachment.encoding === "base64"
      ? new Blob([base64ToArrayBuffer(attachment.body)], { type: attachment.mimeType })
      : new Blob([attachment.body], { type: attachment.mimeType });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = attachment.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

function formatPreviewText(attachment: ChatAttachment): string {
  try {
    const text = decodeAttachmentText(attachment);
    if (attachment.mimeType === "application/json") {
      try {
        return JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        return text;
      }
    }
    return text;
  } catch {
    return "";
  }
}

function AttachmentPreviewOverlay({ attachment, onClose, actions }: { attachment: ChatAttachment; onClose: () => void; actions?: React.ReactNode }) {
  const mediaSrc = useMemo(() => getMediaSrc(attachment), [attachment]);
  const mimeTypeClassification = useMemo(() => getMimeTypeClassification(attachment.mimeType), [attachment]);
  const previewText = useMemo(() => (mimeTypeClassification === "text" ? formatPreviewText(attachment) : ""), [attachment]);

  return (
    <FocusTrap
      focusTrapOptions={{
        allowOutsideClick: true,
        escapeDeactivates: false,
        fallbackFocus: "#attachment-preview-dialog",
      }}
    >
      <div
        id="attachment-preview-dialog"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-preview-title"
        tabIndex={-1}
        onClick={onClose}
      >
        <div
          className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-primary bg-secondary shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-primary px-4 py-3">
            <div className="min-w-0">
              <h3 id="attachment-preview-title" className="truncate text-sm font-semibold text-primary">
                {attachment.name}
              </h3>
              <p className="truncate text-xs text-muted">{attachment.mimeType}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-0.5">{actions}</div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-primary focus-ring"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {mimeTypeClassification === "image" && mediaSrc ? (
              <img src={mediaSrc} alt={attachment.name} className="mx-auto max-h-[70vh] max-w-full rounded-md object-contain" />
            ) : mimeTypeClassification === "audio" && mediaSrc ? (
              <audio controls className="w-full" src={mediaSrc}>
                <track kind="captions" />
              </audio>
            ) : mimeTypeClassification === "video" && mediaSrc ? (
              <video controls className="mx-auto max-h-[70vh] max-w-full rounded-md" src={mediaSrc}>
                <track kind="captions" />
              </video>
            ) : attachment.mimeType === "text/html" ? (
              <iframe title={attachment.name} srcDoc={previewText} sandbox="" className="h-[60vh] w-full rounded-md border border-primary bg-primary" />
            ) : previewText ? (
              <pre className="overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border border-primary bg-tertiary p-3 text-xs text-primary font-mono">
                {previewText}
              </pre>
            ) : (
              <p className="text-sm text-muted">No preview available for this attachment.</p>
            )}
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}

export default function AttachmentChip({ attachment, onRemove, showRemove = false, variant = "row" }: AttachmentChipProps) {
  const Icon = getAttachmentIcon(attachment.mimeType);
  const imageSrc = useMemo(() => getImagePreviewSrc(attachment), [attachment]);
  const { copied, markCopied } = useCopyToClipboard();
  const [downloading, setDownloading] = useState(false);
  const [imageError, setImageError] = useState(false);
  // Auto-close preview if this chip is reused for a different attachment
  const {
    isOpen: previewOpen,
    open: openPreview,
    close: closePreview,
  } = useLightbox({
    itemKey: `${attachment.name}\0${attachment.mimeType}\0${attachment.encoding}`,
  });

  const showImageThumb = Boolean(imageSrc && !imageError);

  const handleDownload = (e?: MouseEvent) => {
    e?.stopPropagation();
    setDownloading(true);
    try {
      downloadAttachment(attachment);
    } catch (error: unknown) {
      toastManager.error(`Failed to download "${attachment.name}": ${formatError(error)}`, { duration: 5000 });
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  const handleCopy = async (e: MouseEvent) => {
    e.stopPropagation();
    const mimeTypeClassification = getMimeTypeClassification(attachment.mimeType);
    const reportCopyError = (error: unknown) => {
      toastManager.error(`Failed to copy "${attachment.name}" to clipboard: ${formatError(error)}`, { duration: 5000 });
    };

    try {
      // Image blobs use ClipboardItem — not covered by the text copy utility
      if (mimeTypeClassification === "image" && attachment.encoding === "base64" && typeof ClipboardItem !== "undefined") {
        const blob = new Blob([base64ToArrayBuffer(attachment.body)], { type: attachment.mimeType });
        await navigator.clipboard.write([new ClipboardItem({ [attachment.mimeType]: blob })]);
        markCopied();
        return;
      }

      const text = attachment.encoding === "href" || mimeTypeClassification !== "text" ? attachment.body : decodeAttachmentText(attachment);
      await copyToClipboard(text, {
        silent: true,
        onSuccess: () => markCopied(),
        onError: reportCopyError,
      });
    } catch (error: unknown) {
      reportCopyError(error);
    }
  };

  const handlePreview = (e: MouseEvent) => {
    e.stopPropagation();
    openPreview();
  };

  const handleRemove = (e: MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      className={actionButtonClassName}
      title={`Copy ${attachment.name} to clipboard`}
      aria-label={`Copy ${attachment.name} to clipboard`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
  const downloadButton = (
    <button
      type="button"
      onClick={handleDownload}
      className={actionButtonClassName}
      title={downloading ? `Downloading ${attachment.name}...` : `Download ${attachment.name}`}
      aria-label={downloading ? `Downloading ${attachment.name}...` : `Download ${attachment.name}`}
      disabled={downloading}
    >
      {downloading ? (
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
    </button>
  );
  const glyph = showImageThumb ? (
    <img src={imageSrc!} alt="" className="h-4 w-4 shrink-0 rounded-sm object-cover" loading="lazy" onError={() => setImageError(true)} />
  ) : (
    <Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
  );
  const preview = previewOpen
    ? createPortal(
        <AttachmentPreviewOverlay
          attachment={attachment}
          onClose={closePreview}
          actions={
            <>
              {copyButton}
              {downloadButton}
            </>
          }
        />,
        document.body,
      )
    : null;

  if (variant === "pill") {
    return (
      <li className="min-w-0 max-w-full">
        <button
          type="button"
          onClick={handlePreview}
          className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-secondary transition-colors hover:border-line-strong hover:text-fg focus-ring cursor-pointer"
          title={`Preview ${attachment.name}`}
          aria-label={`Preview attachment ${attachment.name}`}
        >
          {glyph}
          <span className="min-w-0 truncate">{attachment.name}</span>
        </button>
        {preview}
      </li>
    );
  }

  return (
    <div
      className="group flex max-w-full items-center gap-2 py-0.5 text-sm"
      style={{ flex: "0 1 350px", width: 350 }}
      role="listitem"
      aria-label={`Attachment: ${attachment.name}`}
    >
      {glyph}

      <span className="min-w-0 flex-1 truncate font-mono text-primary" title={attachment.name}>
        {attachment.name}
      </span>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={handlePreview}
          className={actionButtonClassName}
          title={`Preview ${attachment.name}`}
          aria-label={`Preview ${attachment.name}`}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        {copyButton}
        {downloadButton}
        {showRemove && onRemove && (
          <button
            type="button"
            onClick={handleRemove}
            className={`${actionButtonClassName} hover:text-error`}
            title={`Remove ${attachment.name}`}
            aria-label={`Remove ${attachment.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {preview}
    </div>
  );
}
