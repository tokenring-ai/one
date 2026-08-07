import formatError from "@tokenring-ai/utility/error/formatError";
import { AlertTriangle, Eye, FilePlus, FileText, FolderOpen, Loader2, PanelRight, Save, Sparkles, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { cn } from "../../lib/utils.ts";
import { filesystemRPCClient, useFilesystemProviders } from "../../rpc.ts";
import AIEditPanel from "./components/AIEditPanel.tsx";
import MarkdownPreview from "./components/MarkdownPreview.tsx";
import OpenDocumentModal from "./components/OpenDocumentModal.tsx";
import SaveAsModal from "./components/SaveAsModal.tsx";
import { INITIAL_CONTENT } from "./constants.ts";
import { useAIEdit } from "./hooks/useAIEdit.ts";
import type { RightPanel, TextSelection } from "./types.ts";

type PendingAction = { type: "new" } | { type: "open" };

function titleFromPath(path: string): string {
  const name = path.split("/").pop() || path;
  return name.replace(/\.md$/i, "") || "Untitled Document";
}

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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const isDirty = content !== savedContent;
  const providers = fsProviders.data?.providers ?? [];
  const appliedNavKey = useRef<string | null>(null);

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
  useEffect(() => {
    const state = location.state as { filePath?: string; fileContent?: string; title?: string; provider?: string } | null;
    if (state?.fileContent === undefined) return;
    if (appliedNavKey.current === location.key) return;
    appliedNavKey.current = location.key;
    loadDocument({
      content: state.fileContent,
      path: state.filePath ?? null,
      provider: state.provider ?? null,
      title: state.title,
    });
  }, [location.key, location.state, loadDocument]);

  // Warn on browser close / refresh with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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
      setTitle(titleFromPath(path));
      toastManager.success("Saved", { duration: 2000 });
    },
    [content],
  );

  const resetToNew = useCallback(() => {
    loadDocument({ content: INITIAL_CONTENT, path: null, provider: null, title: "Untitled Document" });
  }, [loadDocument]);

  const requestNew = useCallback(() => {
    if (isDirty) {
      setPendingAction({ type: "new" });
      return;
    }
    resetToNew();
  }, [isDirty, resetToNew]);

  const requestOpen = useCallback(() => {
    if (isDirty) {
      setPendingAction({ type: "open" });
      return;
    }
    setShowOpen(true);
  }, [isDirty]);

  const handleOpenDocument = useCallback(
    (path: string, fileContent: string, provider: string) => {
      loadDocument({ content: fileContent, path, provider, title: titleFromPath(path) });
      setShowOpen(false);
      toastManager.success(`Opened ${titleFromPath(path)}`, { duration: 2000 });
    },
    [loadDocument],
  );

  const confirmPending = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    if (action.type === "new") {
      resetToNew();
      return;
    }
    setShowOpen(true);
  }, [pendingAction, resetToNew]);

  // Ctrl/Cmd+S save, Ctrl/Cmd+O open, Ctrl/Cmd+N new (disabled while modals/dialogs are open)
  useEffect(() => {
    if (showSaveAs || showOpen || pendingAction) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void handleSave();
      } else if (key === "o") {
        e.preventDefault();
        requestOpen();
      } else if (key === "n") {
        e.preventDefault();
        requestNew();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, requestOpen, requestNew, showSaveAs, showOpen, pendingAction]);

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

      {showOpen && <OpenDocumentModal providers={providers} initialProvider={currentProvider} onOpen={handleOpenDocument} onClose={() => setShowOpen(false)} />}

      {pendingAction && (
        <ConfirmDialog
          title="Unsaved changes"
          message="You have unsaved changes. Discard them and continue?"
          confirmText="Discard"
          cancelText="Cancel"
          variant="warning"
          onConfirm={confirmPending}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {initError && !initialising && (
        <div role="alert" className="shrink-0 px-4 py-2.5 bg-warning/10 border-b border-warning/30 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">AI editing is disabled</p>
            <p className="text-xs text-muted">{initError}</p>
          </div>
        </div>
      )}

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
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
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
