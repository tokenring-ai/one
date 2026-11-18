import { resetWsRPCConnections, type WsRPCClientAuth } from "@tokenring-ai/web-host/createWsRPCClient";

const USERNAME_KEY = "tokenring.rpc.username";

/**
 * The password is intentionally kept in memory only. Persisting it in
 * sessionStorage would leave the backend password in plaintext where any XSS
 * on this origin could read it.
 *
 * Reloads survive instead on the HttpOnly session cookie minted by
 * `primeRpcSession()`: the browser holds a revocable, expiring id it cannot
 * read from script, and the server maps that back to the username when the
 * RPC socket connects. The username is not a secret and is persisted so the
 * login form can prefill it.
 */
let memoryPassword = "";
/** Mirror of the stored username so sign-in still works when sessionStorage is blocked. */
let memoryUsername = "";

/**
 * Set by a password sign-in (`setRpcAuth`) and consumed by the first successful
 * `primeRpcSession()`. The socket reports auth success after every reconnect
 * while the password is still in memory; without this flag each reconnect
 * would mint another server session while the earlier ids stay valid until TTL.
 */
let sessionPrimePending = false;

/** Who the server last signed this tab in as (password or session cookie); null when signed out. */
let signedInUsername: string | null = null;
const signedInListeners = new Set<() => void>();
const signedOutListeners = new Set<() => void>();

function setSignedInUsername(next: string | null): void {
  if (signedInUsername === next) return;
  signedInUsername = next;
  for (const listener of signedInListeners) listener();
}

/** Snapshot for `useSyncExternalStore`: the signed-in username, or null. */
export function getSignedInUsername(): string | null {
  return signedInUsername;
}

export function subscribeSignedInUsername(listener: () => void): () => void {
  signedInListeners.add(listener);
  return () => {
    signedInListeners.delete(listener);
  };
}

/** Notified after `signOut()` completes, so the login UI can show itself at once. */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
}

function readStoredUsername(): string {
  try {
    return sessionStorage.getItem(USERNAME_KEY) ?? "";
  } catch {
    // SecurityError (storage blocked): fall back to no stored username rather than breaking auth.
    return "";
  }
}

/**
 * Live credentials object passed into createWsRPCClient.
 * Values are read at auth time so login can update them without recreating
 * every RPC client.
 */
export const rpcAuth: WsRPCClientAuth = {
  get username() {
    return readStoredUsername() || memoryUsername;
  },
  get password() {
    return memoryPassword;
  },
};

export function setRpcAuth(auth: WsRPCClientAuth): void {
  memoryUsername = auth.username;
  try {
    sessionStorage.setItem(USERNAME_KEY, auth.username);
  } catch {
    // Non-fatal: private mode / quota; the username is only used to prefill the login form.
  }
  memoryPassword = auth.password;
  sessionPrimePending = true;
}

/** Records the username the server signed us in as (a cookie session is the only source of it). */
export function setRpcAuthUsername(username: string): void {
  if (!username) return;
  memoryUsername = username;
  setSignedInUsername(username);
  try {
    sessionStorage.setItem(USERNAME_KEY, username);
  } catch {
    // Non-fatal: private mode / quota; the username is only used to prefill the login form.
  }
}

export function clearRpcAuth(): void {
  try {
    sessionStorage.removeItem(USERNAME_KEY);
  } catch {
    // Storage blocked: nothing was persisted, so there is nothing to remove.
  }
  memoryUsername = "";
  memoryPassword = "";
  sessionPrimePending = false;
  setSignedInUsername(null);
}

/**
 * Exchanges the in-memory password for an HttpOnly session cookie, so the next
 * page load can re-authenticate the RPC socket without a password. Mints at
 * most one session per password sign-in: later calls (socket reconnects) are
 * no-ops until `setRpcAuth` runs again. A cookie-based sign-in already has one.
 */
export async function primeRpcSession(): Promise<void> {
  if (!sessionPrimePending || !hasRpcAuth()) return;
  // Consume up front so overlapping calls cannot mint twice; re-arm on failure.
  sessionPrimePending = false;
  try {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: rpcAuthHeaders(),
      credentials: "include",
    });
    if (!response.ok) sessionPrimePending = true;
  } catch {
    // Non-fatal: the session is a convenience, the socket is already authenticated.
    sessionPrimePending = true;
  }
}

export type PasswordCheck = "valid" | "invalid" | "throttled" | "unreachable";

/**
 * Checks the password just entered (`setRpcAuth`) with the server directly,
 * instead of waiting for a queued RPC to retry it: after a sign-out, or before
 * any call has been refused, nothing may be waiting, so the login form would
 * otherwise never hear back. The same request mints this sign-in's session
 * cookie, so a valid answer leaves `primeRpcSession()` nothing to do.
 */
export async function checkPasswordSignIn(): Promise<PasswordCheck> {
  if (!hasRpcAuth()) return "invalid";
  sessionPrimePending = false;
  try {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: rpcAuthHeaders(),
      credentials: "include",
    });
    if (response.ok) return "valid";
    if (response.status === 401) return "invalid";
    if (response.status === 429) return "throttled";
  } catch {
    // Network failure: fall through to "unreachable".
  }
  // No verdict: leave the session to be minted after the socket signs in.
  sessionPrimePending = true;
  return "unreachable";
}

/** Signs out everywhere: revokes the server session and clears the cookie. */
export async function clearRpcSession(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
  } catch {
    // Non-fatal: local credentials are cleared regardless.
  }
  clearRpcAuth();
}

export function hasRpcAuth(): boolean {
  return Boolean(rpcAuth.username && rpcAuth.password);
}

/** Authorization headers for authenticated HTTP calls (filesystem static serving, etc.). */
export function rpcAuthHeaders(): HeadersInit {
  if (!hasRpcAuth()) return {};
  const token = btoa(`${rpcAuth.username}:${rpcAuth.password}`);
  return { Authorization: `Basic ${token}` };
}

/**
 * Signs this browser out: revokes the server session and its cookie (which also
 * ends `/api/fs` media access), drops the local credentials, and closes the
 * shared RPC socket so it no longer carries the old login. The replacement socket has neither password nor cookie, so
 * the next RPC reaches the login overlay; listeners show it immediately.
 */
export async function signOut(): Promise<void> {
  await clearRpcSession();
  resetWsRPCConnections();
  for (const listener of signedOutListeners) listener();
}
