import { FILTER_OPERATORS_BY_VALUE, isNumericType } from "./constants.ts";
import type { ColumnDef, DraftFilter } from "./types.ts";

export type QueryFilter = {
  column: string;
  op: DraftFilter["op"];
  value?: string | number | boolean | null | (string | number)[];
};

/**
 * Coerce a typed filter string into the value shape the selectRows RPC accepts.
 * Returns `null` when the input cannot be coerced for a numeric column so callers
 * can skip invalid filters instead of sending strings that MySQL may coerce to 0.
 */
export function coerceScalar(raw: string, dataType: string | undefined): string | number | boolean | null {
  const trimmed = raw.trim();
  if (dataType && /^(bool|boolean|bit\(1\))/i.test(dataType)) {
    const lower = trimmed.toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  if (dataType && isNumericType(dataType)) {
    if (trimmed === "") return raw;
    const num = Number(trimmed);
    if (Number.isNaN(num)) return null;
    return num;
  }
  return raw;
}

/**
 * Draft filters stay editable as strings; only complete ones are sent, with
 * values coerced to match the column type so MySQL binds the right parameter type.
 */
export function draftFiltersToQuery(drafts: DraftFilter[], columns: ColumnDef[]): QueryFilter[] {
  const columnByName = new Map(columns.map(column => [column.name, column]));
  const out: QueryFilter[] = [];

  for (const draft of drafts) {
    const operator = FILTER_OPERATORS_BY_VALUE.get(draft.op);
    if (!operator) continue;

    if (!operator.takesValue) {
      out.push({ column: draft.column, op: draft.op });
      continue;
    }

    const raw = draft.value;
    if (raw.trim() === "") continue;

    const dataType = columnByName.get(draft.column)?.dataType;

    if (operator.takesList) {
      const parts = raw
        .split(",")
        .map(part => part.trim())
        .filter(part => part.length > 0);
      if (parts.length === 0) continue;
      const values: (string | number)[] = [];
      for (const part of parts) {
        const coerced = coerceScalar(part, dataType);
        if (coerced === null) continue; // skip invalid numeric tokens
        // RowFilter `in` accepts string | number only, not boolean.
        values.push(typeof coerced === "boolean" ? String(coerced) : coerced);
      }
      if (values.length === 0) continue;
      out.push({
        column: draft.column,
        op: draft.op,
        value: values,
      });
      continue;
    }

    if (draft.op === "like") {
      // Filter bar labels this "contains"; wrap unless the user already used wildcards.
      const pattern = /[%_]/.test(raw) ? raw : `%${raw}%`;
      out.push({ column: draft.column, op: draft.op, value: pattern });
      continue;
    }

    const coerced = coerceScalar(raw, dataType);
    if (coerced === null) continue; // skip invalid numeric filters
    out.push({ column: draft.column, op: draft.op, value: coerced });
  }

  return out;
}
