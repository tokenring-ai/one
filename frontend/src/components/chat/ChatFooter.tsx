import { type ChatAttachment, ChatAttachmentSchema } from "@tokenring-ai/agent/AgentEvents";
import type { RemoteEntry } from "@tokenring-ai/filesystem/remote/RemoteStore";
import { formatUsd } from "@tokenring-ai/metrics/frontend/features/metrics/formatters.ts";
import formatError from "@tokenring-ai/utility/error/formatError";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cloud,
  FileAudio,
  FileCode,
  File as FileIcon,
  FileText,
  Folder,
  FolderOpen,
  History,
  Image,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Send,
  Square,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useContextualSearch } from "../../hooks/useContextualSearch.ts";
import { findActiveMention, replaceActiveMention } from "../../lib/contextualMention.ts";
import { agentRPCClient, remoteRPCClient, useChatUsage, useFilesystemState, useRemoteMounts } from "../../rpc.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.tsx";
import { toastManager } from "../ui/toast.tsx";
import ContextualSearchPicker, { flattenContextualSearchItems } from "./ContextualSearchPicker.tsx";
import RemoteFilePicker from "./RemoteFilePicker.tsx";

interface FileAttachment {
  id: string;
  /** Null for drafts re-injected from a previous message (file object is gone). */
  file: File | null;
  attachment: ChatAttachment;
}

/** An attachment contributed by the surrounding app (e.g. a design file), shown as a removable chip. */
export interface ExtraChatAttachment {
  id: string;
  label: string;
  attachment: ChatAttachment;
}

/** A message waiting in the backend's input queue while another input runs. */
export interface QueuedChatInput {
  requestId: string;
  message: string;
}

interface ChatFooterProps {
  agentId: string;
  input: string;
  setInput: (value: string) => void;
  inputError: boolean;
  setInputError: (value: boolean) => void;
  idle: boolean;
  availableCommands: string[];
  commandHistory: string[];
  showHistory: boolean;
  setShowHistory: (value: boolean) => void;
  setShowFileBrowser: (value: boolean) => void;
  /**
   * Send the composer contents. Resolves true once the message was delivered;
   * false (or a rejection) means it was not, and the attachment chips are kept.
   */
  onSubmit: (attachments?: ChatAttachment[]) => Promise<boolean>;
  submitFeedback: { message: string; type: "success" | "error" } | null;
  /** App-contributed attachments sent with the next message. */
  extraAttachments?: ExtraChatAttachment[];
  onRemoveExtraAttachment?: (id: string) => void;
  /** Inputs waiting in the agent's queue while another input executes. */
  queuedInputs?: QueuedChatInput[];
  /** Cancel a queued input before it starts running. */
  onCancelQueuedInput?: (requestId: string) => void;
  /**
   * Attachments re-injected by "edit message": adopted once per nonce into the
   * local attachment chips so resending keeps the original files.
   */
  injectedDraft?: { attachments: ChatAttachment[]; nonce: number } | null;
}

// Get file icon based on mime type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.startsWith("text/")) return FileText;
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("typescript")) return FileCode;
  return FileIcon;
}

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Match CLI: discard accidental taps, hard-stop long recordings
const MIN_RECORDING_MS = 150;
const MAX_RECORDING_MS = 5 * 60 * 1000;
// Command suggestions actually rendered in the listbox; the rest are summarized as "+N more".
const MAX_RENDERED_SUGGESTIONS = 15;

// Format file size with appropriate units
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function formatRecordingDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mpeg", "audio/wav"];
  return candidates.find(type => MediaRecorder.isTypeSupported(type));
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function normalizeAttachmentMimeType(mimeType: string): string {
  // MediaRecorder may report codecs in the type string; schema only allows the base type.
  if (mimeType.startsWith("audio/webm")) return "audio/webm";
  if (mimeType.startsWith("audio/mpeg")) return "audio/mpeg";
  if (mimeType.startsWith("audio/wav") || mimeType.startsWith("audio/wave") || mimeType.startsWith("audio/x-wav")) {
    return "audio/wav";
  }
  // Clipboard / OS aliases that the schema does not list directly.
  if (mimeType === "image/jpg" || mimeType === "image/pjpeg") return "image/jpeg";
  if (mimeType === "image/x-png") return "image/png";
  return mimeType;
}

const PASTED_FILE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "text/x-diff": "diff",
  "application/json": "json",
  "message/rfc822": "eml",
};

function pastedFileName(mimeType: string): string {
  const normalized = normalizeAttachmentMimeType(mimeType);
  const ext = PASTED_FILE_EXTENSIONS[normalized] ?? "bin";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `pasted-${stamp}.${ext}`;
}

function ensurePastedFileName(file: File): File {
  if (file.name) return file;
  const name = pastedFileName(file.type);
  try {
    if (typeof File === "function") {
      return new File([file], name, { type: file.type, lastModified: file.lastModified });
    }
  } catch {
    // Some test environments expose a non-constructable File global.
  }
  return Object.assign(new Blob([file], { type: file.type }), {
    name,
    lastModified: file.lastModified || Date.now(),
  }) as File;
}

