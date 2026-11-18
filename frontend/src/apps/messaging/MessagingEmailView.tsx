import { messagePath } from "@tokenring-ai/email/frontend/lib/paths.ts";
import { RefreshCw } from "lucide-react";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import EmailPanel from "../../features/messaging/EmailPanel.tsx";
import { useMessagingData } from "../../features/messaging/useMessagingData.ts";
import { cn } from "../../lib/utils.ts";

/** The primary email provider's inbox, in summary. */
export default function MessagingEmailView() {
  const data = useMessagingData();

  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader
          variant="navigator"
          middle={data.emailMessages.length > 0 ? data.emailMessages.length : undefined}
          actions={[
            {
              icon: <RefreshCw className={cn("w-3.5 h-3.5", data.emailInbox.isValidating && "animate-spin")} />,
              label: "Refresh email",
              onClick: data.refreshEmail,
            },
          ]}
        />
      }
    >
      <div className="h-full overflow-y-auto">
        <EmailPanel
          provider={data.primaryEmailProvider}
          providers={data.providers}
          messages={data.emailMessages}
          loading={data.emailProvidersLoading || (!!data.primaryEmailProvider && data.emailInbox.isLoading && !data.emailInbox.data)}
          providersError={data.emailProvidersFailed ? data.emailConfiguration.error : undefined}
          error={data.emailInbox.error}
          onOpenEmail={() => void data.navigate("/email")}
          onOpenMessage={message => void data.navigate(data.primaryEmailProvider ? messagePath(data.primaryEmailProvider, "inbox", message.id) : "/email")}
          onOpenConfig={() => void data.navigate("/configuration")}
          onRetry={data.refreshEmail}
        />
      </div>
    </ViewShell>
  );
}
