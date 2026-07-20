import type { ParsedFileSelectQuestion } from "@tokenring-ai/agent/question";
import type { MaybePromise } from "bun";
import { AlertCircle, Check, ChevronDown, ChevronRight, File, Folder, RefreshCw, Send, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { filesystemRPCClient, useFilesystemState } from "../../../rpc.ts";
import { sendInteractionResponse } from "../sendInteractionResponse.ts";

interface FileInlineProps {
  question: ParsedFileSelectQuestion;
  agentId: string;
  requestId: string;
  interactionId?: string;
  onSubmitValue?: (value: string[] | null) => MaybePromise<void>;
  onClose: () => void;
  autoFocus?: boolean;
}

export default function FileInlineQuestion({
  question: { allowFiles, allowDirectories, minimumSelections, maximumSelections, defaultValue },
  agentId,
  requestId,
  interactionId,
  onSubmitValue,
  onClose,
  autoFocus = true,
}: FileInlineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["."]));
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<Map<string, string[]>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValue));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const multiple = maximumSelections !== 1;

  const fsState = useFilesystemState(agentId);
  const provider = fsState.data?.status === "success" ? fsState.data.provider : null;

  const loadDirectory = useCallback(
    async (path: string) => {
      if (files.has(path)) return;
      if (!provider) return;
      setLoading(prev => new Set(prev).add(path));
      try {
        const result = await filesystemRPCClient.listDirectory({ path, showHidden: true, provider, recursive: false });
        setFiles(prev => new Map(prev).set(path, result.files));
      } catch {
        setError("Failed to load directory");
        setTimeout(() => setError(null), 3000);
      } finally {
        setLoading(prev => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [provider, files],
  );

  const toggleExpand = async (path: string) => {
    const isExpanded = expanded.has(path);
    if (isExpanded) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } else {
      setExpanded(prev => new Set(prev).add(path));
      await loadDirectory(path);
    }
  };

  const toggleSelect = (path: string, isDir: boolean) => {
    const isSelectable = (isDir && allowDirectories) || (!isDir && allowFiles);
    if (!isSelectable) return;

    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        if (minimumSelections && next.size <= minimumSelections) {
          setError(`Minimum ${minimumSelections} required`);
          setTimeout(() => setError(null), 2000);
          return prev;
        }
        next.delete(path);
      } else {
        if (maximumSelections && next.size >= maximumSelections) {
          setError(`Maximum ${maximumSelections} allowed`);
          setTimeout(() => setError(null), 2000);
          return prev;
        }
        if (!multiple) next.clear();
        next.add(path);
      }
      return next;
    });
  };

  const isSelectionValid = () => {
    const count = selected.size;
    if (minimumSelections !== undefined && count < minimumSelections) return false;
    if (maximumSelections !== undefined && count > maximumSelections) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!isSelectionValid()) {
      setError("Selection is invalid");
      setTimeout(() => setError(null), 2000);
      return;
    }
    setIsSubmitting(true);
    const result = Array.from(selected);
    if (onSubmitValue) {
      await onSubmitValue(result);
    } else if (interactionId) {
      await sendInteractionResponse({
        agentId,
        requestId,
        interactionId,
        result,
      });
    }
    onClose();
  };

  const handleCancel = async () => {
    if (onSubmitValue) {
      await onSubmitValue(null);
    } else if (interactionId) {
      await sendInteractionResponse({
        agentId,
        requestId,
        interactionId,
        result: null,
      });
    }
    onClose();
  };

  const renderTree = (path: string, depth: number = 0): React.ReactNode[] => {
    const items = files.get(path) || [];
    const result: React.ReactNode[] = [];

    for (const item of items.sort((a, b) => {
      const aDir = a.endsWith("/");
      const bDir = b.endsWith("/");
      if (aDir && !bDir) return -1;
      if (!aDir && bDir) return 1;
      return a.localeCompare(b);
    })) {
      const isDir = item.endsWith("/");
      const cleanPath = isDir ? item.slice(0, -1) : item;
      const name = cleanPath.split("/").pop() || cleanPath;
      const isExpanded = expanded.has(cleanPath);
      const isLoading = loading.has(cleanPath);
      const isSelected = selected.has(item);
      const isSelectable = (isDir && allowDirectories) || (!isDir && allowFiles);

      result.push(
        <div
          key={item}
          role="treeitem"
          aria-expanded={isDir ? isExpanded : undefined}
          aria-selected={isSelected}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
            isSelected ? "bg-accent/20" : "hover:bg-hover"
          } ${!isSelectable ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (!isSelectable) return;
            if (isDir) {
              void toggleExpand(cleanPath);
            } else {
              toggleSelect(item, false);
            }
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (isDir) {
                void toggleExpand(cleanPath);
              } else {
                toggleSelect(item, false);
              }
            }
          }}
          tabIndex={isSelectable ? 0 : -1}
        >
          {isDir ? (
            <span className="text-muted shrink-0" aria-hidden="true">
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted" />
              ) : isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              )}
            </span>
          ) : (
            <span className="w-3.5 shrink-0"></span>
          )}
          {isDir ? (
            <Folder className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          ) : (
            <File className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
          )}
          <span className="text-sm truncate">{name}</span>
          {isSelected && <Check className="w-3.5 h-3.5 text-accent ml-auto shrink-0" aria-hidden="true" />}
        </div>,
      );

      if (isDir && isExpanded && !isLoading) {
        result.push(...renderTree(cleanPath, depth + 1));
      }
    }

    return result;
  };

  // Auto-focus on mount and scroll into view
  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [autoFocus]);

  useEffect(() => {
    void loadDirectory(".");
  }, [loadDirectory]);

  return (
    <div ref={containerRef} className="p-4 space-y-3">
      <div
        role="tree"
        aria-label="File browser"
        className="max-h-75 overflow-y-auto custom-scrollbar border border-primary/30 rounded-lg bg-secondary shadow-md p-2"
      >
        {files.has(".") ? (
          renderTree(".", 0)
        ) : (
          <div className="flex items-center justify-center gap-2 text-muted text-sm py-8">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading files...</span>
          </div>
        )}
      </div>
      {error && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm"
          role="alert"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-2xs font-medium ${isSelectionValid() ? "text-primary" : "text-amber-600 dark:text-amber-400"}`} aria-live="polite">
            {selected.size} selected
          </span>
          {(minimumSelections !== undefined || maximumSelections !== undefined) && (
            <span className="text-2xs text-muted">
              {minimumSelections !== undefined && `min ${minimumSelections}`}
              {minimumSelections !== undefined && maximumSelections !== undefined && " · "}
              {maximumSelections !== undefined && `max ${maximumSelections}`}
            </span>
          )}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-2xs text-muted hover:text-primary transition-colors focus-ring"
              aria-label="Clear all selections"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 p-1.5 rounded-md text-xs text-muted hover:bg-hover hover:text-primary transition-colors disabled:opacity-50 focus-ring"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !isSelectionValid()}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {isSubmitting ? "Sending..." : "Submit"}
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
