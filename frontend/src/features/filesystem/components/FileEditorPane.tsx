import { Code, FileWarning, Loader2, Save } from "lucide-react";
import CodeEditor from "../../../components/editor/CodeEditor.tsx";
import MarkdownEditor from "../../../components/editor/MarkdownEditor.tsx";
import { getBasename, isLikelyTextFile } from "../fsUtils.ts";

interface FileEditorPaneProps {
  file: string | null;
  content: string;
  onContentChange: (c: string) => void;
  isLoading: boolean;
  hasData: boolean;
  isDirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  loadError?: string | null;
}

export default function FileEditorPane({
  file,
  content,
  onContentChange,
  isLoading,
  hasData,
  isDirty = false,
  saving = false,
  onSave,
  loadError,
}: FileEditorPaneProps) {
  if (!file) {
    return (
      <div className="h-full bg-tertiary flex flex-col items-center justify-center text-center p-8">
        <Code className="w-12 h-12 text-muted opacity-20 mb-4" />
        <p className="text-sm text-muted">No file selected for editing</p>
        <p className="text-2xs text-dim mt-1">Open a file from the list above</p>
      </div>
    );
  }

  const name = getBasename(file);
  const textEditable = isLikelyTextFile(file);

  return (
    <div className="h-full bg-secondary flex flex-col min-h-0">
      <div className="h-9 px-3 border-b border-primary bg-tertiary flex items-center gap-2 shrink-0">
        <span className="text-2xs font-semibold text-muted uppercase tracking-widest shrink-0">Editor</span>
        <span className="text-xs text-dim">·</span>
        <span className="text-xs text-primary font-medium truncate" title={file}>
          {name}
        </span>
        {isDirty && <span className="text-2xs text-amber-400 shrink-0">unsaved</span>}
        <div className="flex-1" />
        {onSave && textEditable && (
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-1.5 px-2 py-1 text-muted hover:text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors focus-ring rounded-md text-xs cursor-pointer"
            aria-label="Save file"
            title="Save (⌘/Ctrl+S)"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        {!textEditable ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-2">
            <FileWarning className="w-10 h-10 text-muted opacity-40" />
            <p className="text-sm text-muted">Binary or media file</p>
            <p className="text-2xs text-dim max-w-xs">This file type isn’t opened in the text editor. Use Download from the preview panel if needed.</p>
          </div>
        ) : isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-muted animate-spin" />
          </div>
        ) : loadError ? (
          <div className="h-full flex items-center justify-center text-2xs text-red-400 p-4 text-center">{loadError}</div>
        ) : hasData ? (
          <div className="h-full overflow-auto">
            {file.endsWith(".md") ? (
              <MarkdownEditor key={file} content={content} onContentChange={onContentChange} />
            ) : (
              <CodeEditor key={file} file={file} content={content} onContentChange={onContentChange} />
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-2xs text-muted">Could not load file</div>
        )}
      </div>
    </div>
  );
}
