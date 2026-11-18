import type { EmailMessage } from "@tokenring-ai/email";
import { Plug, PlugZap } from "lucide-react";
import StatusBadge from "../../components/ui/StatusBadge.tsx";
import { getServiceBrand } from "../../lib/serviceGradient.ts";
import { cn } from "../../lib/utils.ts";
import type { useBots } from "../../rpc.ts";

/**
 * Types and small presentational bits shared by the Messaging views.
 *
 * Each tab is now its own dock panel, so the derivations they all read live in
 * {@link ./useMessagingData.ts} rather than in a common parent.
 */

export type BotsData = NonNullable<ReturnType<typeof useBots>["data"]>;
export type BotSummary = BotsData["bots"][number];
export type BotConversation = BotSummary["conversations"][number];
export type BotChannel = BotSummary["channels"][number];

export type LiveConversation = BotConversation & {
  botName: string;
  botDisplayName: string;
};

export type ChannelCard = {
  id: string;
  name: string;
  kind: "messaging" | "email";
  connected: boolean;
  detail: string;
  href: string;
};

export function ServicePill({ service, connected }: { service: string; connected: boolean }) {
  const brand = getServiceBrand(service);
  const label = brand.displayName;
  return (
    <StatusBadge
      label={label}
      icon={connected ? <PlugZap className="w-3 h-3" /> : <Plug className="w-3 h-3" />}
      colorClass={connected ? cn(brand.solidBg, brand.solidText, brand.solidBorder) : "bg-tertiary text-muted border-primary"}
      title={connected ? `${label} is connected` : `${label} is not connected`}
    />
  );
}

export function senderName(msg: EmailMessage): string {
  return msg.from.name || msg.from.email;
}
