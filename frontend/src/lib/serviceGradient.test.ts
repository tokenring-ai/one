import { describe, expect, it } from "bun:test";
import { formatServiceName, getServiceBrand, serviceGradient } from "./serviceGradient.ts";

describe("serviceGradient", () => {
  it("maps known services to brand gradients", () => {
    expect(serviceGradient("slack")).toBe("from-purple-500 to-violet-600");
    expect(serviceGradient("telegram")).toBe("from-sky-500 to-blue-600");
    expect(serviceGradient("discord")).toBe("from-indigo-500 to-violet-600");
    expect(serviceGradient("x")).toBe("from-gray-700 to-gray-900");
    expect(serviceGradient("twitter")).toBe("from-gray-700 to-gray-900");
    expect(serviceGradient("reddit")).toBe("from-orange-500 to-red-600");
    expect(serviceGradient("email")).toBe("from-red-500 to-rose-600");
  });

  it("is case-insensitive", () => {
    expect(serviceGradient("Slack")).toBe("from-purple-500 to-violet-600");
    expect(serviceGradient("EMAIL")).toBe("from-red-500 to-rose-600");
  });

  it("falls back to emerald for unknown services", () => {
    expect(serviceGradient("unknown")).toBe("from-emerald-500 to-green-600");
    expect(serviceGradient("")).toBe("from-emerald-500 to-green-600");
  });
});

describe("getServiceBrand", () => {
  it("returns full brand tokens for known services", () => {
    const slack = getServiceBrand("slack");
    expect(slack.id).toBe("slack");
    expect(slack.displayName).toBe("Slack");
    expect(slack.gradient).toBe("from-purple-500 to-violet-600");
    expect(slack.solidBg).toBe("bg-purple-500/10");
    expect(slack.solidText).toContain("purple");
    expect(slack.solidBorder).toContain("purple");
    expect(slack.icon).toBeDefined();
  });

  it("aliases twitter to the X visual brand", () => {
    const twitter = getServiceBrand("twitter");
    const x = getServiceBrand("x");
    expect(twitter.gradient).toBe(x.gradient);
    expect(twitter.displayName).toBe("X");
    expect(twitter.id).toBe("twitter");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(getServiceBrand("  Discord  ").id).toBe("discord");
    expect(getServiceBrand("TELEGRAM").displayName).toBe("Telegram");
  });

  it("falls back for unknown and empty services", () => {
    const empty = getServiceBrand("");
    expect(empty.id).toBe("default");
    expect(empty.displayName).toBe("Unknown");
    expect(empty.gradient).toBe("from-emerald-500 to-green-600");

    const custom = getServiceBrand("my-bot");
    expect(custom.id).toBe("my-bot");
    expect(custom.displayName).toBe("My-bot");
    expect(custom.gradient).toBe(empty.gradient);
    expect(custom.solidBg).toBe(empty.solidBg);
  });
});

describe("formatServiceName", () => {
  it("title-cases known and unknown services", () => {
    expect(formatServiceName("slack")).toBe("Slack");
    expect(formatServiceName("telegram")).toBe("Telegram");
    expect(formatServiceName("x")).toBe("X");
    expect(formatServiceName("twitter")).toBe("X");
    expect(formatServiceName("custom")).toBe("Custom");
    expect(formatServiceName("")).toBe("Unknown");
  });
});
