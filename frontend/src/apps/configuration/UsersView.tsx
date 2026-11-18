import { KeyRound, MoreHorizontal, Smartphone, UserPlus } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu.tsx";
import RemoteAccessNotices, { type RemoteAccessFacts } from "../../components/users/RemoteAccessNotices.tsx";
import { SelfAccessLinkPanel } from "../../components/users/SelfAccessLinkPanel.tsx";
import { AddUserDialog, ChangeRoleDialog, NewLinkDialog, ResetPasswordDialog, ROLE_EXPLANATIONS, type Role } from "../../components/users/UserDialogs.tsx";
import { useAnnouncer } from "../../hooks/useAnnouncer.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { describeRpcError, isAdminRequiredError } from "../../lib/rpcErrors.ts";
import { useMe, usePendingAccessLinks, useRemoteAccessInfo, usersRPCClient, useUserList } from "../../rpc.ts";
import { Badge, Button, EmptyState, ErrorState, LoadingState, ViewShell } from "../../ui/index.ts";
import { usePanelTitle } from "../panelHooks.ts";

type UserRow = NonNullable<ReturnType<typeof useUserList>["data"]>["users"][number];
type LinkRow = NonNullable<ReturnType<typeof usePendingAccessLinks>["data"]>["links"][number];

function formatWhen(ms: number | null): string {
  if (ms === null) return "never";
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

type Dialog = { kind: "add" } | { kind: "link"; user: UserRow } | { kind: "password"; user: UserRow } | { kind: "role"; user: UserRow } | null;

function UserCard({ user, onAction }: { user: UserRow; onAction: (action: "link" | "password" | "role" | "signOut" | "remove", user: UserRow) => void }) {
  const readOnly = user.source === "config";
  return (
    <li aria-label={user.username} className="rounded-md border border-line bg-raised px-3 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 break-all text-sm font-semibold text-primary">{user.username}</span>
        <Badge tone={user.role === "admin" ? "accent" : "neutral"}>{ROLE_EXPLANATIONS[user.role].label}</Badge>
        {readOnly && <Badge tone="info">Set in the config file</Badge>}
        <span className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" aria-label={`Actions for ${user.username}`} icon={MoreHorizontal} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onAction("link", user)}>New access link</DropdownMenuItem>
            {!readOnly && <DropdownMenuItem onSelect={() => onAction("password", user)}>Reset password</DropdownMenuItem>}
            {!readOnly && <DropdownMenuItem onSelect={() => onAction("role", user)}>Change role</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => onAction("signOut", user)}>Sign out everywhere</DropdownMenuItem>
            {!readOnly && <DropdownMenuItem onSelect={() => onAction("remove", user)}>Remove</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-3">
        <div>
          <dt className="inline">Last sign-in: </dt>
          <dd className="inline text-secondary">{formatWhen(user.lastLoginAt)}</dd>
        </div>
        <div>
          <dt className="inline">Signed in on: </dt>
          <dd className="inline text-secondary">{plural(user.activeSessions, "device", "devices")}</dd>
        </div>
        <div>
          <dt className="inline">Waiting links: </dt>
          <dd className="inline text-secondary">{user.pendingAccessLinks}</dd>
        </div>
      </dl>
    </li>
  );
}

function PendingLinks({ links, onRevoke, revoking }: { links: LinkRow[]; onRevoke: (link: LinkRow) => void; revoking: string | null }) {
  return (
    <section aria-labelledby="pending-links-heading" className="space-y-2">
      <h2 id="pending-links-heading" className="text-sm font-semibold text-primary">
        Pending access links
      </h2>
      {links.length === 0 ? (
        <p className="text-sm text-muted">No links are waiting to be used.</p>
      ) : (
        <ul className="space-y-2">
          {links.map(link => (
            <li key={link.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-raised px-3 py-2 text-sm">
              <span className="min-w-0 break-all font-medium text-primary">{link.username}</span>
              <span className="text-xs text-muted">expires {formatWhen(link.expiresAt)}</span>
              {link.createdBy && <span className="text-xs text-muted">made by {link.createdBy}</span>}
              <span className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                busy={revoking === link.id}
                onClick={() => onRevoke(link)}
                aria-label={`Revoke the link for ${link.username}`}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminUsers({ me }: { me: string }) {
  const users = useUserList();
  const links = usePendingAccessLinks();
  const info = useRemoteAccessInfo();
  const { announce, region } = useAnnouncer();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const refresh = () => {
    void users.mutate();
    void links.mutate();
  };
  const facts: RemoteAccessFacts | null = info.data ? { isLoopback: info.data.isLoopback, isHttps: info.data.isHttps, warnings: info.data.warnings } : null;
  const storeProblem = users.data?.storeProblem ?? info.data?.storeProblem ?? null;

  const act = async (label: string, run: () => Promise<unknown>, done: string) => {
    setActionError(null);
    try {
      await run();
      announce(done);
      refresh();
    } catch (caught) {
      setActionError(`${label}: ${describeRpcError(caught)}`);
    }
  };

  const onAction = async (action: "link" | "password" | "role" | "signOut" | "remove", user: UserRow) => {
    if (action === "link" || action === "password" || action === "role") {
      setDialog({ kind: action, user });
      return;
    }
    if (action === "signOut") {
      const confirmed = await openConfirm({
        id: "users:sign-out",
        title: "Sign out everywhere",
        message: `Sign ${user.username} out on every device? Their account stays, and they can sign in again.`,
        confirmText: "Sign out",
        cancelText: "Cancel",
        variant: "warning",
        dontAskAgain: false,
      });
      if (confirmed)
        await act(
          `Could not sign ${user.username} out`,
          () => usersRPCClient.signOutUser({ username: user.username }),
          `${user.username} signed out everywhere`,
        );
      return;
    }
    const confirmed = await openConfirm({
      id: "users:remove",
      title: `Remove ${user.username}`,
      message: `Remove ${user.username}? Their account, ${plural(user.pendingAccessLinks, "waiting link", "waiting links")} and all ${plural(user.activeSessions, "sign-in", "sign-ins")} are removed straight away, and a phone that is open right now stops working on its next click. This cannot be undone.${user.username === me ? " This is you: you will be signed out." : ""}`,
      confirmText: "Remove user",
      cancelText: "Keep",
      variant: "danger",
      dontAskAgain: false,
    });
    if (confirmed) await act(`Could not remove ${user.username}`, () => usersRPCClient.removeUser({ username: user.username }), `${user.username} removed`);
  };

  const revoke = async (link: LinkRow) => {
    setRevoking(link.id);
    await act("Could not revoke the link", () => usersRPCClient.revokeAccessLink({ id: link.id }), `Link for ${link.username} revoked`);
    setRevoking(null);
  };

  let list: React.ReactNode;
  if (users.isLoading && !users.data) list = <LoadingState className="py-8" />;
  else if (users.error && !users.data)
    list = <ErrorState title="Failed to load users" error={users.error} onRetry={() => void users.mutate()} variant="inline" />;
  else if ((users.data?.users.length ?? 0) === 0)
    list = <EmptyState icon={UserPlus} title="No users yet" hint="Choose Add user to give someone their own sign-in." variant="compact" />;
  else
    list = (
      <ul aria-label="Users" className="space-y-2">
        {users.data?.users.map(user => (
          <UserCard key={user.username} user={user} onAction={(action, row) => void onAction(action, row)} />
        ))}
      </ul>
    );

  return (
    <>
      {region}
      <ConfirmDialog />
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-primary">People who can sign in</h2>
        <span className="flex-1" />
        <Button type="button" icon={UserPlus} onClick={() => setDialog({ kind: "add" })}>
          Add user
        </Button>
      </div>
      {facts && <RemoteAccessNotices facts={facts} />}
      {storeProblem && (
        <p role="alert" className="rounded-md border border-warning bg-warning-subtle px-3 py-2 text-sm text-primary">
          {storeProblem}
        </p>
      )}
      {actionError && (
        <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-3 py-2 text-sm text-primary">
          {actionError}
        </p>
      )}
      {list}
      <PendingLinks links={links.data?.links ?? []} onRevoke={link => void revoke(link)} revoking={revoking} />
      {dialog?.kind === "add" && <AddUserDialog facts={facts} onClose={() => setDialog(null)} onChanged={refresh} />}
      {dialog?.kind === "link" && <NewLinkDialog username={dialog.user.username} facts={facts} onClose={() => setDialog(null)} onChanged={refresh} />}
      {dialog?.kind === "password" && <ResetPasswordDialog username={dialog.user.username} onClose={() => setDialog(null)} onChanged={refresh} />}
      {dialog?.kind === "role" && (
        <ChangeRoleDialog username={dialog.user.username} current={dialog.user.role as Role} onClose={() => setDialog(null)} onChanged={refresh} />
      )}
    </>
  );
}

/** Configuration > Users: administrators manage who can sign in; everyone can sign themselves in on a phone. */
export default function UsersView() {
  usePanelTitle("Users");
  const me = useMe();
  const isAdmin = me.data?.role === "admin";

  let body: React.ReactNode;
  if (me.isLoading && !me.data) {
    body = <LoadingState className="py-8" />;
  } else if (me.error && !me.data) {
    body = isAdminRequiredError(me.error) ? null : (
      <ErrorState title="Failed to load your account" error={me.error} onRetry={() => void me.mutate()} variant="inline" />
    );
  } else if (isAdmin) {
    body = <AdminUsers me={me.data?.username ?? ""} />;
  } else {
    body = (
      <EmptyState
        icon={KeyRound}
        title="Only an administrator manages users"
        hint="Ask an administrator to add people, change roles or sign someone out. You can still sign yourself in on your phone below."
        variant="compact"
      />
    );
  }

  return (
    <ViewShell pad="page" width="prose">
      <div className="space-y-5">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold text-primary">Users</h1>
          <p className="text-sm text-muted">Who can sign in to this TokenRing, and how.</p>
        </header>
        {body}
        {me.data && (
          <section aria-labelledby="self-link-heading" className="space-y-2 border-t border-line pt-4">
            <h2 id="self-link-heading" className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              Sign in on another device
            </h2>
            <SelfAccessLinkPanel />
          </section>
        )}
      </div>
    </ViewShell>
  );
}
