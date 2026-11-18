import formatError from "@tokenring-ai/utility/error/formatError";
import { Copy, Download, GitBranch, Pencil, Pin, PinOff, Radar, Trash2 } from "lucide-react";
import { toastManager } from "../../components/ui/toast.tsx";
import type { PanelMenuItem } from "../../layout/context.ts";
import { downloadTranscript, fetchAgentTranscript, formatTranscript, type TranscriptFormat } from "../../lib/agentTranscript.ts";
import { copyToClipboard } from "../../lib/clipboard.ts";
import type { ChatMessage } from "../../types/agent-events.ts";

export interface AgentMenuHandlers {
  branch: () => void;
  end: () => void;
  ending: boolean;
  /** Opens the Monitors app's create form with this agent chosen. */
  monitor?: () => void;
  /** List-only actions; omitted where they don't apply (the chat's own menu). */
  pinned?: boolean;
  togglePinned?: () => void;
  rename?: () => void;
  /** More commands for this agent, placed just before End agent (Clear transcript in the chat). */
  extra?: readonly PanelMenuItem[];
}

async function withTranscript(agentId: string, onTranscript: (messages: ChatMessage[]) => Promise<unknown> | void) {
  try {
    const messages = await fetchAgentTranscript(agentId);
    if (!messages) {
      toastManager.error("That agent is no longer running", { duration: 4000 });
      return;
    }
    await onTranscript(messages);
  } catch (error) {
    toastManager.error(`Could not read the transcript: ${formatError(error)}`, { duration: 5000 });
  }
}

const FORMAT_LABEL: Record<TranscriptFormat, string> = { markdown: "Markdown", json: "JSON" };

/** Everything you can do with one running agent: the row ⋯ menu and the agent list's area menu share it. */
export function agentMenuItems(agentId: string, handlers: AgentMenuHandlers): PanelMenuItem[] {
  const formats: TranscriptFormat[] = ["markdown", "json"];
  return [
    {
      id: "branch",
      label: "Branch into a new agent",
      icon: GitBranch,
      onSelect: handlers.branch,
    },
    ...formats.map(
      (format, index): PanelMenuItem => ({
        id: `copy-${format}`,
        label: `Copy transcript as ${FORMAT_LABEL[format]}`,
        icon: Copy,
        separated: index === 0,
        onSelect: () =>
          void withTranscript(agentId, messages => copyToClipboard(formatTranscript(messages, format), { label: `transcript as ${FORMAT_LABEL[format]}` })),
      }),
    ),
    ...formats.map(
      (format): PanelMenuItem => ({
        id: `download-${format}`,
        label: `Download as ${FORMAT_LABEL[format]}`,
        icon: Download,
        onSelect: () => void withTranscript(agentId, messages => downloadTranscript(messages, format)),
      }),
    ),
    ...(handlers.monitor
      ? [{ id: "monitor", label: "Monitor this agent", icon: Radar, separated: true, onSelect: handlers.monitor } satisfies PanelMenuItem]
      : []),
    ...(handlers.togglePinned
      ? [
          {
            id: "pin",
            label: handlers.pinned ? "Unpin" : "Pin to top",
            icon: handlers.pinned ? PinOff : Pin,
            separated: true,
            onSelect: handlers.togglePinned,
          } satisfies PanelMenuItem,
        ]
      : []),
    ...(handlers.rename ? [{ id: "rename", label: "Rename…", icon: Pencil, onSelect: handlers.rename } satisfies PanelMenuItem] : []),
    ...(handlers.extra ?? []),
    { id: "end", label: "End agent…", icon: Trash2, danger: true, disabled: handlers.ending, separated: true, onSelect: handlers.end },
  ];
}
