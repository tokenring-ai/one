import { Check } from "lucide-react";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useConfirmSkipPreferences } from "../../hooks/useConfirmDialog.tsx";
import Badge from "../../ui/badge.tsx";
import Button from "../../ui/button.tsx";
import { SettingsCard, SettingsRow } from "./shared.tsx";

/**
 * Readable name for a stored skip key. Keys are either a prompt's title (the
 * default) or a `scope:kebab-action` id such as `agents:delete-agent`, which
 * renders as "Delete agent (Agents)". Anything else is shown as stored.
 */
export function confirmSkipLabel(id: string): string {
  const match = /^([a-z0-9][\w.-]*):([a-z0-9][\w.-]*)$/i.exec(id);
  if (!match) return id;
  const words = (value: string) => value.split(/[-_.]+/).filter(Boolean);
  const [scope, action] = [words(match[1] ?? ""), words(match[2] ?? "")];
  if (action.length === 0) return id;
  const sentence = action.join(" ");
  const label = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  const scopeLabel = scope.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return scopeLabel ? `${label} (${scopeLabel})` : label;
}

/** The skipped-prompts card, shared by the standalone view and the combined settings page. */
export function ConfirmationsSection() {
  const { skippedIds, restore, restoreAll } = useConfirmSkipPreferences();

  return (
    <SettingsCard>
      <SettingsRow
        title="Confirmation prompts"
        description="Destructive actions ask first. Check “Don't ask again” on a prompt to skip it on this device."
        border={skippedIds.length > 0}
      >
        {skippedIds.length === 0 ? (
          <Badge tone="success">
            <Check className="w-3 h-3" aria-hidden="true" /> All prompts enabled
          </Badge>
        ) : (
          <Button type="button" variant="secondary" onClick={restoreAll}>
            Restore all
          </Button>
        )}
      </SettingsRow>
      {skippedIds.map((id, index) => {
        const label = confirmSkipLabel(id);
        return (
          <SettingsRow key={id} title={label} description="This prompt is hidden on this device" border={index < skippedIds.length - 1}>
            <Button type="button" variant="secondary" onClick={() => restore(id)} aria-label={`Restore “${label}” confirmation prompt`}>
              Restore
            </Button>
          </SettingsRow>
        );
      })}
    </SettingsCard>
  );
}

export default function SettingsConfirmationsView() {
  return (
    <ViewShell pad="page">
      <ConfirmationsSection />
    </ViewShell>
  );
}
