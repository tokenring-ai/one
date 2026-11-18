import formatError from "@tokenring-ai/utility/error/formatError";
import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { cn } from "../../lib/utils.ts";
import type { aiRPCClient } from "../../rpc.ts";
import Button from "../../ui/button.tsx";
import Checkbox from "../../ui/checkbox.tsx";
import { controlClassName } from "../../ui/control.ts";

type DiscoverResult = Awaited<ReturnType<typeof aiRPCClient.discoverModels>>;
export type DiscoveredModel = Extract<DiscoverResult, { status: "success" }>["models"][number];
export type CustomModels = Parameters<typeof aiRPCClient.updateProviderModels>[0]["models"];
type ChatModelSpec = NonNullable<CustomModels["chat"]>[string];
type EmbeddingModelSpec = NonNullable<CustomModels["embedding"]>[string];

/** One editable model row; the number fields hold what was typed. */
export interface ModelRow {
  key: string;
  include: boolean;
  kind: "chat" | "embedding";
  name: string;
  /** The id the server knows the model by. Embedding models are saved under it: they can't be renamed. */
  serverId: string;
  input: string;
  cached: string;
  output: string;
  context: string;
  /** "<catalog>/<model>" when the prices came from the model catalog. */
  priceSource?: string;
}

let rowCounter = 0;
const nextKey = () => `row-${++rowCounter}`;

const numberText = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? String(value) : "");

