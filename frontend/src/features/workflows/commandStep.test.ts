import { describe, expect, it } from "bun:test";
import type { AvailableAgentCommand } from "./commandStep.ts";
import { defaultsForCommand, formatStepLabel, isStepFilled, missingRequiredFields, normalizeSteps } from "./commandStep.ts";

const agentRun: AvailableAgentCommand = {
  name: "agent run",
  description: "Run an agent with a message",
  inputSchema: {
    args: {
      bg: { type: "flag", description: "Run in background" },
      type: { type: "string", description: "The type of agent to run", required: true },
      timeout: { type: "number", description: "Timeout ms", defaultValue: 0 },
    },
    remainder: { name: "message", description: "The message to send", required: true },
  },
};

describe("commandStep (structured)", () => {
  it("defaultsForCommand seeds schema defaults into arguments", () => {
    const step = defaultsForCommand(agentRun);
    expect(step.command).toBe("agent run");
    expect(step.arguments.bg).toBe(false);
    expect(step.arguments.timeout).toBe(0);
    expect(step.arguments.type).toBeUndefined();
    expect(step.remainder).toBe("");
  });

  it("formatStepLabel renders chat and command steps", () => {
    expect(formatStepLabel("hello world")).toBe("hello world");
    expect(
      formatStepLabel({
        command: "agent run",
        arguments: { type: "leader", bg: true },
        remainder: "scan",
      }),
    ).toBe("/agent run --type leader --bg scan");
  });

  it("isStepFilled requires content", () => {
    expect(isStepFilled("")).toBe(false);
    expect(isStepFilled("  ")).toBe(false);
    expect(isStepFilled("hi")).toBe(true);
    expect(isStepFilled({ command: "", arguments: {}, remainder: "" })).toBe(false);
    expect(isStepFilled({ command: "agent run", arguments: {}, remainder: "" })).toBe(true);
  });

  it("missingRequiredFields checks args and remainder", () => {
    const step = defaultsForCommand(agentRun);
    expect(missingRequiredFields(step, agentRun)).toEqual(["type", "message"]);
    step.arguments.type = "leader";
    step.remainder = "go";
    expect(missingRequiredFields(step, agentRun)).toEqual([]);
  });

  it("normalizeSteps drops blanks and strips empty args", () => {
    expect(
      normalizeSteps([
        "",
        "  chat me  ",
        { command: "", arguments: {}, remainder: "x" },
        { command: " agent run ", arguments: { bg: false, type: " leader ", timeout: 0 }, remainder: " go " },
      ]),
    ).toEqual([
      "  chat me",
      {
        command: "agent run",
        arguments: { type: "leader", timeout: 0 },
        remainder: " go",
      },
    ]);
  });
});
