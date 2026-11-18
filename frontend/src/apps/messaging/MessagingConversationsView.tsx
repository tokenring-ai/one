import SendMessageForm from "@tokenring-ai/bot/frontend/components/SendMessageForm.tsx";
import { ArrowRight, MessagesSquare, RefreshCw } from "lucide-react";
import { useState } from "react";
import ConversationRow from "../../components/ui/ConversationRow.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useMessagingData } from "../../features/messaging/useMessagingData.ts";
import { cn } from "../../lib/utils.ts";

/** Live bot conversations across every connected service, newest first. */
export default function MessagingConversationsView() {
  const data = useMessagingData();
  const [sendTarget, setSendTarget] = useState<string | undefined>(undefined);

  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader
          variant="navigator"
          middle={data.liveConversations.length > 0 ? data.liveConversations.length : undefined}
          actions={[
            {
              icon: <RefreshCw className={cn("w-3.5 h-3.5", data.bots.isValidating && "animate-spin")} />,
              label: "Refresh conversations",
              onClick: data.refresh,
            },
          ]}
        />
      }
    >
      <div className="h-full overflow-y-auto">
        {sendTarget !== undefined && (
          <div className="p-3 border-b border-primary">
            <SendMessageForm
              options={data.targetOptions}
              initialTarget={sendTarget}
              onSent={() => {
                setSendTarget(undefined);
                data.refresh();
              }}
              onCancel={() => setSendTarget(undefined)}
            />
          </div>
        )}
        {data.isLoading ? (
          <LoadingState message="Loading conversations…" className="py-10" />
        ) : data.botsFailed ? (
          <ErrorState title="Unable to load conversations" error={data.loading.hardError} onRetry={data.refresh} variant="page" />
        ) : data.liveConversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No live bot conversations"
            hint="Conversations appear here when someone messages a bot on Slack, Telegram, or another connected service."
            action={
              <button
                type="button"
                onClick={() => void data.navigate("/bots")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary rounded-lg text-muted hover:text-primary focus-ring cursor-pointer"
              >
                Manage bots <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-primary">
            {data.liveConversations.map(conversation => (
              <ConversationRow
                key={`${conversation.botName}:${conversation.key}`}
                conversation={{
                  key: conversation.key,
                  channelName: conversation.channelName,
                  conversationId: conversation.conversationId,
                  service: conversation.service,
                  busy: conversation.busy,
                  lastActivityAt: conversation.lastActivityAt,
                  agentId: conversation.agentId,
                  agentType: conversation.agentType,
                  botDisplayName: conversation.botDisplayName,
                }}
                connected={data.connectedServiceNames.has(conversation.service)}
                onOpenAgent={() => void data.navigate(`/agent/${conversation.agentId}`)}
                onMessage={() => setSendTarget(conversation.key)}
              />
            ))}
          </div>
        )}
      </div>
    </ViewShell>
  );
}
