import { describe, expect, it } from "bun:test";
import { formatProviderName, getProviderBrand, isKnownProvider, providerCodeFromModelId, providerColor, resolveProviderBrand } from "./providerBrand.ts";

describe("getProviderBrand", () => {
  it("maps known providers to brand tokens", () => {
    const openai = getProviderBrand("openai");
    expect(openai.id).toBe("openai");
    expect(openai.displayName).toBe("OpenAI");
    expect(openai.color).toBe("text-zinc-900 dark:text-white");
    expect(openai.icon).toBeDefined();

    expect(getProviderBrand("anthropic").color).toBe("text-accent");
    expect(getProviderBrand("groq").color).toContain("orange");
    expect(getProviderBrand("openrouter").color).toContain("purple");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(getProviderBrand("  OpenAI  ").id).toBe("openai");
    expect(getProviderBrand("ANTHROPIC").displayName).toBe("Anthropic");
    expect(getProviderBrand("xAI").id).toBe("xai");
  });

  it("resolves brand from model ids", () => {
    expect(getProviderBrand("openai:gpt-4o").id).toBe("openai");
    expect(getProviderBrand("anthropic/claude-sonnet").id).toBe("anthropic");
    expect(getProviderBrand("OpenAI:gpt-5").id).toBe("openai");
  });

  it("falls back for unknown and empty providers", () => {
    const empty = getProviderBrand("");
    expect(empty.id).toBe("default");
    expect(empty.displayName).toBe("Unknown");
    expect(empty.color).toBe("text-muted");

    const custom = getProviderBrand("acme-llm");
    expect(custom.id).toBe("acme-llm");
    expect(custom.displayName).toBe("Acme-llm");
    expect(custom.color).toBe(empty.color);
  });
});

describe("providerCodeFromModelId", () => {
  it("extracts provider from colon and slash forms", () => {
    expect(providerCodeFromModelId("openai:gpt-4o")).toBe("openai");
    expect(providerCodeFromModelId("anthropic/claude-sonnet")).toBe("anthropic");
    expect(providerCodeFromModelId("  groq:llama-3  ")).toBe("groq");
  });

  it("returns empty for blank input", () => {
    expect(providerCodeFromModelId("")).toBe("");
    expect(providerCodeFromModelId("   ")).toBe("");
  });
});

describe("providerColor", () => {
  it("returns brand color", () => {
    expect(providerColor("deepseek")).toContain("cyan");
    expect(providerColor("unknown")).toBe("text-muted");
  });
});

describe("formatProviderName", () => {
  it("returns display names for known providers", () => {
    expect(formatProviderName("openai")).toBe("OpenAI");
    expect(formatProviderName("xai")).toBe("xAI");
    expect(formatProviderName("zai")).toBe("Z.ai");
    expect(formatProviderName("custom")).toBe("Custom");
    expect(formatProviderName("")).toBe("Unknown");
  });
});

describe("isKnownProvider / resolveProviderBrand", () => {
  it("detects catalog providers including model ids", () => {
    expect(isKnownProvider("openai")).toBe(true);
    expect(isKnownProvider("OpenAI")).toBe(true);
    expect(isKnownProvider("anthropic/claude")).toBe(true);
    expect(isKnownProvider("acme-llm")).toBe(false);
    expect(isKnownProvider("")).toBe(false);
  });

  it("prefers the first known candidate", () => {
    expect(resolveProviderBrand("Custom Cloud", "openai:gpt-4o").id).toBe("openai");
    expect(resolveProviderBrand("openai", "anthropic:claude").id).toBe("openai");
    expect(resolveProviderBrand("mystery", "also-mystery").id).toBe("mystery");
    expect(resolveProviderBrand(null, undefined, "").id).toBe("default");
  });
});
