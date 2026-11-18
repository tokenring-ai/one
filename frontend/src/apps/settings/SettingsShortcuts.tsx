import ViewShell from "../../components/ui/ViewShell.tsx";
import { SettingsCard } from "./shared.tsx";

interface ShortcutEntry {
  /** Keys as shown on macOS. */
  mac: string;
  /** Keys as shown on Windows / Linux; omitted when identical to `mac`. */
  other?: string;
  label: string;
  scope: string;
}

/** Every shortcut the shell and core views register. Keep in sync with the code. */
const SHORTCUTS: readonly ShortcutEntry[] = [
  { mac: "⌘K", other: "Ctrl+K", label: "Open the command palette (dashboards, agents, views, actions)", scope: "Anywhere" },
  { mac: "⌘Z / ⇧⌘Z", other: "Ctrl+Z / Ctrl+Shift+Z", label: "Undo / redo dashboard layout changes", scope: "Editable dashboards" },
  { mac: "⌘N / ⌘S / ⌘O", other: "Ctrl+N / Ctrl+S / Ctrl+O", label: "New / save / open document", scope: "Documents" },
  { mac: "⌘⌫", other: "Ctrl+Backspace", label: "Delete the agent whose chat is open", scope: "Agents" },
  { mac: "↑ / ↓", label: "Browse previous messages you have sent", scope: "Chat composer" },
  { mac: "Enter", label: "Send message", scope: "Chat composer" },
  { mac: "Shift+Enter", label: "New line", scope: "Chat composer" },
  { mac: "/", label: "Show command suggestions", scope: "Chat composer" },
  { mac: "@", label: "Mention a skill, file, or memory", scope: "Chat composer" },
  { mac: "Home / End", label: "Jump to top / bottom of the transcript", scope: "Chat transcript" },
  { mac: "Esc", label: "Close overlays and pickers", scope: "Anywhere" },
];

/** Apple platforms use ⌘; everything else uses Ctrl (the shortcut hooks accept either). */
export function isApplePlatform(
  nav: Pick<Navigator, "platform" | "userAgent"> | undefined = typeof navigator === "undefined" ? undefined : navigator,
): boolean {
  if (!nav) return false;
  const hinted = (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test([hinted, nav.platform, nav.userAgent].join(" "));
}

function Kbd({ children }: { children: string }) {
  return <kbd className="inline-block rounded-md border border-primary bg-tertiary px-1.5 py-0.5 font-mono text-[11px] text-primary">{children}</kbd>;
}

/** Discoverability for the keyboard-first shell, shared by the standalone view and the settings page. */
export function ShortcutsSection() {
  const scopes = [...new Set(SHORTCUTS.map(entry => entry.scope))];
  const apple = isApplePlatform();

  return (
    <SettingsCard>
      <div className="divide-y divide-primary">
        {scopes.map(scope => (
          <div key={scope} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:gap-4">
            <p className="w-40 shrink-0 text-xs font-semibold uppercase tracking-widest text-muted pt-1">{scope}</p>
            <ul className="flex-1 min-w-0 space-y-1.5">
              {SHORTCUTS.filter(entry => entry.scope === scope).map(entry => (
                <li key={entry.mac + entry.label} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-44 shrink-0">
                    <Kbd>{apple ? entry.mac : (entry.other ?? entry.mac)}</Kbd>
                  </span>
                  <span className="text-xs text-secondary">{entry.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

export default function SettingsShortcutsView() {
  return (
    <ViewShell pad="page">
      <ShortcutsSection />
    </ViewShell>
  );
}
