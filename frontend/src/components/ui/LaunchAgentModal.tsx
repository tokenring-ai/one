import formatError from "@tokenring-ai/utility/error/formatError";
import { BotMessageSquare } from "lucide-react";
import { type ElementType, useCallback, useId, useState } from "react";
import { useOpenAgentChat } from "../../apps/chat/useOpenAgentChat.ts";
import { requireAgentFound } from "../../lib/requireAgentFound.ts";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, filesystemRPCClient, useAgentTypes } from "../../rpc.ts";
import ModalShell from "./ModalShell.tsx";
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
  /** Called when the agent is successfully launched (default: open the agent's chat panel) */
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
  const openAgentChat = useOpenAgentChat();
  const agentTypes = useAgentTypes();
  const [selectedType, setSelectedType] = useState(defaultAgentType);
  const [question, setQuestion] = useState(defaultQuestion);
  const [launching, setLaunching] = useState(false);
  const questionId = useId();
  const typeId = useId();

  const firstType = agentTypes.data?.[0]?.type ?? "";
  const effectiveType = selectedType || firstType;

  const handleLaunch = useCallback(async () => {
    if (!effectiveType || !question.trim() || launching) return;
    setLaunching(true);
    let contextPath: string | null = null;
    try {
      const { id: agentId } = await agentRPCClient.createAgent({ agentType: effectiveType });

      if (contextData) {
        contextPath = resolveContextPath(contextFileName);
        // Snapshot question + timestamp at launch time so callers can pass stable context objects.
        const payload = {
          ...contextData,
          question: question.trim(),
          fetchedAt: new Date().toISOString(),
        };
        await filesystemRPCClient.writeFile({
          path: contextPath,
          content: JSON.stringify(payload, null, 2),
        });
        requireAgentFound(await filesystemRPCClient.addFileToChat({ agentId, file: contextPath }));
      }

      const messageParts = [
        messagePrefix?.trim() || null,
        contextPath ? `Context is attached as ${contextPath}.` : null,
        `User question: ${question.trim()}`,
      ].filter(Boolean);

      requireAgentFound(
        await agentRPCClient.sendInput({
          agentId,
          input: {
            from: messageSource,
            message: messageParts.join("\n"),
          },
        }),
      );

      onClose();
      if (onLaunch) {
        onLaunch(agentId);
      } else {
        openAgentChat(agentId);
      }
    } catch (err) {
      // Best-effort cleanup of the temp context file if launch failed after write.
      if (contextPath) {
        try {
          await filesystemRPCClient.deleteFile({ path: contextPath });
        } catch {
          // Don't mask the original error
        }
      }
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setLaunching(false);
    }
  }, [effectiveType, question, launching, contextData, contextFileName, messagePrefix, messageSource, openAgentChat, onClose, onLaunch]);

  return (
    <ModalShell
      title={title}
      description={description}
      onClose={onClose}
      busy={launching}
      width={width}
      className={cn("space-y-4", className)}
      focusTrap={focusTrap}
      headerClassName="flex items-start justify-between gap-3"
      footerClassName="pt-1"
      confirmLabel={launchLabel}
      confirmIcon={LaunchIcon}
      confirmDisabled={!effectiveType || !question.trim()}
      onConfirm={() => void handleLaunch()}
    >
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
          className="w-full text-sm bg-input border border-control rounded-lg px-3 py-2 text-primary focus-accent outline-none resize-none disabled:opacity-40"
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
          className="w-full text-sm bg-input border border-control rounded-lg px-3 py-2 text-primary focus-accent outline-none cursor-pointer disabled:opacity-40"
        >
          {agentTypes.data?.map(t => (
            <option key={t.type} value={t.type}>
              {t.displayName}
            </option>
          ))}
        </select>
      </div>
    </ModalShell>
  );
}
