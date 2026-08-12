/** Format a USD cost with adaptive precision for small amounts. */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "$0.00";

  // Always en-US so `$` + decimal point stay stable across host locales.
  const abs = Math.abs(amount);
  const body = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs < 0.01 ? 4 : 2,
    maximumFractionDigits: abs < 0.01 ? 6 : 4,
  });
  return amount < 0 ? `-$${body}` : `$${body}`;
}

/** Compact token/count formatting (1.2k, 3.4M). */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const thousands = abs / 1_000;
    // Keep one decimal under 100k so 12.5k doesn't round away; whole numbers drop trailing .0
    const body = thousands >= 100 ? thousands.toFixed(0) : thousands.toFixed(1).replace(/\.0$/, "");
    return `${sign}${body}k`;
  }
  return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
}

/** Format milliseconds as ms or seconds. */
export function formatMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

/** Format tokens/sec throughput. */
export function formatTps(tps: number | undefined): string {
  if (tps === undefined || !Number.isFinite(tps) || tps <= 0) return "—";
  return `${tps >= 100 ? Math.round(tps) : tps.toFixed(1)} tk/s`;
}

/** Sum values in a string→number record. */
export function sumRecord(record: Record<string, number> | undefined): number {
  if (!record) return 0;
  return Object.values(record).reduce((a, b) => a + b, 0);
}

/** Top N entries from a string→number record, sorted by value descending. */
export function topRecordEntries(record: Record<string, number> | undefined, limit = 5): Array<{ key: string; value: number }> {
  if (!record) return [];
  return Object.entries(record)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Format a 0–1 share as a percentage string. */
export function formatPercent(share: number, digits = 0): string {
  if (!Number.isFinite(share)) return "0%";
  const pct = share * 100;
  if (pct > 0 && pct < 1 && digits === 0) return "<1%";
  return `${pct.toFixed(digits)}%`;
}

/** Shorten a long agent id for display (first 8 chars). */
export function formatAgentIdShort(agentId: string): string {
  if (!agentId) return "—";
  return agentId.length <= 8 ? agentId : agentId.slice(0, 8);
}

/** Shorten model/category labels like "Chat (OpenAI:gpt-4o)" for display. */
export function shortCategoryLabel(category: string): string {
  const chatMatch = category.match(/^Chat\s*\((.+)\)$/i);
  if (chatMatch?.[1]) return chatMatch[1];
  const imageMatch = category.match(/^Image Generation\s*\((.+)\)$/i);
  if (imageMatch?.[1]) return `Image · ${imageMatch[1]}`;
  const videoMatch = category.match(/^Video Generation\s*\((.+)\)$/i);
  if (videoMatch?.[1]) return `Video · ${videoMatch[1]}`;
  const generateMatch = category.match(/^GenerateObject\s*\((.+)\)$/i);
  if (generateMatch?.[1]) return `Object · ${generateMatch[1]}`;
  return category;
}

/** Coarse bucket for color-coding category bars. */
export function categoryKind(category: string): "chat" | "image" | "video" | "other" {
  const lower = category.toLowerCase();
  if (lower.startsWith("chat") || lower.startsWith("generateobject")) return "chat";
  if (lower.startsWith("image")) return "image";
  if (lower.startsWith("video")) return "video";
  return "other";
}

export type CategoryShare = {
  category: string;
  amount: number;
  share: number;
};

/** Sort categories by amount descending and attach share of total. */
export function categoryShares(totalsByCategory: Record<string, number>, grandTotal: number): CategoryShare[] {
  const entries = Object.entries(totalsByCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      share: grandTotal > 0 ? amount / grandTotal : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return entries;
}

/** Bucket spend into chat / media / other for summary cards. */
export function bucketTotals(totalsByCategory: Record<string, number>): {
  chat: number;
  media: number;
  other: number;
} {
  let chat = 0;
  let media = 0;
  let other = 0;
  for (const [category, amount] of Object.entries(totalsByCategory)) {
    const kind = categoryKind(category);
    if (kind === "chat") chat += amount;
    else if (kind === "image" || kind === "video") media += amount;
    else other += amount;
  }
  return { chat, media, other };
}

export type AgentFilter = "all" | "active" | "idle";

/** Filter agent cost rows by idle/active status. */
export function filterAgents<T extends { idle: boolean; displayName: string; agentType: string; agentId: string }>(
  agents: T[],
  filter: AgentFilter,
  search = "",
): T[] {
  const q = search.trim().toLowerCase();
  return agents.filter(agent => {
    if (filter === "active" && agent.idle) return false;
    if (filter === "idle" && !agent.idle) return false;
    if (!q) return true;
    return agent.displayName.toLowerCase().includes(q) || agent.agentType.toLowerCase().includes(q) || agent.agentId.toLowerCase().includes(q);
  });
}
