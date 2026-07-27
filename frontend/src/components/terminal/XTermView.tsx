import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

/** Matches the `bg-[#1a1a2e]` panel the terminal used to render into. */
const TERMINAL_THEME = {
  background: "#1a1a2e",
  foreground: "#4ade80",
  cursor: "#4ade80",
  cursorAccent: "#1a1a2e",
  selectionBackground: "rgba(99, 102, 241, 0.35)",
  black: "#1a1a2e",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#f59e0b",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e7e5e4",
  brightBlack: "#78716c",
  brightRed: "#f87171",
  brightGreen: "#4ade80",
  brightYellow: "#fbbf24",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#fafaf9",
};

/**
 * Literal stack rather than var(--font-mono): xterm measures cell width from this value
 * directly, and an unresolved custom property would throw the metrics off. The inline prompt
 * reuses it so typed text matches the grid it sits on.
 */
const TERMINAL_FONT = '"JetBrains Mono", "Fira Code", monospace';
const TERMINAL_FONT_SIZE = 12;

/** Where the terminal's cursor sits, in pixels relative to the wrapper. */
type CaretPosition = { left: number; top: number; height: number };

type XTermViewProps = {
  /** Full accumulated terminal output. Only the newly appended suffix is written. */
  output: string;
  /**
   * Called with the fitted grid size on mount and whenever it changes, so the caller can tell
   * a pty-backed session how wide its window is. Without this the shell wraps at its own
   * default column count rather than the one on screen.
   */
  onResize?: (cols: number, rows: number) => void;
  /** Called with the typed line when Enter is pressed. Omit for a read-only view. */
  onSubmit?: (input: string) => void;
  /** Keeps the output readable but stops accepting input, e.g. once the process has exited. */
  readOnly?: boolean;
  className?: string;
};

/**
 * Renders terminal output with xterm.js so ANSI escape sequences (colors, cursor
 * movement, progress bars) display the way they would in a real terminal.
 *
 * The caller passes the whole accumulated output string; this component tracks how
 * much of it has already been written and only emits the delta, so redraws stay
 * incremental. Mount one instance per terminal session (pass a `key`) — switching
 * sessions in place would replay unrelated output into the same buffer.
 *
 * Typing happens in an overlay input parked on the cursor cell rather than in the xterm
 * buffer itself: the line is only sent on Enter, and echoing it into the buffer early would
 * collide with whatever the shell writes in the meantime.
 */
export default function XTermView({ output, onResize, onSubmit, readOnly, className }: XTermViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const writtenRef = useRef(0);

  const [caret, setCaret] = useState<CaretPosition | null>(null);
  const [input, setInput] = useState("");

  const interactive = onSubmit !== undefined && !readOnly;

  // Held in a ref so a new callback identity doesn't tear down and rebuild the terminal.
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const measureCaret = useCallback(() => {
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
      // Keystrokes are collected by the overlay prompt below, not typed into the buffer.
      disableStdin: true,
      cursorBlink: false,
      // The overlay prompt holds focus, so xterm would otherwise paint an idle cursor outline
      // underneath it.
      cursorInactiveStyle: "none",
      scrollback: 10000,
      fontSize: TERMINAL_FONT_SIZE,
      lineHeight: 1.2,
      fontFamily: TERMINAL_FONT,
      theme: TERMINAL_THEME,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(host);
    // The overlay prompt draws its own caret; xterm's would sit on top of the typed text.
    term.write("\x1b[?25l");
    fitAddon.fit();

    termRef.current = term;
    writtenRef.current = 0;

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
      termRef.current = null;
      term.dispose();
    };
  }, [measureCaret]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    // The stream only ever appends, so a shorter string means the buffer was reset.
    if (output.length < writtenRef.current) {
      term.reset();
      term.write("\x1b[?25l");
      writtenRef.current = 0;
    }

    if (output.length > writtenRef.current) {
      term.write(output.slice(writtenRef.current));
      writtenRef.current = output.length;
    }
  }, [output]);

  // The prompt is the only place typing goes, so hand it focus as soon as the session opens.
  useEffect(() => {
    if (interactive) promptRef.current?.focus();
  }, [interactive]);

  const focusPrompt = () => {
    // Clicking to finish a drag-selection should leave that selection alone.
    if (window.getSelection()?.toString()) return;
    promptRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Typing while scrolled back into the scrollback: snap to the cursor, like a real terminal.
    if (!caret) termRef.current?.scrollToBottom();

    if (event.key === "Enter") {
      event.preventDefault();
      if (!input) return;
      // The provider terminates the line itself; sending our own \n submits a blank line too.
      onSubmit?.(input);
      setInput("");
      return;
    }

    if (event.key === "c" && event.ctrlKey) {
      // Ctrl+C only means "interrupt" when there is nothing to copy — in the draft or on the page.
      const field = event.currentTarget;
      if (field.selectionStart !== field.selectionEnd || window.getSelection()?.toString()) return;
      event.preventDefault();
      setInput("");
      onSubmit?.("\x03");
    }
  };

  return (
    // Click-to-focus mirrors a real terminal; the prompt input is the focusable control.
    <div ref={wrapperRef} className={`relative ${className ?? ""}`} onMouseUp={focusPrompt}>
      <div ref={hostRef} className="w-full h-full" />
      {interactive && (
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
            height: caret?.height ?? TERMINAL_FONT_SIZE,
            // Runs to the right edge; longer drafts scroll inside the field.
            width: `calc(100% - ${caret?.left ?? 0}px)`,
            lineHeight: `${caret?.height ?? TERMINAL_FONT_SIZE}px`,
            fontFamily: TERMINAL_FONT,
            fontSize: TERMINAL_FONT_SIZE,
            color: TERMINAL_THEME.foreground,
            caretColor: TERMINAL_THEME.cursor,
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
