import { getRpcConnectionState, type RpcConnectionState, subscribeRpcConnection } from "@tokenring-ai/web-host/createWsRPCClient";

/** Where the shared RPC socket's health is read from; injectable for tests. */
export interface RpcConnectionSource {
  getState: () => RpcConnectionState;
  subscribe: (listener: (state: RpcConnectionState) => void) => () => void;
}

const sharedConnection: RpcConnectionSource = { getState: getRpcConnectionState, subscribe: subscribeRpcConnection };

/** The outcome of an RPC whose delivery matters (a mutation that must not run twice). */
export type DeliveryResult<T> = { ok: true; value: T } | { ok: false; error: unknown; mayHaveBeenSent: boolean };

/**
 * Runs an RPC and, if it fails, says whether the request could have reached the server.
 *
 * The WS client only writes a request to an open socket, and the socket reports "connected"
 * as it opens. So if the connection was never "connected" at any moment during the call,
 * the request was definitely never sent and is safe to send again. Otherwise it may have
 * been sent with only the response lost (the socket closed under it), and resending could
 * run it twice. The check errs towards "may have been sent".
 */
export async function trackDelivery<T>(call: () => Promise<T>, connection: RpcConnectionSource = sharedConnection): Promise<DeliveryResult<T>> {
  let connected = connection.getState() === "connected";
  const unsubscribe = connection.subscribe(state => {
    if (state === "connected") connected = true;
  });
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    return { ok: false, error, mayHaveBeenSent: connected };
  } finally {
    unsubscribe();
  }
}
