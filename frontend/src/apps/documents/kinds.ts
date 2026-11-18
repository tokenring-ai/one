import type { KindManifest } from "../../layout/types.ts";

/** Kinds the Documents app adds: the editor, and the tools (preview, AI edit) that sit beside it. */
export const DOCUMENTS_KINDS: readonly KindManifest[] = [
  { id: "document", label: "Documents", plural: "documents" },
  { id: "document-tool", label: "Document tools", plural: "document tools" },
];
