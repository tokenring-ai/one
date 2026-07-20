import MDEditor from "@uiw/react-md-editor";
import React, { useCallback, useMemo, useState } from "react";

interface FileViewerProps {
  content: string;
  onContentChange?: (content: string) => void;
}

type PreviewMode = NonNullable<React.ComponentProps<typeof MDEditor>["preview"]>;

export default function MarkdownEditor({ content, onContentChange }: FileViewerProps) {
  const [editorContent, setEditorContent] = useState(content);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("preview");

  React.useEffect(() => {
    setEditorContent(content);
  }, [content]);

  const handleContentChange = (value?: string) => {
    if (value) {
      setEditorContent(value);
      onContentChange?.(value);
    }
  };

  // Calculate content statistics
  const stats = useMemo(() => {
    const chars = editorContent.length;
    const words = editorContent.trim() ? editorContent.trim().split(/\s+/).length : 0;
    return { chars, words };
  }, [editorContent]);

  // Toggle preview mode
  const cyclePreviewMode = useCallback(() => {
    setPreviewMode(current => {
      const modes: PreviewMode[] = ["preview", "live", "edit"];
      const currentIndex = modes.indexOf(current);
      return modes[(currentIndex + 1) % modes.length]!;
    });
  }, []);

  // Handle keyboard shortcut for preview mode toggle
  React.useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Ctrl+P or Cmd+P to toggle preview mode
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        cyclePreviewMode();
      }
    };

    // Only attach to the editor container to avoid global conflicts
    const editorElement = document.querySelector<HTMLElement>('[role="region"][aria-label="Markdown Editor"]');
    editorElement?.addEventListener("keydown", handleKeyDown);

    return () => {
      editorElement?.removeEventListener("keydown", handleKeyDown);
    };
  }, [cyclePreviewMode]);

  return (
    <div className="flex flex-col h-full" role="region" aria-label="Markdown Editor">
      <MDEditor className="flex-1 flex flex-row h-full" preview={previewMode} value={editorContent} onChange={handleContentChange} data-gramm="false" />
      {/* Status bar with content stats and shortcuts */}
      <div
        className="bg-tertiary border border-primary px-4 py-3 text-xs flex justify-between items-center rounded-b-lg shadow-md"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-4">
          <span className="text-muted">{stats.words} words</span>
          <span className="text-muted">{stats.chars} characters</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={cyclePreviewMode}
            className="text-muted hover:text-primary transition-colors focus-ring p-1.5 rounded-md"
            title={`Current mode: ${previewMode === "preview" ? "Preview only" : previewMode === "edit" ? "Edit only" : "Split view"}. Click or press Ctrl/Cmd+P to change.`}
            aria-label="Toggle preview mode (Ctrl/Cmd+P)"
          >
            {previewMode === "preview" && "👁 Preview"}
            {previewMode === "edit" && "✏️ Edit"}
            {previewMode === "live" && "🔄 Split"}
          </button>
          <span className="text-muted">⌘/Ctrl + B: Bold | ⌘/Ctrl + I: Italic | ⌘/Ctrl + K: Link | ⌘/Ctrl + P: Toggle Preview</span>
        </div>
      </div>
    </div>
  );
}
