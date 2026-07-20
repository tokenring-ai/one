import { type ChatAttachment, ChatAttachmentSchema } from "@tokenring-ai/agent/AgentEvents";
import formatError from "@tokenring-ai/utility/error/formatError";
import { AnimatePresence, motion } from "framer-motion";
import { FileAudio, FileCode, File as FileIcon, FileText, FolderOpen, History, Image, Mic, Paperclip, Send, Square, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { agentRPCClient } from "../../rpc.ts";
import HookSelector from "../HookSelector.tsx";
import ModelSelector from "../ModelSelector.tsx";
import SkillSelector from "../SkillSelector.tsx";
import SubAgentSelector from "../SubAgentSelector.tsx";
import ToolSelector from "../ToolSelector.tsx";
import { toastManager } from "../ui/toast.tsx";

interface FileAttachment {
  id: string;
  file: File;
  attachment: ChatAttachment;
}

interface ChatFooterProps {
  agentId: string;
  input: string;
  setInput: (value: string) => void;
  inputError: boolean;
  setInputError: (value: boolean) => void;
  idle: boolean;
  statusMessage: string;
  availableCommands: string[];
  commandHistory: string[];
  showHistory: boolean;
  setShowHistory: (value: boolean) => void;
  setShowFileBrowser: (value: boolean) => void;
  onSubmit: (attachments?: ChatAttachment[]) => void;
  submitFeedback: { message: string; type: "success" | "error" } | null;
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
  return mimeType;
}

function recordingFileName(mimeType: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `recording-${stamp}.${extensionForMimeType(mimeType)}`;
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
  statusMessage,
  availableCommands,
  commandHistory,
  showHistory,
  setShowHistory,
  setShowFileBrowser,
  onSubmit,
  submitFeedback,
}: ChatFooterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const maxRecordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingCancelledRef = useRef(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyBuffer, setHistoryBuffer] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const isNavigatingHistoryRef = useRef(false);

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
      if (!isProcessingFiles && idle) {
        setIsDragOver(true);
      }
    },
    [isProcessingFiles, idle],
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
    if (!idle || isProcessingFiles || isRecording) return;

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
  }, [clearMaxRecordingTimeout, finalizeRecording, idle, isProcessingFiles, isRecording, stopMediaTracks, stopRecording]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      setIsProcessingFiles(true);
      const newAttachments: FileAttachment[] = [];

      const processFiles = async () => {
        for (const file of files) {
          // Check file size
          if (file.size > MAX_FILE_SIZE) {
            toastManager.warning(`"${file.name}" exceeds the 5MB limit and was not attached.`, { duration: 5000 });
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
        setIsProcessingFiles(false);
      };

      void processFiles();
    },
    [readFileAsAttachment],
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsProcessingFiles(true);
      const newAttachments: FileAttachment[] = [];

      try {
        for (const file of Array.from(files)) {
          // Check file size
          if (file.size > MAX_FILE_SIZE) {
            toastManager.warning(`"${file.name}" exceeds the 5MB limit and was not attached.`, { duration: 5000 });
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

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [readFileAsAttachment],
  );

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // Handle submit with attachments
  const handleSubmitWithAttachments = useCallback(() => {
    if (isRecording) return;
    const inputAttachments = attachments.length > 0 ? attachments.map(a => a.attachment) : undefined;
    onSubmit(inputAttachments);
    setAttachments([]);
    // Reset textarea height after submission
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [attachments, isRecording, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        const cmd = availableCommands[selectedSuggestion];
        setInput(`/${cmd} `);
        textareaRef.current?.focus();
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

          setHistoryIndex(newIndex);
          isNavigatingHistoryRef.current = true;
          setInput(commandHistory[newIndex] ?? "Array Overflow");
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
        handleSubmitWithAttachments();
      }
    }
  };

  return (
    <footer
      ref={footerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`shrink-0 border-t border-primary md:border-t-0 md:bg-transparent relative transition-all duration-200 md:rounded-none ${
        isDragOver ? "ring-2 ring-accent ring-inset bg-accent/10" : ""
      }`}
    >
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
            aria-activedescendant={`cmd-${selectedSuggestion}`}
          >
            {availableCommands.slice(0, 15).map((cmd, idx) => (
              <button
                type="button"
                key={cmd}
                id={`cmd-${idx}`}
                onClick={() => {
                  setInput(`/${cmd} `);
                  textareaRef.current?.focus();
                }}
                className={`text-xs font-mono px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  idx === selectedSuggestion ? "bg-accent text-primary" : "bg-tertiary hover:bg-hover text-accent"
                }`}
                role="option"
                aria-selected={idx === selectedSuggestion}
              >
                /{cmd}
              </button>
            ))}
            {availableCommands.length > 15 && <span className="text-xs text-muted ml-auto">+{availableCommands.length - 15} more</span>}
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
                <p className="text-lg font-mono text-accent/80 font-semibold">Drop files to attach</p>
                <p className="text-sm text-muted font-mono mt-1">Maximum 5MB per file</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="md:mx-4 md:mb-4 md:rounded-xl md:overflow-hidden md:ring-1 md:ring-white/10 md:shadow-xl md:bg-secondary rounded-t-xl overflow-hidden">
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
                    className="px-2.5 py-1.5 rounded-md text-xs font-mono bg-error/15 text-error hover:bg-error/25 transition-colors focus-ring flex items-center gap-1.5"
                    aria-label="Stop recording and attach"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 bg-tertiary px-3 py-1.5 rounded-md group shadow-card"
                      >
                        <Icon className="w-4 h-4 text-muted" />
                        <span className="text-sm text-primary font-mono max-w-37.5 truncate">{file.name}</span>
                        <span className="text-xs text-muted font-mono">({formatFileSize(file.size)})</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(id)}
                          className="text-muted hover:text-error transition-colors focus-ring rounded-md p-1.5"
                          aria-label={`Remove ${file.name}`}
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
                      attachments.reduce((sum, a) => sum + a.file.size, 0) > MAX_FILE_SIZE * 0.8 ? "text-warning" : "text-muted"
                    }`}
                  >
                    {attachments.reduce((sum, a) => sum + a.file.size, 0).toLocaleString()} bytes
                  </span>
                  {attachments.reduce((sum, a) => sum + a.file.size, 0) > MAX_FILE_SIZE && (
                    <span className="text-xs text-error font-mono">Exceeds 5MB limit</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-start gap-4 px-6 pt-3 pb-2">
            <div className="shrink-0 h-lh items-center flex justify-center select-none text-lg">
              <span className="text-accent font-bold">&gt;</span>
            </div>

            <div className="flex-1 relative pt-0.75">
              <label htmlFor="chat-input" className="sr-only">
                Command or message input
              </label>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  id="chat-input"
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    setInputError(false);
                    // Auto-expand textarea when typing
                    const target = e.target;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={!idle || isRecording}
                  rows={1}
                  className={`w-full bg-transparent border-none focus:ring-0 resize-none text-sm font-mono text-primary placeholder-muted p-0 leading-relaxed outline-none transition-opacity ${
                    inputError ? "placeholder:text-error/50" : ""
                  } ${!idle || isRecording ? "opacity-60" : ""}`}
                  placeholder={
                    isRecording
                      ? "Recording… add a message or stop to attach audio"
                      : inputError
                        ? "Please enter a message, command, or attach a file..."
                        : "Execute command or send message..."
                  }
                  spellCheck="false"
                  aria-label="Command or message input"
                  aria-describedby={availableCommands.length > 0 ? "command-suggestions" : undefined}
                  aria-invalid={inputError}
                  aria-required="true"
                  style={{ height: "auto", minHeight: "1.5rem", maxHeight: "12rem" }}
                />
              </div>
            </div>

            {/* Send/Abort button - moved to right of input */}
            <div className="shrink-0">
              {idle ? (
                <button
                  type="button"
                  aria-label="Send message"
                  onClick={handleSubmitWithAttachments}
                  disabled={isRecording}
                  className="p-2 rounded-md hover:bg-hover transition-colors text-muted hover:text-primary focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Abort current operation"
                  onClick={() => agentRPCClient.abortCurrentOperation({ agentId, message: "User aborted the current operation via the chat webapp" })}
                  className="p-2 rounded-md hover:bg-hover transition-colors text-muted hover:text-error focus-ring"
                >
                  <Square className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-10 pb-3 bg-secondary flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 gap-2 sm:gap-0">
            <div className="flex flex-wrap items-center gap-2 order-2 sm:order-1">
              {/* Local file upload button */}
              <button
                type="button"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
                disabled={!idle || isProcessingFiles || isRecording}
                className="p-1.5 rounded-md hover:bg-hover transition-colors text-muted hover:text-primary focus-ring disabled:opacity-50 disabled:cursor-not-allowed relative"
                title={isProcessingFiles ? "Processing files..." : "Attach file"}
              >
                {isProcessingFiles ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5">
                    <Paperclip className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>
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
                disabled={!idle || isProcessingFiles}
                className={`p-1.5 rounded-md transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed relative ${
                  isRecording ? "bg-error/15 text-error hover:bg-error/25" : "hover:bg-hover text-muted hover:text-primary"
                }`}
                title={isRecording ? "Stop recording and attach" : "Record audio"}
              >
                <Mic className="w-5 h-5" />
              </button>
              {/* Remote file browser button */}
              <button
                type="button"
                aria-label="Browse remote files"
                onClick={() => setShowFileBrowser(true)}
                disabled={isRecording}
                className="p-1.5 rounded-md hover:bg-hover transition-colors text-muted hover:text-primary focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderOpen className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label={showHistory ? "Hide command history" : "Show command history"}
                onClick={() => setShowHistory(!showHistory)}
                disabled={commandHistory.length === 0}
                className="p-1.5 rounded-md hover:bg-hover transition-colors text-muted hover:text-primary focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <History className="w-5 h-5" />
              </button>
              <div className="w-px h-5 bg-primary/70 mx-0.5" aria-hidden="true" />
              <ModelSelector agentId={agentId} triggerVariant="icon" />
              <ToolSelector agentId={agentId} triggerVariant="icon" />
              <HookSelector agentId={agentId} triggerVariant="icon" />
              <SkillSelector
                agentId={agentId}
                triggerVariant="icon"
                onTrySkill={name => {
                  setInput(`/${name} `);
                  setInputError(false);
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
              />
              <SubAgentSelector agentId={agentId} triggerVariant="icon" />
            </div>

            <div className="flex items-center gap-2 order-1 sm:order-2" aria-live="polite" aria-atomic="true">
              {/* Right side - status indicator */}
              <div
                className={`w-2 h-2 ${idle ? "bg-accent" : "bg-warning"} rounded-full animate-pulse`}
                aria-label={idle ? "Agent is online" : "Agent is busy"}
                role="status"
              />
              <span className={`text-xs ${idle ? "text-accent" : "text-warning"} font-mono uppercase`}>{idle ? "Online" : "Busy"}</span>
              {attachments.length > 0 && (
                <span className="text-xs text-accent font-mono">
                  • {attachments.length} file{attachments.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

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

        <div className="h-6 bg-tertiary flex items-center justify-between px-6 select-none">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted font-mono line-clamp-1">{statusMessage}</span>
            <span className="text-xs text-dim font-mono">{input.length} chars</span>
            {submitFeedback && (
              <span className={`text-xs font-mono ${submitFeedback.type === "success" ? "text-success" : "text-error"}`}>{submitFeedback.message}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-dim mt-0.5">
            <span className="hidden md:inline">
              <kbd className="px-1.5 py-0.5 bg-tertiary rounded-md text-primary font-mono">↑/↓</kbd> History •{" "}
              <kbd className="px-1.5 py-0.5 bg-tertiary rounded-md text-primary font-mono">Enter</kbd> Send •{" "}
              <kbd className="px-1.5 py-0.5 bg-tertiary rounded-md text-primary font-mono">Shift+Enter</kbd> New line
            </span>
            <span className="md:hidden">↑/↓ History • Enter for new line • Tap send to submit</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
