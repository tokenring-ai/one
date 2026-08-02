import type {
  ConfigFieldNode,
  ConfigGroupNode,
  ConfigListNode,
  ConfigMapNode,
  ConfigOpaqueNode,
  ConfigSecretNode,
  ConfigUINode,
  ConfigVariantNode,
} from "@tokenring-ai/app/config/uiSchema";
// Deep import: the package root re-exports SecretService, which is server-only.
import { type SecretSource, secretSourceOf } from "@tokenring-ai/secrets/secret";
import deepEqual from "@tokenring-ai/utility/object/deepEqual";
import { isPlainObject } from "@tokenring-ai/utility/object/isPlainObject";
import { ChevronRight, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isRedactedSensitiveValue } from "../../lib/utils.ts";

export interface ConfigIssue {
  path: (string | number)[];
  message: string;
}

interface NodeRendererProps {
  node: ConfigUINode;
  /** Absolute path of this node in the config (indices/keys included inside lists/maps). */
  absPath: (string | number)[];
  /** Current override value at this node (undefined = not overridden). */
  overrideValue: unknown;
  /** Effective (merged) config value at this node. */
  effectiveValue: unknown;
  /** Reports the new override value for this node; undefined clears the override. */
  onChange: (value: unknown) => void;
  issues: ConfigIssue[];
}

function pathsEqual(a: (string | number)[], b: (string | number)[]): boolean {
  return a.length === b.length && a.every((part, index) => String(part) === String(b[index]));
}

function issuesWithin(issues: ConfigIssue[], absPath: (string | number)[]): ConfigIssue[] {
  return issues.filter(issue => issue.path.length >= absPath.length && absPath.every((part, index) => String(part) === String(issue.path[index])));
}

export default function ConfigNodeRenderer(props: NodeRendererProps) {
  switch (props.node.kind) {
    case "group":
      return <GroupRenderer {...props} node={props.node} />;
    case "field":
      return <FieldRenderer {...props} node={props.node} />;
    case "list":
      return <ListRenderer {...props} node={props.node} />;
    case "map":
      return <MapRenderer {...props} node={props.node} />;
    case "variant":
      return <VariantRenderer {...props} node={props.node} />;
    case "secret":
      return <SecretRenderer {...props} node={props.node} />;
    case "opaque":
      return <OpaqueRenderer {...props} node={props.node} />;
  }
}

/* ---------------------------------- group --------------------------------- */

function GroupRenderer(props: NodeRendererProps & { node: ConfigGroupNode }) {
  const { node } = props;
  const normalChildren = node.children.filter(child => !("advanced" in child && child.advanced));
  const advancedChildren = node.children.filter(child => "advanced" in child && child.advanced);

  const renderChild = (child: ConfigUINode) => (
    <ConfigNodeRenderer
      key={child.key}
      node={child}
      absPath={[...props.absPath, child.key]}
      overrideValue={isPlainObject(props.overrideValue) ? props.overrideValue[child.key] : undefined}
      effectiveValue={isPlainObject(props.effectiveValue) ? props.effectiveValue[child.key] : undefined}
      onChange={value => {
        const base = isPlainObject(props.overrideValue) ? { ...props.overrideValue } : {};
        if (value === undefined) {
          delete base[child.key];
        } else {
          base[child.key] = value;
        }
        props.onChange(Object.keys(base).length > 0 ? base : undefined);
      }}
      issues={props.issues}
    />
  );

  const body = (
    <div className="space-y-3">
      {normalChildren.map(renderChild)}
      {advancedChildren.length > 0 && (
        <details className="group/adv">
          <summary className="flex items-center gap-1 text-2xs font-semibold text-muted uppercase tracking-widest cursor-pointer select-none py-1">
            <ChevronRight className="w-3 h-3 transition-transform group-open/adv:rotate-90" />
            Advanced
          </summary>
          <div className="space-y-3 mt-2 pl-2 border-l border-primary">{advancedChildren.map(renderChild)}</div>
        </details>
      )}
    </div>
  );

  // Top-level slice groups get a section card; nested groups a lighter header.
  return (
    <section className="space-y-2">
      <div className="px-1">
        <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">{node.label}</h3>
        {node.description && <p className="text-2xs text-muted mt-0.5">{node.description}</p>}
      </div>
      <div className="bg-secondary border border-primary rounded-xl px-4 py-3">{body}</div>
    </section>
  );
}

