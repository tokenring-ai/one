import { describe, expect, it } from "bun:test";
import { coerceScalar, draftFiltersToQuery } from "./filterQuery.ts";
import type { ColumnDef } from "./types.ts";

const columns: ColumnDef[] = [
  { name: "id", dataType: "int", nullable: false, isPrimaryKey: true, defaultValue: null },
  { name: "name", dataType: "varchar(255)", nullable: true, isPrimaryKey: false, defaultValue: null },
  { name: "active", dataType: "boolean", nullable: false, isPrimaryKey: false, defaultValue: null },
  { name: "score", dataType: "decimal(10,2)", nullable: true, isPrimaryKey: false, defaultValue: null },
];

describe("coerceScalar", () => {
  it("coerces numeric columns to numbers", () => {
    expect(coerceScalar("42", "int")).toBe(42);
    expect(coerceScalar("3.5", "decimal(10,2)")).toBe(3.5);
  });

  it("returns null for non-numeric text on numeric columns", () => {
    expect(coerceScalar("abc", "int")).toBeNull();
  });

  it("coerces boolean-ish values", () => {
    expect(coerceScalar("true", "boolean")).toBe(true);
    expect(coerceScalar("0", "boolean")).toBe(false);
    expect(coerceScalar("yes", "bool")).toBe(true);
  });

  it("returns the raw string for free-text columns", () => {
    expect(coerceScalar("hello", "varchar(255)")).toBe("hello");
  });
});

describe("draftFiltersToQuery", () => {
  it("skips incomplete value filters", () => {
    expect(
      draftFiltersToQuery(
        [
          { id: "1", column: "name", op: "eq", value: "" },
          { id: "2", column: "name", op: "eq", value: "   " },
        ],
        columns,
      ),
    ).toEqual([]);
  });

  it("emits isNull without a value", () => {
    expect(draftFiltersToQuery([{ id: "1", column: "name", op: "isNull", value: "" }], columns)).toEqual([{ column: "name", op: "isNull" }]);
  });

  it("wraps contains/like with wildcards", () => {
    expect(draftFiltersToQuery([{ id: "1", column: "name", op: "like", value: "bob" }], columns)).toEqual([{ column: "name", op: "like", value: "%bob%" }]);
  });

  it("preserves user-supplied wildcards on like", () => {
    expect(draftFiltersToQuery([{ id: "1", column: "name", op: "like", value: "bob%" }], columns)).toEqual([{ column: "name", op: "like", value: "bob%" }]);
  });

  it("coerces numeric eq filters", () => {
    expect(draftFiltersToQuery([{ id: "1", column: "id", op: "eq", value: "7" }], columns)).toEqual([{ column: "id", op: "eq", value: 7 }]);
  });

  it("splits in-list values and coerces numbers", () => {
    expect(draftFiltersToQuery([{ id: "1", column: "id", op: "in", value: "1, 2, 3" }], columns)).toEqual([{ column: "id", op: "in", value: [1, 2, 3] }]);
  });

  it("coerces boolean eq filters", () => {
    expect(draftFiltersToQuery([{ id: "1", column: "active", op: "eq", value: "true" }], columns)).toEqual([{ column: "active", op: "eq", value: true }]);
  });

  it("skips filters with invalid numeric values", () => {
    expect(draftFiltersToQuery([{ id: "1", column: "id", op: "eq", value: "abc" }], columns)).toEqual([]);
  });

  it("drops invalid tokens from in-list filters on numeric columns", () => {
    expect(draftFiltersToQuery([{ id: "1", column: "id", op: "in", value: "1, abc, 3" }], columns)).toEqual([{ column: "id", op: "in", value: [1, 3] }]);
  });
});
