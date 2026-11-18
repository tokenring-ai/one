import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  checkPasswordSignIn,
  clearRpcAuth,
  clearRpcSession,
  hasRpcAuth,
  primeRpcSession,
  rpcAuth,
  rpcAuthHeaders,
  setRpcAuth,
  setRpcAuthUsername,
} from "./rpcAuth.ts";

/**
 * The password must never reach storage; reloads survive on the HttpOnly
 * session cookie minted by `primeRpcSession` instead.
 */

const USERNAME_KEY = "tokenring.rpc.username";

let fetchMock: ReturnType<typeof mock>;
const realFetch = globalThis.fetch;

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit];
}

/** Every key and value a Storage holds. Storage is not spreadable, so read it through its own API. */
function dumpStorage(storage: Storage): string {
  const entries: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key !== null) entries.push(`${key}=${storage.getItem(key) ?? ""}`);
  }
  return entries.join("\n");
}

beforeEach(() => {
  sessionStorage.clear();
  clearRpcAuth();
  fetchMock = mock(async () => new Response(null, { status: 200 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  sessionStorage.clear();
  clearRpcAuth();
});

describe("credential storage", () => {
  it("persists the username but keeps the password in memory only", () => {
    setRpcAuth({ username: "mark", password: "s3cret" });

    expect(sessionStorage.getItem(USERNAME_KEY)).toBe("mark");
    expect(rpcAuth.username).toBe("mark");
    expect(rpcAuth.password).toBe("s3cret");

    // The password must not be recoverable from any web storage.
    expect(dumpStorage(sessionStorage)).not.toContain("s3cret");
    expect(dumpStorage(localStorage)).not.toContain("s3cret");
  });

  it("records a username the server reported, and ignores an empty one", () => {
    setRpcAuthUsername("from-session");
    expect(sessionStorage.getItem(USERNAME_KEY)).toBe("from-session");

    setRpcAuthUsername("");
    expect(sessionStorage.getItem(USERNAME_KEY)).toBe("from-session");
  });

  it("reports complete credentials only when both halves are present", () => {
    expect(hasRpcAuth()).toBe(false);
    setRpcAuthUsername("mark");
    // A username recovered from a session is not enough to re-authenticate by password.
    expect(hasRpcAuth()).toBe(false);
    setRpcAuth({ username: "mark", password: "s3cret" });
    expect(hasRpcAuth()).toBe(true);
  });

  it("builds a Basic authorization header, and none without credentials", () => {
    expect(rpcAuthHeaders()).toEqual({});
    setRpcAuth({ username: "mark", password: "s3cret" });
    expect(rpcAuthHeaders()).toEqual({ Authorization: `Basic ${btoa("mark:s3cret")}` });
  });
});

describe("primeRpcSession", () => {
  it("exchanges the password for a cookie, sending credentials and accepting the cookie", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });

    await primeRpcSession();

    const [url, init] = lastCall();
    expect(url).toBe("/api/auth/session");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual({ Authorization: `Basic ${btoa("mark:s3cret")}` });
  });

  it("does nothing without a password, so a cookie sign-in does not re-mint", async () => {
    setRpcAuthUsername("mark");

    await primeRpcSession();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("survives a failing request, since the socket is already authenticated", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });
    fetchMock = mock(async () => {
      throw new Error("offline");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(primeRpcSession()).resolves.toBeUndefined();
  });

  it("mints one session per password sign-in, not one per socket reconnect", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });

    // onAuthSuccess fires after the sign-in and again after every reconnect.
    await primeRpcSession();
    await primeRpcSession();
    await primeRpcSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A fresh password sign-in earns a fresh session.
    setRpcAuth({ username: "mark", password: "s3cret" });
    await primeRpcSession();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not mint twice when reconnects overlap an in-flight prime", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });
    await Promise.all([primeRpcSession(), primeRpcSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on the next success when the first prime failed", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });
    globalThis.fetch = mock(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await primeRpcSession();

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await primeRpcSession();
    await primeRpcSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("checkPasswordSignIn", () => {
  const respond = (status: number) => {
    globalThis.fetch = mock(async () => new Response(null, { status })) as unknown as typeof fetch;
  };

  it("maps the server's answer to a verdict", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });
    respond(200);
    expect(await checkPasswordSignIn()).toBe("valid");
    respond(401);
    expect(await checkPasswordSignIn()).toBe("invalid");
    respond(429);
    expect(await checkPasswordSignIn()).toBe("throttled");
    respond(503);
    expect(await checkPasswordSignIn()).toBe("unreachable");
    globalThis.fetch = mock(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect(await checkPasswordSignIn()).toBe("unreachable");
  });

  it("is invalid without a password and sends nothing", async () => {
    expect(await checkPasswordSignIn()).toBe("invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mints the session itself, so priming after a valid check sends nothing more", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });
    expect(await checkPasswordSignIn()).toBe("valid");
    await primeRpcSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastCall()[1].headers).toEqual(rpcAuthHeaders());
  });

  it("leaves the session to be minted later when the server could not answer", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });
    globalThis.fetch = mock(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect(await checkPasswordSignIn()).toBe("unreachable");
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await primeRpcSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("blocked sessionStorage", () => {
  const realStorage = globalThis.sessionStorage;
  const throwing = {
    getItem() {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem() {
      throw new DOMException("blocked", "SecurityError");
    },
    removeItem() {
      throw new DOMException("blocked", "SecurityError");
    },
    clear() {},
    key: () => null,
    length: 0,
  } as unknown as Storage;

  beforeEach(() => {
    Object.defineProperty(globalThis, "sessionStorage", { value: throwing, configurable: true, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "sessionStorage", { value: realStorage, configurable: true, writable: true });
  });

  it("still signs in, builds headers, and signs out when storage throws", () => {
    expect(() => sessionStorage.getItem(USERNAME_KEY)).toThrow();
    expect(rpcAuth.username).toBe("");
    setRpcAuth({ username: "mark", password: "s3cret" });
    expect(rpcAuth.username).toBe("mark");
    expect(hasRpcAuth()).toBe(true);
    expect(rpcAuthHeaders()).toEqual({ Authorization: `Basic ${btoa("mark:s3cret")}` });

    expect(() => clearRpcAuth()).not.toThrow();
    expect(hasRpcAuth()).toBe(false);
    expect(rpcAuth.username).toBe("");
  });
});

describe("clearRpcSession", () => {
  it("revokes the server session and drops local credentials", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });

    await clearRpcSession();

    const [url, init] = lastCall();
    expect(url).toBe("/api/auth/session");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("include");
    expect(hasRpcAuth()).toBe(false);
    expect(sessionStorage.getItem(USERNAME_KEY)).toBeNull();
  });

  it("still clears local credentials when the server cannot be reached", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });
    fetchMock = mock(async () => {
      throw new Error("offline");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await clearRpcSession();

    expect(hasRpcAuth()).toBe(false);
  });
});

describe("signed-in state", () => {
  it("tracks the server-reported user and forgets it on clear", async () => {
    const { getSignedInUsername, subscribeSignedInUsername } = await import("./rpcAuth.ts");
    let notified = 0;
    const stop = subscribeSignedInUsername(() => {
      notified += 1;
    });
    try {
      expect(getSignedInUsername()).toBeNull();
      setRpcAuthUsername("mark");
      expect(getSignedInUsername()).toBe("mark");
      clearRpcAuth();
      expect(getSignedInUsername()).toBeNull();
      expect(notified).toBe(2);
    } finally {
      stop();
    }
  });
});
