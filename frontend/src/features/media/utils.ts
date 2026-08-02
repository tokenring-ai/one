export function mediaUrl(filename: string) {
  return `/api/media/${encodeURIComponent(filename)}`;
}

export function aspectLabel(width: number, height: number) {
  if (width === height) return "Square";
  if (width > height) return "Wide";
  return "Tall";
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Extract lightweight keywords from a free-text prompt for media-library metadata. */
export function keywordsFromPrompt(prompt: string, limit = 10): string[] {
  return prompt
    .trim()
    .split(/[,\s]+/)
    .map(part => part.replace(/[^\p{L}\p{N}-]+/gu, ""))
    .filter(Boolean)
    .slice(0, limit);
}

/** Trigger a browser download for a media-library file. Falls back to opening the URL if fetch fails. */
export async function downloadMedia(filename: string): Promise<void> {
  const url = mediaUrl(filename);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback for environments where fetch is blocked or offline caching fails.
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export function workOnMediaMessage(kind: "image" | "video" | "audio", filename: string, keywords: string[] = []): string {
  const kw = keywords.length > 0 ? keywords.join(", ") : "none";
  return [`Please help me work with this ${kind} from the media library.`, `Filename: ${filename}`, `URL: ${mediaUrl(filename)}`, `Keywords: ${kw}`].join("\n");
}
