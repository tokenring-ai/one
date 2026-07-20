import { Code, Loader2 } from "lucide-react";
import CodeEditor from "../../../components/editor/CodeEditor.tsx";
import MarkdownEditor from "../../../components/editor/MarkdownEditor.tsx";

interface FileEditorPaneProps {
  file: string | null;
  content: string;
  onContentChange: (c: string) => void;
  isLoading: boolean;
  hasData: boolean;
}

export default function FileEditorPane({ file, content, onContentChange, isLoading, hasData }: FileEditorPaneProps) {
  if (!file) {
    return (
      <div className="h-full bg-tertiary flex flex-col items-center justify-center text-center p-8">
        <Code className="w-12 h-12 text-muted opacity-20 mb-4" />
        <p className="text-sm text-muted">No file selected for editing</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-secondary flex flex-col">
      <div className="flex-1 overflow-hidden min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-muted animate-spin" />
          </div>
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
