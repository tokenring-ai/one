import { FileText } from "lucide-react";
import { defineApp } from "../../layout/define.ts";
import type { AppManifest } from "../../layout/types.ts";

/**
 * The Documents app: the markdown editor beside a tabbed Preview / AI edit
 * container, with agent chats on the right. Routes: `/documents`,
 * `/documents/preview`, `/documents/ai`.
 *
 * React-free apart from the icon: the server imports it to serve routes.
 */
export const DOCUMENTS_APP: AppManifest = defineApp({
  id: "documents",
  path: "/documents",
  shortLabel: "DO",
  iconClass: "text-lime-500",
  gradient: "from-lime-500 to-green-600",
  defaultPinned: true,
  label: "Documents",
  description: "Write and edit documents with AI assistance",
  icon: FileText,
  group: "Build",
  views: ["document-editor", "document-preview", "document-ai-edit", "chat"],
  primaryKind: "document",
  placement: { agent: "right" },
  layout: {
    split: "row",
    sizes: [3, 2],
    children: [
      { presenter: "single", accepts: ["document"], items: ["document-editor"], primary: true },
      { presenter: "tabs", accepts: ["document-tool"], items: ["document-preview", "document-ai-edit"] },
    ],
  },
});
