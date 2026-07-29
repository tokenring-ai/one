import type { FilterOperator } from "./types.ts";

export const DATABASE_AGENT_TYPE = "database";

export const PAGE_SIZE = 50;

/** Operators the filter bar offers, in the order they're shown. */
export const FILTER_OPERATORS: { value: FilterOperator; label: string; takesValue: boolean; takesList?: boolean }[] = [
  { value: "eq", label: "=", takesValue: true },
  { value: "ne", label: "≠", takesValue: true },
  { value: "lt", label: "<", takesValue: true },
  { value: "lte", label: "≤", takesValue: true },
  { value: "gt", label: ">", takesValue: true },
  { value: "gte", label: "≥", takesValue: true },
  { value: "like", label: "contains", takesValue: true },
  { value: "in", label: "in list", takesValue: true, takesList: true },
  { value: "isNull", label: "is null", takesValue: false },
  { value: "isNotNull", label: "is not null", takesValue: false },
];

export const FILTER_OPERATORS_BY_VALUE = new Map(FILTER_OPERATORS.map(op => [op.value, op]));

/** Connection-string examples shown as placeholder text in the datasource form. */
export const CONNECTION_STRING_PLACEHOLDER = "mysql://user:password@host:3306/dbname";

/** Numeric-ish MySQL types get right-aligned in the grid. */
const numericTypePattern = /^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real|bit)/i;

export function isNumericType(dataType: string): boolean {
  return numericTypePattern.test(dataType);
}
