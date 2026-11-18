import { BookOpen, Bot, Cloud, Code, Cpu, Database, GitFork, Mic, Sparkles, Video, Zap } from "lucide-react";
import type { ElementType } from "react";

/**
 * Visual identity for an AI model provider.
 * Single source of truth for icon + text color used in model pickers and catalogs.
 */
export interface ProviderBrand {
  /** Canonical lowercase id (e.g. "openai"). Empty/unknown use "default". */
  id: string;
  /** Human-readable label (e.g. "OpenAI"). */
  displayName: string;
  /** Tailwind text color classes for icons and labels. */
  color: string;
  /** Icon component for list headers and badges. */
  icon: ElementType;
}

const DEFAULT_BRAND: ProviderBrand = {
  id: "default",
  displayName: "Unknown",
  color: "text-muted",
  icon: Database,
};

/** Known providers keyed by lowercase id (and common aliases). */
const PROVIDER_BRANDS: Record<string, ProviderBrand> = {
  anthropic: {
    id: "anthropic",
    displayName: "Anthropic",
    color: "text-accent",
    icon: Sparkles,
  },
  azure: {
    id: "azure",
    displayName: "Azure",
    color: "text-blue-600 dark:text-blue-400",
    icon: Cloud,
  },
  cerebras: {
    id: "cerebras",
    displayName: "Cerebras",
    color: "text-amber-600 dark:text-amber-500",
    icon: Cpu,
  },
  chutes: {
    id: "chutes",
    displayName: "Chutes",
    color: "text-violet-600 dark:text-violet-400",
    icon: Cloud,
  },
  deepseek: {
    id: "deepseek",
    displayName: "DeepSeek",
    color: "text-cyan-600 dark:text-cyan-500",
    icon: Code,
  },
  elevenlabs: {
    id: "elevenlabs",
    displayName: "ElevenLabs",
    color: "text-indigo-600 dark:text-indigo-400",
    icon: Mic,
  },
  fal: {
    id: "fal",
    displayName: "Fal",
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    icon: Video,
  },
  google: {
    id: "google",
    displayName: "Google",
    color: "text-blue-500 dark:text-blue-400",
    icon: Sparkles,
  },
  groq: {
    id: "groq",
    displayName: "Groq",
    color: "text-orange-600 dark:text-orange-500",
    icon: Zap,
  },
  local: {
    id: "local",
    displayName: "Local",
    color: "text-emerald-600 dark:text-emerald-400",
    icon: Cpu,
  },
  meta: {
    id: "meta",
    displayName: "Meta",
    color: "text-blue-600 dark:text-blue-400",
    icon: Bot,
  },
  mimo: {
    id: "mimo",
    displayName: "MiMo",
    color: "text-teal-600 dark:text-teal-400",
    icon: Bot,
  },
  minimax: {
    id: "minimax",
    displayName: "MiniMax",
    color: "text-rose-600 dark:text-rose-400",
    icon: Bot,
  },
  nvidia: {
    id: "nvidia",
    displayName: "NVIDIA",
    color: "text-lime-600 dark:text-lime-400",
    icon: Cpu,
  },
  openai: {
    id: "openai",
    displayName: "OpenAI",
    color: "text-zinc-900 dark:text-white",
    icon: Bot,
  },
  openrouter: {
    id: "openrouter",
    displayName: "OpenRouter",
    color: "text-purple-600 dark:text-purple-400",
    icon: GitFork,
  },
  perplexity: {
    id: "perplexity",
    displayName: "Perplexity",
    color: "text-sky-600 dark:text-sky-400",
    icon: Sparkles,
  },
  qwen: {
    id: "qwen",
    displayName: "Qwen",
    color: "text-pink-600 dark:text-pink-500",
    icon: Cloud,
  },
  xai: {
    id: "xai",
    displayName: "xAI",
    color: "text-zinc-800 dark:text-zinc-100",
    icon: Cloud,
  },
  zai: {
    id: "zai",
    displayName: "Z.ai",
    color: "text-green-600 dark:text-green-500",
    icon: BookOpen,
  },
};

/**
 * Extract a provider code from a model id.
 * Supports `provider:model`, `provider/model`, and bare ids.
 */
export function providerCodeFromModelId(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return "";
  const beforeColon = trimmed.split(":")[0] ?? trimmed;
  const beforeSlash = beforeColon.split("/")[0] ?? beforeColon;
  return beforeSlash.trim().toLowerCase();
}

/**
 * Resolve brand identity for an AI provider.
 * Accepts provider codes (`openai`), display names (`OpenAI`), or model ids
 * (`openai:gpt-4o`, `openai/gpt-4o`). Case-insensitive.
 */
export function getProviderBrand(provider: string): ProviderBrand {
  const key = provider.trim().toLowerCase();
  if (!key) return DEFAULT_BRAND;

  const direct = PROVIDER_BRANDS[key];
  if (direct) return direct;

  // Model id forms: "openai:gpt-4" / "openai/gpt-4"
  const fromModelId = providerCodeFromModelId(key);
  if (fromModelId && fromModelId !== key) {
    const nested = PROVIDER_BRANDS[fromModelId];
    if (nested) return nested;
  }

  return {
    ...DEFAULT_BRAND,
    id: key,
    displayName: key.charAt(0).toUpperCase() + key.slice(1),
  };
}

/** True when `provider` matches a catalog entry (code, display name, or model id). */
export function isKnownProvider(provider: string): boolean {
  const key = provider.trim().toLowerCase();
  if (!key) return false;
  if (PROVIDER_BRANDS[key]) return true;
  const code = providerCodeFromModelId(key);
  return Boolean(code && PROVIDER_BRANDS[code]);
}

/**
 * Resolve brand from the first candidate that matches the catalog.
 * Falls back to the first non-empty candidate's generic brand, then default.
 * Useful when the group key may be a custom display name but model ids carry the code.
 */
export function resolveProviderBrand(...candidates: Array<string | undefined | null>): ProviderBrand {
  let fallback: ProviderBrand | undefined;
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    if (isKnownProvider(candidate)) return getProviderBrand(candidate);
    if (!fallback) fallback = getProviderBrand(candidate);
  }
  return fallback ?? DEFAULT_BRAND;
}

/** Tailwind text color for a provider (icons/labels). */
export function providerColor(provider: string): string {
  return getProviderBrand(provider).color;
}

/** Display name for a provider (openai → OpenAI). */
export function formatProviderName(provider: string): string {
  return getProviderBrand(provider).displayName;
}
