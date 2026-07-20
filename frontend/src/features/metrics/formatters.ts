/** Format a USD cost with adaptive precision for small amounts. */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "$0.00";
  if (amount === 0) return "$0.00";
  if (Math.abs(amount) < 0.01) {
    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    })}`;
  }
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
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
