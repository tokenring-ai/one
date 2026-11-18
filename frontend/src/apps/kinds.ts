import { defineKind } from "../layout/define.ts";
import type { KindManifest } from "../layout/types.ts";

/** View kinds shipped by the core frontend. Plugins add their own. */
export const CORE_KINDS: readonly KindManifest[] = [
  defineKind({ id: "agent", label: "Agents", plural: "agent chats" }),
  defineKind({ id: "agent-type", label: "Agent types", plural: "agent types" }),
  defineKind({ id: "page", label: "Pages", plural: "pages" }),
  defineKind({ id: "navigator", label: "Navigators", plural: "navigators", presenter: "single" }),
  defineKind({ id: "widget", label: "Widgets", plural: "widgets", presenter: "single" }),
  defineKind({ id: "plugin-config", label: "Plugin settings", plural: "plugin settings" }),
];
