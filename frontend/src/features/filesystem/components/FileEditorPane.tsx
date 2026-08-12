import { Code, FileWarning, Loader2, Save } from "lucide-react";
import CodeEditor from "../../../components/editor/CodeEditor.tsx";
import MarkdownEditor from "../../../components/editor/MarkdownEditor.tsx";
import DetailViewerArea from "../../../components/ui/DetailViewerArea.tsx";
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
  return (
    <DetailViewerArea
      ready
      hasSelection={file != null}
      data={file}
      loading={false}
      emptyState={{
        icon: Code,
        title: "No file selected for editing",
        hint: "Open a file from the list above",
      }}
      renderContent={selectedFile => (
        <FileEditorBody
          file={selectedFile}
          content={content}
          onContentChange={onContentChange}
          isLoading={isLoading}
          hasData={hasData}
          isDirty={isDirty}
          saving={saving}
          {...(onSave != null ? { onSave } : {})}
          {...(loadError !== undefined ? { loadError } : {})}
        />
      )}
    />
  );
}

function FileEditorBody({
  file,
  content,
  onContentChange,
  isLoading,
  hasData,
  isDirty,
  saving,
  onSave,
  loadError,
}: {
  file: string;
  content: string;
  onContentChange: (c: string) => void;
  isLoading: boolean;
  hasData: boolean;
  isDirty: boolean;
  saving: boolean;
  onSave?: () => void;
  loadError?: string | null;
}) {
  const name = getBasename(file);
  const textEditable = isLikelyTextFile(file);

  // Represent loaded text as a stable object so empty-string content is still valid data.
  const textData = hasData ? { content } : null;
  const loadFailure = loadError != null && loadError !== "" ? loadError : !isLoading && !hasData ? "Could not load file" : null;

  return (
    <div className="h-full bg-secondary flex flex-col min-h-0">
      <div className="h-9 px-3 border-b border-primary bg-tertiary flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-muted uppercase tracking-widest shrink-0">Editor</span>
        <span className="text-xs text-dim">·</span>
        <span className="text-xs text-primary font-medium truncate" title={file}>
          {name}
        </span>
        {isDirty && <span className="text-xs text-amber-400 shrink-0">unsaved</span>}
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
            <p className="text-xs text-dim max-w-xs">This file type isn’t opened in the text editor. Use Download from the preview panel if needed.</p>
          </div>
        ) : (
          <DetailViewerArea
            ready
            hasSelection
            data={textData}
            loading={isLoading}
            {...(loadFailure != null ? { error: loadFailure } : {})}
            loadingMessage="Loading file…"
            errorTitle="Failed to load file"
            emptyState={{
              icon: Code,
              title: "No file content",
              hint: "Select a text file to edit.",
            }}
            renderContent={({ content: fileContent }) => (
              <div className="h-full overflow-auto">
                {file.endsWith(".md") ? (
                  <MarkdownEditor key={file} content={fileContent} onContentChange={onContentChange} />
                ) : (
                  <CodeEditor key={file} file={file} content={fileContent} onContentChange={onContentChange} />
                )}
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
