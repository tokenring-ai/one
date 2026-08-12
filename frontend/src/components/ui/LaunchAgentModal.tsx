import formatError from "@tokenring-ai/utility/error/formatError";
import { FocusTrap } from "focus-trap-react";
import { BotMessageSquare, Loader2, X } from "lucide-react";
import { type ElementType, useCallback, useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, filesystemRPCClient, useAgentTypes } from "../../rpc.ts";
import { toastManager } from "./toast.tsx";

export interface LaunchAgentModalProps {
  /** Modal title */
  title: string;
  /** Subtitle/description under the title */
  description?: string;
  /** Default question text */
  defaultQuestion?: string;
  /** Label above the question field (default: "Your question") */
  questionLabel?: string;
  /** Context data to serialize and attach as a file */
  contextData?: Record<string, unknown> | undefined;
  /**
   * File path or name for the context file.
   * Supports `${timestamp}` placeholder. Relative names are written under `/tmp/`.
   * Default: `tokenring-context-${timestamp}.json`
   */
  contextFileName?: string;
  /** Prefix lines for the initial agent message (joined with newlines before the question) */
  messagePrefix?: string;
  /** Source label for the agent message (default: "App") */
  messageSource?: string;
  /** Pre-selected agent type (empty = use first available) */
  defaultAgentType?: string;
  /** Called when the agent is successfully launched (default: navigate to `/agent/:id`) */
  onLaunch?: (agentId: string) => void;
  /** Called when the user cancels or the modal is dismissed */
  onClose: () => void;
  /** Label on the launch button (default: "Launch Agent") */
  launchLabel?: string;
  /** Leading icon on the launch button when not launching (default: BotMessageSquare) */
  launchIcon?: ElementType;
  /** Modal card width class (default: "w-full max-w-md") */
  width?: string;
  /** Whether to trap focus inside the dialog (default: true) */
  focusTrap?: boolean;
  /** Optional className on the dialog card */
  className?: string;
}

/** Literal placeholder string embedded in context file name templates (not JS interpolation). */
const TIMESTAMP_PLACEHOLDER = `\${timestamp}`;

function resolveContextPath(contextFileName: string | undefined): string {
  const raw = (contextFileName ?? `tokenring-context-${TIMESTAMP_PLACEHOLDER}.json`).replaceAll(TIMESTAMP_PLACEHOLDER, String(Date.now()));
  if (raw.startsWith("/")) return raw;
  return `/tmp/${raw}`;
}

export default function LaunchAgentModal({
  title,
  description,
  defaultQuestion = "",
  questionLabel = "Your question",
  contextData,
  contextFileName,
  messagePrefix,
  messageSource = "App",
  defaultAgentType = "",
  onLaunch,
  onClose,
  launchLabel = "Launch Agent",
  launchIcon: LaunchIcon = BotMessageSquare,
  width = "w-full max-w-md",
  focusTrap = true,
  className,
}: LaunchAgentModalProps) {
  const navigate = useNavigate();
  const agentTypes = useAgentTypes();
  const [selectedType, setSelectedType] = useState(defaultAgentType);
  const [question, setQuestion] = useState(defaultQuestion);
  const [launching, setLaunching] = useState(false);
  const titleId = useId();
  const questionId = useId();
  const typeId = useId();

  const firstType = agentTypes.data?.[0]?.type ?? "";
  const effectiveType = selectedType || firstType;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !launching) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, launching]);

  const handleLaunch = useCallback(async () => {
    if (!effectiveType || !question.trim() || launching) return;
    setLaunching(true);
    let contextPath: string | null = null;
    let fsProvider: string | null = null;
    try {
      const { id: agentId } = await agentRPCClient.createAgent({ agentType: effectiveType, headless: false });

      if (contextData) {
        contextPath = resolveContextPath(contextFileName);
        const fsState = await filesystemRPCClient.getFilesystemState({ agentId });
        if (fsState.status !== "success") throw new Error("Failed to get filesystem state");
        fsProvider = fsState.provider;
        // Snapshot question + timestamp at launch time so callers can pass stable context objects.
        const payload = {
          ...contextData,
          question: question.trim(),
          fetchedAt: new Date().toISOString(),
        };
        await filesystemRPCClient.writeFile({
          path: contextPath,
          content: JSON.stringify(payload, null, 2),
          provider: fsProvider,
        });
        await filesystemRPCClient.addFileToChat({ agentId, file: contextPath });
      }

      const messageParts = [
        messagePrefix?.trim() || null,
        contextPath ? `Context is attached as ${contextPath}.` : null,
        `User question: ${question.trim()}`,
      ].filter(Boolean);

      await agentRPCClient.sendInput({
        agentId,
        input: {
          from: messageSource,
          message: messageParts.join("\n"),
        },
      });

      onClose();
      if (onLaunch) {
        onLaunch(agentId);
      } else {
        void navigate(`/agent/${agentId}`);
      }
    } catch (err) {
      // Best-effort cleanup of the temp context file if launch failed after write.
      if (contextPath && fsProvider) {
        try {
          await filesystemRPCClient.deleteFile({ path: contextPath, provider: fsProvider });
        } catch {
          // Don't mask the original error
        }
      }
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setLaunching(false);
    }
  }, [effectiveType, question, launching, contextData, contextFileName, messagePrefix, messageSource, navigate, onClose, onLaunch]);

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("bg-secondary border border-primary rounded-xl shadow-xl p-5 space-y-4", width, className)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-sm font-semibold text-primary">
              {title}
            </h2>
            {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={launching}
            className="p-1 text-muted hover:text-primary focus-ring rounded shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-xs text-muted font-medium block mb-1" htmlFor={questionId}>
            {questionLabel}
          </label>
          <textarea
            id={questionId}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            rows={3}
            disabled={launching}
            className="w-full text-sm bg-input border border-primary rounded-lg px-3 py-2 text-primary focus-accent outline-none resize-none disabled:opacity-40"
          />
        </div>

        <div>
          <label className="text-xs text-muted font-medium block mb-1" htmlFor={typeId}>
            Agent type
          </label>
          <select
            id={typeId}
            value={effectiveType}
            onChange={e => setSelectedType(e.target.value)}
            disabled={launching}
            className="w-full text-sm bg-input border border-primary rounded-lg px-3 py-2 text-primary focus-accent outline-none cursor-pointer disabled:opacity-40"
          >
            {agentTypes.data?.map(t => (
              <option key={t.type} value={t.type}>
                {t.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={launching}
            className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleLaunch()}
            disabled={launching || !effectiveType || !question.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LaunchIcon className="w-3.5 h-3.5" />}
            {launchLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (!focusTrap) return dialog;
  return <FocusTrap>{dialog}</FocusTrap>;
}
