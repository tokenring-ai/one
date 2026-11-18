import SendMessageForm from "@tokenring-ai/bot/frontend/components/SendMessageForm.tsx";
import { messagePath } from "@tokenring-ai/email/frontend/lib/paths.ts";
import { Bot, Hash, Mail, MessageSquare, MessagesSquare, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import QuickLink from "../../components/ui/QuickLink.tsx";
import SummaryStat from "../../components/ui/SummaryStat.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import OverviewPanel from "../../features/messaging/OverviewPanel.tsx";
import { MESSAGING_AGENT_TYPES, useMessagingData } from "../../features/messaging/useMessagingData.ts";
import { cn } from "../../lib/utils.ts";

/** Channels, recent threads and email at a glance, plus the quick-send form. */
export default function MessagingOverviewView() {
  const data = useMessagingData();
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendTarget, setSendTarget] = useState<string | undefined>(undefined);

  const openSendForm = (target?: string) => {
    setSendTarget(target);
    setShowSendForm(true);
  };

  return (
    <ViewShell
      pad="page"
      bodyClassName="space-y-5"
      header={
        <ViewHeader
          icon={MessageSquare}
          iconGradient="from-teal-500 to-emerald-600"
          title="Messaging"
          subtitle="Channels, bots, live threads and email"
          actions={[
            {
              key: "send",
              icon: <Send className="w-3.5 h-3.5" />,
              label: "Send a message",
              // A disabled control must say why.
              title: data.canSend ? "Send a message" : "Connect a chat service in Bots to send messages",
              onClick: () => openSendForm(undefined),
              disabled: !data.canSend,
            },
            {
              key: "refresh",
              icon: <RefreshCw className={cn("w-3.5 h-3.5", data.bots.isValidating && "animate-spin")} />,
              label: "Refresh",
              onClick: data.refresh,
            },
          ]}
        />
      }
    >
      {data.isLoading ? (
        <LoadingState message="Loading messaging status…" className="py-10" />
      ) : data.botsFailed ? (
        <ErrorState title="Unable to load messaging status" error={data.loading.hardError} onRetry={data.refresh} variant="page" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryStat label="Channels" value={String(data.connectedCount)} icon={<Hash className="w-3.5 h-3.5" />} accentClass="text-sky-500" size="sm" />
            <SummaryStat label="Bots" value={String(data.botList.length)} icon={<Bot className="w-3.5 h-3.5" />} accentClass="text-teal-500" size="sm" />
            <SummaryStat
              label="Live threads"
              value={String(data.liveConversations.length)}
              icon={<MessagesSquare className="w-3.5 h-3.5" />}
              accentClass="text-violet-500"
              size="sm"
            />
            <SummaryStat label="Email" value={data.emailStatValue} icon={<Mail className="w-3.5 h-3.5" />} accentClass="text-red-500" size="sm" />
          </div>

          {showSendForm && (
            <SendMessageForm
              options={data.targetOptions}
              initialTarget={sendTarget}
              onSent={() => {
                setShowSendForm(false);
                data.refresh();
              }}
              onCancel={() => setShowSendForm(false)}
            />
          )}

          <OverviewPanel
            channelCards={data.channelCards}
            liveConversations={data.liveConversations}
            emailMessages={data.emailMessages}
            emailProvider={data.primaryEmailProvider}
            emailLoading={!!data.primaryEmailProvider && data.emailInbox.isLoading && !data.emailInbox.data}
            emailError={data.emailProvidersFailed ? data.emailConfiguration.error : data.emailInbox.error}
            emailProvidersFailed={data.emailProvidersFailed}
            emailProvidersLoading={data.emailProvidersLoading}
            messagingAgents={data.messagingAgents}
            servicesConnected={data.services.length}
            botsCount={data.botList.length}
            providersCount={data.providers.length}
            onOpenConversation={id => void data.navigate(`/agent/${id}`)}
            onQuickSend={() => openSendForm(undefined)}
            canSend={data.canSend}
            connectedServices={data.connectedServiceNames}
            onOpenEmail={() => void data.navigate("/email")}
            onOpenEmailMessage={message =>
              void data.navigate(data.primaryEmailProvider ? messagePath(data.primaryEmailProvider, "inbox", message.id) : "/email")
            }
            onOpenBots={() => void data.navigate("/bots")}
            onOpenAgent={id => void data.navigate(`/agent/${id}`)}
            onLaunchAgent={agentType => void data.launchMessagingAgent(agentType)}
            onRetryEmail={data.refreshEmail}
            creatingAgent={data.creatingAgent}
            messagingAgentType={data.messagingAgentType}
            messagingAgentTypes={MESSAGING_AGENT_TYPES}
            agentTypeOptions={data.agentTypeOptions}
            agentTypesLoaded={data.agentTypesLoaded}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <QuickLink
              title="Email inbox"
              description="Browse, search, and reply with AI"
              icon={<Mail className="w-4 h-4" />}
              gradient="from-red-500 to-rose-600"
              onClick={() => void data.navigate("/email")}
            />
            <QuickLink
              title="Bots"
              description="Connect Slack or Telegram; channels, people, and live threads"
              icon={<Bot className="w-4 h-4" />}
              gradient="from-teal-500 to-emerald-600"
              onClick={() => void data.navigate("/bots")}
            />
            <QuickLink
              title="Configuration"
              description="Add an email provider"
              icon={<Send className="w-4 h-4" />}
              gradient="from-slate-500 to-zinc-600"
              onClick={() => void data.navigate("/configuration")}
            />
          </div>
        </>
      )}
    </ViewShell>
  );
}
