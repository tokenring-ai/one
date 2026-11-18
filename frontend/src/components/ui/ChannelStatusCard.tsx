import { ArrowRight } from "lucide-react";
import { getServiceBrand } from "../../lib/serviceGradient.ts";
import { cn } from "../../lib/utils.ts";
import StatusBadge from "./StatusBadge.tsx";

export type ChannelStatusKind = "messaging" | "email";

export interface ChannelStatusCardProps {
  /** Unique identifier for the card */
  id: string;
  /** Display name of the service or channel */
  name: string;
  /** Kind of service (determines icon) */
  kind: ChannelStatusKind;
  /** Whether the service is currently connected */
  connected: boolean;
  /** Detail text shown below the name */
  detail: string;
  /** Click handler */
  onOpen: () => void;
  /** Renders a more compact version */
  compact?: boolean;
  /** Override the gradient (defaults to service brand based on kind/name) */
  gradient?: string;
  className?: string;
  "data-testid"?: string;
}

/**
 * Card that displays a messaging service or channel with a gradient icon badge,
 * connection status badge (Connected/Offline), and a detail line.
 */
export default function ChannelStatusCard({
  id,
  name,
  kind,
  connected,
  detail,
  onOpen,
  compact = false,
  gradient: gradientOverride,
  className,
  "data-testid": testId,
}: ChannelStatusCardProps) {
  // Email kind always uses the email brand; messaging resolves by service name.
  const brand = kind === "email" ? getServiceBrand("email") : getServiceBrand(name);
  const gradient = gradientOverride ?? brand.gradient;
  const Icon = brand.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-channel-id={id}
      className={cn(
        "flex items-center gap-3 bg-primary border border-primary rounded-xl text-left hover:bg-hover/40 transition-colors focus-ring cursor-pointer shadow-sm",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        className,
      )}
      data-testid={testId}
    >
      <div className={cn("rounded-lg bg-linear-to-br flex items-center justify-center shrink-0", compact ? "w-8 h-8" : "w-9 h-9", gradient)}>
        <Icon className="w-4 h-4 text-white" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-primary truncate">{name}</p>
          <StatusBadge
            label={connected ? "Connected" : "Offline"}
            colorClass={connected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-tertiary text-muted border-primary"}
            className="px-1.5"
          />
        </div>
        <p className="text-xs text-muted truncate mt-0.5">{detail}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
    </button>
  );
}
