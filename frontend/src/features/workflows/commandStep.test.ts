import { describe, expect, it } from "bun:test";
import type { AvailableAgentCommand } from "./commandStep.ts";
import {
  defaultsForCommand,
  formatStepLabel,
  isStepFilled,
  MAX_STEP_RETRIES,
  missingRequiredFields,
  normalizeSteps,
  withOnError,
  withRetries,
} from "./commandStep.ts";

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

  it("withOnError and withRetries keep only non-default execution options", () => {
    const base = { command: "agent run", arguments: {}, remainder: "" };
    expect(withOnError(base, "continue")).toEqual({ ...base, onError: "continue" });
    expect(withOnError({ ...base, onError: "continue" }, "stop")).toEqual(base);
    expect(withRetries(base, 3)).toEqual({ ...base, retries: 3 });
    expect(withRetries({ ...base, retries: 3 }, 0)).toEqual(base);
    expect(withRetries(base, 2.7)).toEqual({ ...base, retries: 2 });
    expect(withRetries(base, 99)).toEqual({ ...base, retries: MAX_STEP_RETRIES });
    expect(withRetries(base, Number.NaN)).toEqual(base);
  });

  it("normalizeSteps preserves onError and retries but drops their defaults", () => {
    expect(
      normalizeSteps([
        { command: "a", arguments: {}, remainder: "", onError: "continue", retries: 2 },
        { command: "b", arguments: {}, remainder: "", onError: "stop", retries: 0 },
      ]),
    ).toEqual([
      { command: "a", arguments: {}, remainder: "", onError: "continue", retries: 2 },
      { command: "b", arguments: {}, remainder: "" },
    ]);
  });
});
