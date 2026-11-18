import { describe, expect, it } from "bun:test";
import { checkpointLabel } from "./checkpointLabel.ts";

describe("checkpointLabel", () => {
  it("names the todo and goal plugins' nudges instead of showing their banner", () => {
    expect(checkpointLabel("**AUTOMATED SYSTEM MESSAGE**\nYou still have open todos")).toBe("Automatic check-in");
    expect(checkpointLabel("**AUTOMATED SYSTEM MESSAGE — GOAL MODE**\nKeep going")).toBe("Goal check-in");
  });

  it("uses the first non-empty line without markdown emphasis", () => {
    expect(checkpointLabel("\n**Fix** the `build`\nmore detail")).toBe("Fix the build");
  });

  it("shortens long inputs and names empty ones", () => {
    expect(checkpointLabel("x".repeat(200))).toHaveLength(80);
    expect(checkpointLabel("   ")).toBe("Untitled checkpoint");
  });

  it("names slash commands without their arguments", () => {
    expect(checkpointLabel("/github repo list someuser")).toBe("Ran /github");
    expect(checkpointLabel("/work Fix the login bug")).toBe("Ran /work");
    // A message that starts with a path is not a command.
    expect(checkpointLabel("/Users/me/notes.md is broken")).toBe("/Users/me/notes.md is broken");
  });
});
