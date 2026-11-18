import formatError from "@tokenring-ai/utility/error/formatError";
import { Rocket } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { usePaneLink } from "../../layout/hooks.ts";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, useAgentTypes } from "../../rpc.ts";
import { MARKETPLACE_PATH, NEW_AGENT_PATH } from "../agents/shared.tsx";
import { CHAT_VIEW } from "../chat/ids.ts";

/** One-click launch of any installed agent type; the new chat opens on Home. */
export default function QuickLaunchView() {
  const types = useAgentTypes();
  const openPane = usePaneLink();
  const navigate = useNavigate();
  const [launching, setLaunching] = useState<string | null>(null);

  if (types.isLoading) return <LoadingState size="sm" className="h-full" />;
  if (types.error) return <ErrorState error={types.error} onRetry={() => void types.mutate()} title="Unable to load agent types" variant="page" />;
  const list = types.data ?? [];
  if (list.length === 0) {
    return (
      <EmptyState
        icon={Rocket}
        title="No agent types"
        hint="Install or create an agent type to launch agents."
        ctaLabel="New agent"
        onCta={() => void navigate(NEW_AGENT_PATH)}
        action={
          <Link to={MARKETPLACE_PATH} className="mt-2 inline-block text-xs text-accent-soft hover:underline focus-ring rounded">
            Browse marketplace
          </Link>
        }
        variant="page"
      />
    );
  }

  const launch = async (type: string) => {
    setLaunching(type);
    try {
      const { id } = await agentRPCClient.createAgent({ agentType: type });
      openPane(CHAT_VIEW, { agentId: id });
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setLaunching(null);
    }
  };

  return (
    <ViewShell pad="compact">
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 content-start" aria-label="Launch an agent">
        {list.map(type => (
          <li key={type.type}>
            <button
              type="button"
              disabled={launching !== null}
              onClick={() => void launch(type.type)}
              className={cn(
                "w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border border-primary bg-secondary text-left hover:border-accent/50 hover:bg-hover focus-ring disabled:opacity-60",
                launching === type.type && "border-accent",
              )}
              aria-label={`Launch ${type.displayName}`}
            >
              <Rocket className={cn("mt-0.5 w-3.5 h-3.5 shrink-0", launching === type.type ? "text-accent animate-pulse" : "text-muted")} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-primary truncate">{type.displayName}</span>
                <span className="block text-[11px] text-muted line-clamp-2">{type.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ViewShell>
  );
}
