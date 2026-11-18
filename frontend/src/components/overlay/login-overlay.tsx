import { type RPCError, setWsRPCAuthHandler } from "@tokenring-ai/web-host/createWsRPCClient";
import { FocusTrap } from "focus-trap-react";
import { Lock } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { checkPasswordSignIn, hasRpcAuth, onSignedOut, primeRpcSession, rpcAuth, setRpcAuth, setRpcAuthUsername } from "../../rpcAuth.ts";
import PasswordInput from "../ui/PasswordInput.tsx";

/**
 * Full-page login overlay shown whenever the RPC client fails to authenticate
 * (missing, wrong, or changed credentials). Pending RPC calls stay queued
 * while the overlay is up and resume after a successful login, so the user
 * never leaves the page they are on.
 *
 * A reload usually does not reach this overlay at all: the socket
 * re-authenticates from the HttpOnly session cookie, and this only appears
 * once that cookie is missing or expired.
 */
export default function LoginOverlay() {
  const [visible, setVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const resolversRef = useRef<Array<() => void>>([]);
  const submittingRef = useRef(false);
  /** Watchdog for the in-flight attempt; one at a time so a stale timer cannot fail a newer attempt. */
  const attemptTimerRef = useRef<number | null>(null);
  /** Bumped per submit, so a late password check cannot settle a newer attempt. */
  const attemptIdRef = useRef(0);

  const clearAttemptTimer = () => {
    if (attemptTimerRef.current !== null) {
      window.clearTimeout(attemptTimerRef.current);
      attemptTimerRef.current = null;
    }
  };

  const setSubmittingState = (value: boolean) => {
    submittingRef.current = value;
    setSubmitting(value);
  };

  useEffect(() => {
    setWsRPCAuthHandler({
      onAuthRequired: (error: RPCError) =>
        new Promise<void>(resolve => {
          resolversRef.current.push(resolve);
          // A refusal of a request sent before the user submitted: the password
          // check in flight decides the outcome and will release this retry.
          if (submittingRef.current && attemptTimerRef.current === null) return;
          clearAttemptTimer();
          // On first visit there are no stored credentials yet — show a plain
          // sign-in prompt instead of an "invalid password" error.
          setErrorMessage(hasRpcAuth() ? error.message : null);
          setUsername(current => current || rpcAuth.username);
          setSubmittingState(false);
          setVisible(true);
        }),
      onAuthSuccess: (signedInAs: string) => {
        clearAttemptTimer();
        setVisible(false);
        setSubmittingState(false);
        setErrorMessage(null);
        setPassword("");
        // After a cookie sign-in the server is the only source of the username.
        setRpcAuthUsername(signedInAs);
        // Session cookie so the next page load (and /api/fs media) authenticates without a password.
        // No-op after reconnects: rpcAuth mints one session per password sign-in.
        void primeRpcSession();
      },
    });
    // An explicit sign-out shows the form at once instead of waiting for the
    // next RPC to be refused.
    const stopSignedOut = onSignedOut(() => {
      clearAttemptTimer();
      setErrorMessage(null);
      setSubmittingState(false);
      setPassword("");
      setVisible(true);
    });
    return () => {
      setWsRPCAuthHandler(null);
      stopSignedOut();
      clearAttemptTimer();
    };
    // clearAttemptTimer only touches a ref; it is stable in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (submitting || !username.trim()) return;
    setSubmittingState(true);
    setErrorMessage(null);
    setRpcAuth({ username: username.trim(), password });
    clearAttemptTimer();
    const attemptId = ++attemptIdRef.current;
    const releaseQueuedRetries = () => {
      const resolvers = resolversRef.current;
      resolversRef.current = [];
      for (const resolve of resolvers) resolve();
    };

    // Ask the server directly rather than relying on a queued RPC to retry the
    // password: after a sign-out, or before any call was refused, nothing is
    // waiting, and the form would never hear back.
    void checkPasswordSignIn().then(result => {
      if (attemptIdRef.current !== attemptId || !submittingRef.current) return;
      if (result === "valid") {
        setRpcAuthUsername(rpcAuth.username);
        setVisible(false);
        setSubmittingState(false);
        setPassword("");
        releaseQueuedRetries();
        return;
      }
      if (result === "invalid" || result === "throttled") {
        // Queued requests keep waiting for the next attempt instead of
        // retrying (and counting against the rate limit) with a bad password.
        setSubmittingState(false);
        setErrorMessage(result === "invalid" ? "Invalid username or password." : "Too many failed sign-in attempts. Try again later.");
        return;
      }
      // No verdict from the server: let the queued RPCs try the password. They
      // either sign in (onAuthSuccess) or are refused (onAuthRequired); if
      // neither happens, un-stick the form instead of sitting on "Signing in…".
      releaseQueuedRetries();
      const timer = window.setTimeout(() => {
        if (attemptTimerRef.current !== timer) return;
        attemptTimerRef.current = null;
        if (submittingRef.current) {
          setSubmittingState(false);
          setErrorMessage("Sign-in could not be completed. Check your connection and try again.");
        }
      }, 8000);
      attemptTimerRef.current = timer;
    });
  };

  return (
    <FocusTrap>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-overlay-title"
      >
        <form onSubmit={handleSubmit} className="bg-secondary border border-primary rounded-lg shadow-xl max-w-sm w-full">
          <div className="flex items-center gap-3 p-4 border-b border-primary">
            <div className="p-2 bg-tertiary rounded-lg">
              <Lock className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 id="login-overlay-title" className="text-lg font-semibold text-primary">
                Sign in
              </h3>
              <p className="text-xs text-muted">Authentication is required to continue.</p>
            </div>
          </div>
          <div className="px-4 py-4 space-y-3">
            {errorMessage && (
              <div role="alert" className="px-3 py-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md">
                {errorMessage}
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-secondary">Username</span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                className="w-full bg-input border border-control rounded-lg py-1.5 px-3 text-sm text-primary placeholder-muted focus-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-secondary">Password</span>
              <PasswordInput autoComplete="current-password" value={password} onChange={setPassword} inputClassName="text-sm font-sans py-1.5" />
            </label>
          </div>
          <div className="px-4 pb-4">
            <button
              type="submit"
              disabled={submitting || !username.trim()}
              className="w-full px-4 py-2 btn-accent rounded-md shadow-lg shadow-button-primary transition-colors active:scale-[0.98] focus-ring disabled:opacity-60 disabled:pointer-events-none"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </FocusTrap>
  );
}
