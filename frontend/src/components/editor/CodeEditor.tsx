import Editor from "@monaco-editor/react";
import type React from "react";
import { useEffect, useState } from "react";
import { useTheme } from "../../hooks/useTheme.ts";

interface FileViewerProps {
  file: string;
  content: string;
  onContentChange?: (content: string) => void;
  onMarkSaved?: () => void;
}

type MonacoEditorInstance = Parameters<NonNullable<React.ComponentProps<typeof Editor>["onMount"]>>[0];

export default function CodeEditor({ file, content, onContentChange, onMarkSaved }: FileViewerProps) {
  const handleMarkSaved = () => {
    setIsModified(false);
    onMarkSaved?.();
  };
  const [editorContent, setEditorContent] = useState(content);
  const [isModified, setIsModified] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  useEffect(() => {
    setEditorContent(content);
    setIsModified(false);
  }, [content, file]);

  const handleContentChange = (value: string | undefined) => {
    const newContent = value || "";
    setEditorContent(newContent);
    setIsModified(newContent !== content);
    onContentChange?.(newContent);
  };

  const getLanguage = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      go: "go",
      rs: "rust",
      rb: "ruby",
      php: "php",
      swift: "swift",
      kt: "kotlin",
      scala: "scala",
      sql: "sql",
      sh: "shell",
      bash: "shell",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      html: "html",
      css: "css",
      scss: "scss",
      less: "less",
    };
    return langMap[ext || ""] || "plaintext";
  };

  const getLineCount = (text: string) => {
    return text.length > 0 ? text.split("\n").length : 1;
  };

  const getWordCount = (text: string) => {
    const words = text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    return words.length;
  };

  const [theme] = useTheme();
  const language = getLanguage(file);
  const lineCount = getLineCount(editorContent);
  const wordCount = getWordCount(editorContent);

  const handleEditorMount = (editor: MonacoEditorInstance) => {
    const updateCursorPosition = () => {
      const position = editor.getPosition();
      if (position) {
        setCursorPosition({
          line: position.lineNumber,
          column: position.column,
        });
      }
    };

    editor.onDidChangeCursorPosition(updateCursorPosition);
    updateCursorPosition();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={editorContent}
          onChange={handleContentChange}
          onMount={handleEditorMount}
          theme={theme === "light" ? "vs-light" : "vs-dark"}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
      <div className={`flex items-center justify-between px-4 py-3 text-xs border-t border-primary bg-tertiary`}>
        <div className="flex items-center gap-4">
          <span className="font-medium truncate max-w-50 text-primary" title={file}>
            {file}
          </span>
          {isModified && <span className="px-2 py-0.5 rounded-md text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400">Modified</span>}
          {!isModified && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Saved">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted">{language}</span>
          <span className="text-muted">{lineCount} lines</span>
          <span className="text-muted">{wordCount} words</span>
          <span className="text-muted" title="Cursor position">
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
          <button
            type="button"
            onClick={handleMarkSaved}
            disabled={!isModified}
            className={`px-2 py-0.5 rounded-md text-xs transition-colors focus-ring ${
              isModified ? "bg-accent text-white hover:bg-accent active:scale-[0.98]" : "opacity-30 cursor-not-allowed bg-accent text-white"
            }`}
            title="Mark as saved"
          >
            Mark Saved
          </button>
        </div>
      </div>
    </div>
  );
}
