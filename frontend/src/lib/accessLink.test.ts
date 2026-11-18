import { describe, expect, it, spyOn } from "bun:test";
import { REDEEM_MESSAGES, startAccessLinkRedeem, takeAccessToken } from "./accessLink.ts";

const TOKEN = "3q2-7wG4n0x8Yk1b9hZpA5uR6tVdLmCsQe_JfXoIhNa";

/** A tiny stand-in for window: records the order of "replaceState" and "fetch" so the order can be asserted. */
function makeEnv(hash: string, pathname = "/documents/42", search = "?tab=1") {
  const events: string[] = [];
  const location = { hash, pathname, search };
  const history = {
    state: { keep: true },
    replaceState: (_state: unknown, _title: string, url?: string | URL | null) => {
      events.push("replaceState");
      const next = String(url);
      location.hash = next.includes("#") ? next.slice(next.indexOf("#")) : "";
    },
  };
  return { events, location, history };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("takeAccessToken", () => {
  it("removes the fragment, keeps path and query, and returns the token", () => {
    const env = makeEnv(`#access=${TOKEN}`);
    const calls: unknown[][] = [];
    env.history.replaceState = (...args: unknown[]) => {
      calls.push(args);
      env.location.hash = "";
    };
    expect(takeAccessToken(env)).toBe(TOKEN);
    expect(calls).toEqual([[{ keep: true }, "", "/documents/42?tab=1"]]);
    expect(env.location.hash).toBe("");
  });

  it("keeps unrelated fragment parameters", () => {
    const env = makeEnv(`#line=3&access=${TOKEN}`);
    let replaced = "";
    env.history.replaceState = (_s: unknown, _t: string, url?: string | URL | null) => {
      replaced = String(url);
    };
    expect(takeAccessToken(env)).toBe(TOKEN);
    expect(replaced).toBe("/documents/42?tab=1#line=3");
    expect(replaced).not.toContain(TOKEN);
  });

  it("does nothing on a page without an access fragment", () => {
    for (const hash of ["", "#main-content", "#section=access"]) {
      const env = makeEnv(hash);
      expect(takeAccessToken(env)).toBeNull();
      expect(env.events).toEqual([]);
    }
  });
});

describe("startAccessLinkRedeem", () => {
  it("strips the fragment BEFORE the request is made, and sends the token only to the redeem endpoint", async () => {
    const env = makeEnv(`#access=${TOKEN}`);
    const requests: Array<{ url: string; init: RequestInit; hashAtRequest: string; eventsAtRequest: string[] }> = [];
    const fetchMock = (async (url: string, init: RequestInit) => {
      requests.push({ url, init, hashAtRequest: env.location.hash, eventsAtRequest: [...env.events] });
      return jsonResponse(200, { ok: true, username: "maria", role: "member" });
    }) as unknown as typeof fetch;

    const outcome = await startAccessLinkRedeem({ ...env, fetch: fetchMock });

    expect(outcome).toEqual({ status: "signedIn", username: "maria", role: "member" });
    expect(requests).toHaveLength(1);
    const request = requests[0]!;
    expect(request.eventsAtRequest).toEqual(["replaceState"]);
    expect(request.hashAtRequest).toBe("");
    expect(request.url).toBe("/api/auth/redeem");
    expect(request.init.method).toBe("POST");
    expect(request.init.credentials).toBe("same-origin");
    expect((request.init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(request.init.body as string)).toEqual({ token: TOKEN });
    // Nothing but the body carries it.
    expect(request.url).not.toContain(TOKEN);
    expect(JSON.stringify(request.init.headers)).not.toContain(TOKEN);
  });

  it("reports an expired or used link (401) with the plain message", async () => {
    const env = makeEnv(`#access=${TOKEN}`);
    const outcome = await startAccessLinkRedeem({
      ...env,
      fetch: (async () => jsonResponse(401, { error: "This link is not valid." })) as unknown as typeof fetch,
    });
    expect(outcome).toEqual({ status: "invalid" });
    expect(REDEEM_MESSAGES.invalid).toBe("This link has expired or has already been used. Ask the person who gave it to you for a new one.");
  });

  it("reports rate limiting (429) separately", async () => {
    const env = makeEnv(`#access=${TOKEN}`);
    const outcome = await startAccessLinkRedeem({ ...env, fetch: (async () => jsonResponse(429, { error: "Too many attempts." })) as unknown as typeof fetch });
    expect(outcome).toEqual({ status: "rateLimited" });
    expect(REDEEM_MESSAGES.rateLimited).toMatch(/wait a few minutes/i);
  });

  it("reports an unreachable server for network errors and unexpected statuses, without logging", async () => {
    const log = spyOn(console, "log");
    const warn = spyOn(console, "warn");
    const error = spyOn(console, "error");
    try {
      const a = makeEnv(`#access=${TOKEN}`);
      expect(
        await startAccessLinkRedeem({
          ...a,
          fetch: (async () => {
            throw new TypeError(`Failed to fetch /api/auth/redeem ${TOKEN}`);
          }) as unknown as typeof fetch,
        }),
      ).toEqual({ status: "unreachable" });
      const b = makeEnv(`#access=${TOKEN}`);
      expect(await startAccessLinkRedeem({ ...b, fetch: (async () => jsonResponse(500, {})) as unknown as typeof fetch })).toEqual({ status: "unreachable" });
      for (const spy of [log, warn, error]) expect(spy).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it("never touches the network for a page without a fragment", () => {
    const env = makeEnv("");
    let called = false;
    const outcome = startAccessLinkRedeem({
      ...env,
      fetch: (async () => {
        called = true;
        return jsonResponse(200, {});
      }) as unknown as typeof fetch,
    });
    expect(outcome).toBeNull();
    expect(called).toBe(false);
    expect(env.events).toEqual([]);
  });

  it("does not send an empty or absurdly long token", async () => {
    let calls = 0;
    const counting = (async () => {
      calls++;
      return jsonResponse(200, {});
    }) as unknown as typeof fetch;
    expect(await startAccessLinkRedeem({ ...makeEnv("#access="), fetch: counting })).toEqual({ status: "invalid" });
    expect(await startAccessLinkRedeem({ ...makeEnv(`#access=${"a".repeat(600)}`), fetch: counting })).toEqual({ status: "invalid" });
    expect(calls).toBe(0);
  });
});
