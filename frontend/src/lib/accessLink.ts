/**
 * Redeeming a one-time access link (the QR code lands here).
 *
 * The link is `<base>/#access=<token>`. The token lives in the URL fragment so it never reaches a server log or a
 * Referer header, but it is still a credential for as long as it sits in the address bar: anyone who copies the bar,
 * bookmarks the page or screenshots it would get a sign-in. So the first thing that happens, before any network call
 * and before the router reads the location, is that the fragment is removed with `history.replaceState`. The token
 * then exists only as a local variable of `startAccessLinkRedeem`, is sent to exactly one endpoint, and is never
 * logged, stored or put in React state.
 */

export const ACCESS_REDEEM_ROUTE = "/api/auth/redeem";

/** Longer than this cannot be a real token (they are about 43 characters); not worth sending. */
const MAX_TOKEN_LENGTH = 512;

export type RedeemOutcome =
  | { status: "signedIn"; username: string; role: "admin" | "member" }
  | { status: "invalid" }
  | { status: "rateLimited" }
  | { status: "unreachable" };

export type RedeemFailure = Exclude<RedeemOutcome, { status: "signedIn" }>;

export const REDEEM_MESSAGES: Record<RedeemFailure["status"], string> = {
  invalid: "This link has expired or has already been used. Ask the person who gave it to you for a new one.",
  rateLimited: "Too many attempts. Wait a few minutes, then try again or ask for a new link.",
  unreachable: "TokenRing could not be reached to sign you in. Check your connection, then open the link again.",
};

export interface RedeemEnvironment {
  location: Pick<Location, "hash" | "pathname" | "search">;
  history: Pick<History, "replaceState" | "state">;
  fetch: typeof fetch;
}

/**
 * Removes `access=<token>` from the address bar and returns the token (null when the page has no access fragment).
 * Other fragment parameters are kept. Synchronous on purpose.
 */
export function takeAccessToken(env: Pick<RedeemEnvironment, "location" | "history">): string | null {
  const { hash, pathname, search } = env.location;
  if (!hash.includes("access=")) return null;
  const kept: string[] = [];
  let token: string | null = null;
  for (const part of hash.replace(/^#/, "").split("&")) {
    if (part.startsWith("access=")) {
      if (token === null) {
        try {
          token = decodeURIComponent(part.slice("access=".length));
        } catch {
          token = "";
        }
      }
    } else if (part) {
      kept.push(part);
    }
  }
  if (token === null) return null;
  env.history.replaceState(env.history.state, "", `${pathname}${search}${kept.length > 0 ? `#${kept.join("&")}` : ""}`);
  return token;
}

/** Sends the token to the redeem endpoint, once. Never throws and never reports the token anywhere. */
export async function redeemAccessToken(token: string, fetchImpl: typeof fetch): Promise<RedeemOutcome> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return { status: "invalid" };
  try {
    const response = await fetchImpl(ACCESS_REDEEM_ROUTE, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (response.status === 429) return { status: "rateLimited" };
    if (response.status === 401) return { status: "invalid" };
    if (!response.ok) return { status: "unreachable" };
    const body = (await response.json()) as { username?: unknown; role?: unknown };
    if (typeof body.username !== "string") return { status: "unreachable" };
    return { status: "signedIn", username: body.username, role: body.role === "admin" ? "admin" : "member" };
  } catch {
    return { status: "unreachable" };
  }
}

/**
 * Strips the fragment first, then redeems. Returns null when the page was not opened from an access link, so a normal
 * page load is untouched.
 */
export function startAccessLinkRedeem(env: RedeemEnvironment): Promise<RedeemOutcome> | null {
  const token = takeAccessToken(env);
  if (token === null) return null;
  return redeemAccessToken(token, env.fetch.bind(globalThis));
}
