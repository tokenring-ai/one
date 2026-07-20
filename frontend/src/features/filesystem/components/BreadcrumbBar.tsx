import { ChevronRight, Eye, EyeOff, Plus, RefreshCw } from "lucide-react";
import React from "react";
import { cn } from "../../../lib/utils.ts";

interface BreadcrumbBarProps {
  path: string;
  onNavigate: (p: string) => void;
  showHidden: boolean;
  onToggleHidden: () => void;
  onUpload: () => void;
  onRefresh: () => void;
}

export default function BreadcrumbBar({ path, onNavigate, showHidden, onToggleHidden, onUpload, onRefresh }: BreadcrumbBarProps) {
  const parts = path === "." ? [] : path.split("/");
  return (
    <div className="h-10 border-b border-primary bg-secondary flex items-center gap-2 px-3 shrink-0">
      <div className="flex items-center gap-0.5 text-xs text-muted flex-1 min-w-0 overflow-hidden">
        <button type="button" onClick={() => onNavigate(".")} className="hover:text-primary shrink-0 focus-ring rounded px-1">
          root
        </button>
        {parts.map((part, i) => (
          <React.Fragment key={part}>
            <ChevronRight className="w-3 h-3 shrink-0 text-dim" />
            <button
              type="button"
              onClick={() => onNavigate(parts.slice(0, i + 1).join("/"))}
              className={cn("hover:text-primary truncate focus-ring rounded px-1 cursor-pointer", i === parts.length - 1 && "text-primary font-medium")}
            >
              {part}
            </button>
          </React.Fragment>
        ))}
      </div>

      <button
        type="button"
        onClick={onRefresh}
        className="p-1.5 text-muted hover:text-primary transition-colors focus-ring rounded-md cursor-pointer"
        aria-label="Refresh"
        title="Refresh"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onToggleHidden}
        className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-hover text-muted text-2xs transition-colors focus-ring cursor-pointer"
        title={showHidden ? "Hide hidden files" : "Show hidden files"}
      >
        {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{showHidden ? "Hide" : "Show"} hidden</span>
      </button>
      <button
        type="button"
        onClick={onUpload}
        className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-hover text-muted text-2xs transition-colors focus-ring cursor-pointer"
        title="Upload files"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Upload</span>
      </button>
    </div>
  );
}
