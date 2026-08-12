import formatError from "@tokenring-ai/utility/error/formatError";
import { Check, Code, Download, File, FileText, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import KeyValueMetadata from "../../../components/ui/KeyValueMetadata.tsx";
import { toastManager } from "../../../components/ui/toast.tsx";
import { cn } from "../../../lib/utils.ts";
import { filesystemRPCClient } from "../../../rpc.ts";
import { downloadWorkspaceFile } from "../downloadFile.ts";
import { formatFileDate, formatFileSize, getBasename, getFileIcon } from "../fsUtils.ts";

interface FileStats {
  size?: number;
  modified?: string;
  created?: string;
  isDirectory?: boolean;
  isFile?: boolean;
}

interface PreviewMetadataPaneProps {
  file: string | null;
  provider: string | null;
  selectedPaths: Set<string>;
  onToggleSelected: (f: string) => void;
  onClose: () => void;
  isDirty: boolean;
  saving: boolean;
  onSave: () => Promise<void>;
  onRename?: (file: string) => void;
  onDelete?: (file: string) => void;
}

export default function PreviewMetadataPane({
  file,
  provider,
  selectedPaths,
  onToggleSelected,
  onClose,
  isDirty,
  saving,
  onSave,
  onRename,
  onDelete,
}: PreviewMetadataPaneProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<FileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !provider) {
      setStats(null);
      setStatsError(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);
    setStats(null);
    filesystemRPCClient
      .stat({ path: file, provider })
      .then(({ stats: s }) => {
        if (cancelled) return;
        if (s.exists) {
          const next: FileStats = {};
          if (s.size !== undefined) next.size = s.size;
          if (s.modified !== undefined) next.modified = s.modified;
          if (s.created !== undefined) next.created = s.created;
          if (s.isDirectory !== undefined) next.isDirectory = s.isDirectory;
          if (s.isFile !== undefined) next.isFile = s.isFile;
          setStats(next);
        } else {
          setStatsError("File not found");
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setStatsError(formatError(e));
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file, provider]);

  if (!file) {
    return (
      <div className="h-full bg-tertiary flex flex-col items-center justify-center text-center p-8">
        <File className="w-12 h-12 text-muted opacity-20 mb-4" />
        <p className="text-sm text-muted">Select a file to preview</p>
        <p className="text-xs text-dim mt-1">Or check files and launch an agent</p>
      </div>
    );
  }

  const name = getBasename(file);
  const isChecked = selectedPaths.has(file);
  const ext = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "File";

  const handleDownload = async () => {
    if (!provider) return;
    try {
      await downloadWorkspaceFile(file, provider);
    } catch {
      toastManager.error("Download failed", { duration: 3000 });
    }
  };

  return (
    <div className="h-full bg-secondary flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-primary flex items-start gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-tertiary flex items-center justify-center shrink-0">{getFileIcon(file, false, 20)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate" title={file}>
            {name}
          </p>
          <p className="text-xs text-muted mt-0.5">{ext}</p>
        </div>
        <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary focus-ring rounded" aria-label="Close preview">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-primary space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => onToggleSelected(file)}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all focus-ring cursor-pointer",
            isChecked
              ? "bg-accent-subtle border border-accent-strong text-accent-soft hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400"
              : "bg-accent hover:bg-accent-hover text-white shadow-button-primary",
          )}
        >
          {isChecked ? (
            <>
              <Check className="w-3.5 h-3.5" /> Selected for launch
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> Select for launch
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleDownload()}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-primary text-xs font-medium text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </button>
          {onRename && (
            <button
              type="button"
              onClick={() => onRename(file)}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-primary text-xs font-medium text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" /> Rename
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(file)}
              className={cn(
                "flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-primary text-xs font-medium text-muted hover:text-red-400 hover:bg-hover transition-all focus-ring cursor-pointer",
                !onRename && "col-span-2",
              )}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>

        {/\.md$/i.test(file) && provider && (
          <button
            type="button"
            onClick={async () => {
              try {
                const result = await filesystemRPCClient.readTextFile({ path: file, provider });
                const title = getBasename(file).replace(/\.md$/i, "");
                void navigate("/documents", { state: { filePath: file, fileContent: result.content ?? "", title, provider } });
              } catch {
                toastManager.error("Could not read file", { duration: 3000 });
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-primary text-xs font-medium text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> Open in Documents
          </button>
        )}
        {/\.html?$/i.test(file) && provider && (
          <button
            type="button"
            onClick={async () => {
              try {
                const result = await filesystemRPCClient.readTextFile({ path: file, provider });
                void navigate("/web-design", { state: { fileContent: result.content ?? "" } });
              } catch {
                toastManager.error("Could not read file", { duration: 3000 });
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-primary text-xs font-medium text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" /> Open in Web Design
          </button>
        )}
        {isDirty && (
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-primary text-xs font-medium text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>

      <div className="px-4 py-3 space-y-1.5 shrink-0 overflow-y-auto flex-1">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Details</p>
        <KeyValueMetadata
          labelWidth="w-16"
          gap="space-y-1.5"
          items={[
            {
              label: "Path",
              value: (
                <span className="font-mono text-primary" title={file}>
                  {file}
                </span>
              ),
            },
            { label: "Type", value: <span className="text-primary">{ext ?? "—"}</span> },
            !statsLoading &&
              !statsError && {
                label: "Size",
                value: <span className="text-primary">{formatFileSize(stats?.size)}</span>,
              },
            !statsLoading &&
              !statsError && {
                label: "Modified",
                value: <span className="text-primary">{formatFileDate(stats?.modified)}</span>,
              },
            !statsLoading &&
              !statsError && {
                label: "Created",
                value: <span className="text-primary">{formatFileDate(stats?.created)}</span>,
              },
          ]}
        />
        {statsLoading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading stats…
          </div>
        ) : statsError ? (
          <p className="text-xs text-red-400">{statsError}</p>
        ) : null}
      </div>
    </div>
  );
}
