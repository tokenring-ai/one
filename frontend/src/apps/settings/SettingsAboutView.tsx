import { ExternalLink, Package, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import packageJSON from "../../../package.json" with { type: "json" };
import SectionLabel from "../../components/ui/SectionLabel.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { cn } from "../../lib/utils.ts";
import { NavRow, SettingsCard } from "./shared.tsx";

const RESOURCE_LINKS = [
  { label: "GitHub", href: "https://github.com/tokenring-ai" },
  { label: "Website", href: "https://tokenring.ai" },
  { label: "X / Twitter", href: "https://x.com/TokenRingAI" },
];

/** The configuration, version and resources groups, shared by the standalone view and the combined settings page. */
export function AboutSections() {
  const runtimeLabel = useMemo(() => {
    if (typeof navigator === "undefined") return "Unknown";
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return "Edge";
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
    return "Browser";
  }, []);

  return (
    <>
      <section className="space-y-3">
        <SectionLabel className="px-1">Configuration</SectionLabel>
        <SettingsCard>
          <NavRow
            to="/configuration"
            title="Server configuration"
            description="Override plugin settings for this TokenRing instance"
            icon={<SlidersHorizontal className="w-4 h-4" />}
          />
          <NavRow
            to="/plugins"
            title="Plugins"
            description="Browse installed plugins and open their config"
            icon={<Package className="w-4 h-4" />}
            border={false}
          />
        </SettingsCard>
      </section>

      <section className="space-y-3">
        <SectionLabel className="px-1">About</SectionLabel>
        <SettingsCard>
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-primary">
            <p className="text-sm font-medium text-primary">TokenRing One</p>
            <span className="text-xs text-muted font-mono">v{packageJSON.version}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-primary">
            <p className="text-sm font-medium text-primary">Platform</p>
            <span className="text-xs text-muted">Multi-agent orchestration</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <p className="text-sm font-medium text-primary">Client</p>
            <span className="text-xs text-muted">{runtimeLabel}</span>
          </div>
        </SettingsCard>
      </section>

      <section className="space-y-3">
        <SectionLabel className="px-1">Resources</SectionLabel>
        <SettingsCard>
          {RESOURCE_LINKS.map((link, index, all) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-between px-4 py-3.5 hover:bg-hover transition-colors focus-ring text-sm font-medium text-primary",
                index < all.length - 1 && "border-b border-primary",
              )}
            >
              {link.label}
              <ExternalLink className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
            </a>
          ))}
        </SettingsCard>
      </section>
    </>
  );
}

export default function SettingsAboutView() {
  return (
    <ViewShell pad="page" bodyClassName="space-y-6">
      <AboutSections />
    </ViewShell>
  );
}
