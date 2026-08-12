import formatError from "@tokenring-ai/utility/error/formatError";
import { Eye, FilePlus, FileText, FolderOpen, Loader2, PanelRight, Save, Sparkles, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorBanner from "../../components/ui/ErrorBanner.tsx";
import FileBrowserModal from "../../components/ui/FileBrowserModal.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useDirtyState } from "../../hooks/useDirtyState.tsx";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts.ts";
import { useNavigationStatePayload } from "../../hooks/useNavigationStatePayload.ts";
import { cn } from "../../lib/utils.ts";
import { filesystemRPCClient, useFilesystemProviders } from "../../rpc.ts";
import AIEditPanel from "./components/AIEditPanel.tsx";
import MarkdownPreview from "./components/MarkdownPreview.tsx";
import SaveAsModal from "./components/SaveAsModal.tsx";
import { INITIAL_CONTENT } from "./constants.ts";
import { useAIEdit } from "./hooks/useAIEdit.ts";
import type { RightPanel, TextSelection } from "./types.ts";

function titleFromPath(path: string): string {
  const name = path.split("/").pop() || path;
  return name.replace(/\.md$/i, "") || "Untitled Document";
}

const DISCARD_DIALOG = {
  dialog: {
    title: "Unsaved changes",
    message: "You have unsaved changes. Discard them and continue?",
    confirmLabel: "Discard",
  },
} as const;

export default function DocumentsApp() {
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
  const resetAI = useCallback(() => {
    cancelAI();
    clearAI();
  }, [cancelAI, clearAI]);

  const [content, setContent] = useState(INITIAL_CONTENT);
  const [title, setTitle] = useState("Untitled Document");
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("preview");
  /** On viewports &lt; lg the right panel is a full-screen sheet; this tracks whether it is open. */
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  // Save / open state
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState(INITIAL_CONTENT);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showOpen, setShowOpen] = useState(false);

  const { isDirty, DirtyDot, confirmDiscard, DiscardDialog } = useDirtyState({
    current: content,
    saved: savedContent,
  });
  const providers = fsProviders.data?.providers ?? [];

  const loadDocument = useCallback(
    (opts: { content: string; path: string | null; provider: string | null; title?: string | undefined }) => {
      setContent(opts.content);
      setSavedContent(opts.content);
      setCurrentFilePath(opts.path);
      setCurrentProvider(opts.provider);
      setTitle(opts.title ?? (opts.path ? titleFromPath(opts.path) : "Untitled Document"));
      setSelection(null);
      setAiPrompt("");
      resetAI();
      setMobilePanelOpen(false);
    },
    [resetAI],
  );

  // Load file from FilesApp navigation state only when a file payload is present
  useNavigationStatePayload<{ filePath?: string; fileContent?: string; title?: string; provider?: string }>({
    onPayload: state => {
      if (state.fileContent === undefined) return;
      loadDocument({
        content: state.fileContent,
        path: state.filePath ?? null,
        provider: state.provider ?? null,
        title: state.title,
      });
    },
  });

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
      try {
        await filesystemRPCClient.writeFile({ path, content, provider });
        setCurrentFilePath(path);
        setCurrentProvider(provider);
        setSavedContent(content);
        setShowSaveAs(false);
        setTitle(titleFromPath(path));
        toastManager.success("Saved", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
        // Re-throw so SaveAsModal can keep its form-level error state.
        throw e;
      }
    },
    [content],
  );

  const resetToNew = useCallback(() => {
    loadDocument({ content: INITIAL_CONTENT, path: null, provider: null, title: "Untitled Document" });
  }, [loadDocument]);

  const requestNew = useCallback(() => {
    void (async () => {
      if (!(await confirmDiscard(DISCARD_DIALOG))) return;
      resetToNew();
    })();
  }, [confirmDiscard, resetToNew]);

  const requestOpen = useCallback(() => {
    void (async () => {
      if (!(await confirmDiscard(DISCARD_DIALOG))) return;
      setShowOpen(true);
    })();
  }, [confirmDiscard]);

  const handleOpenDocument = useCallback(
    (path: string, fileContent: string, provider: string) => {
      loadDocument({ content: fileContent, path, provider, title: titleFromPath(path) });
      setShowOpen(false);
      toastManager.success(`Opened ${titleFromPath(path)}`, { duration: 2000 });
    },
    [loadDocument],
  );

  // Ctrl/Cmd+S save, Ctrl/Cmd+O open, Ctrl/Cmd+N new (disabled while modals/dialogs are open)
  useKeyboardShortcuts([
    { key: "s", handler: () => void handleSave(), enabled: !showSaveAs && !showOpen },
    { key: "o", handler: () => requestOpen(), enabled: !showSaveAs && !showOpen },
    { key: "n", handler: () => requestNew(), enabled: !showSaveAs && !showOpen },
  ]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stats = React.useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return { words, chars: content.length };
  }, [content]);

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
    setRightPanel("ai");
    setMobilePanelOpen(true);
  }, []);

  // Drop in-flight / prior AI results when the selection range or text changes
  const selectionIdentity = selection ? `${selection.start}:${selection.end}:${selection.text}` : null;
  const prevSelectionIdentity = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSelectionIdentity.current;
    prevSelectionIdentity.current = selectionIdentity;
    if (prev === selectionIdentity) return;
    // First selection from nothing: only clear on subsequent change/clear
    if (prev === null && selectionIdentity !== null) return;
    resetAI();
  }, [selectionIdentity, resetAI]);

  const applyAIResponse = useCallback(() => {
    if (aiResponse === null || !selection) return;
    const currentSlice = content.slice(selection.start, selection.end);
    if (currentSlice !== selection.text) {
      toastManager.error("Document changed since the selection was made. Select the text again and re-run AI edit.", {
        duration: 4000,
      });
      return;
    }
    const before = content.slice(0, selection.start);
    const after = content.slice(selection.end);
    const newContent = before + aiResponse + after;
    setContent(newContent);
    const newPos = selection.start + aiResponse.length;
    clearAI();
    setAiPrompt("");
    setSelection(null);
    setMobilePanelOpen(false);
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

  const handlePanelToggle = useCallback(
    (panel: RightPanel) => {
      setRightPanel(panel);
      setMobilePanelOpen(true);
      if (panel === "preview") {
        setSelection(null);
        resetAI();
      }
    },
    [resetAI],
  );

  const rightPanelContent =
    rightPanel === "preview" ? (
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
    );

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      {showSaveAs && (
        <SaveAsModal
          providers={providers}
          initialPath={currentFilePath ?? `${title.toLowerCase().replace(/\s+/g, "-") || "untitled"}.md`}
          initialProvider={currentProvider}
          onSave={handleSaveAs}
          onClose={() => setShowSaveAs(false)}
        />
      )}

      {showOpen && (
        <FileBrowserModal
          providers={providers}
          initialProvider={currentProvider}
          extensionFilter=".md"
          title="Open Document"
          searchPlaceholder="Search markdown files…"
          emptyMessage="No markdown files or folders here"
          onOpen={handleOpenDocument}
          onClose={() => setShowOpen(false)}
        />
      )}

      <DiscardDialog />

      {initError && !initialising && <ErrorBanner title="AI editing is disabled" message={initError} variant="warning" />}

      <AppPageHeader
        size="compact"
        icon={<FileText className="w-4 h-4" />}
        iconGradient="from-lime-500 to-green-600"
        className="py-2.5"
        title={
          <div className="min-w-0">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-primary placeholder-muted focus:outline-none min-w-0"
              placeholder="Document title…"
              aria-label="Document title"
            />
            {currentFilePath && (
              <p className="text-xs text-muted truncate" title={currentFilePath}>
                {currentProvider ? `${currentProvider}:` : ""}
                {currentFilePath}
              </p>
            )}
          </div>
        }
      >
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            onClick={requestNew}
            title="New document (Ctrl/⌘+N)"
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>
          <button
            type="button"
            onClick={requestOpen}
            title="Open document (Ctrl/⌘+O)"
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open</span>
          </button>

          <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0 hidden sm:block" aria-hidden="true" />

          <div className="flex items-center gap-1">
            <DirtyDot />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || (!isDirty && !!currentFilePath)}
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
                className="px-2 py-1.5 text-xs text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer hidden sm:inline"
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
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors focus-ring cursor-pointer",
                rightPanel === "preview" ? "bg-accent text-on-accent" : "text-muted hover:text-primary hover:bg-hover",
              )}
              aria-pressed={rightPanel === "preview"}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              type="button"
              onClick={() => handlePanelToggle("ai")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors focus-ring cursor-pointer",
                rightPanel === "ai" ? "bg-accent text-on-accent" : "text-muted hover:text-primary hover:bg-hover",
              )}
              aria-pressed={rightPanel === "ai"}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{initialising ? "AI…" : "AI Edit"}</span>
              {selection && rightPanel !== "ai" && <span className="w-1.5 h-1.5 bg-accent-soft rounded-full animate-pulse" />}
            </button>
          </div>
        </div>
      </AppPageHeader>

      {/* Body: editor + right panel */}
      <div className="flex flex-1 min-h-0 relative">
        {/* ── Markdown editor ── */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-primary">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => {
              setContent(e.target.value);
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
          <div className="shrink-0 h-8 border-t border-primary bg-secondary flex items-center px-4 gap-4 text-xs text-muted select-none overflow-hidden">
            <span className="shrink-0">{stats.words} words</span>
            <span className="shrink-0">{stats.chars} chars</span>
            {selection && <span className="text-accent-soft font-semibold shrink-0">{selection.end - selection.start} chars selected</span>}
            {isDirty && <span className="text-amber-400 shrink-0">Unsaved</span>}
            {currentFilePath && (
              <span className="truncate flex-1 min-w-0 text-right" title={currentFilePath}>
                {currentFilePath}
              </span>
            )}
            {!currentFilePath && <span className="flex-1" />}
            <button
              type="button"
              onClick={() => setMobilePanelOpen(true)}
              className="min-[1440px]:hidden shrink-0 flex items-center gap-1 text-muted hover:text-primary focus-ring rounded px-1 cursor-pointer"
              title="Show side panel"
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Right panel (desktop side-by-side) ── */}
        <div className="w-80 min-[1600px]:w-96 shrink-0 flex-col min-h-0 hidden min-[1440px]:flex">{rightPanelContent}</div>

        {/* ── Right panel (mobile/tablet full-screen sheet) ── */}
        {mobilePanelOpen && (
          <div className="min-[1440px]:hidden absolute inset-0 z-30 flex flex-col bg-primary">
            <div className="shrink-0 h-10 border-b border-primary bg-secondary flex items-center px-3 gap-2">
              <button
                type="button"
                onClick={() => setMobilePanelOpen(false)}
                className="p-1.5 text-muted hover:text-primary focus-ring rounded-md cursor-pointer"
                aria-label="Back to editor"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-primary">{rightPanel === "preview" ? "Preview" : "AI Edit"}</span>
              <div className="ml-auto flex rounded-lg border border-primary overflow-hidden">
                <button
                  type="button"
                  onClick={() => handlePanelToggle("preview")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors focus-ring cursor-pointer",
                    rightPanel === "preview" ? "bg-accent text-on-accent" : "text-muted hover:text-primary",
                  )}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => handlePanelToggle("ai")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors focus-ring cursor-pointer",
                    rightPanel === "ai" ? "bg-accent text-on-accent" : "text-muted hover:text-primary",
                  )}
                >
                  AI Edit
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">{rightPanelContent}</div>
          </div>
        )}
      </div>
    </div>
  );
}
