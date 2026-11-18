import { useEffect, useRef } from "react";

export interface KeyboardShortcut {
  /** Single key to match (e.g. "s", "o", "n"). Matched case-insensitively. */
  key: string;
  /** Handler called when the shortcut fires. Receives the KeyboardEvent. */
  handler: (e: KeyboardEvent) => void;
  /** Optional condition to disable this shortcut (e.g. while a modal is open). Defaults to true. */
  enabled?: boolean;
  /**
   * Also fire while the event comes from an editable target (input, textarea, select,
   * contentEditable, Monaco, xterm). Off by default so shortcuts like Ctrl/⌘+⌫ don't hijack
   * the platform's word/line delete while typing. Defaults to false.
   */
  allowInEditable?: boolean;
}

/** True when the key event originates somewhere the user is typing text. */
export function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.closest(".monaco-editor, .xterm, [contenteditable]:not([contenteditable='false'])") !== null;
}

/**
 * Register Ctrl/Cmd keyboard shortcuts.
 * Automatically prevents default browser behavior and cleans up on unmount.
 *
 * Uses a single `window` keydown listener. Shortcut definitions are read from a
 * ref so handlers and `enabled` flags stay current without re-binding.
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: "s", handler: () => void handleSave(), enabled: !showModal },
 *   { key: "o", handler: () => requestOpen(), enabled: !showModal },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const pressed = e.key.toLowerCase();
      const fromEditable = isEditableKeyTarget(e.target);
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;
        if (shortcut.key.toLowerCase() !== pressed) continue;
        if (fromEditable && !shortcut.allowInEditable) continue;
        e.preventDefault();
        shortcut.handler(e);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
