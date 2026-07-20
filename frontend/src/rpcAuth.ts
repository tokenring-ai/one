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
