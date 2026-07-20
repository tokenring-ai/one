import formatError from "@tokenring-ai/utility/error/formatError";
import { AlertTriangle, Eye, FileText, Loader2, Save, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { cn } from "../../lib/utils.ts";
import { filesystemRPCClient, useFilesystemProviders } from "../../rpc.ts";
import AIEditPanel from "./components/AIEditPanel.tsx";
import MarkdownPreview from "./components/MarkdownPreview.tsx";
import SaveAsModal from "./components/SaveAsModal.tsx";
import { INITIAL_CONTENT } from "./constants.ts";
import { useAIEdit } from "./hooks/useAIEdit.ts";
import type { RightPanel, TextSelection } from "./types.ts";

export default function DocumentsApp() {
  const location = useLocation();
  const fsProviders = useFilesystemProviders();
  const {
    agentId,
    initialising,
    error: initError,
  } = useHeadlessAgent({
    appName: "Documents app",
    preferredTypes: ["writer"],
    noTypesMessage: "No agent types available for AI editing",
    onNoTypes: message => toastManager.warning(message, { duration: 5000 }),
    onError: message => toastManager.error(`AI editing unavailable: ${message}`, { duration: 5000 }),
  });
  const { loading: aiLoading, response: aiResponse, sendEdit, cancel: cancelAI, clear: clearAI } = useAIEdit(agentId);

  const [content, setContent] = useState(INITIAL_CONTENT);
  const [title, setTitle] = useState("Untitled Document");
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("preview");
  const [aiPrompt, setAiPrompt] = useState("");

  // Save state
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState(INITIAL_CONTENT);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);

  const isDirty = content !== savedContent;
  const providers = fsProviders.data?.providers ?? [];

  // Load file from FilesApp navigation state; reset when navigating without file payload
  useEffect(() => {
    const state = location.state as { filePath?: string; fileContent?: string; title?: string; provider?: string } | null;

    if (state?.fileContent !== undefined) {
      setContent(state.fileContent);
      setSavedContent(state.fileContent);
      setCurrentFilePath(state.filePath ?? null);
      setCurrentProvider(state.provider ?? null);
      if (state.title) setTitle(state.title);
      return;
    }

    setContent(INITIAL_CONTENT);
    setSavedContent(INITIAL_CONTENT);
    setCurrentFilePath(null);
    setCurrentProvider(null);
    setTitle("Untitled Document");
  }, [location.key, location.state]);

  const handleSave = useCallback(async () => {
    if (!currentFilePath || !currentProvider) {
      setShowSaveAs(true);
      return;
    }
    setIsSaving(true);
    try {
      await filesystemRPCClient.writeFile({ path: currentFilePath, content, provider: currentProvider });
      setSavedContent(content);
      toastManager.success("Saved", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  }, [currentFilePath, currentProvider, content]);

  const handleSaveAs = useCallback(
    async (path: string, provider: string) => {
      await filesystemRPCClient.writeFile({ path, content, provider });
      setCurrentFilePath(path);
      setCurrentProvider(provider);
      setSavedContent(content);
      setShowSaveAs(false);
      const name = path.split("/").pop() || path;
      setTitle(name.replace(/\.md$/i, ""));
      toastManager.success("Saved", { duration: 2000 });
    },
    [content],
  );

  // Ctrl/Cmd+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stats = React.useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return { words, chars: content.length };
  }, [content]);

  // Capture textarea selection
  const captureSelection = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) {
      setSelection(null);
      return;
    }
    setSelection({ start, end, text: ta.value.slice(start, end) });
    // Auto-switch to AI panel when something is selected
    setRightPanel("ai");
  }, []);

  // Apply AI response into the document
  const applyAIResponse = useCallback(() => {
    if (!aiResponse || !selection) return;
    const before = content.slice(0, selection.start);
    const after = content.slice(selection.end);
    const newContent = before + aiResponse + after;
    setContent(newContent);
    const newPos = selection.start + aiResponse.length;
    clearAI();
    setAiPrompt("");
    setSelection(null);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.selectionStart = newPos;
        ta.selectionEnd = newPos;
        ta.focus();
      }
    });
    toastManager.success("Changes applied", { duration: 2000 });
  }, [aiResponse, selection, content, clearAI]);

  const handleSubmitAI = useCallback(async () => {
    if (!selection || !aiPrompt.trim()) return;
    await sendEdit(selection.text, aiPrompt.trim());
  }, [selection, aiPrompt, sendEdit]);

  // Clear selection + AI state when switching away from AI panel
  const handlePanelToggle = useCallback(
    (panel: RightPanel) => {
      setRightPanel(panel);
      if (panel === "preview") {
        setSelection(null);
        clearAI();
      }
    },
    [clearAI],
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      {showSaveAs && (
        <SaveAsModal
          providers={providers}
          initialPath={currentFilePath ?? `${title.toLowerCase().replace(/\s+/g, "-")}.md`}
          onSave={handleSaveAs}
          onClose={() => setShowSaveAs(false)}
        />
      )}

      {initError && !initialising && (
        <div role="alert" className="shrink-0 px-4 py-2.5 bg-warning/10 border-b border-warning/30 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">AI editing is disabled</p>
            <p className="text-2xs text-muted">{initError}</p>
          </div>
        </div>
      )}

      <AppPageHeader
        size="compact"
        icon={<FileText className="w-4 h-4" />}
        iconGradient="from-lime-500 to-green-600"
        className="py-2.5"
        title={
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold text-primary placeholder-muted focus:outline-none min-w-0"
            placeholder="Document title…"
            aria-label="Document title"
          />
        }
      >
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              title={currentFilePath ? `Save (Ctrl/⌘+S)` : "Save As…"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {currentFilePath ? "Save" : "Save As…"}
            </button>
            {currentFilePath && (
              <button
                type="button"
                onClick={() => setShowSaveAs(true)}
                title="Save As…"
                className="px-2 py-1.5 text-xs text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer"
              >
                Save As…
              </button>
            )}
          </div>
          <div className="flex rounded-lg border border-primary overflow-hidden">
            <button
              type="button"
              onClick={() => handlePanelToggle("preview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors focus-ring cursor-pointer",
                rightPanel === "preview" ? "bg-accent text-on-accent" : "text-muted hover:text-primary hover:bg-hover",
              )}
              aria-pressed={rightPanel === "preview"}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => handlePanelToggle("ai")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors focus-ring cursor-pointer",
                rightPanel === "ai" ? "bg-accent text-on-accent" : "text-muted hover:text-primary hover:bg-hover",
              )}
              aria-pressed={rightPanel === "ai"}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {initialising ? "AI…" : "AI Edit"}
              {selection && rightPanel !== "ai" && <span className="w-1.5 h-1.5 bg-accent-soft rounded-full animate-pulse" />}
            </button>
          </div>
        </div>
      </AppPageHeader>

      {/* Body: editor + right panel */}
      <div className="flex flex-1 min-h-0">
        {/* ── Markdown editor ── */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-primary">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => {
              setContent(e.target.value);
              // Update selection text if still valid
              const ta = e.target;
              const start = ta.selectionStart;
              const end = ta.selectionEnd;
              if (selection && start !== end) {
                setSelection({ start, end, text: ta.value.slice(start, end) });
              }
            }}
            onSelect={captureSelection}
            onMouseUp={captureSelection}
            onKeyUp={captureSelection}
            className="flex-1 resize-none bg-primary text-primary text-sm font-mono p-5 leading-7 focus:outline-none placeholder-muted"
            placeholder="Start writing markdown here…"
            spellCheck={false}
            aria-label="Markdown editor"
            aria-multiline="true"
          />

          {/* Status bar */}
          <div className="shrink-0 h-8 border-t border-primary bg-secondary flex items-center px-4 gap-4 text-2xs text-muted select-none">
            <span>{stats.words} words</span>
            <span>{stats.chars} chars</span>
            {selection && <span className="text-accent-soft font-semibold">{selection.end - selection.start} chars selected</span>}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="w-80 xl:w-96 shrink-0 flex-col min-h-0 hidden lg:flex">
          {rightPanel === "preview" ? (
            <MarkdownPreview content={content} />
          ) : (
            <AIEditPanel
              selection={selection}
              agentId={agentId}
              initError={initError}
              initialising={initialising}
              prompt={aiPrompt}
              onPromptChange={setAiPrompt}
              loading={aiLoading}
              response={aiResponse}
              onSubmit={handleSubmitAI}
              onCancel={cancelAI}
              onApply={applyAIResponse}
              onClearResponse={clearAI}
            />
          )}
        </div>
      </div>
    </div>
  );
}
