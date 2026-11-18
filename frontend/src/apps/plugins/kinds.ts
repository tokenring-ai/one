import { defineKind } from "../../layout/define.ts";
import type { KindManifest } from "../../layout/types.ts";

export const PLUGINS_KINDS: readonly KindManifest[] = [defineKind({ id: "plugin", label: "Plugins", plural: "plugins" })];
