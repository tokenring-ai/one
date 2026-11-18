const MAX = 80;

/**
 * Checkpoints are named after the input that produced them, which is often not something a person typed:
 * the todo and goal plugins nudge agents with "**AUTOMATED SYSTEM MESSAGE …**". Show those as what they are,
 * show slash commands by name only, and show everything else as its first line with markdown emphasis removed.
 */
export function checkpointLabel(name: string): string {
  const text = name.trim();
  if (/^\**\s*AUTOMATED SYSTEM MESSAGE\b/i.test(text)) return /GOAL MODE/i.test(text.split("\n", 1)[0]!) ? "Goal check-in" : "Automatic check-in";
  // A slash command: name the command, not its arguments (they are often ids, paths or account names).
  const command = /^\/([\w-]+)(?=\s|$)/.exec(text);
  if (command) return `Ran /${command[1]}`;
  const firstLine = (text.split("\n").find(line => line.trim()) ?? "").replace(/[*_`#>]+/g, "").trim();
  if (!firstLine) return "Untitled checkpoint";
  return firstLine.length > MAX ? `${firstLine.slice(0, MAX - 1)}…` : firstLine;
}
