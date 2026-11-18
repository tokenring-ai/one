import { defineKind } from "../../layout/define.ts";
import type { KindManifest } from "../../layout/types.ts";

/** View kinds the Debug app adds to the core ones. */
export const DEBUG_KINDS: readonly KindManifest[] = [defineKind({ id: "debug-snapshot", label: "Snapshots", plural: "snapshots" })];
