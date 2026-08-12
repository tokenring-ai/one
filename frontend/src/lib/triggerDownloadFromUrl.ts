import { rpcAuthHeaders } from "../rpcAuth.ts";

export type DownloadFromUrlOptions = {
  /** The URL to download from */
  url: string;
  /** The filename to use for the downloaded file */
  filename: string;
};

/**
 * Trigger a browser download for a file at the given URL.
 * Attempts blob fetch first (preserves filename via `download` attribute);
 * falls back to opening the URL directly if fetch fails.
 *
 * Sends RPC Basic credentials and includes cookies so authenticated
 * filesystem HTTP endpoints work.
 */
export async function triggerDownloadFromUrl(options: DownloadFromUrlOptions): Promise<void> {
  const { url, filename } = options;
  try {
    const res = await fetch(url, {
      headers: rpcAuthHeaders(),
      credentials: "include",
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
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
    }
  }
}
