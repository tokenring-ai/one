import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Search, X } from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRefSync } from "../../hooks/useRefSync.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import { useThemeAccent } from "../../theme/themeStore.ts";
import { TERMINAL_DEFAULT_FONT_SIZE, TERMINAL_FONT, terminalTheme } from "./terminalTheme.ts";

/**
 * Literal font stack rather than var(--font-mono): xterm measures cell width from this value
 * directly, and an unresolved custom property would throw the metrics off. The line-mode
 * prompt reuses it so typed text matches the grid it sits on.
 */

/** Where the terminal's cursor sits, in pixels relative to the wrapper. */
type CaretPosition = { left: number; top: number; height: number };

export type XTermInputMode = "line" | "raw";

type XTermViewProps = {
  /** Accumulated terminal output (possibly capped from the front). Only newly appended text is written. */
  output: string;
  /**
   * How many characters have ever been appended to `output`, counting text since dropped from its
   * front. Needed once the caller caps `output`: its length then stops growing. Defaults to its length.
   */
  outputEnd?: number;
  /**
   * Called with the fitted grid size on mount and whenever it changes, so the caller can tell
   * a pty-backed session how wide its window is. Without this the shell wraps at its own
   * default column count rather than the one on screen.
   */
  onResize?: (cols: number, rows: number) => void;
  /** Line mode: called with the typed line when Enter is pressed. */
  onSubmit?: (input: string) => void;
  /** Raw mode: called with each keystroke / escape sequence straight from xterm's onData. */
  onInput?: (input: string) => void;
  /**
   * "line" (default) parks an overlay input on the cursor cell and submits whole lines on
   * Enter — readable, mobile-friendly. "raw" hands every keystroke to `onInput` so full-screen
   * programs (vim, htop, fzf) work. The mode is read at mount: switch it via the React `key`
   * so the terminal remounts (the caller owns the accumulated output, which is rewritten).
   */
  inputMode?: XTermInputMode;
  /** Keeps the output readable but stops accepting input, e.g. once the process has exited. */
  readOnly?: boolean;
  /** Font size in pixels; changes apply live. */
  fontSize?: number;
  /**
   * Absolute paths printed by the shell that live under this directory become clickable
   * (Cmd/Ctrl+click) and call `onOpenPath`.
   */
  workspaceDirectory?: string | undefined;
  onOpenPath?: ((path: string) => void) | undefined;
  className?: string;
};

/**
 * Absolute-looking paths with at least two segments ("src/app.ts" has none, "/a/b" does).
 * Matches preceded by ":" or "/" are skipped so URLs like https://host/path don't match.
 */
const PATH_IN_LINE_PATTERN = /\/[\w.@+-]+(?:\/[\w.@+-]+)*/g;

export interface MatchedPathLink {
  text: string;
  /** 1-based column of the first character on the line. */
  startColumn: number;
  endColumn: number;
}

/** Pure matcher so the link rules are testable without a real xterm. */
export function matchWorkspacePaths(lineText: string, workspaceDirectory: string | undefined): MatchedPathLink[] {
  if (!workspaceDirectory) return [];
  const normalizedWorkspace = workspaceDirectory.replace(/\/+$/, "");
  const matches: MatchedPathLink[] = [];
  for (const match of lineText.matchAll(PATH_IN_LINE_PATTERN)) {
    const text = match[0];
    const index = match.index;
    const before = index > 0 ? lineText[index - 1] : "";
    if (before === ":" || before === "/") continue;
    if (!(text === normalizedWorkspace || text.startsWith(`${normalizedWorkspace}/`))) continue;
    matches.push({ text, startColumn: index + 1, endColumn: index + text.length + 1 });
  }
  return matches;
}

/**
 * `lib.dom` types `navigator.clipboard` as always present, but it is `undefined`
 * outside a secure context (plain http, some embedded webviews) and in test
 * environments, so read it through a correctly-optional type.
 */
function getClipboard(): Clipboard | undefined {
  return (navigator as { clipboard?: Clipboard }).clipboard;
}

