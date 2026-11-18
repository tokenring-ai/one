import { aboutCost } from "@tokenring-ai/ai-client/util/estimatedCost";
import type { CostEstimateState } from "../../hooks/useCostEstimate.ts";

/**
 * Small muted price line for a Generate control. Shows the estimate, "price not available" when the model has
 * no price, a placeholder while checking, and nothing at all if the check failed (never a made-up number).
 */
export default function EstimatedCost({ estimate, className = "" }: { estimate: CostEstimateState; className?: string }) {
  if (estimate.status === "idle" || estimate.status === "error") return null;
  const text = estimate.status === "loading" ? "Estimating price…" : estimate.status === "unavailable" ? "price not available" : aboutCost(estimate.amountUsd);
  if (!text) return null;
  return (
    <p className={`text-xs text-muted text-center ${className}`} data-testid="estimated-cost" aria-live="polite">
      {text}
    </p>
  );
}
