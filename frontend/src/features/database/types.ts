import type { CellValue, ColumnDef, FilterOperator, OrderBy, Row, TableRef, TableSchema } from "@tokenring-ai/database/types";

export type { CellValue, ColumnDef, FilterOperator, OrderBy, Row, TableRef, TableSchema };

/** A datasource as the browser sees it — never includes the connection string. */
export interface DatasourceSummary {
  name: string;
  scheme: string;
  allowWrites: boolean;
}

/** One row of the filter bar. Held as a string until it's sent, so the input stays editable. */
export interface DraftFilter {
  id: string;
  column: string;
  op: FilterOperator;
  value: string;
}

/** The datasource form's editable state. */
export interface DatasourceDraft {
  name: string;
  url: string;
  allowWrites: boolean;
}
