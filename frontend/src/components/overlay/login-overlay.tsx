import { type RPCError, setWsRPCAuthHandler } from "@tokenring-ai/web-host/createWsRPCClient";
import { FocusTrap } from "focus-trap-react";
import { Lock } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { hasRpcAuth, rpcAuth, setRpcAuth } from "../../rpcAuth.ts";

/**
 * Full-page login overlay shown whenever the RPC client fails to authenticate
 * (missing, wrong, or changed credentials). Pending RPC calls stay queued
 * while the overlay is up and resume after a successful login, so the user
 * never leaves the page they are on.
 */
export default function LoginOverlay() {
  const [visible, setVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const resolversRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    setWsRPCAuthHandler({
      onAuthRequired: (error: RPCError) =>
        new Promise<void>(resolve => {
          resolversRef.current.push(resolve);
          // On first visit there are no stored credentials yet — show a plain
          // sign-in prompt instead of an "invalid password" error.
          setErrorMessage(hasRpcAuth() ? error.message : null);
          setUsername(current => current || rpcAuth.username);
          setSubmitting(false);
          setVisible(true);
        }),
      onAuthSuccess: () => {
        setVisible(false);
        setSubmitting(false);
        setErrorMessage(null);
        setPassword("");
      },
    });
    return () => setWsRPCAuthHandler(null);
  }, []);

  if (!visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !username.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    setRpcAuth({ username: username.trim(), password });
    const resolvers = resolversRef.current;
    resolversRef.current = [];
    for (const resolve of resolvers) resolve();
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
                className="w-full bg-input border border-primary rounded-lg py-1.5 px-3 text-sm text-primary placeholder-muted focus-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-secondary">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-input border border-primary rounded-lg py-1.5 px-3 text-sm text-primary placeholder-muted focus-accent"
              />
            </label>
          </div>
          <div className="px-4 pb-4">
            <button
              type="submit"
              disabled={submitting || !username.trim()}
              className="w-full px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-md shadow-lg shadow-button-primary transition-colors active:scale-[0.98] focus-ring disabled:opacity-60 disabled:pointer-events-none"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </FocusTrap>
  );
}
