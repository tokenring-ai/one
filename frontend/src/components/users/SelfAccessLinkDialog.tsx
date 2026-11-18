import { useState } from "react";
import { useAnnouncer } from "../../hooks/useAnnouncer.tsx";
import { describeRpcError } from "../../lib/rpcErrors.ts";
import { useMe, useRemoteAccessInfo, usersRPCClient } from "../../rpc.ts";
import Select from "../../ui/select.tsx";
import ModalShell from "../ui/ModalShell.tsx";
import AccessLinkResultDialog, { type IssuedLink } from "./AccessLinkResultDialog.tsx";
import { factsFromUrl, SELF_LINK_DEFAULT_MINUTES, SELF_LINK_EXPIRY_OPTIONS } from "./constants.ts";
import RemoteAccessNotices from "./RemoteAccessNotices.tsx";

/**
 * "Sign in on another device": makes a one-time link that signs the CURRENT person in on their phone. Open to every
 * signed-in user. Administrators see the server's exact warnings about the address before creating the link; members
 * cannot ask for them, so the address of this page stands in until the link exists (and its own address is then checked).
 */
export default function SelfAccessLinkDialog({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const isAdmin = me.data?.role === "admin";
  const info = useRemoteAccessInfo(isAdmin);
  const { announce, region } = useAnnouncer();
  const [minutes, setMinutes] = useState(String(SELF_LINK_DEFAULT_MINUTES));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedLink | null>(null);

  const username = me.data?.username ?? "you";

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await usersRPCClient.createMyAccessLink({ expiresInMinutes: Number(minutes) });
      setIssued({ url: result.url, expiresAt: result.expiresAt });
      announce("Access link created");
    } catch (caught) {
      setError(`Could not create the link: ${describeRpcError(caught)}`);
    } finally {
      setBusy(false);
    }
  };

  const done = () => {
    setIssued(null);
    onClose();
  };

  if (issued) {
    return (
      <>
        {region}
        <AccessLinkResultDialog username={username} link={issued} onDone={done} title="Sign in on another device">
          <RemoteAccessNotices facts={factsFromUrl(issued.url)} />
        </AccessLinkResultDialog>
      </>
    );
  }

  const facts = info.data ?? {
    isLoopback: factsFromUrl(window.location.href).isLoopback,
    isHttps: window.location.protocol === "https:",
  };

  return (
    <>
      {region}
      <ModalShell
        title="Sign in on another device"
        description="Open TokenRing on your phone as yourself."
        onClose={onClose}
        busy={busy}
        width="w-full max-w-md"
        error={error}
        confirmLabel="Create link and QR code"
        onConfirm={() => void create()}
      >
        <div className="mb-4 space-y-3">
          <p className="text-sm text-secondary">
            This makes a one-time link, shown as a QR code, that signs <strong>{username}</strong> in on another device. Anyone who opens it first is signed in
            as you, so treat it like a password.
          </p>
          <RemoteAccessNotices facts={{ ...facts, warnings: info.data?.warnings ?? [] }} />
          <Select label="Link expires after" value={minutes} onChange={setMinutes}>
            {SELF_LINK_EXPIRY_OPTIONS.map(option => (
              <option key={option.minutes} value={String(option.minutes)}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </ModalShell>
    </>
  );
}
