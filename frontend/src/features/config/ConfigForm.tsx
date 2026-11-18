import type { ConfigUINode, ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import { isPlainObject } from "@tokenring-ai/utility/object/isPlainObject";
import { useMemo } from "react";
import ConfigNodeRenderer, { type ConfigIssue, ConfigSavedResetContext } from "./ConfigNodeRenderer.tsx";

interface ConfigFormProps {
  plugin: ConfigUIPluginSchema;
  /** Full override draft (all plugins); this form edits only its own slices. */
  draft: Record<string, unknown>;
  effective: Record<string, unknown>;
  issues: ConfigIssue[];
  onDraftChange: (nextDraft: Record<string, unknown>) => void;
  /** The scope's saved overrides; with `onResetSaved`, lets a field's reset remove its saved value. */
  savedOverrides?: Record<string, unknown> | undefined;
  onResetSaved?: ((path: string[], label: string) => void) | undefined;
}

export function nodeHasSensitiveFields(node: ConfigUINode): boolean {
  switch (node.kind) {
    case "field":
    case "opaque":
      return node.sensitive === true;
    case "secret":
      return true;
    case "group":
      return node.children.some(nodeHasSensitiveFields);
    case "list":
      return nodeHasSensitiveFields(node.item);
    case "map":
      return nodeHasSensitiveFields(node.value);
    case "variant":
      return Object.values(node.variants).some(nodeHasSensitiveFields);
  }
}

export default function ConfigForm({ plugin, draft, effective, issues, onDraftChange, savedOverrides, onResetSaved }: ConfigFormProps) {
  const savedReset = useMemo(() => (savedOverrides && onResetSaved ? { savedOverrides, onResetSaved } : null), [savedOverrides, onResetSaved]);
  return (
    <ConfigSavedResetContext.Provider value={savedReset}>
      <div className="space-y-6">
        {Object.entries(plugin.slices).map(([sliceKey, node]) => (
          <ConfigNodeRenderer
            key={sliceKey}
            node={node}
            absPath={[sliceKey]}
            overrideValue={draft[sliceKey]}
            effectiveValue={effective[sliceKey]}
            onChange={value => {
              const next = { ...draft };
              if (value === undefined) {
                delete next[sliceKey];
              } else if (isPlainObject(value) || Array.isArray(value)) {
                next[sliceKey] = value;
              } else {
                next[sliceKey] = value;
              }
              onDraftChange(next);
            }}
            issues={issues}
          />
        ))}
      </div>
    </ConfigSavedResetContext.Provider>
  );
}

/** Every setting label in a plugin's settings tree, for searching settings rather than plugin names. */
export function collectSettingLabels(node: ConfigUINode, out: string[] = []): string[] {
  out.push(node.label);
  switch (node.kind) {
    case "group":
      for (const child of node.children) collectSettingLabels(child, out);
      break;
    case "list":
      collectSettingLabels(node.item, out);
      break;
    case "map":
      collectSettingLabels(node.value, out);
      break;
    case "variant":
      for (const variant of Object.values(node.variants)) collectSettingLabels(variant, out);
      break;
    default:
      break;
  }
  return out;
}

/** Setting labels of `plugin` that contain `query` (case-insensitive), deduplicated, in tree order. */
export function matchingSettingLabels(plugin: ConfigUIPluginSchema, query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const labels = Object.values(plugin.slices).flatMap(node => collectSettingLabels(node));
  return [...new Set(labels.filter(label => label.toLowerCase().includes(q)))];
}
