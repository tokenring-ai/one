/** Where the docs site serves the remote-access guide (docs/docs/guides/remote-access-and-users.md). */
export const REMOTE_ACCESS_GUIDE_URL = "https://docs.tokenring.ai/docs/guides/remote-access-and-users";
/** The HTTPS section of the operations guide. */
export const OPERATIONS_HTTPS_URL = "https://docs.tokenring.ai/docs/guides/operations#https";

export interface LinkExpiryOption {
  minutes: number;
  label: string;
}

/** The backend accepts 15 minutes to 7 days. */
export const LINK_EXPIRY_OPTIONS: readonly LinkExpiryOption[] = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 24 * 60, label: "24 hours" },
  { minutes: 3 * 24 * 60, label: "3 days" },
  { minutes: 7 * 24 * 60, label: "7 days" },
];

/** Choices for signing yourself in on another device: short on purpose. */
export const SELF_LINK_EXPIRY_OPTIONS: readonly LinkExpiryOption[] = LINK_EXPIRY_OPTIONS.slice(0, 3);
export const SELF_LINK_DEFAULT_MINUTES = 15;
export const ADMIN_LINK_DEFAULT_MINUTES = 24 * 60;

/** True for hostnames only this computer can reach (mirrors the server's check; the server's answer wins when available). */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host.endsWith(".localhost") || host === "::1" || host.startsWith("127.") || host === "::ffff:127.0.0.1";
}

/** What can be told about an address from the address alone (the loopback and https checks the notices need). */
export function factsFromUrl(url: string): { isLoopback: boolean; isHttps: boolean } {
  try {
    const parsed = new URL(url);
    return { isLoopback: isLoopbackHostname(parsed.hostname), isHttps: parsed.protocol === "https:" };
  } catch {
    return { isLoopback: false, isHttps: false };
  }
}
