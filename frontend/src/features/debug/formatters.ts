/** Formats a snapshot file size for the snapshot list. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formats a capture time as a local time-of-day, with the date when it is not today. */
export function formatCaptureTime(timestamp: number): string {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString(undefined, { hour12: false });
  const isToday = new Date().toDateString() === date.toDateString();
  return isToday ? time : `${date.toLocaleDateString()} ${time}`;
}

/**
 * Re-formats snapshot JSON with two-space indentation. Snapshots are written
 * pretty-printed already, so this is a safety net for hand-edited files; text
 * that will not parse is shown unchanged.
 */
export function prettyPrintSnapshot(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}