function copyText(text: string): void {
  void getClipboard()
    ?.writeText(text)
    .catch(() => {});
}

/**
 * Renders terminal output with xterm.js so ANSI escape sequences (colors, cursor
 * movement, progress bars) display the way they would in a real terminal.
 *
 * The caller passes the whole accumulated output string; this component tracks how
 * much of it has already been written and only emits the delta, so redraws stay
 * incremental. Mount one instance per terminal session (pass a `key`) — switching
 * sessions or input modes in place would replay unrelated output into the same buffer.
 *
 * Input models:
 * - Line mode types into an overlay input parked on the cursor cell: the line is only
 *   sent on Enter, so early echoing never collides with what the shell writes meanwhile.
 * - Raw mode enables xterm's own keyboard handling (`onData`) and forwards every keystroke,
 *   which is what full-screen TUI programs require.
 */
export default function XTermView({
  output,
  outputEnd = output.length,
  onResize,
  onSubmit,
  onInput,
  inputMode = "line",
  readOnly,
  fontSize,
  workspaceDirectory,
  onOpenPath,
  className,
}: XTermViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const writtenRef = useRef(0);

  const [resolvedTheme] = useTheme();
  const accent = useThemeAccent();
  const [caret, setCaret] = useState<CaretPosition | null>(null);
  const [input, setInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchAddonRef = useRef<SearchAddon | null>(null);
  // Local command history for this session instance (remounted per terminal via `key`).
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  /** Draft text restored when the user arrows back down past the newest history entry. */
  const draftRef = useRef("");

  const resolvedFontSize = fontSize ?? TERMINAL_DEFAULT_FONT_SIZE;
  const rawMode = inputMode === "raw";
  const interactiveLine = inputMode === "line" && onSubmit !== undefined && !readOnly;
  const interactiveRaw = rawMode && onInput !== undefined && !readOnly;

  // Held in refs so new callback identities don't tear down and rebuild the terminal.
  const onResizeRef = useRefSync(onResize);
  const onInputRef = useRefSync(onInput);
  const onSubmitRef = useRefSync(onSubmit);
  const onOpenPathRef = useRefSync(onOpenPath);
  const workspaceDirectoryRef = useRefSync(workspaceDirectory);
  // Interactivity toggles (e.g. `readOnly` flipping when a command exits) are read through refs
  // so they never tear down the xterm instance — a rebuild would drop the rendered buffer.
  const interactiveLineRef = useRefSync(interactiveLine);
  const interactiveRawRef = useRefSync(interactiveRaw);
  const outputRef = useRefSync(output);

  const measureCaret = useCallback(() => {
    if (!interactiveLineRef.current) return;
    const term = termRef.current;
    const wrapper = wrapperRef.current;
    const screen = hostRef.current?.querySelector<HTMLElement>(".xterm-screen");
    if (!term || !wrapper || !screen) return;

    const buffer = term.buffer.active;
    // cursorY is relative to the bottom of the scrollback; scrolling up can push it off screen.
    const row = buffer.baseY + buffer.cursorY - buffer.viewportY;
    if (row < 0 || row >= term.rows) {
      setCaret(null);
      return;
    }

    const screenRect = screen.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const next: CaretPosition = {
      left: screenRect.left - wrapperRect.left + (buffer.cursorX * screenRect.width) / term.cols,
      top: screenRect.top - wrapperRect.top + (row * screenRect.height) / term.rows,
      height: screenRect.height / term.rows,
    };

    setCaret(prev => (prev && prev.left === next.left && prev.top === next.top && prev.height === next.height ? prev : next));
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      // Pipe-mode sessions emit bare \n; xterm needs \r\n to return to column 0. Harmless
      // for pty sessions, which already send \r\n.
      convertEol: true,
      // Raw mode takes keystrokes in the buffer itself; line mode collects them in the
      // overlay prompt below instead.
      disableStdin: !interactiveRaw,
      cursorBlink: interactiveRaw,
      // Line mode's overlay prompt holds focus, so xterm would otherwise paint an idle
      // cursor outline underneath it. Raw mode wants the real cursor at all times.
      cursorInactiveStyle: interactiveRaw ? "outline" : "none",
      scrollback: 10000,
      fontSize: resolvedFontSize,
      lineHeight: 1.2,
      fontFamily: TERMINAL_FONT,
      theme: terminalTheme(resolvedTheme, accent),
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    searchAddonRef.current = searchAddon;
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(
      new WebLinksAddon((_event, uri) => {
        window.open(uri, "_blank", "noopener,noreferrer");
      }),
    );

    // Workspace file paths in output become Cmd/Ctrl+clickable links into the Files app.
    term.registerLinkProvider({
      provideLinks: (lineNumber, callback) => {
        const line = term.buffer.active.getLine(lineNumber);
        const openPath = onOpenPathRef.current;
        const workspace = workspaceDirectoryRef.current;
        if (!line || !openPath || !workspace) {
          callback(undefined);
          return;
        }
        const lineText = line.translateToString(true);
        const matches = matchWorkspacePaths(lineText, workspace);
        if (matches.length === 0) {
          callback(undefined);
          return;
        }
        callback(
          matches.map(match => ({
            range: {
              start: { x: match.startColumn, y: lineNumber },
              end: { x: match.endColumn, y: lineNumber },
            },
            text: match.text,
            activate: (_event: unknown, text: string) => openPath(text),
          })),
        );
      },
    });
    term.open(host);
    if (rawMode) {
      if (interactiveRawRef.current) term.focus();
    } else {
      // The overlay prompt draws its own caret; xterm's would sit on top of the typed text.
      term.write("\x1b[?25l");
      fitAddon.fit();
    }

    termRef.current = term;
    // A fresh buffer replays everything accumulated so far, so a (re)built terminal never
    // comes up blank waiting for the next output delta.
    term.write(outputRef.current);
    writtenRef.current = outputRef.current.length;

    // Raw keystrokes flow straight through; the shell echoes them back in the output stream.
    if (rawMode) {
      term.onData(data => {
        if (interactiveRawRef.current) onInputRef.current?.(data);
      });
      // Ctrl+C with a selection copies instead of sending ^C; paste shortcuts hit the clipboard.
      term.attachCustomKeyEventHandler(event => {
        if (event.type !== "keydown") return true;
        if (event.key.toLowerCase() === "c" && (event.metaKey || event.ctrlKey)) {
          if (term.hasSelection()) {
            copyText(term.getSelection());
            return false;
          }
          // No selection: Cmd+C does nothing, Ctrl+C passes through as an interrupt.
          return !event.metaKey;
        }
        if (event.key.toLowerCase() === "v" && (event.metaKey || event.ctrlKey)) {
          void getClipboard()
            ?.readText()
            .then(text => {
              if (text && interactiveRawRef.current) onInputRef.current?.(text);
            })
            .catch(() => {});
          return false;
        }
        return true;
      });
      // Copy-on-select mirrors native terminal conventions.
      term.onSelectionChange(() => {
        const selection = term.getSelection();
        if (selection) copyText(selection);
      });
    }

    // Coalesce the burst of sizes produced while a window is being dragged.
    let emitTimer: ReturnType<typeof setTimeout> | undefined;
    const emitSize = (cols: number, rows: number) => {
      clearTimeout(emitTimer);
      emitTimer = setTimeout(() => onResizeRef.current?.(cols, rows), 100);
    };

    const subscriptions = [
      term.onResize(({ cols, rows }) => emitSize(cols, rows)),
      // Any of these can move the cursor cell the prompt is parked on.
      term.onRender(measureCaret),
      term.onCursorMove(measureCaret),
      term.onScroll(measureCaret),
      term.onResize(measureCaret),
    ];
    // onResize only fires on a change, so report the size we fitted to up front.
    emitSize(term.cols, term.rows);
    measureCaret();

    const resizeObserver = new ResizeObserver(() => {
      // While the container is collapsed, fit() would clamp the grid to 2x1 and rewrap the buffer.
      if (host.clientWidth === 0 || host.clientHeight === 0) return;
      fitAddon.fit();
      measureCaret();
    });
    resizeObserver.observe(host);

    return () => {
      clearTimeout(emitTimer);
      resizeObserver.disconnect();
      for (const subscription of subscriptions) subscription.dispose();
      searchAddon.dispose();
      searchAddonRef.current = null;
      termRef.current = null;
      term.dispose();
    };
    // inputMode/theme/fontSize are read at mount by design (theme and size have their own
    // live-update effects below) — remount via `key` to change the input mode. Interactivity
    // (readOnly / handler presence) is applied live by the effect below instead.
  }, [measureCaret]);

  // Toggling raw-mode input in place keeps the buffer; xterm reads these options live.
  useEffect(() => {
    const term = termRef.current;
    if (!term || !rawMode) return;
    term.options.disableStdin = !interactiveRaw;
    term.options.cursorBlink = interactiveRaw;
    term.options.cursorInactiveStyle = interactiveRaw ? "outline" : "none";
  }, [rawMode, interactiveRaw]);

  // Live theme and font-size updates apply without losing the buffer.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = terminalTheme(resolvedTheme, accent);
  }, [resolvedTheme, accent]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (term.options.fontSize === resolvedFontSize) return;
    term.options.fontSize = resolvedFontSize;
    term.refresh(0, term.rows - 1);
    measureCaret();
  }, [resolvedFontSize, measureCaret]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    // writtenRef counts characters written, on the same scale as outputEnd. The stream only ever
    // appends, so an end before what was written means the output started over; more new text than
    // the buffer still holds means the screen must be redrawn from what is left.
    const fresh = outputEnd - writtenRef.current;
    if (fresh < 0 || fresh > output.length) {
      term.reset();
      if (!rawMode) term.write("\x1b[?25l");
      term.write(output);
    } else if (fresh > 0) {
      term.write(output.slice(output.length - fresh));
    }
    writtenRef.current = outputEnd;
  }, [output, outputEnd, rawMode]);

  // The prompt is the only place typing goes, so hand it focus as soon as the session opens.
  useEffect(() => {
    if (!interactiveLine) {
      setCaret(null);
      return;
    }
    measureCaret();
    promptRef.current?.focus();
  }, [interactiveLine, measureCaret]);

  // Cmd/Ctrl+F opens the in-buffer search, but only while focus is inside this terminal —
  // hidden dock tabs and other panels (Monaco, the browser's own find) keep the shortcut.
  // Capture phase: xterm stops propagation of keys it consumes in raw mode.
  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "f") return;
    // Plain Ctrl+F in a raw session is the program's (readline forward-char, vim page-down).
    if (interactiveRaw && event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setSearchOpen(true);
  };

  const focusTerminal = () => {
    // Clicking to finish a drag-selection should leave that selection alone.
    if (window.getSelection()?.toString()) return;
    if (interactiveRaw) {
      termRef.current?.focus();
      return;
    }
    promptRef.current?.focus();
  };

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    termRef.current?.focus();
  }, []);

  const runSearch = useCallback(
    (direction: "next" | "previous") => {
      const searchAddon = searchAddonRef.current;
      if (!searchAddon || !searchQuery) return;
      const options = { caseSensitive: false } as const;
      if (direction === "next") {
        searchAddon.findNext(searchQuery, options);
      } else {
        searchAddon.findPrevious(searchQuery, options);
      }
    },
    [searchQuery],
  );

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch(event.shiftKey ? "previous" : "next");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Typing while scrolled back into the scrollback: snap to the cursor, like a real terminal.
    if (!caret) termRef.current?.scrollToBottom();

    // Paste from the clipboard straight into the draft.
    if (event.key.toLowerCase() === "v" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void getClipboard()
        ?.readText()
        .then(text => {
          if (text) setInput(previous => previous + text);
        })
        .catch(() => {});
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      // Empty Enter is valid (blank line / accept default prompt). The provider appends \n.
      if (input.trim()) {
        const history = historyRef.current;
        if (history[history.length - 1] !== input) {
          historyRef.current = [...history, input].slice(-200);
        }
      }
      historyIndexRef.current = -1;
      draftRef.current = "";
      onSubmitRef.current?.(input);
      setInput("");
      return;
    }

    if (event.key === "ArrowUp") {
      const history = historyRef.current;
      if (history.length === 0) return;
      event.preventDefault();
      if (historyIndexRef.current === -1) draftRef.current = input;
      const next = historyIndexRef.current === -1 ? history.length - 1 : Math.max(0, historyIndexRef.current - 1);
      historyIndexRef.current = next;
      setInput(history[next] ?? "");
      return;
    }

    if (event.key === "ArrowDown") {
      if (historyIndexRef.current === -1) return;
      event.preventDefault();
      const history = historyRef.current;
      if (historyIndexRef.current >= history.length - 1) {
        historyIndexRef.current = -1;
        setInput(draftRef.current);
      } else {
        historyIndexRef.current += 1;
        setInput(history[historyIndexRef.current] ?? "");
      }
      return;
    }

    if (event.key === "c" && event.ctrlKey) {
      // Ctrl+C only means "interrupt" when there is nothing to copy — in the draft or on the page.
      const field = event.currentTarget;
      if (field.selectionStart !== field.selectionEnd || window.getSelection()?.toString()) return;
      event.preventDefault();
      setInput("");
      historyIndexRef.current = -1;
      draftRef.current = "";
      onSubmitRef.current?.("\x03");
      return;
    }

    if (event.key === "d" && event.ctrlKey) {
      // Empty Ctrl+D → EOF (shell exit). With a draft, leave the browser alone.
      if (input) return;
      event.preventDefault();
      onSubmitRef.current?.("\x04");
      return;
    }

    if (event.key === "l" && event.ctrlKey) {
      event.preventDefault();
      onSubmitRef.current?.("\x0c");
    }
  };

  return (
    // Click-to-focus mirrors a real terminal.
    <div ref={wrapperRef} className={`relative ${className ?? ""}`} onMouseUp={focusTerminal} onKeyDownCapture={handleKeyDownCapture}>
      <div ref={hostRef} className="w-full h-full" />

      {searchOpen && (
        <div
          role="search"
          aria-label="Search terminal buffer"
          className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-secondary border border-primary rounded-lg shadow-card px-1.5 py-1"
        >
          <Search className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search buffer"
            aria-label="Search term"
            className="w-40 bg-transparent border-0 outline-none text-xs text-primary placeholder:text-muted focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => runSearch("previous")}
            disabled={!searchQuery}
            className="p-0.5 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring disabled:opacity-40"
            aria-label="Previous match"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => runSearch("next")}
            disabled={!searchQuery}
            className="p-0.5 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring disabled:opacity-40"
            aria-label="Next match"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={closeSearch}
            className="p-0.5 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring"
            aria-label="Close search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {interactiveLine && (
        <input
          ref={promptRef}
          type="text"
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          className="absolute bg-transparent border-0 p-0 outline-none"
          style={{
            left: caret?.left ?? 0,
            top: caret?.top ?? 0,
            height: caret?.height ?? resolvedFontSize,
            // Runs to the right edge; longer drafts scroll inside the field.
            width: `calc(100% - ${caret?.left ?? 0}px)`,
            lineHeight: `${caret?.height ?? resolvedFontSize}px`,
            fontFamily: TERMINAL_FONT,
            fontSize: resolvedFontSize,
            color: terminalTheme(resolvedTheme).foreground,
            caretColor: terminalTheme(resolvedTheme).cursor,
            // Off-screen cursor: keep the field mounted so focus survives, just don't paint it.
            opacity: caret ? 1 : 0,
          }}
          aria-label="Terminal input"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      )}
    </div>
  );
}
