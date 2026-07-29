import { AlertCircle, Archive, FileText, Inbox, type LucideIcon, Mail, Send, Star, Trash2 } from "lucide-react";
import type { FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import type { MessageFilter } from "./types.ts";

export const BOX_META: Record<string, { icon: LucideIcon; color: string }> = {
  inbox: { icon: Inbox, color: "text-blue-400" },
  starred: { icon: Star, color: "text-amber-400" },
  sent: { icon: Send, color: "text-green-400" },
  drafts: { icon: FileText, color: "text-purple-400" },
  archive: { icon: Archive, color: "text-muted" },
  trash: { icon: Trash2, color: "text-red-400" },
  spam: { icon: AlertCircle, color: "text-amber-500" },
};

export const DEFAULT_BOX_META = { icon: Mail, color: "text-muted" } as const;

export const MESSAGE_FILTERS: FilterTabOption<MessageFilter>[] = [
  { id: "all", label: "All" },
  { id: "read", label: "Read" },
  { id: "unread", label: "Unread" },
];

export const PAGE_SIZE = 50;
