import formatError from "@tokenring-ai/utility/error/formatError";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { botRPCClient, useBots } from "../rpc.ts";
import { Button, Checkbox, Select, TextField } from "../ui/index.ts";

/** `service:id`, e.g. `telegram:123456789`, `slack:C0123ABCD` or `group:oncall`. */
const TARGET_PATTERN = /^[a-z][a-z0-9_-]*:\S+$/i;
const OTHER = "__other__";

type Outcome = { kind: "ok"; target: string } | { kind: "testFailed"; target: string; message: string } | { kind: "rejected"; message: string };

/**
 * Sets up where questions from unattended runs are sent, from the form that starts those runs.
 * It writes the same settings as Bots, Approval escalation (one place, two ways in) and then sends a test
 * message, so the person knows it reaches them before relying on it.
 */
export default function EscalationSetup({ onSaved }: { onSaved: () => void }) {
  const bots = useBots().data;
  const [choice, setChoice] = useState("");
  const [typed, setTyped] = useState("");
  const [alerts, setAlerts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: { target: string; label: string }[] = [];
    const add = (target: string, label: string) => {
      if (seen.has(target)) return;
      seen.add(target);
      out.push({ target, label });
    };
    for (const channel of bots?.discoveredChannels ?? []) add(channel.target, `${channel.title ?? channel.target} (channel, ${channel.service})`);
    for (const channel of bots?.discoveredChannels ?? [])
      if (channel.invitedBy) add(channel.invitedBy, `${channel.invitedBy} (added the bot to ${channel.title ?? channel.target})`);
    for (const group of bots?.groups ?? [])
      add(`group:${group.name}`, `${group.name} (group, ${group.members.length} ${group.members.length === 1 ? "member" : "members"})`);
    return out;
  }, [bots]);

  if (!bots) return <p className="text-xs text-muted">Loading messaging services…</p>;
  if (bots.services.length === 0) {
    return (
      <p className="text-xs text-muted" data-testid="escalation-needs-service">
        No messaging service is connected yet. Connect Telegram, Slack or Discord under{" "}
        <Link to="/bots" className="text-accent-soft hover:underline focus-ring rounded">
          Bots
        </Link>
        , then come back here.
      </p>
    );
  }

  const usingTyped = choice === OTHER || suggestions.length === 0;
  const target = (usingTyped ? typed : choice).trim();
  const targetError = usingTyped && target && !TARGET_PATTERN.test(target) ? "Use service:id, for example telegram:123456789 or group:oncall" : null;
  const canSave = target !== "" && targetError === null && !busy;

  const save = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      const saved = await botRPCClient.setEscalation({ target, jobAlertsEnabled: alerts });
      if (saved.status === "configRejected") {
        setOutcome({ kind: "rejected", message: saved.issues.map(issue => issue.message).join("; ") });
        return;
      }
      onSaved();
      try {
        const tested = await botRPCClient.testEscalation({});
        setOutcome(tested.status === "success" ? { kind: "ok", target: tested.target } : { kind: "testFailed", target, message: tested.message });
      } catch (error) {
        setOutcome({ kind: "testFailed", target, message: formatError(error) });
      }
    } catch (error) {
      setOutcome({ kind: "rejected", message: formatError(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-primary bg-secondary p-3" data-testid="escalation-setup">
      {suggestions.length > 0 && (
        <Select label="Send questions to" value={choice} onChange={setChoice} hint="Channels and people your bots already know about.">
          <option value="">Choose…</option>
          {suggestions.map(suggestion => (
            <option key={suggestion.target} value={suggestion.target}>
              {suggestion.label}
            </option>
          ))}
          <option value={OTHER}>Another address…</option>
        </Select>
      )}
      {usingTyped && (
        <TextField
          label={suggestions.length > 0 ? "Address" : "Send questions to"}
          value={typed}
          onChange={setTyped}
          placeholder="telegram:123456789"
          mono
          error={targetError}
          hint="A person (telegram:123456789), a channel (slack:C0123ABCD) or a group (group:oncall)."
        />
      )}
      <p className="text-xs text-muted">
        A reply in that chat answers the question, so choose a private chat or a channel only people you trust can post in. A run is asked after 5 minutes and
        only for actions it was allowed to do on its own.
      </p>
      <Checkbox checked={alerts} onChange={setAlerts} label="Also message this target when a scheduled, queued or workflow run fails or is interrupted" />
      <div className="flex flex-wrap items-center gap-2">
        <Button busy={busy} disabled={!canSave} onClick={() => void save()}>
          Save and send a test message
        </Button>
        <span className="text-xs text-muted">
          More options, such as the wait time, are under{" "}
          <Link to="/bots" className="text-accent-soft hover:underline focus-ring rounded">
            Bots
          </Link>
          .
        </span>
      </div>
      {outcome?.kind === "ok" && (
        <p className="text-xs text-success" role="status">
          Saved. A test message was sent to {outcome.target}.
        </p>
      )}
      {outcome?.kind === "testFailed" && (
        <p className="text-xs text-danger" role="alert">
          Saved, but the test message to {outcome.target} did not go through: {outcome.message}. Check the address and that the bot is in that chat.
        </p>
      )}
      {outcome?.kind === "rejected" && (
        <p className="text-xs text-danger" role="alert">
          Could not save: {outcome.message}
        </p>
      )}
    </div>
  );
}
