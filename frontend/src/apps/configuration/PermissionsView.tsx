import formatError from "@tokenring-ai/utility/error/formatError";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { chatRPCClient, usePermissionGrants } from "../../rpc.ts";
import { Badge, Button, EmptyState, ErrorState, LoadingState, toastManager, ViewShell } from "../../ui/index.ts";
import { usePanelTitle } from "../panelHooks.ts";

type Grant = NonNullable<ReturnType<typeof usePermissionGrants>["data"]>["grants"][number];

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function GrantRow({ grant, revoking, onRevoke }: { grant: Grant; revoking: boolean; onRevoke: (grant: Grant) => void }) {
  return (
    <li aria-label={grant.id} className="rounded-md border border-line bg-surface px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <code className="min-w-0 break-all text-sm font-medium text-primary">{grant.id}</code>
        {grant.source === "workspace" && <Badge tone="neutral">Workspace</Badge>}
        {grant.ignoredReason && <Badge tone="warning">Not in effect: {grant.ignoredReason}</Badge>}
        <span className="flex-1" />
        <Button variant="ghost" busy={revoking} onClick={() => onRevoke(grant)} aria-label={`Revoke ${grant.id}`}>
          Revoke
        </Button>
      </div>
      {grant.summary && <p className="mt-0.5 text-sm text-secondary">{grant.summary}</p>}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        <span>Granted {formatDate(grant.grantedAt)}</span>
        {grant.uses === 0 || !grant.lastUsedAt ? <span className="text-muted">never used</span> : <span>Last used {formatDate(grant.lastUsedAt)}</span>}
        <span>{grant.uses === 1 ? "1 use" : `${grant.uses} uses`}</span>
      </div>
    </li>
  );
}

/** Configuration > Permissions: the actions agents may do without asking, each with Revoke. */
export default function PermissionsView() {
  usePanelTitle("Permissions");
  const query = usePermissionGrants();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const [revoking, setRevoking] = useState<string | null>(null);
  const grants = query.data?.grants ?? [];

  const revoke = async (grant: Grant) => {
    const what = grant.summary ? `${grant.summary} (${grant.id})` : grant.id;
    const confirmed = await openConfirm({
      id: "configuration:revoke-permission",
      title: "Revoke permission",
      message: `Revoke "${grant.id}"? Agents will ask for approval again before they ${grant.summary ? grant.summary.charAt(0).toLowerCase() + grant.summary.slice(1) : "do this"}, and unattended runs will refuse it. This covers: ${what}.`,
      confirmText: "Revoke",
      cancelText: "Keep",
      variant: "danger",
      dontAskAgain: false,
    });
    if (!confirmed) return;
    setRevoking(grant.id);
    try {
      const result = await chatRPCClient.revokePermissionGrant({ id: grant.id });
      if (result.status === "rejected") toastManager.error(`Could not revoke "${grant.id}": ${result.message}`);
      else if (result.status === "notFound") toastManager.info(`"${grant.id}" was already revoked`);
      void query.mutate();
    } catch (error) {
      toastManager.error(`Could not revoke "${grant.id}": ${formatError(error, { includeStack: false })}`);
    } finally {
      setRevoking(null);
    }
  };

  let body: React.ReactNode;
  if (query.isLoading && !query.data) {
    body = <LoadingState className="py-8" />;
  } else if (query.error && !query.data) {
    body = <ErrorState title="Failed to load permissions" error={query.error} onRetry={() => void query.mutate()} variant="inline" />;
  } else if (grants.length === 0) {
    body = (
      <EmptyState
        icon={ShieldCheck}
        title="Nothing is allowed without asking yet"
        hint="When TokenRing asks before doing something and you choose Always allow, it appears here and you can take it back at any time."
        variant="inline"
      />
    );
  } else {
    body = (
      <ul aria-label="Things TokenRing may do without asking" className="space-y-2">
        {grants.map(grant => (
          <GrantRow key={`${grant.source}:${grant.id}`} grant={grant} revoking={revoking === grant.id} onRevoke={target => void revoke(target)} />
        ))}
      </ul>
    );
  }

  return (
    <ViewShell pad="page" width="prose" data-testid="permissions-view">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-primary">Things TokenRing may do without asking</h2>
          <p className="mt-0.5 text-xs text-muted">
            Each item below is a standing yes you gave by choosing Always allow, such as publishing to one blog. TokenRing does it without asking, including
            scheduled and queued runs while you are away. Choose Revoke and it asks again.
          </p>
          <p className="mt-1.5 text-xs text-muted" data-testid="permissions-reassurance">
            TokenRing asks you before it sends an email, posts online or publishes, unless you have chosen Always allow for that kind of action, or turned the
            chat setting "Go ahead without asking, up to safety level" up to 8 or higher. It does not ask before every use of your AI service, or before making
            images, audio or video, so keep an eye on usage in your AI provider account.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
            <li>
              Risky actions such as force pushes, dropping database tables, running as administrator or changing credentials can never be allowed without
              asking.
              {query.data && <> (Advanced: the highest safety level a permission can cover here is {query.data.maxGrantLevel}.)</>}
            </li>
            <li>Bots in shared channels cannot grant permissions, and agents cannot grant themselves any. Only you can, here or when asked.</li>
          </ul>
        </div>
        {body}
      </div>
      <ConfirmDialog />
    </ViewShell>
  );
}
