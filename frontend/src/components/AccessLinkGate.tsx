import { type ReactNode, useEffect, useState } from "react";
import { REDEEM_MESSAGES, type RedeemFailure, type RedeemOutcome } from "../lib/accessLink.ts";
import { clearRpcAuth } from "../rpcAuth.ts";

export interface AccessLinkGateProps {
  /** The in-flight redemption from `accessLinkBoot`, or null when the page was not opened from an access link. */
  redeem: Promise<RedeemOutcome> | null;
  children: ReactNode;
  /** Injected by tests; reloads the page by default. */
  reload?: () => void;
}

/**
 * Holds the app back while an access link is being redeemed. On success the page reloads at the same path: the new
 * session cookie is then in place for the WebSocket handshake, and nothing loaded for a previous user (cached lists,
 * an open socket, remembered sign-in) survives into the new one. On failure the app opens normally, with its own
 * sign-in form, under a plain explanation.
 */
export default function AccessLinkGate({ redeem, children, reload = () => window.location.reload() }: AccessLinkGateProps) {
  const [failure, setFailure] = useState<RedeemFailure["status"] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(redeem !== null);

  useEffect(() => {
    if (!redeem) return;
    let cancelled = false;
    void redeem.then(outcome => {
      if (cancelled) return;
      if (outcome.status === "signedIn") {
        // Forget who this tab was signed in as; the cookie the server just set decides who it is now.
        clearRpcAuth();
        reload();
        return;
      }
      setFailure(outcome.status);
      setPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [redeem, reload]);

  if (pending) {
    return (
      <div role="status" aria-live="polite" className="flex h-dvh items-center justify-center bg-primary text-primary">
        <p className="text-sm">Signing you in…</p>
      </div>
    );
  }

  return (
    <>
      {failure && !dismissed && (
        <div role="alert" className="fixed inset-x-0 top-0 z-[300] flex items-start gap-3 border-b border-line bg-raised px-4 py-3 text-sm text-fg">
          <p className="min-w-0 flex-1">{REDEEM_MESSAGES[failure]}</p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded-md px-2 py-1 text-muted hover:bg-hover focus-ring cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </>
  );
}
