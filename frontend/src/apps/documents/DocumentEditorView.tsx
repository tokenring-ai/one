import formatError from "@tokenring-ai/utility/error/formatError";
import { FileDown, FilePlus, FileText, FolderOpen, ListPlus, Save, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FileBrowserModal from "../../components/ui/FileBrowserModal.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import AppendModal from "../../features/documents/components/AppendModal.tsx";
import SaveAsModal from "../../features/documents/components/SaveAsModal.tsx";
import {
  appendDocumentText,
  clearCaretRequest,
  clearReplaceRequest,
  loadDocument,
  markSaved,
  requestAiFocus,
  resetToNewDocument,
  setContent,
  setSelection,
  setTitle,
  spliceContent,
  titleFromPath,
  useDocumentsState,
} from "../../features/documents/documentsStore.ts";
import { resolveDocumentPath } from "../../features/documents/resolveDocumentPath.ts";
import { useDirtyState } from "../../hooks/useDirtyState.tsx";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts.ts";
import { useNavigationStatePayload } from "../../hooks/useNavigationStatePayload.ts";
import { usePaneLink, usePanel } from "../../layout/hooks.ts";
import { filesystemRPCClient } from "../../rpc.ts";
import { usePanelBadge } from "../panelHooks.ts";
import { DISCARD_DIALOG, DOCUMENT_AI_EDIT_VIEW } from "./shared.tsx";

/**
 * Replaces `start..end` through the browser's editing pipeline so Ctrl/⌘+Z can
 * undo it. Returns false when that is not possible (the textarea cannot take
 * focus, or `insertText` is unsupported), leaving the caller to splice instead.
 */
function insertTextNatively(textarea: HTMLTextAreaElement, start: number, end: number, text: string): boolean {
  textarea.focus();
  // execCommand edits whatever has focus; never let it land somewhere else.
  if (document.activeElement !== textarea) return false;
  textarea.setSelectionRange(start, end);
  try {
    // Deprecated but still the only way to put a programmatic edit on the native undo stack.
    // oxlint-disable-next-line typescript/no-deprecated
    return typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
  } catch {
    return false;
  }
}

/**
 * The markdown editor. Owns opening, saving and the document's text; the preview
 * and AI panels read the same document from the store.
 */
export default function DocumentEditorView() {
  // These shortcuts are window-level listeners; without the visibility gate a
  // hidden editor tab on any dashboard would intercept ⌘S/⌘O/⌘N app-wide.
  const panel = usePanel();
  const paneLink = usePaneLink();
  const { content, savedContent, title, filePath, selection, caretRequest, replaceRequest } = useDocumentsState();

  const [isSaving, setIsSaving] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [showAppend, setShowAppend] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const navigate = useNavigate();

  // Unsaved edits show as a warning dot on the tab instead of a beforeunload
  // prompt; the document lives in the module store, which mirrors the draft to
  // localStorage, so it survives the panel, a reload and a closed tab.
  const { isDirty, confirmDiscard, DiscardDialog } = useDirtyState({ current: content, saved: savedContent, warnOnUnload: false });
  usePanelBadge(isDirty ? { tone: "warning", label: "Unsaved changes" } : null);

  // Load a file handed over by the Files dashboard. The payload is consumed once:
  // the history entry's state is cleared, so Back/Forward onto it later cannot
  // re-run the hand-off over the edits made since. A dirty document is never
  // replaced without asking.
  useNavigationStatePayload<{ filePath?: string; fileContent?: string; title?: string }>({
    onPayload: state => {
      const fileContent = state.fileContent;
      if (fileContent === undefined) return;
      const label = state.title ?? (state.filePath ? titleFromPath(state.filePath) : "the incoming document");
      const load = () => loadDocument({ content: fileContent, path: state.filePath ?? null, title: state.title });
      const ok = confirmDiscard({
        dialog: { title: "Unsaved changes", message: `You have unsaved changes. Discard them and open ${label}?`, confirmLabel: "Discard" },
      });
      if (ok === true) load();
      else if (ok !== false)
        void ok.then(confirmed => {
          if (confirmed) load();
        });
    },
    clearAfterConsume: true,
    navigate,
  });

  // The AI panel asks for the caret after applying a suggestion; only the editor
  // can grant it, since only the editor owns the textarea.
  useEffect(() => {
    if (!caretRequest) return;
    const frame = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.selectionStart = caretRequest.position;
        textarea.selectionEnd = caretRequest.position;
        textarea.focus();
      }
      clearCaretRequest();
    });
    return () => cancelAnimationFrame(frame);
  }, [caretRequest]);

  // The AI panel asks for its suggestion to be applied; doing it as a native
  // edit keeps it on the textarea's undo stack.
  useEffect(() => {
    if (!replaceRequest) return;
    const { start, end, text } = replaceRequest;
    clearReplaceRequest();
    const textarea = textareaRef.current;
    const expected = textarea ? textarea.value.slice(0, start) + text + textarea.value.slice(end) : "";
    if (textarea && insertTextNatively(textarea, start, end, text)) {
      // onChange has normally synced the store already; this only guards against a missed input
      // event. The DOM already holds this value, so React writes nothing and the undo stack stays.
      setContent(expected);
      textarea.setSelectionRange(start + text.length, start + text.length);
      setSelection(null);
      toastManager.success("Changes applied. Press Ctrl/⌘+Z to undo.", { duration: 3000 });
      return;
    }
    spliceContent(start, end, text);
    toastManager.success("Changes applied", { duration: 2000 });
  }, [replaceRequest]);

  const askAi = useCallback(() => {
    requestAiFocus();
    paneLink(DOCUMENT_AI_EDIT_VIEW);
  }, [paneLink]);

  const handleSave = useCallback(async () => {
    if (!filePath) {
      setShowSaveAs(true);
      return;
    }
    setIsSaving(true);
    try {
      const target = await resolveDocumentPath(filePath);
      await filesystemRPCClient.writeFile({ path: target, content });
      markSaved({ content, filePath: target });
      toastManager.success("Saved", { duration: 2000 });
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  }, [content, filePath]);

  const handleSaveAs = useCallback(
    async (path: string) => {
      try {
        const target = await resolveDocumentPath(path);
        await filesystemRPCClient.writeFile({ path: target, content });
        markSaved({ content, filePath: target });
        setShowSaveAs(false);
        toastManager.success("Saved", { duration: 2000 });
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 4000 });
        // Re-throw so SaveAsModal can keep its form-level error state.
        throw error;
      }
    },
    [content],
  );

  const handleAppend = useCallback(
    async (text: string) => {
      if (!filePath) throw new Error("Open a document before appending");
      let target: string;
      try {
        target = await resolveDocumentPath(filePath);
        await filesystemRPCClient.appendFile({ path: target, content: text });
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 4000 });
        throw error;
      }
      appendDocumentText(text, target);
      setShowAppend(false);
      toastManager.success("Appended", { duration: 2000 });
    },
    [filePath],
  );

  const requestNew = useCallback(() => {
    void (async () => {
      if (!(await confirmDiscard(DISCARD_DIALOG))) return;
      resetToNewDocument();
    })();
  }, [confirmDiscard]);

  const requestOpen = useCallback(() => {
    void (async () => {
      if (!(await confirmDiscard(DISCARD_DIALOG))) return;
      setShowOpen(true);
    })();
  }, [confirmDiscard]);

  useKeyboardShortcuts([
    { key: "s", handler: () => void handleSave(), allowInEditable: true, enabled: panel.isVisible && !showSaveAs && !showOpen && !showAppend },
    { key: "o", handler: () => requestOpen(), allowInEditable: true, enabled: panel.isVisible && !showSaveAs && !showOpen && !showAppend },
    { key: "n", handler: () => requestNew(), allowInEditable: true, enabled: panel.isVisible && !showSaveAs && !showOpen && !showAppend },
  ]);

  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return { words, chars: content.length };
  }, [content]);

  /** Selecting text is what offers it to the AI panel. */
  const captureSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      setSelection(null);
      return;
    }
    setSelection({ start, end, text: textarea.value.slice(start, end) });
  }, []);

  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader
          icon={FileText}
          iconGradient="from-lime-500 to-green-600"
          // The title is editable in place, as it was on the single-page version.
          title={
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              aria-label="Document title"
              className="w-full min-w-0 bg-transparent text-sm font-semibold text-primary focus:outline-none focus-ring rounded px-1 -mx-1"
              placeholder="Untitled Document"
            />
          }
          actions={[
            { key: "new", icon: <FilePlus className="w-3.5 h-3.5" />, label: "New", title: "New document (Ctrl/⌘+N)", onClick: requestNew },
            { key: "open", icon: <FolderOpen className="w-3.5 h-3.5" />, label: "Open", title: "Open document (Ctrl/⌘+O)", onClick: requestOpen },
            {
              key: "save",
              icon: <Save className="w-3.5 h-3.5" />,
              label: "Save",
              title: filePath ? "Save (Ctrl/⌘+S)" : "Save As…",
              onClick: () => void handleSave(),
              disabled: isSaving,
            },
            {
              key: "save-as",
              icon: <FileDown className="w-3.5 h-3.5" />,
              label: "Save As",
              title: "Save As…",
              onClick: () => setShowSaveAs(true),
              disabled: isSaving,
            },
            {
              key: "append",
              icon: <ListPlus className="w-3.5 h-3.5" />,
              label: "Append",
              title: filePath ? "Append text to this file" : "Open or save a document before appending",
              onClick: () => setShowAppend(true),
              disabled: isSaving || !filePath,
            },
          ]}
        />
      }
      footer={
        <div className="shrink-0 h-8 border-t border-primary bg-secondary flex items-center px-4 gap-4 text-xs text-muted select-none overflow-hidden">
          <span className="shrink-0">{stats.words} words</span>
          <span className="shrink-0">{stats.chars} chars</span>
          {selection && <span className="text-accent-soft font-semibold shrink-0">{selection.end - selection.start} chars selected</span>}
          {selection && (
            <button
              type="button"
              onClick={askAi}
              // Keep the textarea's selection: a mousedown here would otherwise blur it first.
              onMouseDown={event => event.preventDefault()}
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-accent-soft hover:text-primary hover:bg-hover focus-ring cursor-pointer"
              title="Edit the selected text with AI"
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" /> Ask AI
            </button>
          )}
          {isDirty && <span className="text-amber-400 shrink-0">Unsaved</span>}
          {filePath ? (
            <span className="truncate flex-1 min-w-0 text-right" title={filePath}>
              {filePath}
            </span>
          ) : (
            <span className="flex-1" />
          )}
        </div>
      }
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={event => {
          setContent(event.target.value);
          const textarea = event.target;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          if (selection && start !== end) {
            setSelection({ start, end, text: textarea.value.slice(start, end) });
          }
        }}
        onSelect={captureSelection}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        className="w-full h-full resize-none bg-primary text-primary text-sm font-mono p-5 leading-7 focus:outline-none placeholder-muted"
        placeholder="Start writing markdown here…"
        spellCheck={false}
        aria-label="Markdown editor"
        aria-multiline="true"
      />

      {showSaveAs && (
        <SaveAsModal
          initialPath={filePath ?? `${title.toLowerCase().replace(/\s+/g, "-") || "untitled"}.md`}
          onSave={handleSaveAs}
          onClose={() => setShowSaveAs(false)}
        />
      )}
      {showAppend && filePath && <AppendModal filePath={filePath} onAppend={handleAppend} onClose={() => setShowAppend(false)} />}
      {showOpen && (
        <FileBrowserModal
          extensionFilter=".md"
          title="Open Document"
          searchPlaceholder="Search markdown files…"
          emptyMessage="No markdown files or folders here"
          onOpen={(path, fileContent) => {
            loadDocument({ content: fileContent, path, title: titleFromPath(path) });
            setShowOpen(false);
            toastManager.success(`Opened ${titleFromPath(path)}`, { duration: 2000 });
          }}
          onClose={() => setShowOpen(false)}
        />
      )}
      <DiscardDialog />
    </ViewShell>
  );
}
