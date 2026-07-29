import { Check, ChevronRight, Monitor, Moon, Package, RotateCcw, Settings, SlidersHorizontal, Sun, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import packageJSON from "../../../package.json" with { type: "json" };
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import { useSidebar } from "../../components/SidebarContext.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import { notificationManager } from "../../components/ui/toast.tsx";
import { type ThemePreference, useTheme } from "../../hooks/useTheme.ts";

/** Client-side keys owned by the frontend UI (not user content like calendar events). */
const CLIENT_PREFERENCE_KEYS = ["theme", "tokenring-sidebar-expanded", "tokenring-mobile-open", "tokenring-chat-inputs"] as const;

function ToggleSwitch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-accent" : "bg-tertiary"
      }`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-1 bg-tertiary rounded-lg p-1" role="group" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
            value === option.value ? "bg-secondary text-primary shadow-sm" : "text-muted hover:text-primary"
          }`}
          aria-pressed={value === option.value}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SettingsRow({ title, description, children, border = true }: { title: string; description?: string; children: ReactNode; border?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-3.5 ${border ? "border-b border-primary" : ""}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary">{title}</p>
        {description ? <p className="text-2xs text-muted mt-0.5">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NavRow({ to, title, description, icon, border = true }: { to: string; title: string; description: string; icon: ReactNode; border?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-hover transition-colors focus-ring ${border ? "border-b border-primary" : ""}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 text-muted shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">{title}</p>
          <p className="text-2xs text-muted mt-0.5">{description}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted shrink-0" />
    </Link>
  );
}

export default function SettingsApp() {
  const [resolvedTheme, setTheme, preference] = useTheme();
  const { isSidebarExpanded, toggleSidebar, resetToDefaults, localStorageAvailable } = useSidebar();
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmResetLayout, setConfirmResetLayout] = useState(false);

  const themeOptions = useMemo(
    () =>
      [
        { value: "light" as const, label: "Light", icon: <Sun className="w-3.5 h-3.5" /> },
        { value: "dark" as const, label: "Dark", icon: <Moon className="w-3.5 h-3.5" /> },
        { value: "system" as const, label: "System", icon: <Monitor className="w-3.5 h-3.5" /> },
      ] satisfies { value: ThemePreference; label: string; icon: ReactNode }[],
    [],
  );

  const handleResetLayout = () => {
    resetToDefaults();
    setConfirmResetLayout(false);
    notificationManager.success("Layout reset to defaults");
  };

  const handleClearPreferences = () => {
    for (const key of CLIENT_PREFERENCE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
    }
    setTheme("system");
    resetToDefaults();
    setConfirmClear(false);
    notificationManager.success("Local preferences cleared");
    // Reload so chat draft context and other modules re-read storage
    window.setTimeout(() => {
      window.location.reload();
    }, 400);
  };

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
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Settings"
        subtitle="Configure your TokenRing preferences"
        icon={<Settings className="w-4 h-4" />}
        iconGradient="from-stone-500 to-gray-600"
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {!localStorageAvailable && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-2xs text-amber-700 dark:text-amber-300" role="status">
              Browser storage is unavailable. Theme and layout choices will not persist across sessions.
            </div>
          )}

          {/* Appearance */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">Appearance</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <SettingsRow
                title="Theme"
                description={preference === "system" ? `Follows system appearance (currently ${resolvedTheme})` : "Choose light, dark, or match your system"}
                border={false}
              >
                <SegmentedControl value={preference} onChange={setTheme} options={themeOptions} ariaLabel="Theme preference" />
              </SettingsRow>
            </div>
          </section>

          {/* Layout */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">Layout</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <SettingsRow title="Expanded sidebar" description="Show labels and full navigation width">
                <ToggleSwitch checked={isSidebarExpanded} onChange={toggleSidebar} label="Toggle expanded sidebar" />
              </SettingsRow>
              <SettingsRow title="Reset layout" description="Restore sidebar defaults for this device" border={false}>
                <button
                  type="button"
                  onClick={() => setConfirmResetLayout(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-tertiary text-primary hover:bg-hover border border-primary transition-colors focus-ring cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </SettingsRow>
            </div>
          </section>

          {/* Server & account configuration (existing surfaces) */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">Configuration</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
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
            </div>
          </section>

          {/* Data / privacy (client-side only) */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">Data</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <SettingsRow
                title="Local storage"
                description={
                  localStorageAvailable ? "Theme, layout, and chat drafts are saved in this browser" : "Storage is blocked — preferences stay in memory only"
                }
              >
                <span
                  className={`inline-flex items-center gap-1 text-2xs font-medium px-2 py-1 rounded-full ${
                    localStorageAvailable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {localStorageAvailable ? (
                    <>
                      <Check className="w-3 h-3" /> Available
                    </>
                  ) : (
                    "Unavailable"
                  )}
                </span>
              </SettingsRow>
              <SettingsRow title="Clear local preferences" description="Remove theme, layout, and chat draft data from this browser" border={false}>
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={!localStorageAvailable}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </SettingsRow>
            </div>
          </section>

          {/* About */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">About</h2>
            <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-primary">
                <p className="text-sm font-medium text-primary">TokenRing One</p>
                <span className="text-2xs text-muted font-mono">v{packageJSON.version}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-primary">
                <p className="text-sm font-medium text-primary">Platform</p>
                <span className="text-2xs text-muted">Multi-agent orchestration</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5">
                <p className="text-sm font-medium text-primary">Client</p>
                <span className="text-2xs text-muted">{runtimeLabel}</span>
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

      {confirmResetLayout && (
        <ConfirmDialog
          title="Reset layout?"
          message="The sidebar will expand and mobile drawer state will return to defaults on this device."
          confirmText="Reset"
          cancelText="Cancel"
          variant="info"
          onConfirm={handleResetLayout}
          onCancel={() => setConfirmResetLayout(false)}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Clear local preferences?"
          message="This removes theme, sidebar, and chat draft data stored in this browser. Server configuration and account data are not affected. The page will reload."
          confirmText="Clear preferences"
          cancelText="Cancel"
          variant="danger"
          onConfirm={handleClearPreferences}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
