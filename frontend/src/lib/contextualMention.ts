export type ActiveMention = {
  query: string;
  start: number;
  end: number;
};

export function findActiveMention(text: string, cursor: number): ActiveMention | null {
  if (cursor < 0 || cursor > text.length) return null;

  let at = -1;
  for (let i = Math.min(cursor, text.length) - 1; i >= 0; i--) {
    const char = text[i];
    if (char === undefined) break;
    if (/\s/.test(char)) break;
    if (char === "@" && (i === 0 || /\s/.test(text[i - 1] ?? ""))) {
      at = i;
      break;
    }
  }
  if (at < 0) return null;

  let end = at + 1;
  while (end < text.length && !/\s/.test(text[end] ?? "")) {
    end++;
  }
  if (cursor < at || cursor > end) return null;

  const afterAt = text.slice(at + 1, end);
  if (afterAt.startsWith("[")) return null;

  return { query: afterAt, start: at, end };
}

export function replaceActiveMention(text: string, mention: ActiveMention, tag: string): { next: string; cursor: number } {
  const next = `${text.slice(0, mention.start)}${tag} ${text.slice(mention.end)}`;
  return { next, cursor: mention.start + tag.length + 1 };
}
