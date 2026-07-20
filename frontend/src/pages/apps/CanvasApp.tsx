import Editor from "@monaco-editor/react";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, PenTool, Play, Plus, Save, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatPanel from "../../components/chat/ChatPanel.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useOwnedAgent } from "../../hooks/useOwnedAgent.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import { sanitizeCanvasHtml } from "../../lib/sanitizeHtml.ts";
import { filesystemRPCClient, useFilesystemProviders } from "../../rpc.ts";

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canvas</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, sans-serif;
      background: #ffffff;
      color: #1a1a1a;
    }
    h1 { color: #7c3aed; margin-bottom: 8px; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>Hello, Canvas!</h1>
  <p>Start editing the code on the left, or launch an agent below to build something amazing.</p>
</body>
</html>`;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FileState {
  filePath?: string;
  fileContent?: string;
  provider?: string;
}

// ─── SaveAsModal ───────────────────────────────────────────────────────────────

function SaveAsModal({
  providers,
  initialPath,
  onSave,
  onClose,
}: {
  providers: string[];
  initialPath: string;
  onSave: (path: string, provider: string) => Promise<void>;
  onClose: () => void;
}) {
  const [path, setPath] = useState(initialPath);
  const [provider, setProvider] = useState(providers[0] ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = async () => {
    if (!path.trim() || !provider) return;
    setSaving(true);
    try {
      await onSave(path.trim(), provider);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-secondary border border-primary rounded-xl p-5 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-primary">Save As</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary focus-ring rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {providers.length > 1 && (
            <div className="space-y-1">
              <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Location</label>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value)}
                className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-ring"
              >
                {providers.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted uppercase tracking-wide">File path</label>
            <input
              ref={inputRef}
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !saving) void handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="pages/index.html"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!path.trim() || !provider || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export default function CanvasApp() {
  const location = useLocation();
  const fileState = (location.state as FileState | null) ?? null;

  return <CanvasWorkspace fileState={fileState} />;
}

// ─── Workspace ─────────────────────────────────────────────────────────────────

function CanvasWorkspace({ fileState }: { fileState?: FileState | null }) {
  const [theme] = useTheme();
  const fsProviders = useFilesystemProviders();

  const initialContent = fileState?.fileContent ?? DEFAULT_HTML;
  const [htmlContent, setHtmlContent] = useState(initialContent);
  const [previewSource, setPreviewSource] = useState(initialContent);
  const [autoPreview, setAutoPreview] = useState(true);

  // Save state
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(fileState?.filePath ?? null);
  const [currentProvider, setCurrentProvider] = useState<string | null>(fileState?.provider ?? null);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);

  const { agentId, assignAgent: handleAgentLaunched } = useOwnedAgent("Canvas app");

  const isDirty = htmlContent !== savedContent;
  const providers = fsProviders.data?.providers ?? [];

  // Debounced preview update
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEditorChange = (value: string | undefined) => {
    const newVal = value ?? "";
    setHtmlContent(newVal);
    if (autoPreview) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setPreviewSource(newVal), 400);
    }
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!currentFilePath || !currentProvider) {
      setShowSaveAs(true);
      return;
    }
    setIsSaving(true);
    try {
      await filesystemRPCClient.writeFile({ path: currentFilePath, content: htmlContent, provider: currentProvider });
      setSavedContent(htmlContent);
      toastManager.success("Saved", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  }, [currentFilePath, currentProvider, htmlContent]);

  const handleSaveAs = useCallback(
    async (path: string, provider: string) => {
      await filesystemRPCClient.writeFile({ path, content: htmlContent, provider });
      setCurrentFilePath(path);
      setCurrentProvider(provider);
      setSavedContent(htmlContent);
      setShowSaveAs(false);
      toastManager.success("Saved", { duration: 2000 });
    },
    [htmlContent],
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

  const runPreview = () => setPreviewSource(htmlContent);

  const previewHtml = useMemo(() => sanitizeCanvasHtml(previewSource), [previewSource]);

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      {showSaveAs && (
        <SaveAsModal providers={providers} initialPath={currentFilePath ?? "index.html"} onSave={handleSaveAs} onClose={() => setShowSaveAs(false)} />
      )}

      <AppPageHeader title="Canvas" icon={<PenTool className="w-4 h-4" />} iconGradient="from-purple-500 to-violet-600" size="compact">
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
          <input type="checkbox" checked={autoPreview} onChange={e => setAutoPreview(e.target.checked)} className="w-3.5 h-3.5 accent-control cursor-pointer" />
          <span className="text-2xs text-muted select-none">Auto-preview</span>
        </label>

        {/* Manual run button (shown when auto-preview is off) */}
        {!autoPreview && (
          <button
            type="button"
            onClick={runPreview}
            title="Run preview"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-500 dark:text-emerald-400 text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
          >
            <Play className="w-3 h-3" />
            Run
          </button>
        )}

        {/* Save controls */}
        <div className="flex items-center gap-1 shrink-0">
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            title={currentFilePath ? "Save (Ctrl/⌘+S)" : "Save As…"}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {currentFilePath ? "Save" : "Save As…"}
          </button>
          {currentFilePath && (
            <button
              type="button"
              onClick={() => setShowSaveAs(true)}
              title="Save As…"
              className="px-2 py-1 text-xs text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer"
            >
              Save As…
            </button>
          )}
        </div>

        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />

        {/* New canvas button */}
        <button
          type="button"
          onClick={() => {
            setHtmlContent(DEFAULT_HTML);
            setPreviewSource(DEFAULT_HTML);
            setSavedContent(DEFAULT_HTML);
            setCurrentFilePath(null);
            setCurrentProvider(null);
          }}
          title="New canvas"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-muted hover:bg-accent-muted-hover text-accent text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
        >
          <Plus className="w-3 h-3" />
          New
        </button>

        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />

        {/* Agent launcher */}
        {!agentId && (
          <AgentLauncherBar
            defaultAgentType="canvas"
            buttonLabel="Start Agent"
            buttonClassName="bg-violet-600 hover:bg-violet-500 text-white shadow-button-primary"
            onLaunch={handleAgentLaunched}
          />
        )}
      </AppPageHeader>

      {/* ── Vertical split: editor+preview (top) | agent chat (bottom) ──── */}
      {agentId ? (
        <ResizableSplit direction="vertical" initialRatio={0.65} minFirst={120} minSecond={120} className="flex-1 min-h-0">
          <EditorPreviewPane htmlContent={htmlContent} previewHtml={previewHtml} theme={theme} onChange={handleEditorChange} />
          <div className="h-full overflow-hidden bg-primary">
            <ChatPanel agentId={agentId} />
          </div>
        </ResizableSplit>
      ) : (
        <EditorPreviewPane htmlContent={htmlContent} previewHtml={previewHtml} theme={theme} onChange={handleEditorChange} className="flex-1 min-h-0" />
      )}
    </div>
  );
}

// ─── EditorPreviewPane ─────────────────────────────────────────────────────────

function EditorPreviewPane({
  htmlContent,
  previewHtml,
  theme,
  onChange,
  className = "h-full",
}: {
  htmlContent: string;
  previewHtml: string;
  theme: string;
  onChange: (value: string | undefined) => void;
  className?: string;
}) {
  return (
    <ResizableSplit direction="horizontal" initialRatio={0.5} minFirst={160} minSecond={160} className={className}>
      {/* Code editor */}
      <div className="h-full flex flex-col border-r border-primary">
        <div className="shrink-0 px-3 py-1.5 bg-tertiary/60 border-b border-primary flex items-center gap-2">
          <span className="text-2xs font-mono font-semibold text-muted uppercase tracking-wider">HTML / CSS / JS</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language="html"
            value={htmlContent}
            onChange={onChange}
            theme={theme === "light" ? "vs-light" : "vs-dark"}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              padding: { top: 8 },
            }}
          />
        </div>
      </div>

      {/* Preview iframe */}
      <div className="h-full flex flex-col">
        <div className="shrink-0 px-3 py-1.5 bg-tertiary/60 border-b border-primary flex items-center gap-2">
          <span className="text-2xs font-mono font-semibold text-muted uppercase tracking-wider">Preview</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0" />
        </div>
        <iframe className="flex-1 w-full bg-white border-0" srcDoc={previewHtml} sandbox="allow-scripts" referrerPolicy="no-referrer" title="Canvas preview" />
      </div>
    </ResizableSplit>
  );
}
