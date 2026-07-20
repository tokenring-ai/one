import { Moon, Settings, SlidersHorizontal, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useSidebar } from "../../components/SidebarContext.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import { useTheme } from "../../hooks/useTheme.ts";

export default function SettingsApp() {
  const [theme, setTheme] = useTheme();
  const { isSidebarExpanded, toggleSidebar } = useSidebar();

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Settings"
        subtitle="Configure your TokenRing preferences"
        icon={<Settings className="w-4 h-4" />}
        iconGradient="from-stone-500 to-gray-600"
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Appearance */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">Appearance</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-primary last:border-0">
                <div>
                  <p className="text-sm font-medium text-primary">Theme</p>
                  <p className="text-2xs text-muted mt-0.5">Choose between light and dark mode</p>
                </div>
                <div className="flex items-center gap-1 bg-tertiary rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      theme === "light" ? "bg-secondary text-primary shadow-sm" : "text-muted hover:text-primary"
                    }`}
                    aria-pressed={theme === "light"}
                  >
                    <Sun className="w-3.5 h-3.5" /> Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      theme === "dark" ? "bg-secondary text-primary shadow-sm" : "text-muted hover:text-primary"
                    }`}
                    aria-pressed={theme === "dark"}
                  >
                    <Moon className="w-3.5 h-3.5" /> Dark
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Layout */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">Layout</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-primary">Sidebar</p>
                  <p className="text-2xs text-muted mt-0.5">Show or hide the navigation sidebar</p>
                </div>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-ring ${
                    isSidebarExpanded ? "bg-accent" : "bg-tertiary"
                  }`}
                  role="switch"
                  aria-checked={isSidebarExpanded}
                  aria-label="Toggle sidebar"
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isSidebarExpanded ? "translate-x-4" : "translate-x-0"}`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Server configuration */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">Server</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <Link to="/configuration" className="flex items-center justify-between px-4 py-3.5 hover:bg-hover transition-colors focus-ring">
                <div>
                  <p className="text-sm font-medium text-primary">Server configuration</p>
                  <p className="text-2xs text-muted mt-0.5">Override plugin settings for this TokenRing instance</p>
                </div>
                <SlidersHorizontal className="w-4 h-4 text-muted" />
              </Link>
            </div>
          </section>

          {/* About */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">About</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-primary">
                <p className="text-sm font-medium text-primary">TokenRing AI</p>
                <span className="text-2xs text-muted font-mono">v0.2.40</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5">
                <p className="text-sm font-medium text-primary">Platform</p>
                <span className="text-2xs text-muted">Multi-agent orchestration</span>
              </div>
            </div>
          </section>

          {/* Links */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">Resources</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
              {[
                { label: "GitHub", href: "https://github.com/tokenring-ai" },
                { label: "Website", href: "https://tokenring.ai" },
                { label: "X / Twitter", href: "https://x.com/TokenRingAI" },
              ].map((link, i, arr) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between px-4 py-3.5 hover:bg-hover transition-colors focus-ring text-sm font-medium text-primary ${i < arr.length - 1 ? "border-b border-primary" : ""}`}
                >
                  {link.label}
                  <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <title>{link.label}</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
