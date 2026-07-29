/** Relative phrase for conversation timestamps. */
export function formatRelativeTime(ts: number | null | undefined, now = Date.now()): string {
  if (ts == null || ts <= 0) return "—";
  const delta = Math.max(0, now - ts);
  if (delta < 60_000) return "just now";

  const minutes = Math.floor(delta / 60_000);
  const hours = Math.floor(delta / 3_600_000);
  const days = Math.floor(delta / 86_400_000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 48) return `${hours}h ago`;
  return `${days}d ago`;
}

/** Absolute timestamp for titles and tooltips. */
export function formatTimestamp(ts: number | null | undefined): string {
  if (ts == null || ts <= 0) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Title-case a messaging service name (slack → Slack). */
export function formatServiceName(service: string): string {
  if (!service) return "Unknown";
  if (service.toLowerCase() === "x") return "X";
  return service.charAt(0).toUpperCase() + service.slice(1);
}

/** Known channel brand colors for status cards. */
export function serviceGradient(service: string): string {
  switch (service.toLowerCase()) {
    case "slack":
      return "from-purple-500 to-violet-600";
    case "telegram":
      return "from-sky-500 to-blue-600";
    case "discord":
      return "from-indigo-500 to-violet-600";
    case "email":
      return "from-red-500 to-rose-600";
    default:
      return "from-emerald-500 to-green-600";
  }
}
