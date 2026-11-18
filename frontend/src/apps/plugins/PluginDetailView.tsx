import { Copy, ExternalLink, Package, Settings2, X } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SectionLabel from "../../components/ui/SectionLabel.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import type { ViewProps } from "../../layout/define.ts";
import { copyToClipboard } from "../../lib/clipboard.ts";
import { usePlugins } from "../../rpc.ts";
import Button from "../../ui/button.tsx";
import { configurationPath, type InstalledPlugin, packageShortName, usePluginsNavigation } from "./shared.tsx";

function RegistrationList({ title, items, empty }: { title: string; items: readonly string[]; empty: string }) {
  return (
    <section className="space-y-1.5" aria-label={title}>
      <SectionLabel meta={items.length}>{title}</SectionLabel>
      {items.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map(item => (
            <li key={item} className="font-mono text-xs text-primary break-all">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PluginDetail({ plugin, onClose }: { plugin: InstalledPlugin; onClose: () => void }) {
  return (
    <ViewShell
      pad="page"
      header={
        <ViewHeader
          icon={Package}
          iconGradient="from-accent to-violet-600"
          title={plugin.displayName}
          subtitle={plugin.name}
          actions={[{ icon: <X className="w-4 h-4" />, label: "Close plugin details", onClick: onClose }]}
        />
      }
      bodyClassName="space-y-3"
    >
      <section className="space-y-3" aria-label={`Details for ${plugin.displayName}`}>
        <p className="text-xs text-secondary whitespace-pre-wrap">{plugin.description || "No description provided."}</p>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted">Version</dt>
          <dd className="font-mono text-primary">v{plugin.version}</dd>
          <dt className="text-muted">Package</dt>
          <dd className="font-mono text-primary break-all">{plugin.name}</dd>
          <dt className="text-muted">Configuration</dt>
          <dd className="text-primary">{plugin.hasConfig ? "Has settings UI" : "No config schema"}</dd>
        </dl>

        <div className="flex flex-wrap gap-2 pt-1">
          {plugin.hasConfig ? (
            <Link
              to={configurationPath(plugin.name)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-on-accent hover:bg-accent-hover transition-colors focus-ring"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Open configuration
              <ExternalLink className="w-3 h-3 opacity-80" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted bg-tertiary border border-primary">
              <Settings2 className="w-3.5 h-3.5" />
              No configuration available
            </span>
          )}
          <Button variant="secondary" icon={Copy} onClick={() => void copyToClipboard(plugin.name, { label: "package name" })}>
            Copy package name
          </Button>
          <Button variant="secondary" icon={Copy} onClick={() => void copyToClipboard(packageShortName(plugin.name), { label: "short name" })}>
            Copy short name
          </Button>
        </div>

        <div className="space-y-3 pt-1">
          <RegistrationList title="Services" items={plugin.services} empty="No services registered." />
          <RegistrationList title="Tools" items={plugin.tools} empty="No tools registered." />
          <RegistrationList title="Commands" items={plugin.commands} empty="No commands registered." />
          <RegistrationList title="RPC methods" items={plugin.rpcMethods} empty="No RPC methods registered." />
        </div>
      </section>
    </ViewShell>
  );
}

/** One installed plugin. The parameter-less instance is the "select a plugin" tab. */
export default function PluginDetailView({ params }: ViewProps) {
  const plugins = usePlugins();
  const { closePlugin } = usePluginsNavigation();
  const name = params.name || undefined;

  /** Closing also leaves `/plugins/<name>`, so the list deselects. */
  const close = () => {
    if (name) closePlugin(name);
  };

  if (!name) {
    return (
      <ViewShell>
        <EmptyState
          variant="page"
          icon={Package}
          title="Select a plugin"
          hint="Pick a plugin from the list to see its version, package name, configuration, and what it registers."
        />
      </ViewShell>
    );
  }

  if (plugins.isLoading && !plugins.data) {
    return (
      <ViewShell>
        <LoadingState message="Loading plugins…" className="h-full" />
      </ViewShell>
    );
  }
  if (plugins.error && !plugins.data) {
    return (
      <ViewShell>
        <ErrorState title="Failed to load plugins" error={plugins.error} onRetry={() => void plugins.mutate()} variant="page" />
      </ViewShell>
    );
  }

  const plugin = (plugins.data?.plugins ?? []).find(candidate => candidate.name === name);
  if (!plugin) {
    return (
      <ViewShell>
        <EmptyState
          variant="page"
          icon={Package}
          title="Plugin not found"
          hint={`"${name}" is not installed on this instance. It may have been removed.`}
          ctaLabel="Close panel"
          onCta={close}
        />
      </ViewShell>
    );
  }

  return <PluginDetail plugin={plugin} onClose={close} />;
}
