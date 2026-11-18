import { RefreshCw } from "lucide-react";
import ChannelStatusCard from "../../components/ui/ChannelStatusCard.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useMessagingData } from "../../features/messaging/useMessagingData.ts";
import { cn } from "../../lib/utils.ts";

/** Every messaging service and email provider, connected or not. */
export default function MessagingChannelsView() {
  const data = useMessagingData();

  return (
    <ViewShell
      pad="compact"
      bodyClassName="grid gap-3 sm:grid-cols-2 content-start"
      header={
        <ViewHeader
          variant="navigator"
          middle={`${data.connectedCount} connected`}
          actions={[
            { icon: <RefreshCw className={cn("w-3.5 h-3.5", data.bots.isValidating && "animate-spin")} />, label: "Refresh channels", onClick: data.refresh },
          ]}
        />
      }
    >
      {data.isLoading ? (
        <LoadingState message="Loading channels…" className="py-10" />
      ) : data.botsFailed ? (
        <ErrorState title="Unable to load channels" error={data.loading.hardError} onRetry={data.refresh} variant="page" />
      ) : (
        <>
          {data.emailProvidersFailed ? (
            <ErrorState
              className="sm:col-span-2"
              title="Could not load email providers"
              error={data.emailConfiguration.error ?? "Unknown error"}
              onRetry={data.refreshEmail}
            />
          ) : null}
          {data.channelCards.map(card => (
            <ChannelStatusCard
              key={card.id}
              id={card.id}
              name={card.name}
              kind={card.kind}
              connected={card.connected}
              detail={card.detail}
              onOpen={() => void data.navigate(card.href)}
            />
          ))}
        </>
      )}
    </ViewShell>
  );
}