function filesFromClipboard(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];

  const files: File[] = [];
  const seen = new Set<string>();

  const addFile = (file: File | null) => {
    if (!file) return;
    const key = `${file.name}\0${file.type}\0${file.size}\0${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(ensurePastedFileName(file));
  };

  if (clipboardData.files.length > 0) {
    for (const file of Array.from(clipboardData.files)) {
      addFile(file);
    }
  }

  // Screenshots and some OS copy operations expose the image only as an item.
  const items = clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.kind === "file") {
      addFile(item.getAsFile());
    }
  }

  return files;
}

function recordingFileName(mimeType: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `recording-${stamp}.${extensionForMimeType(mimeType)}`;
}

/** Percent of context window used, or null when max is unknown. */
function contextPercentUsed(contextLength: number, maxContextLength: number | null | undefined): number | null {
  if (maxContextLength == null || maxContextLength <= 0) return null;
  const usedPercent = Math.min(100, Math.floor((contextLength * 100) / maxContextLength));
  return Math.max(0, usedPercent);
}

/** Compact token counts for the status strip (e.g. 1.2k, 3.4m). */
function formatCompactTokens(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) {
    const scaled = value / 1_000;
    return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "")}k`;
  }
  const scaled = value / 1_000_000;
  return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "")}m`;
}

/** Shorten paths for the footer: collapse deep trees to `…/parent/leaf`. */
function shortenPath(path: string, maxLen = 28): string {
  if (!path) return "";
  if (path.length <= maxLen) return path;

  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) {
    return `…${path.slice(-(maxLen - 1))}`;
  }
  const tail = parts.slice(-2).join("/");
  if (tail.length + 2 <= maxLen) return `…/${tail}`;
  return `…${tail.slice(-(maxLen - 1))}`;
}

function contextToneClass(percentUsed: number | null): string {
  if (percentUsed == null) return "text-muted";
  if (percentUsed > 80) return "text-error";
  if (percentUsed > 50) return "text-warning";
  return "text-muted";
}

function createRecordingFile(bytes: Uint8Array, name: string, mimeType: string): File {
  // Copy into a standalone ArrayBuffer so the view is a valid BlobPart under
  // stricter lib types (Uint8Array may be backed by SharedArrayBuffer).
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blobParts: BlobPart[] = [arrayBuffer];
  try {
    if (typeof File === "function") {
      return new File(blobParts, name, { type: mimeType });
    }
  } catch {
    // Some test environments expose a non-constructable File global.
  }

  return Object.assign(new Blob(blobParts, { type: mimeType }), {
    name,
    lastModified: Date.now(),
  }) as File;
}

export default function ChatFooter({
  agentId,
  input,
  setInput,
  inputError,
  setInputError,
  idle,
  availableCommands,
  commandHistory,
  showHistory,
  setShowHistory,
  setShowFileBrowser,
  onSubmit,
  submitFeedback,
  extraAttachments,
  onRemoveExtraAttachment,
  queuedInputs = [],
  onCancelQueuedInput,
  injectedDraft = null,
}: ChatFooterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** What to open once the + menu has closed (see its onCloseAutoFocus). */
  const afterAddMenu = useRef<(() => void) | null>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const maxRecordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingCancelledRef = useRef(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [cursor, setCursor] = useState(() => input.length);
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const [selectedMention, setSelectedMention] = useState(0);
  const mentionStartRef = useRef<number | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyBuffer, setHistoryBuffer] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [showRemotePicker, setShowRemotePicker] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const isNavigatingHistoryRef = useRef(false);

  // Adopt "edit message" attachment drafts exactly once per nonce.
  const adoptedDraftNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!injectedDraft || injectedDraft.attachments.length === 0) return;
    if (adoptedDraftNonceRef.current === injectedDraft.nonce) return;
    adoptedDraftNonceRef.current = injectedDraft.nonce;
    setAttachments(prev => [
      ...prev,
      ...injectedDraft.attachments.map((attachment, index) => ({
        id: `draft-${injectedDraft.nonce}-${index}`,
        file: null,
        attachment,
      })),
    ]);
  }, [injectedDraft]);

  // Enter submits on pointer devices and inserts a newline on touch (see handleKeyDown),
  // so the hint follows the device, not the viewport width.

  const remoteMounts = useRemoteMounts().data;
  // Only kinds with something mounted: the AWS plugin registers S3 even when no bucket is configured.
  const remoteStores = remoteMounts ? remoteMounts.stores.filter(store => remoteMounts.mounts.some(mount => mount.scheme === store.scheme)) : [];
  // "Attach from Google Drive" when Drive is the only kind of store. ("Choose from Files" is the host.)
  const remoteAttachLabel = remoteStores.length === 1 ? `Attach from ${remoteStores[0]!.label}` : "Attach from cloud storage";

  const chatUsage = useChatUsage(agentId);
  const filesystemState = useFilesystemState(agentId);

  // Unique per chat: chats can sit side by side.
  const inputId = useId();
  const activeMention = useMemo(() => {
    if (input.startsWith("/")) return null;
    return findActiveMention(input, cursor);
  }, [cursor, input]);

  const mentionQuery = !mentionDismissed && activeMention ? activeMention.query : null;
  const { categories: mentionCategories, pending: mentionPending, isLoading: mentionLoading } = useContextualSearch(agentId, mentionQuery);
  const mentionItems = useMemo(() => flattenContextualSearchItems(mentionCategories), [mentionCategories]);
  const mentionPickerOpen = mentionQuery !== null;

  const usageSnapshot = chatUsage.data?.status === "success" ? chatUsage.data : null;
  const fsSnapshot = filesystemState.data?.status === "success" ? filesystemState.data : null;

  const hasSomethingToSend = input.trim().length > 0 || attachments.length > 0 || (extraAttachments?.length ?? 0) > 0;

  const footerMetrics = useMemo(() => {
    const contextLength = usageSnapshot?.contextLength ?? 0;
    const maxContextLength = usageSnapshot?.maxContextLength ?? null;
    const percentUsed = contextPercentUsed(contextLength, maxContextLength);
    const costTotal = usageSnapshot?.cost.total ?? null;
    // Footer chip: first write-allowed path plus a count of the others.
    const allowedPaths = fsSnapshot?.allowedPaths ?? [];
    const primaryPath = allowedPaths.find(entry => entry.permission === "write") ?? allowedPaths[0] ?? null;
    const extraPathCount = primaryPath ? allowedPaths.length - 1 : 0;

    return {
      percentUsed,
      contextLabel:
        percentUsed != null ? `${percentUsed}% ctx` : maxContextLength == null && contextLength === 0 ? null : `${formatCompactTokens(contextLength)} tok`,
      contextTitle:
        percentUsed != null && maxContextLength != null
          ? `${formatCompactTokens(contextLength)} / ${formatCompactTokens(maxContextLength)} tokens · ${percentUsed}% context used`
          : contextLength > 0
            ? `${formatCompactTokens(contextLength)} tokens in context`
            : "Context usage unavailable",
      costLabel: costTotal != null ? formatUsd(costTotal) : null,
      costTitle: costTotal != null ? `Most recent response cost ${formatUsd(costTotal)}` : "Cost unavailable",
      cwdLabel: primaryPath ? `${shortenPath(primaryPath.path)}${extraPathCount > 0 ? ` +${extraPathCount}` : ""}` : null,
      cwdTitle:
        allowedPaths.length > 0
          ? `Allowed paths:\n${allowedPaths.map(entry => `${entry.path} (${entry.permission})`).join("\n")}`
          : "Allowed paths unavailable",
    };
  }, [usageSnapshot, fsSnapshot]);

  useEffect(() => {
    const start = activeMention?.start ?? null;
    if (start === mentionStartRef.current) return;
    mentionStartRef.current = start;
    setMentionDismissed(false);
  }, [activeMention?.start]);

  useEffect(() => {
    setSelectedMention(0);
  }, [mentionQuery, mentionCategories]);

  // Keep the highlighted command suggestion within the filtered list as it shrinks,
  // so completion can never read past the end (and insert a literal "undefined").
  useEffect(() => {
    setSelectedSuggestion(prev => Math.min(prev, Math.max(availableCommands.length - 1, 0)));
  }, [availableCommands]);

  const applyMention = useCallback(
    (tag: string) => {
      if (!activeMention) return;
      const { next, cursor: nextCursor } = replaceActiveMention(input, activeMention, tag);
      setInput(next);
      setMentionDismissed(true);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
        setCursor(nextCursor);
      });
    },
    [activeMention, input, setInput],
  );

  // Reset history navigation when user manually types
  useEffect(() => {
    if (!isNavigatingHistoryRef.current && historyIndex !== null) {
      setHistoryIndex(null);
      setHistoryBuffer("");
    }
    // Reset the ref after the effect runs
    isNavigatingHistoryRef.current = false;
  }, [historyIndex]);

  const stopMediaTracks = useCallback(() => {
    for (const track of mediaStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    mediaStreamRef.current = null;
  }, []);

  const clearMaxRecordingTimeout = useCallback(() => {
    if (maxRecordingTimeoutRef.current !== null) {
      clearTimeout(maxRecordingTimeoutRef.current);
      maxRecordingTimeoutRef.current = null;
    }
  }, []);

  // Tick recording duration while active
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      if (recordingStartedAtRef.current !== null) {
        setRecordingDurationMs(Date.now() - recordingStartedAtRef.current);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRecording]);

  // Cleanup MediaRecorder resources on unmount
  useEffect(() => {
    return () => {
      clearMaxRecordingTimeout();
      recordingCancelledRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // ignore stop errors during unmount
        }
      }
      mediaRecorderRef.current = null;
      stopMediaTracks();
    };
  }, [clearMaxRecordingTimeout, stopMediaTracks]);

  // Handle drag and drop
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isProcessingFiles) {
        setIsDragOver(true);
      }
    },
    [isProcessingFiles],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // Read file and convert to InputAttachment
  const readFileAsAttachment = useCallback((file: File): Promise<FileAttachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const normalizedMime = normalizeAttachmentMimeType(file.type || "application/octet-stream");
        const mimeType = ChatAttachmentSchema.shape.mimeType.safeParse(normalizedMime);
        if (!mimeType.success) {
          reject(new Error(`Invalid MIME type: ${file.type || normalizedMime}`));
          return;
        }

        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);

        // Convert to base64 in chunks to avoid stack overflow on large files
        const CHUNK = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        const base64 = btoa(binary);

        const attachment: ChatAttachment = {
          name: file.name,
          encoding: "base64",
          mimeType: mimeType.data,
          body: base64,
        };

        resolve({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          attachment,
        });
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const addFilesAsAttachments = useCallback(
    async (files: Iterable<File>) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      setIsProcessingFiles(true);
      const newAttachments: FileAttachment[] = [];

      try {
        for (const file of fileList) {
          if (file.size > MAX_FILE_SIZE) {
            toastManager.warning(`"${file.name}" exceeds the 5MB limit and was not attached.`, { duration: 5000 });
            continue;
          }

          const normalizedMime = normalizeAttachmentMimeType(file.type || "application/octet-stream");
          if (!ChatAttachmentSchema.shape.mimeType.safeParse(normalizedMime).success) {
            toastManager.warning(`"${file.name || "Pasted file"}" is not a supported attachment type and was not attached.`, { duration: 5000 });
            continue;
          }

          try {
            const attachment = await readFileAsAttachment(file);
            newAttachments.push(attachment);
          } catch (error: unknown) {
            toastManager.error(`Failed to read "${file.name}": ${formatError(error)}`, { duration: 5000 });
          }
        }

        if (newAttachments.length > 0) {
          setAttachments(prev => [...prev, ...newAttachments]);
        }
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [readFileAsAttachment],
  );

  /** Reads a picked remote file through the remote RPC and adds it as an attachment chip. */
  const attachRemoteFile = useCallback(async (entry: RemoteEntry) => {
    if (entry.size !== undefined && !entry.readsAs && entry.size > MAX_FILE_SIZE) {
      toastManager.warning(`"${entry.name}" exceeds the 5MB limit and was not attached.`, { duration: 5000 });
      return;
    }
    setIsProcessingFiles(true);
    try {
      const content = await remoteRPCClient.read({ url: entry.url });
      if (content.size > MAX_FILE_SIZE) {
        toastManager.warning(`"${entry.name}" exceeds the 5MB limit and was not attached.`, { duration: 5000 });
        return;
      }
      const isText = content.encoding === "utf8";
      const declared = ChatAttachmentSchema.shape.mimeType.safeParse(normalizeAttachmentMimeType(content.mimeType));
      // Text the chat schema does not name (CSV from a Sheet, source code) still goes in, as plain text.
      const mimeType = declared.success ? declared.data : isText ? "text/plain" : null;
      if (!mimeType) {
        toastManager.warning(`"${entry.name}" (${content.mimeType}) is not a supported attachment type and was not attached.`, { duration: 5000 });
        return;
      }
      const attachment: ChatAttachment = {
        name: content.name,
        description: `From ${entry.url}`,
        encoding: isText ? "text" : "base64",
        mimeType,
        body: content.content,
      };
      setAttachments(prev => [...prev, { id: `${entry.url}-${Date.now()}`, file: null, attachment }]);
    } catch (error: unknown) {
      toastManager.error(`Couldn't attach "${entry.name}": ${formatError(error)}`, { duration: 5000 });
    } finally {
      setIsProcessingFiles(false);
    }
  }, []);

  const finalizeRecording = useCallback(
    async (blob: Blob, durationMs: number) => {
      if (recordingCancelledRef.current) {
        recordingCancelledRef.current = false;
        return;
      }

      if (durationMs < MIN_RECORDING_MS || blob.size === 0) {
        toastManager.warning("Recording was too short and was discarded.", { duration: 3000 });
        return;
      }

      const mimeType = normalizeAttachmentMimeType(blob.type || "audio/webm");
      const name = recordingFileName(mimeType);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const file = createRecordingFile(bytes, name, mimeType);

      if (file.size > MAX_FILE_SIZE) {
        toastManager.warning(`"${file.name}" exceeds the 5MB limit and was not attached.`, { duration: 5000 });
        return;
      }

      setIsProcessingFiles(true);
      try {
        const attachment = await readFileAsAttachment(file);
        const seconds = (durationMs / 1000).toFixed(1);
        attachment.attachment = {
          ...attachment.attachment,
          description: `Microphone recording (${seconds}s)`,
        };
        setAttachments(prev => [...prev, attachment]);
      } catch (error: unknown) {
        toastManager.error(`Failed to attach recording: ${formatError(error)}`, { duration: 5000 });
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [readFileAsAttachment],
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    clearMaxRecordingTimeout();
    try {
      recorder.stop();
    } catch (error: unknown) {
      toastManager.error(`Failed to stop recording: ${formatError(error)}`, { duration: 5000 });
      stopMediaTracks();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setRecordingDurationMs(0);
      recordingStartedAtRef.current = null;
    }
  }, [clearMaxRecordingTimeout, stopMediaTracks]);

  const cancelRecording = useCallback(() => {
    recordingCancelledRef.current = true;
    recordedChunksRef.current = [];
    clearMaxRecordingTimeout();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        stopMediaTracks();
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setRecordingDurationMs(0);
        recordingStartedAtRef.current = null;
      }
    } else {
      stopMediaTracks();
      setIsRecording(false);
      setRecordingDurationMs(0);
      recordingStartedAtRef.current = null;
    }
  }, [clearMaxRecordingTimeout, stopMediaTracks]);

  const startRecording = useCallback(async () => {
    if (isProcessingFiles || isRecording) return;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be null in the browser
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toastManager.error("Audio recording is not supported in this browser.", { duration: 5000 });
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      toastManager.error("Audio recording is not supported in this browser.", { duration: 5000 });
      return;
    }

    const mimeType = pickRecorderMimeType();
    if (!mimeType) {
      toastManager.error("No supported audio recording format is available in this browser.", { duration: 5000 });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      recordingCancelledRef.current = false;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        toastManager.error("Recording failed unexpectedly.", { duration: 5000 });
        clearMaxRecordingTimeout();
        stopMediaTracks();
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setRecordingDurationMs(0);
        recordingStartedAtRef.current = null;
      };

      recorder.onstop = () => {
        const durationMs = recordingStartedAtRef.current !== null ? Date.now() - recordingStartedAtRef.current : 0;
        const blobType = recorder.mimeType || mimeType;
        const blob = new Blob(recordedChunksRef.current, { type: blobType });
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        clearMaxRecordingTimeout();
        stopMediaTracks();
        setIsRecording(false);
        setRecordingDurationMs(0);
        recordingStartedAtRef.current = null;
        void finalizeRecording(blob, durationMs);
      };

      recordingStartedAtRef.current = Date.now();
      setRecordingDurationMs(0);
      setIsRecording(true);
      recorder.start(250);

      maxRecordingTimeoutRef.current = setTimeout(() => {
        toastManager.warning("Maximum recording length reached (5 minutes).", { duration: 4000 });
        stopRecording();
      }, MAX_RECORDING_MS);
    } catch (error: unknown) {
      stopMediaTracks();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setRecordingDurationMs(0);
      recordingStartedAtRef.current = null;

      const message = formatError(error);
      if (/Permission|NotAllowed|denied/i.test(message)) {
        toastManager.error("Microphone permission denied. Allow microphone access to record audio.", { duration: 5000 });
      } else if (/NotFound|DevicesNotFound/i.test(message)) {
        toastManager.error("No microphone was found on this device.", { duration: 5000 });
      } else {
        toastManager.error(`Failed to start recording: ${message}`, { duration: 5000 });
      }
    }
  }, [clearMaxRecordingTimeout, finalizeRecording, isProcessingFiles, isRecording, stopMediaTracks, stopRecording]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      void addFilesAsAttachments(files);
    },
    [addFilesAsAttachments],
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      try {
        await addFilesAsAttachments(files);
      } finally {
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [addFilesAsAttachments],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (isRecording) return;

      const files = filesFromClipboard(e.clipboardData);
      if (files.length === 0) return;

      // Keep default paste for plain text; only consume the event when files are present.
      e.preventDefault();
      e.stopPropagation();
      void addFilesAsAttachments(files);
    },
    [addFilesAsAttachments, isRecording],
  );

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // Handle submit with attachments
  const handleSubmitWithAttachments = useCallback(async () => {
    if (isRecording) return;
    const fileAttachmentList = attachments.length > 0 ? attachments.map(a => a.attachment) : [];
    const extraAttachmentList = (extraAttachments ?? []).map(extra => extra.attachment);
    const inputAttachments = fileAttachmentList.length + extraAttachmentList.length > 0 ? [...extraAttachmentList, ...fileAttachmentList] : undefined;
    // Keep the chips until delivery is confirmed: a failed, dropped or cancelled
    // send must not lose the user's files. Only the chips that were part of this
    // submission are removed, so files added while it was in flight survive.
    const submittedIds = new Set(attachments.map(a => a.id));
    const delivered = await Promise.resolve()
      .then(() => onSubmit(inputAttachments))
      .catch(() => false);
    if (delivered) {
      if (submittedIds.size > 0) setAttachments(prev => prev.filter(a => !submittedIds.has(a.id)));
      // Reset textarea height after submission
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }, [attachments, extraAttachments, isRecording, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    setCursor(e.currentTarget.selectionStart);

    // Handle command suggestions with arrow keys
    if (availableCommands.length > 0 && historyIndex === null) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion(prev => (prev + 1) % availableCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion(prev => (prev - 1 + availableCommands.length) % availableCommands.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const cmd = availableCommands[Math.min(selectedSuggestion, availableCommands.length - 1)];
        setInput(`/${cmd} `);
        textareaRef.current?.focus();
        return;
      }
    }

    if (mentionPickerOpen && historyIndex === null) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (mentionItems.length > 0) {
          setSelectedMention(prev => (prev + 1) % mentionItems.length);
        }
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (mentionItems.length > 0) {
          setSelectedMention(prev => (prev - 1 + mentionItems.length) % mentionItems.length);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const item = mentionItems[selectedMention];
        if (item) applyMention(item.tag);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const item = mentionItems[selectedMention];
        if (item) {
          e.preventDefault();
          applyMention(item.tag);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionDismissed(true);
        return;
      }
    }

    // Handle history navigation with arrow keys
    if (availableCommands.length === 0 || historyIndex !== null) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0) {
          let newIndex: number;

          if (historyIndex === null) {
            // Start navigating history, save current input
            setHistoryBuffer(input);
            newIndex = commandHistory.length - 1;
          } else if (historyIndex > 0) {
            newIndex = historyIndex - 1;
          } else {
            newIndex = 0;
          }

          // Only navigate within valid bounds, even if the history shrank mid-navigation.
          newIndex = Math.max(0, Math.min(newIndex, commandHistory.length - 1));
          setHistoryIndex(newIndex);
          isNavigatingHistoryRef.current = true;
          setInput(commandHistory[newIndex] ?? "");
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex !== null) {
          if (historyIndex < commandHistory.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            isNavigatingHistoryRef.current = true;
            setInput(commandHistory[newIndex]!);
          } else {
            // Go back to the original input before history navigation
            setHistoryIndex(null);
            setHistoryBuffer("");
            setInput(historyBuffer);
          }
        }
        return;
      }
    }

    if (e.key === "Enter") {
      const isTouchDevice = navigator.maxTouchPoints > 0;
      if (!isTouchDevice && !e.shiftKey) {
        e.preventDefault();
        void handleSubmitWithAttachments();
      }
    }
  };

  return (
    <footer
      ref={footerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={`shrink-0 border-t border-primary md:border-t-0 md:bg-transparent relative transition-all duration-200 md:rounded-none ${
        isDragOver ? "ring-2 ring-accent ring-inset bg-accent/10" : ""
      }`}
    >
      {mentionPickerOpen && availableCommands.length === 0 && (
        <ContextualSearchPicker
          categories={mentionCategories}
          pending={mentionPending}
          selectedIndex={selectedMention}
          isLoading={mentionLoading}
          query={activeMention?.query ?? ""}
          onHover={setSelectedMention}
          onSelect={item => applyMention(item.tag)}
        />
      )}

      <AnimatePresence>
        {availableCommands.length > 0 && (
          <motion.div
            id="command-suggestions"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-4 right-4 mb-2 flex flex-wrap gap-2 p-3 bg-secondary border border-primary rounded-lg shadow-md z-20"
            role="listbox"
            aria-label="Command suggestions"
            aria-activedescendant={selectedSuggestion < Math.min(availableCommands.length, MAX_RENDERED_SUGGESTIONS) ? `cmd-${selectedSuggestion}` : undefined}
          >
            {availableCommands.slice(0, MAX_RENDERED_SUGGESTIONS).map((cmd, idx) => (
              <button
                type="button"
                key={cmd}
                id={`cmd-${idx}`}
                onClick={() => {
                  setInput(`/${cmd} `);
                  textareaRef.current?.focus();
                }}
                className={`text-xs font-mono px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  idx === selectedSuggestion ? "bg-accent text-primary" : "bg-tertiary hover:bg-hover text-accent-soft"
                }`}
                role="option"
                aria-selected={idx === selectedSuggestion}
              >
                /{cmd}
              </button>
            ))}
            {availableCommands.length > MAX_RENDERED_SUGGESTIONS && (
              <span className="text-xs text-muted ml-auto">+{availableCommands.length - MAX_RENDERED_SUGGESTIONS} more</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag and drop overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-accent/10 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="flex flex-col items-center gap-3 p-6">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
                <Paperclip className="w-12 h-12 text-accent" />
              </motion.div>
              <div className="text-center">
                <p className="text-lg font-mono text-accent-soft font-semibold">Drop files to attach</p>
                <p className="text-sm text-muted font-mono mt-1">Maximum 5MB per file</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="md:mx-4 md:mb-4 md:rounded-xl md:overflow-hidden md:ring-1 md:ring-line md:shadow-xl md:bg-secondary rounded-t-xl overflow-hidden">
        <div className="relative bg-secondary">
          {/* Hidden file input for local file upload */}
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" aria-label="Upload files" />

          {/* Live recording indicator */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-primary/40 bg-error/5 px-4 py-3 flex items-center justify-between gap-3"
                role="status"
                aria-label="Recording in progress"
                aria-live="polite"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-error" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-error font-semibold">Recording audio…</p>
                    <p className="text-xs font-mono text-muted">{formatRecordingDuration(recordingDurationMs)} · max 5:00</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="px-2.5 py-1.5 rounded-md text-xs font-mono text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
                    aria-label="Cancel recording"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-2.5 py-1.5 rounded-md text-xs font-mono bg-error/15 text-error hover:bg-(--status-danger-bg) transition-colors focus-ring flex items-center gap-1.5"
                    aria-label="Stop recording and attach"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* App-contributed attachment chips (e.g. designs attached from the Web Design app) */}
          {extraAttachments && extraAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {extraAttachments.map(extra => (
                <div key={extra.id} className="flex items-center gap-2 bg-accent-muted px-3 py-1.5 rounded-md group shadow-card">
                  <FileCode className="w-4 h-4 text-accent" />
                  <span className="text-sm text-primary font-mono max-w-37.5 truncate" title={extra.attachment.name}>
                    {extra.label}
                  </span>
                  {onRemoveExtraAttachment && (
                    <button
                      type="button"
                      onClick={() => onRemoveExtraAttachment(extra.id)}
                      className="text-muted hover:text-error transition-colors focus-ring rounded-md p-1.5"
                      aria-label={`Remove ${extra.label}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Attachments preview */}
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border border-primary overflow-hidden"
              >
                {/* Processing indicator */}
                {isProcessingFiles && (
                  <div className="px-4 py-3 flex items-center gap-2 text-warning">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4">
                      <Paperclip className="w-4 h-4" />
                    </motion.div>
                    <span className="text-sm font-mono">Processing files...</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  {attachments.map(({ id, file, attachment }) => {
                    const Icon = getFileIcon(attachment.mimeType);
                    const name = file?.name ?? attachment.name;
                    const size = file?.size ?? Math.floor((attachment.body.length * 3) / 4);
                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 bg-tertiary px-3 py-1.5 rounded-md group shadow-card"
                      >
                        <Icon className="w-4 h-4 text-muted" />
                        <span className="text-sm text-primary font-mono max-w-37.5 truncate">{name}</span>
                        <span className="text-xs text-muted font-mono">({formatFileSize(size)})</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(id)}
                          className="text-muted hover:text-error transition-colors focus-ring rounded-md p-1.5"
                          aria-label={`Remove ${name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
                {/* Total size indicator */}
                <div className="px-4 pb-3 flex items-center gap-2 border-t border-primary/30">
                  <span className="text-xs text-muted font-mono">Total:</span>
                  <span
                    className={`text-xs font-mono ${
                      attachments.reduce((sum, a) => sum + (a.file?.size ?? Math.floor((a.attachment.body.length * 3) / 4)), 0) > MAX_FILE_SIZE * 0.8
                        ? "text-warning"
                        : "text-muted"
                    }`}
                  >
                    {attachments.reduce((sum, a) => sum + (a.file?.size ?? Math.floor((a.attachment.body.length * 3) / 4)), 0).toLocaleString()} bytes
                  </span>
                  {attachments.reduce((sum, a) => sum + (a.file?.size ?? Math.floor((a.attachment.body.length * 3) / 4)), 0) > MAX_FILE_SIZE && (
                    <span className="text-xs text-error font-mono">Exceeds 5MB limit</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inputs waiting in the agent's queue while another input runs */}
          {queuedInputs.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3" role="list" aria-label="Queued messages">
              {queuedInputs.map(queued => (
                <div
                  key={queued.requestId}
                  className="flex items-center gap-2 bg-warning/10 border border-warning/30 px-2.5 py-1.5 rounded-md group shadow-card"
                  role="listitem"
                >
                  <span className="text-xs text-warning" aria-hidden="true">
                    ⏳
                  </span>
                  <span className="text-xs text-primary font-mono max-w-75 truncate" title={queued.message}>
                    {queued.message || "(empty message)"}
                  </span>
                  {onCancelQueuedInput && (
                    <button
                      type="button"
                      onClick={() => onCancelQueuedInput(queued.requestId)}
                      className="text-muted hover:text-error transition-colors focus-ring rounded-md p-1"
                      aria-label={`Cancel queued message: ${queued.message.slice(0, 50)}`}
                      title="Cancel this queued message"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* One row: add (+), the message, then voice, history and send. */}
          <div className="flex items-end gap-1.5 px-2.5 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Add to message"
                  title={isProcessingFiles ? "Processing files…" : "Add to message"}
                  disabled={isProcessingFiles || isRecording}
                  className="p-1.5 rounded-md hover:bg-hover transition-colors text-muted hover:text-primary focus-ring disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isProcessingFiles ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="min-w-52"
                onCloseAutoFocus={event => {
                  // Open what was picked only once the menu has let go of focus. The file browser
                  // traps focus too; opened while the menu was still handing focus back to +, the
                  // two traps pulled focus back and forth forever and hung the page.
                  const action = afterAddMenu.current;
                  afterAddMenu.current = null;
                  if (action) {
                    event.preventDefault();
                    action();
                  }
                }}
              >
                <DropdownMenuItem className="gap-2.5" onSelect={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4 text-muted" aria-hidden="true" /> Add files or photos
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2.5"
                  onSelect={() => {
                    afterAddMenu.current = () => setShowFileBrowser(true);
                  }}
                >
                  <FolderOpen className="h-4 w-4 text-muted" aria-hidden="true" /> Choose from Files
                </DropdownMenuItem>
                {remoteStores.length > 0 && (
                  <DropdownMenuItem
                    className="gap-2.5"
                    onSelect={() => {
                      afterAddMenu.current = () => setShowRemotePicker(true);
                    }}
                  >
                    <Cloud className="h-4 w-4 text-muted" aria-hidden="true" /> {remoteAttachLabel}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="relative min-w-0 flex-1">
              <label htmlFor={inputId} className="sr-only">
                Command or message input
              </label>
              <div className="relative rounded-md border border-control px-2.5 focus-within:border-accent">
                <textarea
                  ref={textareaRef}
                  id={inputId}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    setCursor(e.target.selectionStart);
                    setInputError(false);
                    // Auto-expand textarea when typing
                    const target = e.target;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                  onClick={e => setCursor(e.currentTarget.selectionStart)}
                  onKeyUp={e => setCursor(e.currentTarget.selectionStart)}
                  onSelect={e => setCursor(e.currentTarget.selectionStart)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  disabled={isRecording}
                  rows={1}
                  className={`block w-full bg-transparent border-none focus:ring-0 resize-none text-sm text-primary placeholder-muted px-0 py-[5px] leading-[22px] outline-none transition-opacity ${
                    inputError ? "placeholder:text-error/50" : ""
                  } ${isRecording ? "opacity-60" : ""}`}
                  placeholder={
                    isRecording
                      ? "Recording… add a message or stop to attach audio"
                      : inputError
                        ? "Please enter a message, command, or attach a file..."
                        : idle
                          ? "Message the agent, or type / for commands"
                          : "Agent is busy — your message will be queued"
                  }
                  spellCheck="false"
                  aria-label="Command or message input"
                  aria-describedby={availableCommands.length > 0 ? "command-suggestions" : mentionPickerOpen ? "contextual-search-results" : undefined}
                  aria-autocomplete={mentionPickerOpen || availableCommands.length > 0 ? "list" : undefined}
                  aria-controls={availableCommands.length > 0 ? "command-suggestions" : mentionPickerOpen ? "contextual-search-results" : undefined}
                  aria-activedescendant={mentionPickerOpen && mentionItems[selectedMention] ? `ctx-${selectedMention}` : undefined}
                  aria-invalid={inputError}
                  aria-required="true"
                  // One line is exactly as tall as the icon buttons (32px), so its text centres on them.
                  style={{ height: "auto", minHeight: "2rem", maxHeight: "12rem" }}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              {/* Audio recording button */}
              <button
                type="button"
                aria-label={isRecording ? "Stop recording" : "Record audio"}
                aria-pressed={isRecording}
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                  } else {
                    void startRecording();
                  }
                }}
                disabled={isProcessingFiles}
                className={`p-1.5 rounded-md transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed relative ${
                  isRecording ? "bg-error/15 text-error hover:bg-(--status-danger-bg)" : "hover:bg-hover text-muted hover:text-primary"
                }`}
                title={isRecording ? "Stop recording and attach" : "Record audio"}
              >
                <Mic className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label={showHistory ? "Hide command history" : "Show command history"}
                title="Message history"
                onClick={() => setShowHistory(!showHistory)}
                disabled={commandHistory.length === 0}
                className="p-1.5 rounded-md hover:bg-hover transition-colors text-muted hover:text-primary focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <History className="w-5 h-5" />
              </button>
              {/* Send/Queue and Stop: send (queues while busy) when there is something to send;
                  Stop stays reachable whenever the agent is busy, even with a draft in the composer. */}
              {hasSomethingToSend && (
                <button
                  type="button"
                  aria-label={idle ? "Send message" : "Queue message"}
                  title={idle ? "Send message" : "Agent is busy — click to queue this message"}
                  onClick={() => void handleSubmitWithAttachments()}
                  disabled={isRecording}
                  className="p-2 rounded-md hover:bg-hover transition-colors text-muted hover:text-primary focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
              {!idle && (
                <button
                  type="button"
                  aria-label="Abort current operation"
                  title="Stop the current operation"
                  onClick={() => {
                    // Wrapped so a synchronous throw is caught too; a failed stop must surface, not vanish.
                    Promise.resolve()
                      .then(() => agentRPCClient.abortCurrentOperation({ agentId, message: "User aborted the current operation via the chat webapp" }))
                      .catch((error: unknown) => toastManager.error(`Failed to stop the agent: ${formatError(error)}`, { duration: 5000 }));
                  }}
                  className="p-2 rounded-md hover:bg-hover transition-colors text-muted hover:text-error focus-ring"
                >
                  <Square className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {queuedInputs.length > 0 && (
            <p className="px-4 pb-2 text-xs text-warning" aria-live="polite">
              {queuedInputs.length} queued
            </p>
          )}

          <AnimatePresence>
            {showHistory && commandHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute bottom-full left-6 right-6 mb-2 p-3 bg-secondary border border-primary rounded-lg shadow-md z-30 max-h-64 overflow-y-auto"
                role="dialog"
                aria-labelledby="history-title"
              >
                <div className="flex items-center justify-between mb-2">
                  <span id="history-title" className="text-xs text-muted font-mono uppercase">
                    Command History
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHistory(false)}
                    className="text-muted hover:text-primary focus-ring p-1 rounded-md"
                    aria-label="Close command history"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-1" role="listbox" aria-label="Previous commands">
                  {commandHistory
                    .slice()
                    .reverse()
                    .map((cmd, idx) => {
                      const actualIndex = commandHistory.length - 1 - idx;
                      const isSelected = historyIndex === actualIndex;
                      return (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => {
                            setInput(cmd);
                            textareaRef.current?.focus();
                            setShowHistory(false);
                          }}
                          className={`w-full text-left text-sm font-mono px-3 py-2 rounded-md text-primary transition-colors focus-ring ${
                            isSelected ? "bg-accent text-primary" : "bg-tertiary hover:bg-hover"
                          }`}
                          role="option"
                          aria-selected={isSelected}
                        >
                          {cmd}
                        </button>
                      );
                    })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="min-h-6 py-0.5 bg-tertiary flex flex-wrap items-center justify-between px-4 select-none gap-x-3 gap-y-0.5">
          {/* Where the agent works, on the left; what this conversation costs, on the right. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5">
            {footerMetrics.cwdLabel && (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted" title={footerMetrics.cwdTitle} data-testid="chat-footer-cwd">
                <Folder className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="min-w-0 max-w-72 truncate font-mono">{footerMetrics.cwdLabel}</span>
              </span>
            )}
            {submitFeedback && (
              <span className={`text-xs font-mono shrink-0 ${submitFeedback.type === "success" ? "text-success" : "text-error"}`}>
                {submitFeedback.message}
              </span>
            )}
          </div>
          {(footerMetrics.contextLabel || footerMetrics.costLabel) && (
            <div className="flex items-center gap-x-2 shrink-0" data-testid="chat-footer-metrics">
              {footerMetrics.contextLabel && (
                <span className={`text-xs font-mono tabular-nums shrink-0 ${contextToneClass(footerMetrics.percentUsed)}`} title={footerMetrics.contextTitle}>
                  {footerMetrics.contextLabel}
                </span>
              )}
              {footerMetrics.contextLabel && footerMetrics.costLabel && (
                <span className="text-xs text-muted/50 font-mono" aria-hidden="true">
                  ·
                </span>
              )}
              {footerMetrics.costLabel && (
                <span className="text-xs font-mono tabular-nums text-muted shrink-0" title={footerMetrics.costTitle}>
                  {footerMetrics.costLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {showRemotePicker && <RemoteFilePicker onClose={() => setShowRemotePicker(false)} onPick={entry => void attachRemoteFile(entry)} />}
    </footer>
  );
}
