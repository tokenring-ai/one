import type { ConfigUINode, ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import ConfigNodeRenderer, { type ConfigIssue } from "./ConfigNodeRenderer.tsx";
import { isPlainObject } from "./values.ts";

interface ConfigFormProps {
  plugin: ConfigUIPluginSchema;
  /** Full override draft (all plugins); this form edits only its own slices. */
  draft: Record<string, unknown>;
  effective: Record<string, unknown>;
  issues: ConfigIssue[];
  onDraftChange: (nextDraft: Record<string, unknown>) => void;
}

export function nodeHasSensitiveFields(node: ConfigUINode): boolean {
  switch (node.kind) {
    case "field":
    case "opaque":
      return node.sensitive === true;
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

export default function ConfigForm({ plugin, draft, effective, issues, onDraftChange }: ConfigFormProps) {
  return (
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
  );
}
