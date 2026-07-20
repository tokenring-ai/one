import { Check, Code, File, FileText, Loader2, Plus, Save, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toastManager } from "../../../components/ui/toast.tsx";
import { cn } from "../../../lib/utils.ts";
import { filesystemRPCClient } from "../../../rpc.ts";
import { getBasename, getFileIcon } from "../fsUtils.ts";

interface PreviewMetadataPaneProps {
  agentId: string;
  file: string | null;
  provider: string | null;
  selectedPaths: Set<string>;
  onToggleSelected: (f: string) => void;
  onClose: () => void;
  isDirty: boolean;
  saving: boolean;
  onSave: () => Promise<void>;
}

export default function PreviewMetadataPane({ file, provider, selectedPaths, onToggleSelected, onClose, isDirty, saving, onSave }: PreviewMetadataPaneProps) {
  const navigate = useNavigate();
  if (!file) {
    return (
      <div className="h-full bg-tertiary flex flex-col items-center justify-center text-center p-8">
        <File className="w-12 h-12 text-muted opacity-20 mb-4" />
        <p className="text-sm text-muted">Select a file to preview</p>
        <p className="text-2xs text-dim mt-1">Or check files and launch an agent</p>
      </div>
    );
  }

  const name = getBasename(file);
  const isChecked = selectedPaths.has(file);

  return (
    <div className="h-full bg-secondary flex flex-col">
      <div className="px-4 py-3 border-b border-primary flex items-start gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-tertiary flex items-center justify-center shrink-0">{getFileIcon(file, false, 20)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate" title={file}>
            {name}
          </p>
          <p className="text-2xs text-muted mt-0.5">{file.split(".").pop()?.toUpperCase() || "File"}</p>
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
                void navigate("/canvas", { state: { filePath: file, fileContent: result.content ?? "", provider } });
              } catch {
                toastManager.error("Could not read file", { duration: 3000 });
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-primary text-xs font-medium text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" /> Open in Canvas
          </button>
        )}
        {isDirty && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-primary text-xs font-medium text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>

      <div className="px-4 py-2 border-b border-primary space-y-1 shrink-0">
        <div className="flex justify-between text-2xs">
          <span className="text-muted">Path</span>
          <span className="text-primary truncate ml-4 max-w-40" title={file}>
            {file}
          </span>
        </div>
      </div>
    </div>
  );
}
