import { AlertTriangle, Plus, Store } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils.ts";

/** Where the user can get an agent type that is not installed. */
export const NEW_AGENT_TYPE_PATH = "/agents/new";
export const AGENT_MARKETPLACE_PATH = "/marketplace/agent";

const linkClass =
  "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-primary rounded-md text-secondary hover:text-primary hover:bg-hover focus-ring transition-colors";

/**
 * Explains that an app's preferred agent type is not configured, instead of
 * silently falling back to an unrelated agent (or failing on launch), and
 * points at the two ways to get one: create it, or install it from the
 * marketplace.
 */
export default function MissingAgentTypeNotice({
  agentType,
  feature,
  children,
  className,
}: {
  /** The agent type id(s) the feature needs, e.g. `writer`. */
  agentType: string | readonly string[];
  /** What is unavailable, e.g. "AI editing". */
  feature: string;
  /** Extra content under the explanation (such as a type picker). */
  children?: ReactNode;
  className?: string;
}) {
  const types = typeof agentType === "string" ? [agentType] : agentType;
  const typeList = types.map(type => `“${type}”`).join(" or ");
  return (
    <div role="status" className={cn("rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-left space-y-2", className)}>
      <p className="flex items-start gap-1.5 text-xs text-secondary leading-relaxed">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
        <span>
          {feature} needs a {typeList} agent type, which is not configured. Create one, or install one from the agent marketplace.
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to={NEW_AGENT_TYPE_PATH} className={linkClass}>
          <Plus className="w-3 h-3" aria-hidden="true" /> New agent
        </Link>
        <Link to={AGENT_MARKETPLACE_PATH} className={linkClass}>
          <Store className="w-3 h-3" aria-hidden="true" /> Browse marketplace
        </Link>
      </div>
      {children}
    </div>
  );
}
