import { AtSign, Hash, Mail, MessageCircle, MessageSquare, Send } from "lucide-react";
import type { ElementType } from "react";

/**
 * Visual identity for a messaging / channel service.
 * Single source of truth for gradient badges, solid pills, and icons.
 */
export interface ServiceBrand {
  /** Canonical lowercase id (e.g. "slack"). Empty/unknown use "default". */
  id: string;
  /** Human-readable label (e.g. "Slack", "X"). */
  displayName: string;
  /** Tailwind gradient classes for icon badges (`from-… to-…`). */
  gradient: string;
  /** Soft solid background for pills/chips (`bg-…`). */
  solidBg: string;
  /** Text color for pills/chips (`text-…`). */
  solidText: string;
  /** Border color for pills/chips (`border-…`). */
  solidBorder: string;
  /** Icon component for badges and list rows. */
  icon: ElementType;
}

type SolidTone = Pick<ServiceBrand, "solidBg" | "solidText" | "solidBorder">;

function solid(tone: "purple" | "sky" | "indigo" | "gray" | "orange" | "red" | "emerald"): SolidTone {
  switch (tone) {
    case "purple":
      return {
        solidBg: "bg-purple-500/10",
        solidText: "text-purple-600 dark:text-purple-400",
        solidBorder: "border-purple-500/30",
      };
    case "sky":
      return {
        solidBg: "bg-sky-500/10",
        solidText: "text-sky-600 dark:text-sky-400",
        solidBorder: "border-sky-500/30",
      };
    case "indigo":
      return {
        solidBg: "bg-indigo-500/10",
        solidText: "text-indigo-600 dark:text-indigo-400",
        solidBorder: "border-indigo-500/30",
      };
    case "gray":
      return {
        solidBg: "bg-gray-500/10",
        solidText: "text-gray-700 dark:text-gray-300",
        solidBorder: "border-gray-500/30",
      };
    case "orange":
      return {
        solidBg: "bg-orange-500/10",
        solidText: "text-orange-600 dark:text-orange-400",
        solidBorder: "border-orange-500/30",
      };
    case "red":
      return {
        solidBg: "bg-red-500/10",
        solidText: "text-red-600 dark:text-red-400",
        solidBorder: "border-red-500/30",
      };
    case "emerald":
      return {
        solidBg: "bg-emerald-500/10",
        solidText: "text-emerald-600 dark:text-emerald-400",
        solidBorder: "border-emerald-500/30",
      };
  }
}

const DEFAULT_BRAND: ServiceBrand = {
  id: "default",
  displayName: "Unknown",
  gradient: "from-emerald-500 to-green-600",
  ...solid("emerald"),
  icon: MessageSquare,
};

/** Known services keyed by lowercase id (and aliases). */
const SERVICE_BRANDS: Record<string, ServiceBrand> = {
  slack: {
    id: "slack",
    displayName: "Slack",
    gradient: "from-purple-500 to-violet-600",
    ...solid("purple"),
    icon: Hash,
  },
  telegram: {
    id: "telegram",
    displayName: "Telegram",
    gradient: "from-sky-500 to-blue-600",
    ...solid("sky"),
    icon: Send,
  },
  discord: {
    id: "discord",
    displayName: "Discord",
    gradient: "from-indigo-500 to-violet-600",
    ...solid("indigo"),
    icon: MessageCircle,
  },
  x: {
    id: "x",
    displayName: "X",
    gradient: "from-gray-700 to-gray-900",
    ...solid("gray"),
    icon: AtSign,
  },
  twitter: {
    id: "twitter",
    displayName: "X",
    gradient: "from-gray-700 to-gray-900",
    ...solid("gray"),
    icon: AtSign,
  },
  reddit: {
    id: "reddit",
    displayName: "Reddit",
    gradient: "from-orange-500 to-red-600",
    ...solid("orange"),
    icon: MessageSquare,
  },
  email: {
    id: "email",
    displayName: "Email",
    gradient: "from-red-500 to-rose-600",
    ...solid("red"),
    icon: Mail,
  },
};

/**
 * Resolve brand identity for a messaging service or channel kind.
 * Case-insensitive; unknown services fall back to the default emerald brand
 * with a title-cased display name when a non-empty string is provided.
 */
export function getServiceBrand(service: string): ServiceBrand {
  const key = service.trim().toLowerCase();
  if (!key) return DEFAULT_BRAND;

  const known = SERVICE_BRANDS[key];
  if (known) return known;

  return {
    ...DEFAULT_BRAND,
    id: key,
    displayName: key.charAt(0).toUpperCase() + key.slice(1),
  };
}

/**
 * Returns a Tailwind gradient class for a known messaging service.
 * Unknown services fall back to a default emerald gradient.
 */
export function serviceGradient(service: string): string {
  return getServiceBrand(service).gradient;
}

/**
 * Title-case a messaging service name (slack → Slack, x → X).
 * Empty/unknown empty string → "Unknown".
 */
export function formatServiceName(service: string): string {
  return getServiceBrand(service).displayName;
}
