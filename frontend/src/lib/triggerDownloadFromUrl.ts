import { rpcAuthHeaders } from "../rpcAuth.ts";

export type DownloadFromUrlOptions = {
  /** The URL to download from */
  url: string;
  /** The filename to use for the downloaded file */
  filename: string;
};

/**
 * True when the URL resolves to the current origin. RPC credentials are only
 * ever attached to same-origin requests so a cross-origin URL can never
 * receive the backend password.
 */
function isSameOriginUrl(url: string): boolean {
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Trigger a browser download for a file at the given URL.
 * Attempts blob fetch first (preserves filename via `download` attribute);
 * falls back to opening the URL directly if fetch fails.
 *
 * Sends RPC Basic credentials and includes cookies for same-origin requests
 * so authenticated filesystem HTTP endpoints work. Cross-origin URLs are
 * fetched without credentials.
 */
export async function triggerDownloadFromUrl(options: DownloadFromUrlOptions): Promise<void> {
  const { url, filename } = options;
  const sameOrigin = isSameOriginUrl(url);
  try {
    const res = await fetch(url, {
      headers: sameOrigin ? rpcAuthHeaders() : {},
      credentials: sameOrigin ? "include" : "omit",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        a.remove();
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // Fallback for environments where fetch is blocked or offline caching fails.
    // The `download` attribute is ignored cross-origin, so open those in a new
    // tab instead of navigating the app away.
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    if (!sameOrigin) {
      a.target = "_blank";
    }
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
    }
  }
}
