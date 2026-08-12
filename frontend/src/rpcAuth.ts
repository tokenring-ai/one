import type { WsRPCClientAuth } from "@tokenring-ai/web-host/createWsRPCClient";

const USERNAME_KEY = "tokenring.rpc.username";
const PASSWORD_KEY = "tokenring.rpc.password";

/**
 * Live credentials object passed into createWsRPCClient.
 * Values are read at auth time from sessionStorage so login can update them
 * without recreating every RPC client.
 */
export const rpcAuth: WsRPCClientAuth = {
  get username() {
    return sessionStorage.getItem(USERNAME_KEY) ?? "";
  },
  get password() {
    return sessionStorage.getItem(PASSWORD_KEY) ?? "";
  },
};

export function setRpcAuth(auth: WsRPCClientAuth): void {
  sessionStorage.setItem(USERNAME_KEY, auth.username);
  sessionStorage.setItem(PASSWORD_KEY, auth.password);
}

export function clearRpcAuth(): void {
  sessionStorage.removeItem(USERNAME_KEY);
  sessionStorage.removeItem(PASSWORD_KEY);
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
 * Establish an HttpOnly session cookie for `/api/fs/*` so `<img>`, `<video>`,
 * and iframe navigations can load workspace files without an Authorization header.
 */
export async function primeFilesystemHttpAuth(): Promise<void> {
  if (!hasRpcAuth()) return;
  try {
    await fetch("/api/fs/session", {
      method: "POST",
      headers: rpcAuthHeaders(),
      credentials: "include",
    });
  } catch {
    // Non-fatal: downloads can still use Authorization headers.
  }
}