/* ---------------------------------- field --------------------------------- */

function FieldRenderer(props: NodeRendererProps & { node: ConfigFieldNode }) {
  const { node } = props;
  const overridden = props.overrideValue !== undefined;
  const displayed = overridden ? props.overrideValue : props.effectiveValue;
  const fieldIssues = props.issues.filter(issue => pathsEqual(issue.path, props.absPath));

  return (
    <div className="py-1.5" data-testid={`config-field-${props.absPath.join(".")}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-primary">{node.label}</span>
            {node.required && <span className="text-2xs text-red-400">*</span>}
            {overridden && (
              <span className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-px bg-accent/10 text-accent rounded-full" title="This value is overridden">
                modified
              </span>
            )}
            {node.restartRequired && (
              <span className="text-2xs px-1.5 py-px bg-amber-500/10 text-amber-500 rounded-full" title="Changing this requires a restart">
                restart
              </span>
            )}
          </div>
          {node.description && <p className="text-2xs text-muted mt-0.5">{node.description}</p>}
          {fieldIssues.map(issue => (
            <p key={issue.message} className="text-2xs text-red-400 mt-0.5" role="alert">
              {issue.message}
            </p>
          ))}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <FieldControl node={node} value={displayed} overridden={overridden} onChange={props.onChange} />
          {node.unit && <span className="text-2xs text-muted">{node.unit}</span>}
          {overridden && (
            <button
              type="button"
              onClick={() => props.onChange(undefined)}
              className="p-1 text-muted hover:text-primary transition-colors cursor-pointer"
              title="Reset to default"
              aria-label={`Reset ${node.label}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass = "px-2.5 py-1.5 bg-tertiary border border-primary rounded-lg text-sm text-primary placeholder:text-muted focus-ring min-w-0 w-full sm:w-56";

function formatDefaultValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function FieldControl({
  node,
  value,
  overridden,
  onChange,
}: {
  node: ConfigFieldNode;
  value: unknown;
  overridden: boolean;
  onChange: (value: unknown) => void;
}) {
  const field = node.field;
  const inheritedClass = overridden ? "" : " opacity-70";

  switch (field.type) {
    case "text":
      return (
        <input
          type="text"
          className={inputClass + inheritedClass}
          value={typeof value === "string" ? value : ""}
          placeholder={node.placeholder ?? (node.defaultValue !== undefined ? formatDefaultValue(node.defaultValue) : "")}
          onChange={event => onChange(event.target.value === "" ? undefined : event.target.value)}
          aria-label={node.label}
        />
      );
    case "password": {
      const isSet = isRedactedSensitiveValue(value) ? value.isSet : typeof value === "string" && value.length > 0;
      return (
        <input
          type="password"
          className={inputClass + inheritedClass}
          value={typeof value === "string" ? value : ""}
          placeholder={isSet ? "•••••••• (set — type to replace)" : (node.placeholder ?? "")}
          onChange={event => onChange(event.target.value === "" ? undefined : event.target.value)}
          aria-label={node.label}
        />
      );
    }
    case "multilineText":
      return (
        <textarea
          className={inputClass + inheritedClass}
          rows={3}
          value={typeof value === "string" ? value : ""}
          placeholder={node.placeholder ?? ""}
          onChange={event => onChange(event.target.value === "" ? undefined : event.target.value)}
          aria-label={node.label}
        />
      );
    case "regex":
      return <RegexControl node={node} value={value} overridden={overridden} onChange={onChange} />;
    case "number":
      return (
        <input
          type="number"
          className={inputClass + inheritedClass + " sm:w-32"}
          value={typeof value === "number" && !Number.isNaN(value) ? value : ""}
          min={field.min}
          max={field.max}
          step={field.decimals === 0 ? 1 : "any"}
          placeholder={node.defaultValue !== undefined ? formatDefaultValue(node.defaultValue) : ""}
          onChange={event => {
            const raw = event.target.value;
            if (raw === "") {
              onChange(undefined);
              return;
            }
            const next = Number(raw);
            // Ignore incomplete intermediate input ("-", ".", "1e") so we never store NaN.
            if (Number.isNaN(next)) return;
            onChange(next);
          }}
          aria-label={node.label}
        />
      );
    case "slider": {
      const numeric = typeof value === "number" ? value : ((node.defaultValue as number | undefined) ?? field.min ?? 0);
      return (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.decimals === 0 ? 1 : (field.max ?? 100) / 100}
            value={numeric}
            onChange={event => onChange(Number(event.target.value))}
            aria-label={node.label}
            className="cursor-pointer"
          />
          <span className="text-xs text-secondary font-mono w-12 text-right">{numeric}</span>
        </div>
      );
    }
    case "checkbox": {
      const checked = value === true;
      return (
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-ring ${checked ? "bg-accent" : "bg-tertiary"}`}
          role="switch"
          aria-checked={checked}
          aria-label={node.label}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-4" : "translate-x-0"}`}
          />
        </button>
      );
    }
    case "date":
      return (
        <input
          type="date"
          className={inputClass + inheritedClass + " sm:w-40"}
          value={typeof value === "string" ? value : ""}
          onChange={event => onChange(event.target.value === "" ? undefined : event.target.value)}
          aria-label={node.label}
        />
      );
    case "select":
      return (
        <select
          className={inputClass + inheritedClass + " cursor-pointer"}
          value={typeof value === "string" ? value : ""}
          onChange={event => onChange(event.target.value === "" ? undefined : event.target.value)}
          aria-label={node.label}
        >
          <option value="">{node.defaultValue !== undefined ? `(default: ${formatDefaultValue(node.defaultValue)})` : "(not set)"}</option>
          {field.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "categorySelect":
      return (
        <select
          className={inputClass + inheritedClass + " cursor-pointer"}
          value={typeof value === "string" ? value : ""}
          onChange={event => onChange(event.target.value === "" ? undefined : event.target.value)}
          aria-label={node.label}
        >
          <option value="">(not set)</option>
          {Object.entries(field.categories).map(([category, options]) => (
            <optgroup key={category} label={category}>
              {options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      );
    case "stringList":
      return <StringListControl node={node} value={value} itemType={field.itemType ?? "string"} onChange={onChange} />;
    case "keyValueMap":
    case "json":
      return <JsonControl node={node} value={value} onChange={onChange} />;
  }
}

/**
 * Regex pattern control. The stored value is the pattern body (no surrounding
 * slashes); the UI draws /…/ for clarity and validates the pattern as the user types.
 */
function RegexControl({
  node,
  value,
  overridden,
  onChange,
}: {
  node: ConfigFieldNode;
  value: unknown;
  overridden: boolean;
  onChange: (value: unknown) => void;
}) {
  const pattern = typeof value === "string" ? value : "";
  const inheritedClass = overridden ? "" : " opacity-70";

  let syntaxError: string | null = null;
  if (pattern !== "") {
    try {
      // eslint-disable-next-line no-new -- validate pattern syntax only
      new RegExp(pattern);
    } catch (error: unknown) {
      syntaxError = error instanceof Error ? error.message : "Invalid regular expression";
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 w-full sm:w-56">
      <div
        className={`flex items-center w-full bg-tertiary border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-accent/40 ${
          syntaxError ? "border-red-400/60" : "border-primary"
        }${inheritedClass}`}
      >
        <span className="pl-2.5 text-sm font-mono text-muted select-none" aria-hidden>
          /
        </span>
        <input
          type="text"
          className="flex-1 min-w-0 px-1 py-1.5 bg-transparent text-sm font-mono text-primary placeholder:text-muted focus:outline-none"
          value={pattern}
          placeholder={node.placeholder ?? (node.defaultValue !== undefined ? formatDefaultValue(node.defaultValue) : "pattern")}
          onChange={event => onChange(event.target.value === "" ? undefined : event.target.value)}
          aria-label={node.label}
          aria-invalid={syntaxError != null}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <span className="pr-2.5 text-sm font-mono text-muted select-none" aria-hidden>
          /
        </span>
      </div>
      {syntaxError && (
        <p className="text-2xs text-red-400 max-w-full text-right" role="alert">
          {syntaxError}
        </p>
      )}
    </div>
  );
}

function StringListControl({
  node,
  value,
  itemType,
  onChange,
}: {
  node: ConfigFieldNode;
  value: unknown;
  itemType: "string" | "number";
  onChange: (value: unknown) => void;
}) {
  const [pending, setPending] = useState("");
  const items: unknown[] = Array.isArray(value) ? value : [];

  const addPending = () => {
    const trimmed = pending.trim();
    if (!trimmed) return;
    const parsed = itemType === "number" ? Number(trimmed) : trimmed;
    if (itemType === "number" && Number.isNaN(parsed)) return;
    onChange([...items, parsed]);
    setPending("");
  };

  return (
    <div className="flex flex-col items-end gap-1.5 w-full sm:w-64">
      <div className="flex items-center gap-1 w-full">
        <input
          type="text"
          className={inputClass + " flex-1 sm:w-auto"}
          value={pending}
          placeholder="Add item…"
          onChange={event => setPending(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              addPending();
            }
          }}
          aria-label={`Add to ${node.label}`}
        />
        <button type="button" onClick={addPending} className="p-1.5 text-muted hover:text-primary cursor-pointer" aria-label="Add item">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-end">
          {items.map((item, index) => (
            <span
              // eslint-disable-next-line react/no-array-index-key -- items may repeat; position is identity
              key={`${String(item)}-${index}`}
              className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 bg-tertiary border border-primary rounded-full text-secondary font-mono"
            >
              {String(item)}
              <button
                type="button"
                // Empty array is a real override ("no items"); only the field reset
                // control clears back to the inherited default.
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                className="text-muted hover:text-red-400 cursor-pointer"
                aria-label={`Remove ${String(item)}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function JsonControl({ node, value, onChange }: { node: ConfigFieldNode; value: unknown; onChange: (value: unknown) => void }) {
  const serialized = value === undefined ? "" : JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [parseError, setParseError] = useState<string | null>(null);
  const focusedRef = useRef(false);

  // Resync from the draft only when the field is not focused — otherwise a
  // commit-as-you-type pretty-print would yank the caret mid-edit.
  useEffect(() => {
    if (focusedRef.current) return;
    setText(serialized);
    setParseError(null);
  }, [serialized]);

  /** Push valid JSON into the draft as the user types so Save never misses unblurred edits. */
  const commitText = (nextText: string) => {
    const trimmed = nextText.trim();
    if (trimmed === "") {
      setParseError(null);
      if (value !== undefined) onChange(undefined);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      setParseError(null);
      if (!deepEqual(parsed, value)) onChange(parsed);
    } catch {
      setParseError("Invalid JSON");
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 w-full sm:w-72">
      <textarea
        className={inputClass + " font-mono text-xs w-full sm:w-72"}
        rows={5}
        value={text}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={event => {
          const nextText = event.target.value;
          setText(nextText);
          commitText(nextText);
        }}
        onBlur={() => {
          focusedRef.current = false;
          commitText(text);
          // Adopt pretty-printed form once editing ends (valid JSON only).
          const trimmed = text.trim();
          if (trimmed === "") {
            setText("");
            return;
          }
          try {
            setText(JSON.stringify(JSON.parse(trimmed), null, 2));
          } catch {
            /* keep the invalid local text + error */
          }
        }}
        aria-label={node.label}
        spellCheck={false}
      />
      {parseError && (
        <p className="text-2xs text-red-400" role="alert">
          {parseError}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------- list ---------------------------------- */

function ListRenderer(props: NodeRendererProps & { node: ConfigListNode }) {
  const { node } = props;
  const overridden = props.overrideValue !== undefined;
  const effectiveItems: unknown[] = Array.isArray(props.effectiveValue) ? (props.effectiveValue as unknown[]) : [];
  const items: unknown[] = Array.isArray(overridden ? props.overrideValue : props.effectiveValue)
    ? [...((overridden ? props.overrideValue : props.effectiveValue) as unknown[])]
    : [];

  const update = (nextItems: unknown[]) => props.onChange(nextItems);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">{node.label}</h3>
          {node.description && <p className="text-2xs text-muted mt-0.5">{node.description}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {overridden && (
            <button
              type="button"
              onClick={() => props.onChange(undefined)}
              className="p-1 text-muted hover:text-primary cursor-pointer"
              title="Reset to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => update([...items, {}])}
            className="inline-flex items-center gap-1 text-2xs px-2 py-1 bg-tertiary border border-primary rounded-lg text-secondary hover:text-primary cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>
      {items.map((item, index) => (
        // eslint-disable-next-line react/no-array-index-key -- list items are positional
        <div key={index} className="bg-secondary border border-primary rounded-xl px-4 py-3 relative">
          <button
            type="button"
            onClick={() => update(items.filter((_, itemIndex) => itemIndex !== index))}
            className="absolute top-2 right-2 p-1 text-muted hover:text-red-400 cursor-pointer"
            aria-label={`Remove item ${index + 1}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <ConfigNodeRenderer
            node={node.item}
            absPath={[...props.absPath, index]}
            // Inherited lists must not treat effective items as overrides (false "modified" badges).
            // Once overridden, array merge replaces the whole list, so items are complete values
            // with no per-field effective fallback.
            overrideValue={overridden ? item : undefined}
            effectiveValue={overridden ? undefined : effectiveItems[index]}
            onChange={value =>
              update(
                items.map((existing, itemIndex) => {
                  if (itemIndex !== index) return existing;
                  if (value === undefined) {
                    // Groups clear to an empty object; leaf items clear to null so we never
                    // replace a string/secret with `{}`.
                    return isPlainObject(existing) || existing === undefined ? {} : null;
                  }
                  // First edit of an inherited list: child groups emit a partial object because
                  // overrideValue was undefined — merge onto the effective item so siblings survive.
                  if (!overridden && isPlainObject(value) && isPlainObject(existing)) {
                    return { ...existing, ...value };
                  }
                  return value;
                }),
              )
            }
            issues={props.issues}
          />
        </div>
      ))}
      {items.length === 0 && <p className="text-2xs text-muted px-1">No items</p>}
    </section>
  );
}

/* ----------------------------------- map ----------------------------------- */

function MapRenderer(props: NodeRendererProps & { node: ConfigMapNode }) {
  const { node } = props;
  const [pendingKey, setPendingKey] = useState("");
  const overrideMap = isPlainObject(props.overrideValue) ? props.overrideValue : {};
  const effectiveMap = isPlainObject(props.effectiveValue) ? props.effectiveValue : {};
  const entryKeys = [...new Set([...Object.keys(effectiveMap), ...Object.keys(overrideMap)])];

  const setEntry = (entryKey: string, value: unknown) => {
    const next = { ...overrideMap };
    if (value === undefined) {
      delete next[entryKey];
    } else {
      next[entryKey] = value;
    }
    props.onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  const addEntry = () => {
    const trimmed = pendingKey.trim();
    if (!trimmed || entryKeys.includes(trimmed)) return;
    setEntry(trimmed, {});
    setPendingKey("");
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1 gap-2">
        <div>
          <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">{node.label}</h3>
          {node.description && <p className="text-2xs text-muted mt-0.5">{node.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          <input
            type="text"
            className={inputClass + " sm:w-36"}
            value={pendingKey}
            placeholder="New entry name…"
            onChange={event => setPendingKey(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                addEntry();
              }
            }}
            aria-label={`Add entry to ${node.label}`}
          />
          <button type="button" onClick={addEntry} className="p-1.5 text-muted hover:text-primary cursor-pointer" aria-label="Add entry">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      {entryKeys.map(entryKey => {
        const onlyInOverride = !(entryKey in effectiveMap) || (entryKey in overrideMap && !(entryKey in effectiveMap));
        return (
          <div key={entryKey} className="bg-secondary border border-primary rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-primary font-mono">{entryKey}</span>
              {entryKey in overrideMap && (
                <button
                  type="button"
                  onClick={() => setEntry(entryKey, undefined)}
                  className="p-1 text-muted hover:text-red-400 cursor-pointer"
                  title={onlyInOverride ? "Remove entry" : "Reset entry to base configuration"}
                  aria-label={`${onlyInOverride ? "Remove" : "Reset"} ${entryKey}`}
                >
                  {onlyInOverride ? <X className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <ConfigNodeRenderer
              node={node.value}
              absPath={[...props.absPath, entryKey]}
              overrideValue={overrideMap[entryKey]}
              effectiveValue={effectiveMap[entryKey]}
              onChange={value => setEntry(entryKey, value)}
              issues={props.issues}
            />
          </div>
        );
      })}
      {entryKeys.length === 0 && <p className="text-2xs text-muted px-1">No entries</p>}
    </section>
  );
}

/* --------------------------------- variant --------------------------------- */

function VariantRenderer(props: NodeRendererProps & { node: ConfigVariantNode }) {
  const { node } = props;
  const overridden = props.overrideValue !== undefined;
  const current = overridden ? props.overrideValue : props.effectiveValue;
  const currentRecord = isPlainObject(current) ? current : {};
  const selected = typeof currentRecord[node.discriminator] === "string" ? (currentRecord[node.discriminator] as string) : "";
  const variant = node.variants[selected];

  // Any edit to a variant value becomes a whole-object override carrying the discriminator.
  const emit = (value: unknown) => {
    if (value === undefined) {
      props.onChange(undefined);
      return;
    }
    props.onChange({ [node.discriminator]: selected, ...(isPlainObject(value) ? value : {}) });
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">{node.label}</h3>
          {node.description && <p className="text-2xs text-muted mt-0.5">{node.description}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            className="px-2.5 py-1.5 bg-tertiary border border-primary rounded-lg text-sm text-primary focus-ring cursor-pointer"
            value={selected}
            onChange={event => props.onChange(event.target.value === "" ? undefined : { [node.discriminator]: event.target.value })}
            aria-label={`${node.label} ${node.discriminator}`}
          >
            <option value="">(not set)</option>
            {Object.keys(node.variants).map(variantKey => (
              <option key={variantKey} value={variantKey}>
                {variantKey}
              </option>
            ))}
          </select>
          {overridden && (
            <button
              type="button"
              onClick={() => props.onChange(undefined)}
              className="p-1 text-muted hover:text-primary cursor-pointer"
              title="Reset to default"
              aria-label={`Reset ${node.label}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {variant && (
        <ConfigNodeRenderer
          node={variant}
          absPath={props.absPath}
          overrideValue={overridden ? props.overrideValue : undefined}
          effectiveValue={props.effectiveValue}
          onChange={emit}
          issues={props.issues}
        />
      )}
    </section>
  );
}

/* ---------------------------------- secret --------------------------------- */

const SECRET_SOURCE_LABELS: Record<SecretSource, string> = {
  value: "Value",
  env: "Environment variable",
  vault: "Vault entry",
};

function describeSecretDefault(defaultValue: unknown): string | undefined {
  if (typeof defaultValue === "string") return defaultValue === "" ? undefined : "a value set in the configuration";
  if (!isPlainObject(defaultValue)) return undefined;
  if (defaultValue.source === "env" && typeof defaultValue.env === "string") return `the ${defaultValue.env} environment variable`;
  if (defaultValue.source === "vault" && typeof defaultValue.category === "string" && typeof defaultValue.key === "string") {
    return `vault entry ${defaultValue.category}/${defaultValue.key}`;
  }
  return undefined;
}

/**
 * A secret: the user picks where the value comes from — typed in directly, read
 * from an environment variable, or read from the credential vault — and only
 * the typed-in form is ever masked.
 */
function SecretRenderer(props: NodeRendererProps & { node: ConfigSecretNode }) {
  const { node } = props;
  const overridden = props.overrideValue !== undefined;
  const displayed = overridden ? props.overrideValue : props.effectiveValue;
  const nodeIssues = issuesWithin(props.issues, props.absPath);

  // The chosen source sticks even before the new source has a usable value.
  const [pickedSource, setPickedSource] = useState<SecretSource | null>(null);
  // Stash the previous override when the user explores a different source so
  // switching Value → Env → Value does not permanently destroy a stored secret.
  const stashRef = useRef<{ source: SecretSource; overrideValue: unknown } | null>(null);

  const actualSource: SecretSource | null = displayed === undefined ? null : secretSourceOf(displayed);
  const source: SecretSource | null = pickedSource ?? actualSource;

  // Only read env/vault fields from the displayed value when it matches the UI source;
  // otherwise show empty inputs for the newly picked source.
  const record = isPlainObject(displayed) && actualSource === source ? displayed : {};
  const envName = source === "env" && typeof record.env === "string" ? record.env : "";
  const vaultCategory = source === "vault" && typeof record.category === "string" ? record.category : "";
  const vaultKey = source === "vault" && typeof record.key === "string" ? record.key : "";
  const isSet =
    source === "value" && actualSource === "value"
      ? isRedactedSensitiveValue(displayed)
        ? displayed.isSet
        : typeof displayed === "string" && displayed.length > 0
      : false;
  const valueInput = source === "value" && actualSource === "value" && typeof displayed === "string" ? displayed : "";

  const clearStash = () => {
    stashRef.current = null;
  };

  const emitValue = (raw: string) => {
    clearStash();
    setPickedSource(null);
    props.onChange(raw === "" ? undefined : raw);
  };
  const emitEnv = (name: string) => {
    clearStash();
    setPickedSource(null);
    props.onChange(name === "" ? undefined : { source: "env", env: name });
  };
  const emitVault = (category: string, key: string) => {
    clearStash();
    setPickedSource(null);
    props.onChange(category === "" && key === "" ? undefined : { source: "vault", category, key });
  };

  const changeSource = (next: string) => {
    if (next === "") {
      setPickedSource(null);
      clearStash();
      props.onChange(undefined);
      return;
    }
    const nextSource = next as SecretSource;

    // User returned to the source they left before committing a replacement.
    if (stashRef.current && stashRef.current.source === nextSource) {
      const restored = stashRef.current.overrideValue;
      clearStash();
      setPickedSource(null);
      props.onChange(restored);
      return;
    }

    // Re-selecting the source of the current displayed value — keep it.
    if (actualSource === nextSource) {
      setPickedSource(null);
      return;
    }

    // Leaving a committed override: stash once so multi-hop source browsing
    // (value → env → vault → value) can still restore the original secret.
    if (!stashRef.current && props.overrideValue !== undefined && actualSource !== null) {
      stashRef.current = { source: actualSource, overrideValue: props.overrideValue };
    }

    setPickedSource(nextSource);
    // Incomplete placeholder so the draft is dirty and Save cannot silently keep
    // the old source while the UI shows a different one. Empty env/vault fails
    // server validation until the user fills them in (or switches back / discards).
    if (nextSource === "env") {
      props.onChange({ source: "env", env: "" });
    } else if (nextSource === "vault") {
      props.onChange({ source: "vault", category: "", key: "" });
    } else {
      props.onChange(undefined);
    }
  };

  const defaultDescription = describeSecretDefault(node.defaultValue);

  return (
    <div className="py-1.5" data-testid={`config-secret-${props.absPath.join(".")}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-primary">{node.label}</span>
            {node.required && <span className="text-2xs text-red-400">*</span>}
            {overridden && <span className="text-2xs px-1.5 py-px bg-accent/10 text-accent rounded-full">modified</span>}
            {node.restartRequired && (
              <span className="text-2xs px-1.5 py-px bg-amber-500/10 text-amber-500 rounded-full" title="Changing this requires a restart">
                restart
              </span>
            )}
          </div>
          {node.description && <p className="text-2xs text-muted mt-0.5">{node.description}</p>}
          {!overridden && defaultDescription && <p className="text-2xs text-muted mt-0.5">Defaults to {defaultDescription}</p>}
          {nodeIssues.map(issue => (
            <p key={issue.message} className="text-2xs text-red-400 mt-0.5" role="alert">
              {issue.message}
            </p>
          ))}
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          <div className="flex flex-col gap-1.5 items-end">
            <select
              className="px-2.5 py-1.5 bg-tertiary border border-primary rounded-lg text-sm text-primary focus-ring cursor-pointer w-full sm:w-56"
              value={source ?? ""}
              onChange={event => changeSource(event.target.value)}
              aria-label={`${node.label} source`}
            >
              <option value="">(not set)</option>
              {(Object.keys(SECRET_SOURCE_LABELS) as SecretSource[]).map(candidate => (
                <option key={candidate} value={candidate}>
                  {SECRET_SOURCE_LABELS[candidate]}
                </option>
              ))}
            </select>

            {source === "value" && (
              <input
                type={node.sensitive ? "password" : "text"}
                className={inputClass + (overridden ? "" : " opacity-70")}
                value={valueInput}
                placeholder={
                  node.sensitive ? (isSet ? "•••••••• (set — type to replace)" : (node.placeholder ?? "Secret value")) : (node.placeholder ?? "Value")
                }
                onChange={event => emitValue(event.target.value)}
                aria-label={`${node.label} value`}
              />
            )}

            {source === "env" && (
              <input
                type="text"
                className={inputClass + (overridden ? "" : " opacity-70") + " font-mono"}
                value={envName}
                placeholder="SERVICE_API_KEY"
                onChange={event => emitEnv(event.target.value)}
                aria-label={`${node.label} environment variable`}
              />
            )}

            {source === "vault" && (
              <>
                <input
                  type="text"
                  className={inputClass + (overridden ? "" : " opacity-70") + " font-mono"}
                  value={vaultCategory}
                  placeholder="Vault category"
                  onChange={event => emitVault(event.target.value, vaultKey)}
                  aria-label={`${node.label} vault category`}
                />
                <input
                  type="text"
                  className={inputClass + (overridden ? "" : " opacity-70") + " font-mono"}
                  value={vaultKey}
                  placeholder="Vault key"
                  onChange={event => emitVault(vaultCategory, event.target.value)}
                  aria-label={`${node.label} vault key`}
                />
              </>
            )}
          </div>
          {overridden && (
            <button
              type="button"
              onClick={() => {
                setPickedSource(null);
                clearStash();
                props.onChange(undefined);
              }}
              className="p-1 text-muted hover:text-primary transition-colors cursor-pointer"
              title="Reset to default"
              aria-label={`Reset ${node.label}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- opaque --------------------------------- */

function OpaqueRenderer(props: NodeRendererProps & { node: ConfigOpaqueNode }) {
  const { node } = props;
  const overridden = props.overrideValue !== undefined;
  const nodeIssues = issuesWithin(props.issues, props.absPath);

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-primary">{node.label}</span>
        {overridden && <span className="text-2xs px-1.5 py-px bg-accent/10 text-accent rounded-full">modified</span>}
      </div>
      {node.description && <p className="text-2xs text-muted mt-0.5">{node.description}</p>}
      <p className="text-2xs text-muted mt-0.5 italic">{node.reason} — edited as JSON</p>
      {nodeIssues.map(issue => (
        <p key={issue.message} className="text-2xs text-red-400 mt-0.5" role="alert">
          {issue.message}
        </p>
      ))}
      <div className="mt-1.5 flex items-start gap-1.5">
        <JsonControl
          node={{ ...node, kind: "field", field: { type: "json" }, required: false } as unknown as ConfigFieldNode}
          value={overridden ? props.overrideValue : props.effectiveValue}
          onChange={props.onChange}
        />
        {overridden && (
          <button
            type="button"
            onClick={() => props.onChange(undefined)}
            className="p-1 text-muted hover:text-primary cursor-pointer"
            title="Reset to default"
            aria-label={`Reset ${node.label}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