/** A row for a model the server reports, prefilled from its catalog match. */
export function rowFromDiscovered(model: DiscoveredModel, include: boolean): ModelRow {
  const match = model.catalogMatch;
  return {
    key: nextKey(),
    include,
    kind: model.kind,
    name: model.id,
    serverId: model.id,
    input: numberText(match?.costPerMillionInputTokens),
    cached: model.kind === "chat" ? numberText(match?.costPerMillionCachedInputTokens) : "",
    output: model.kind === "chat" ? numberText(match?.costPerMillionOutputTokens) : "",
    context: numberText(model.maxContextLength ?? match?.maxContextLength),
    ...(match && { priceSource: `${match.catalog}/${match.model}` }),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const numberField = (spec: Record<string, unknown>, field: string) => numberText(typeof spec[field] === "number" ? spec[field] : undefined);

/** Rows for a custom provider's saved list (the `getProviderModels` shape). */
export function rowsFromModels(models: Record<string, unknown>): ModelRow[] {
  const rows: ModelRow[] = [];
  for (const kind of ["chat", "embedding"] as const) {
    const section = models[kind];
    if (!isRecord(section)) continue;
    for (const [name, raw] of Object.entries(section)) {
      const spec = isRecord(raw) ? raw : {};
      rows.push({
        key: nextKey(),
        include: true,
        kind,
        name,
        serverId: typeof spec.providerModelId === "string" && spec.providerModelId ? spec.providerModelId : name,
        input: numberField(spec, "costPerMillionInputTokens"),
        cached: kind === "chat" ? numberField(spec, "costPerMillionCachedInputTokens") : "",
        output: kind === "chat" ? numberField(spec, "costPerMillionOutputTokens") : "",
        context: numberField(spec, "maxContextLength"),
      });
    }
  }
  return rows;
}

/** The name a row is saved under: an embedding model has no separate server id, so it keeps the server's. */
export function savedName(row: ModelRow): string {
  return row.kind === "embedding" ? row.serverId.trim() || row.name.trim() : row.name.trim();
}

/** Adds models the server reports that no row covers yet, unchecked, so nothing is used without asking. */
export function mergeDiscovered(rows: ModelRow[], models: DiscoveredModel[]): { rows: ModelRow[]; added: number } {
  const known = new Set(rows.map(row => row.serverId.trim() || row.name.trim()));
  const fresh = models.filter(model => !known.has(model.id)).map(model => rowFromDiscovered(model, false));
  return { rows: [...rows, ...fresh], added: fresh.length };
}

type Built = { ok: true; models: CustomModels; unpriced: number } | { ok: false; error: string };

/**
 * The included rows in the `CustomModelsSchema` shape: empty fields left out, never NaN. Also counts the chat
 * models left without a price while others have one.
 */
export function buildModels(rows: ModelRow[]): Built {
  const chat: Record<string, ChatModelSpec> = {};
  const embedding: Record<string, EmbeddingModelSpec> = {};
  const seen = new Set<string>();
  let priced = 0;
  let unpriced = 0;

  for (const row of rows) {
    if (!row.include) continue;
    const name = savedName(row);
    if (!name) return { ok: false, error: "Every included model needs a name." };
    if (name.length > 256) return { ok: false, error: `"${name.slice(0, 40)}…" is too long for a model name.` };
    if (seen.has(name)) return { ok: false, error: `Two models are named "${name}". Give each a different name.` };
    seen.add(name);

    const price = (text: string, label: string): number | undefined | string => {
      const trimmed = text.trim();
      if (!trimmed) return undefined;
      const value = Number(trimmed);
      if (!Number.isFinite(value) || value < 0) return `${name}: ${label} must be a number of 0 or more.`;
      return value;
    };
    const input = price(row.input, "input price");
    if (typeof input === "string") return { ok: false, error: input };
    const contextText = row.context.trim();
    let context: number | undefined;
    if (contextText) {
      context = Number(contextText);
      if (!Number.isInteger(context) || context <= 0) return { ok: false, error: `${name}: context length must be a whole number above 0.` };
    }

    if (row.kind === "embedding") {
      embedding[name] = {
        ...(input !== undefined && { costPerMillionInputTokens: input }),
        ...(context !== undefined && { maxContextLength: context }),
      };
      continue;
    }

    const cached = price(row.cached, "cached input price");
    if (typeof cached === "string") return { ok: false, error: cached };
    const output = price(row.output, "output price");
    if (typeof output === "string") return { ok: false, error: output };
    const serverId = row.serverId.trim();
    if (serverId.length > 256) return { ok: false, error: `${name}: the server model id is too long.` };
    chat[name] = {
      ...(serverId && serverId !== name && { providerModelId: serverId }),
      ...(input !== undefined && { costPerMillionInputTokens: input }),
      ...(cached !== undefined && { costPerMillionCachedInputTokens: cached }),
      ...(output !== undefined && { costPerMillionOutputTokens: output }),
      ...(context !== undefined && { maxContextLength: context }),
    };
    if ((input ?? 0) > 0 || (output ?? 0) > 0) priced++;
    else unpriced++;
  }
  return { ok: true, models: { chat, embedding }, unpriced: priced > 0 ? unpriced : 0 };
}

export interface ProviderModelEditorProps {
  /** Names the table for screen readers, e.g. the provider's name. */
  label: string;
  initialRows: ModelRow[];
  initialAddServerModels: boolean;
  /** Asks the server again; returns its models, or a message saying why it couldn't. */
  onRediscover: () => Promise<DiscoveredModel[] | string>;
  /** Saves; resolves to an error message, or null on success. */
  onSave: (models: CustomModels, addServerModels: boolean) => Promise<string | null>;
  onCancel?: () => void;
  saveLabel?: string;
}

const cellInput = cn(controlClassName({ size: "sm" }), "px-2 py-1 min-w-0");

/** The table a custom provider's model list is built in: which models to use, under which names, at which prices. */
export default function ProviderModelEditor({
  label,
  initialRows,
  initialAddServerModels,
  onRediscover,
  onSave,
  onCancel,
  saveLabel = "Save models",
}: ProviderModelEditorProps) {
  const [rows, setRows] = useState(initialRows);
  const [addServerModels, setAddServerModels] = useState(initialAddServerModels);
  const [busy, setBusy] = useState<"save" | "discover" | null>(null);
  /** Set from the first Save click, before any confirmation, so a second click can't save twice. */
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const addServerId = useId();

  const update = (key: string, patch: Partial<ModelRow>) => setRows(current => current.map(row => (row.key === key ? { ...row, ...patch } : row)));
  const allIncluded = rows.length > 0 && rows.every(row => row.include);

  const rediscover = async () => {
    setBusy("discover");
    setError(null);
    setInfo(null);
    try {
      const result = await onRediscover();
      if (typeof result === "string") {
        setError(result);
        return;
      }
      const { added } = mergeDiscovered(rows, result);
      setRows(current => mergeDiscovered(current, result).rows);
      setInfo(added === 0 ? "No new models found." : `Found ${added} new model${added === 1 ? "" : "s"}; check the ones to use.`);
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy("save");
    try {
      await saveOnce();
    } finally {
      saving.current = false;
      setBusy(null);
    }
  };

  const saveOnce = async () => {
    setError(null);
    setInfo(null);
    const built = buildModels(rows);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    const included = Object.keys(built.models.chat ?? {}).length + Object.keys(built.models.embedding ?? {}).length;
    if (included === 0 && !addServerModels) {
      setError("Check at least one model, or also use the models the server lists.");
      return;
    }
    if (built.unpriced > 0) {
      const confirmed = await openConfirm({
        id: "ai-providers:unpriced-models",
        title: "Save models without prices?",
        message: `${built.unpriced} model${built.unpriced === 1 ? " has" : "s have"} no price; cost tracking will show $0 for ${built.unpriced === 1 ? "it" : "them"}.`,
        confirmText: "Save anyway",
        variant: "warning",
        dontAskAgain: false,
      });
      if (!confirmed) return;
    }
    try {
      const failure = await onSave(built.models, addServerModels);
      if (failure) setError(failure);
    } catch (err: unknown) {
      setError(formatError(err));
    }
  };

  return (
    <div className="space-y-2.5" data-testid="provider-model-editor">
      {rows.length === 0 ? (
        <p className="text-xs text-muted">No models in the list yet. Re-discover to ask the server, or use every model it lists.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-primary">
          <table className="w-full min-w-[46rem] text-xs" aria-label={`${label} models`}>
            <thead className="bg-sunken text-muted text-left">
              <tr>
                <th scope="col" className="px-2 py-1.5 w-8">
                  <input
                    type="checkbox"
                    aria-label="Include every model"
                    checked={allIncluded}
                    onChange={event => setRows(current => current.map(row => ({ ...row, include: event.target.checked })))}
                    className="accent-accent cursor-pointer"
                  />
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium">
                  Name
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium">
                  Server model id
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium w-24">
                  Kind
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium w-20">
                  Input $/M
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium w-20">
                  Cached $/M
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium w-20">
                  Output $/M
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium w-24">
                  Context
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const who = row.serverId || row.name || "model";
                const chat = row.kind === "chat";
                return (
                  <tr key={row.key} className={cn("border-t border-primary align-top", !row.include && "opacity-60")} aria-label={who}>
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Include ${who}`}
                        checked={row.include}
                        onChange={event => update(row.key, { include: event.target.checked })}
                        className="accent-accent cursor-pointer mt-1.5"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className={cn(cellInput, "font-mono")}
                        aria-label={`${who} name`}
                        value={chat ? row.name : row.serverId}
                        onChange={event => update(row.key, { name: event.target.value })}
                        disabled={!chat}
                        title={chat ? undefined : "Embedding models are saved under the server's model id"}
                        spellCheck={false}
                        autoComplete="off"
                      />
                      {row.priceSource && <p className="text-[11px] text-muted mt-0.5 truncate">Prices from {row.priceSource}</p>}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className={cn(cellInput, "font-mono")}
                        aria-label={`${who} server model id`}
                        value={row.serverId}
                        onChange={event => update(row.key, { serverId: event.target.value })}
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className={cellInput}
                        aria-label={`${who} kind`}
                        value={row.kind}
                        onChange={event => update(row.key, { kind: event.target.value === "embedding" ? "embedding" : "chat" })}
                      >
                        <option value="chat">Chat</option>
                        <option value="embedding">Embedding</option>
                      </select>
                    </td>
                    {(
                      [
                        ["input", "input price", true],
                        ["cached", "cached input price", chat],
                        ["output", "output price", chat],
                        ["context", "context length", true],
                      ] as const
                    ).map(([field, fieldLabel, enabled]) => (
                      <td key={field} className="px-2 py-1.5">
                        <input
                          className={cellInput}
                          aria-label={`${who} ${fieldLabel}`}
                          type="number"
                          inputMode={field === "context" ? "numeric" : "decimal"}
                          min={field === "context" ? 1 : 0}
                          step={field === "context" ? 1 : "any"}
                          value={enabled ? row[field] : ""}
                          disabled={!enabled}
                          placeholder={enabled ? "—" : ""}
                          onChange={event => update(row.key, { [field]: event.target.value })}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Checkbox
        id={addServerId}
        checked={addServerModels}
        onChange={setAddServerModels}
        label="Also use models the server lists that aren't in this list (unpriced)"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button icon={Save} busy={busy === "save"} disabled={busy !== null} onClick={() => void save()}>
          {saveLabel}
        </Button>
        <Button variant="secondary" icon={RefreshCw} busy={busy === "discover"} disabled={busy !== null} onClick={() => void rediscover()}>
          Re-discover
        </Button>
        {onCancel && (
          <Button variant="ghost" disabled={busy !== null} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      {info && (
        <p role="status" className="text-xs text-muted">
          {info}
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
          <span className="min-w-0">{error}</span>
        </p>
      )}
      <ConfirmDialog />
    </div>
  );
}
