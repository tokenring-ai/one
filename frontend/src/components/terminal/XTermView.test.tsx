import { beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

type DataHandler = (data: string) => void;
type CustomKeyHandler = (event: { key: string; type: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => boolean;

const constructedTerminals: FakeTerminal[] = [];

const dataHandlers = new Set<DataHandler>();
const customKeyHandlers = new Set<CustomKeyHandler>();
const selectionHandlers = new Set<() => void>();
let selection = "";
let lastConstructedOptions: Record<string, unknown> | null = null;

class FakeTerminal {
  options: Record<string, unknown> = {};
  cols = 80;
  rows = 24;
  written = "";

  writtenSequences: string[] = [];

  constructor(options: Record<string, unknown>) {
    lastConstructedOptions = options;
    this.options = { ...options };
    constructedTerminals.push(this);
  }

  loadAddon() {}
  open() {}
  write(data: string) {
    this.written += data;
    this.writtenSequences.push(data);
  }
  reset() {
    this.written = "";
  }
  refresh() {}
  focus() {}
  scrollToBottom() {}
  dispose() {}
  hasSelection() {
    return selection.length > 0;
  }
  getSelection() {
    return selection;
  }
  onData(handler: DataHandler) {
    dataHandlers.add(handler);
    return { dispose: () => dataHandlers.delete(handler) };
  }
  onSelectionChange(handler: () => void) {
    selectionHandlers.add(handler);
    return { dispose: () => selectionHandlers.delete(handler) };
  }
  onRender() {
    return { dispose: () => {} };
  }
  onCursorMove() {
    return { dispose: () => {} };
  }
  onScroll() {
    return { dispose: () => {} };
  }
  onResize() {
    return { dispose: () => {} };
  }
  attachCustomKeyEventHandler(handler: CustomKeyHandler) {
    customKeyHandlers.add(handler);
  }
  registeredLinkProviders: unknown[] = [];
  registerLinkProvider(provider: unknown) {
    this.registeredLinkProviders.push(provider);
    return { dispose: () => {} };
  }
}

class FakeFitAddon {
  fit() {}
}
class FakeSearchAddon {
  findNext = mock(() => true);
  findPrevious = mock(() => true);
  dispose() {}
}
class FakeWebLinksAddon {}

void mock.module("@xterm/xterm", () => ({ Terminal: FakeTerminal }));
void mock.module("@xterm/xterm/css/xterm.css", () => ({}));
void mock.module("@xterm/addon-fit", () => ({ FitAddon: FakeFitAddon }));
void mock.module("@xterm/addon-search", () => ({ SearchAddon: FakeSearchAddon }));
void mock.module("@xterm/addon-web-links", () => ({ WebLinksAddon: FakeWebLinksAddon }));

void mock.module("@tokenring-ai/one-frontend/hooks/useTheme.ts", () => ({
  useTheme: () => ["dark", mock(), "system"] as const,
}));

const { default: XTermView, matchWorkspacePaths } = await import("./XTermView.tsx");

describe("XTermView", () => {
  beforeEach(() => {
    dataHandlers.clear();
    customKeyHandlers.clear();
    selectionHandlers.clear();
    constructedTerminals.length = 0;
    selection = "";
    lastConstructedOptions = null;
  });

  it("constructs line mode with stdin disabled and renders the overlay prompt", () => {
    render(<XTermView output="hello" onSubmit={() => {}} />);

    expect(lastConstructedOptions?.disableStdin).toBe(true);
    expect(dataHandlers.size).toBe(0);
    expect(screen.getByLabelText("Terminal input")).toBeInTheDocument();
    cleanup();
  });

  it("constructs raw mode with stdin enabled and forwards onData to onInput", () => {
    const onInput = mock((_input: string) => {});
    render(<XTermView output="hello" inputMode="raw" onInput={onInput} />);

    expect(lastConstructedOptions?.disableStdin).toBe(false);
    expect(dataHandlers.size).toBe(1);
    expect(screen.queryByLabelText("Terminal input")).not.toBeInTheDocument();

    for (const handler of dataHandlers) handler("i");
    for (const handler of dataHandlers) handler("\x1b[A");
    expect(onInput.mock.calls.map(call => call[0])).toEqual(["i", "\x1b[A"]);
    cleanup();
  });

  it("hides xterm's cursor in line mode (overlay draws its own) but not in raw mode", () => {
    render(<XTermView output="x" inputMode="raw" onInput={() => {}} />);
    cleanup();
    render(<XTermView output="x" onSubmit={() => {}} />);
    cleanup();

    expect(constructedTerminals).toHaveLength(2);
    const [rawTerminal, lineTerminal] = constructedTerminals;
    // The shell controls the cursor in raw mode; line mode parks an overlay caret on top.
    expect(rawTerminal!.writtenSequences).not.toContain("\u001b[?25l");
    expect(lineTerminal!.writtenSequences).toContain("\u001b[?25l");
  });

  it("Ctrl+C with a selection copies instead of sending an interrupt; without one it passes through", () => {
    render(<XTermView output="x" inputMode="raw" onInput={() => {}} />);

    let clipboardText = "";
    Object.assign(navigator, {
      clipboard: {
        writeText: mock(async (text: string) => {
          clipboardText = text;
        }),
        readText: mock(async () => ""),
      },
    });

    for (const handler of customKeyHandlers) {
      const handled = handler({ key: "c", type: "keydown", ctrlKey: true });
      // No selection: the ^C must reach the pty.
      expect(handled).toBe(true);
    }

    selection = "git status";
    for (const handler of customKeyHandlers) {
      const handled = handler({ key: "c", type: "keydown", ctrlKey: true });
      // With a selection the handler consumes the key and copies instead.
      expect(handled).toBe(false);
    }
    expect(clipboardText).toBe("git status");
    cleanup();
  });

  it("paste shortcuts route the clipboard into onInput in raw mode", async () => {
    const onInput = mock((_input: string) => {});
    render(<XTermView output="x" inputMode="raw" onInput={onInput} />);

    Object.assign(navigator, {
      clipboard: {
        readText: mock(async () => "pasted"),
        writeText: mock(async () => {}),
      },
    });

    for (const handler of customKeyHandlers) {
      handler({ key: "v", type: "keydown", ctrlKey: true });
    }
    await Promise.resolve();
    await Promise.resolve();
    expect(onInput).toHaveBeenCalledWith("pasted");
    cleanup();
  });

  it("copy-on-select writes the selection to the clipboard", () => {
    render(<XTermView output="x" inputMode="raw" onInput={() => {}} />);

    const writeText = mock(async (_text: string) => {});
    Object.assign(navigator, { clipboard: { writeText, readText: mock(async () => "") } });

    selection = "selected text";
    for (const handler of selectionHandlers) handler();
    expect(writeText).toHaveBeenCalledWith("selected text");
    cleanup();
  });

  it("applies the dark theme palette and font size", () => {
    render(<XTermView output="x" inputMode="raw" onInput={() => {}} fontSize={16} />);

    expect(lastConstructedOptions?.theme).toMatchObject({ background: "#1a1a2e" });
    expect(lastConstructedOptions?.fontSize).toBe(16);
    cleanup();
  });

  it("Cmd/Ctrl+F opens the buffer search bar when focus is inside the terminal", () => {
    render(<XTermView output="x" onSubmit={() => {}} />);

    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Terminal input"), { key: "f", ctrlKey: true });
    expect(screen.getByRole("search", { name: "Search terminal buffer" })).toBeInTheDocument();
    cleanup();
  });

  it("leaves Cmd/Ctrl+F alone when the key event comes from outside the terminal", () => {
    render(
      <>
        <XTermView output="x" onSubmit={() => {}} />
        <textarea aria-label="Elsewhere" />
      </>,
    );

    const event = new KeyboardEvent("keydown", { key: "f", metaKey: true, bubbles: true, cancelable: true });
    screen.getByLabelText("Elsewhere").dispatchEvent(event);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true, cancelable: true }));

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    cleanup();
  });

  it("keeps the same xterm and its output when readOnly flips (line-mode command finishes)", () => {
    const { rerender } = render(<XTermView output={"$ ls\nfile.txt\n"} onSubmit={() => {}} />);
    expect(constructedTerminals).toHaveLength(1);
    expect(screen.getByLabelText("Terminal input")).toBeInTheDocument();

    rerender(<XTermView output={"$ ls\nfile.txt\n"} onSubmit={() => {}} readOnly />);

    expect(constructedTerminals).toHaveLength(1);
    expect(constructedTerminals[0]!.written).toContain("file.txt");
    expect(screen.queryByLabelText("Terminal input")).not.toBeInTheDocument();

    rerender(<XTermView output={"$ ls\nfile.txt\nexit 0\n"} onSubmit={() => {}} readOnly />);
    expect(constructedTerminals[0]!.written).toContain("file.txt\nexit 0");
    cleanup();
  });

  it("keeps writing new output once the caller's buffer is capped and stops growing", () => {
    // A capped buffer of 10 characters: the string stays the same length while outputEnd keeps counting.
    const { rerender } = render(<XTermView output="0123456789" outputEnd={10} onSubmit={() => {}} />);
    const term = constructedTerminals[0]!;
    expect(term.written).toContain("0123456789");

    rerender(<XTermView output="23456789AB" outputEnd={12} onSubmit={() => {}} />);
    expect(term.written).toContain("0123456789AB");

    rerender(<XTermView output="456789ABCD" outputEnd={14} onSubmit={() => {}} />);
    expect(term.written).toContain("0123456789ABCD");
    cleanup();
  });

  it("redraws from the buffer when more arrived than it still holds", () => {
    const { rerender } = render(<XTermView output="0123456789" outputEnd={10} onSubmit={() => {}} />);
    const term = constructedTerminals[0]!;
    rerender(<XTermView output="KLMNOPQRST" outputEnd={30} onSubmit={() => {}} />);
    expect(term.written).toContain("KLMNOPQRST");
    expect(term.written).not.toContain("0123456789KLM");
    cleanup();
  });

  it("toggles raw-mode stdin in place when readOnly flips", () => {
    const onInput = mock((_input: string) => {});
    const { rerender } = render(<XTermView output="top" inputMode="raw" onInput={onInput} />);
    rerender(<XTermView output="top" inputMode="raw" onInput={onInput} readOnly />);

    expect(constructedTerminals).toHaveLength(1);
    const term = constructedTerminals[0]!;
    expect(term.options.disableStdin).toBe(true);
    expect(term.written).toContain("top");
    for (const handler of dataHandlers) handler("q");
    expect(onInput).not.toHaveBeenCalled();
    cleanup();
  });

  it("replays the full accumulated output into a freshly created terminal", () => {
    render(<XTermView output="already here" onSubmit={() => {}} />);
    expect(constructedTerminals[0]!.written).toContain("already here");
    // Written exactly once — the output effect must not append it a second time.
    expect(constructedTerminals[0]!.written.split("already here")).toHaveLength(2);
    cleanup();
  });
});

describe("matchWorkspacePaths", () => {
  const workspace = "/repo";

  it("matches absolute paths under the workspace with 1-based columns", () => {
    const line = "error in /repo/src/app.ts at line 3";
    const matches = matchWorkspacePaths(line, workspace);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.text).toBe("/repo/src/app.ts");
    expect(matches[0]?.startColumn).toBe(line.indexOf("/repo") + 1);
  });

  it("matches the workspace directory itself", () => {
    expect(matchWorkspacePaths("cd /repo done", workspace).map(m => m.text)).toEqual(["/repo"]);
  });

  it("skips paths outside the workspace and URL lookalikes", () => {
    const line = "see /etc/hosts or https://example.com/repo/file and /repo/ok.ts";
    const matches = matchWorkspacePaths(line, workspace);
    expect(matches.map(m => m.text)).toEqual(["/repo/ok.ts"]);
  });

  it("returns nothing without a workspace", () => {
    expect(matchWorkspacePaths("/repo/src/app.ts", undefined)).toEqual([]);
  });
});
