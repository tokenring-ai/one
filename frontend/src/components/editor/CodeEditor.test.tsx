import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import CodeEditor from "./CodeEditor.tsx";

void mock.module("@monaco-editor/react", () => ({
  default: ({ value }: { value: string }) => <textarea aria-label="monaco-editor" readOnly value={value} />,
}));

void mock.module("../../hooks/useTheme.ts", () => ({
  useTheme: () => ["dark"],
}));

describe("CodeEditor", () => {
  it("syncs editor content when content or file prop changes", () => {
    const { rerender } = render(<CodeEditor file="a.ts" content="const a = 1" />);
    expect(screen.getByRole("textbox", { name: "monaco-editor" })).toHaveValue("const a = 1");

    rerender(<CodeEditor file="b.ts" content="const b = 2" />);
    expect(screen.getByRole("textbox", { name: "monaco-editor" })).toHaveValue("const b = 2");
  });
});
