import { describe, expect, it } from "bun:test";
import type { ChatMessage } from "../types/agent-events.ts";
import { transcriptExportFileName, transcriptTitle, transcriptToJson, transcriptToMarkdown } from "./transcriptExport.ts";

const baseMessages: ChatMessage[] = [
  { type: "agent.created", message: "Agent created", timestamp: 1 },
  { type: "agent.status", status: "running", timestamp: 2, inputExecutionQueue: [], currentActivity: "idle" },
  {
    type: "input.received",
    timestamp: 3,
    requestId: "req-1",
    input: { from: "User", message: "Explain the build failure" },
  },
  { type: "toolCall", timestamp: 4, name: "ReadFile", args: { path: "/tmp/a.txt" }, message: "**File** Read a.txt", failed: false, result: "contents" },
  { type: "output.chat", message: "The build fails because X.", timestamp: 5 },
  { type: "agent.response", timestamp: 6, requestId: "req-1", status: "success", message: "The build fails because X." },
  { type: "agent.response", timestamp: 7, requestId: "req-2", status: "error", message: "Model unavailable" },
];

describe("transcriptTitle", () => {
  it("uses the first user message", () => {
    expect(transcriptTitle(baseMessages)).toBe("Explain the build failure");
  });

  it("truncates long messages and falls back without user input", () => {
    const long: ChatMessage[] = [
      {
        type: "input.received",
        timestamp: 1,
        requestId: "r",
        input: { from: "U", message: "word ".repeat(30) },
      },
    ];
    expect(transcriptTitle(long).length).toBeLessThanOrEqual(61);
    expect(transcriptTitle([{ type: "agent.created", message: "hi", timestamp: 1 }])).toBe("New session");
  });
});

describe("transcriptToMarkdown", () => {
  it("renders user turns, agent turns and tool calls, and skips status noise", () => {
    const markdown = transcriptToMarkdown(baseMessages);
    expect(markdown).toContain("# Explain the build failure");
    expect(markdown).toContain("## User");
    expect(markdown).toContain("Explain the build failure");
    expect(markdown).toContain("**Agent:**\n\nThe build fails because X.");
    expect(markdown).toContain("🔧 **File** Read a.txt");
    // Status/execution events are transport noise, not transcript content.
    expect(markdown).not.toContain("agent.status");
    expect(markdown).not.toContain("Running");
  });

  it("keeps error responses and does not repeat the final chat text for success", () => {
    const markdown = transcriptToMarkdown(baseMessages);
    expect(markdown).toContain("**Agent (error):**");
    // The success response repeats the last output.chat — it should appear once.
    expect(markdown.split("The build fails because X.").length - 1).toBe(1);
  });

  it("notes input attachments", () => {
    const withAttachment: ChatMessage[] = [
      {
        type: "input.received",
        timestamp: 1,
        requestId: "r",
        input: {
          from: "User",
          message: "see attached",
          attachments: [{ name: "log.txt", encoding: "text", mimeType: "text/plain", body: "..." }],
        },
      },
    ];
    expect(transcriptToMarkdown(withAttachment)).toContain("_Attachments: log.txt_");
  });
});

describe("transcriptToJson", () => {
  it("round-trips every message", () => {
    const parsed = JSON.parse(transcriptToJson(baseMessages)) as { title: string; messages: ChatMessage[] };
    expect(parsed.title).toBe("Explain the build failure");
    expect(parsed.messages).toHaveLength(baseMessages.length);
  });
});

describe("transcriptExportFileName", () => {
  it("slugs the title and stamps the date", () => {
    const name = transcriptExportFileName(baseMessages, "md");
    expect(name).toMatch(/^explain-the-build-failure-\d{4}-\d{2}-\d{2}\.md$/);
  });
});
