import Editor from "@monaco-editor/react";
import formatError from "@tokenring-ai/utility/error/formatError";
import {
  ChevronDown,
  ChevronRight,
  Code2,
  Columns2,
  ExternalLink,
  Eye,
  FileCode2,
  FileUp,
  Frame,
  Loader2,
  Play,
  Plus,
  Save,
  Send,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatDock from "../../components/chat/ChatDock.tsx";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useOwnedAgent } from "../../hooks/useOwnedAgent.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import { sanitizeDesignHtml } from "../../lib/sanitizeHtml.ts";
import { agentRPCClient, useDesigns, useFlows, webDesignRPCClient } from "../../rpc.ts";

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design</title>
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
  <h1>Hello, Design!</h1>
  <p>Start editing the code on the left, or launch an agent below to build something amazing.</p>
</body>
</html>`;

const FLOW_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const FILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const WEB_DESIGN_ROOT = "/web-design";
const WEB_DESIGN_PREVIEW_ROOT = "/web-design-preview";
const designPath = (flowName: string, designName: string) => `${WEB_DESIGN_ROOT}/${encodeURIComponent(flowName)}/${encodeURIComponent(designName)}`;
const previewPath = (flowName: string, fileName: string) => `${WEB_DESIGN_PREVIEW_ROOT}/${encodeURIComponent(flowName)}/${encodeURIComponent(fileName)}`;
const previewFlowPath = (flowName: string) => `${WEB_DESIGN_PREVIEW_ROOT}/${encodeURIComponent(flowName)}/`;

function copyFileName(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".");
  return extensionIndex > 0 ? `${fileName.slice(0, extensionIndex)}-copy${fileName.slice(extensionIndex)}` : `${fileName}-copy.html`;
}

function editorLanguage(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "css") return "css";
  if (extension === "js" || extension === "mjs" || extension === "jsx") return "javascript";
  if (extension === "ts" || extension === "tsx") return "typescript";
  if (extension === "json" || extension === "map") return "json";
  if (extension === "svg" || extension === "xml") return "xml";
  if (extension === "md") return "markdown";
  if (extension === "yaml" || extension === "yml") return "yaml";
  return "html";
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read "${file.name}"`));
    reader.onload = () => resolve((reader.result instanceof ArrayBuffer ? new TextDecoder().decode(reader.result) : reader.result)?.split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FlowSummary {
  name: string;
  designCount: number;
  updatedAt: string;
}

interface SelectedDesign {
  flowName: string;
  name: string;
}

interface FileState {
  fileContent?: string;
}

type ViewMode = "split" | "code" | "preview";

// ─── SaveModal ─────────────────────────────────────────────────────────────────

function SaveModal({
  title,
  initialFlowName,
  initialDesignName,
  flows,
  onSave,
  onClose,
}: {
  title: string;
  initialFlowName: string;
  initialDesignName: string;
  flows: FlowSummary[];
  onSave: (flowName: string, designName: string) => Promise<void>;
  onClose: () => void;
}) {
  const [flowValue, setFlowValue] = useState(initialFlowName);
  const [designValue, setDesignValue] = useState(initialDesignName);
  const [saving, setSaving] = useState(false);
  const designInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    designInputRef.current?.focus();
    designInputRef.current?.select();
  }, []);

  const trimmedFlow = flowValue.trim();
  const trimmedDesign = designValue.trim();
  const isValid = FLOW_NAME_PATTERN.test(trimmedFlow) && FILE_NAME_PATTERN.test(trimmedDesign);

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onSave(trimmedFlow, trimmedDesign);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-secondary border border-primary rounded-xl p-5 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary focus-ring rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Flow</label>
            <input
              type="text"
              list="web-design-flow-options"
              value={flowValue}
              onChange={e => setFlowValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") onClose();
              }}
              placeholder="onboarding"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
            />
            <datalist id="web-design-flow-options">
              {flows.map(flow => (
                <option key={flow.name} value={flow.name} />
              ))}
            </datalist>
            {trimmedFlow && !FLOW_NAME_PATTERN.test(trimmedFlow) && (
              <p className="text-xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">File name</label>
            <input
              ref={designInputRef}
              type="text"
              value={designValue}
              onChange={e => setDesignValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !saving) void handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="index.html"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
            />
            {trimmedDesign && !FILE_NAME_PATTERN.test(trimmedDesign) && (
              <p className="text-xs text-red-500">Use letters, numbers, dots, hyphens, and underscores only, starting with a letter or number.</p>
            )}
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
              disabled={!isValid || saving}
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

// ─── NewFlowModal ──────────────────────────────────────────────────────────────

function NewFlowModal({ onCreate, onClose }: { onCreate: (name: string) => Promise<void>; onClose: () => void }) {
  const [nameValue, setNameValue] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = nameValue.trim();
  const isValid = FLOW_NAME_PATTERN.test(trimmed);

  const handleSubmit = async () => {
    if (!isValid || creating) return;
    setCreating(true);
    try {
      await onCreate(trimmed);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-secondary border border-primary rounded-xl p-5 w-80 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-primary">New Flow</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary focus-ring rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !creating) void handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            placeholder="onboarding"
            className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
          />
          {trimmed && !isValid && (
            <p className="text-xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>
          )}
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
              disabled={!isValid || creating}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ConfirmModal ──────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, onConfirm, onClose }: { title: string; message: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-secondary border border-primary rounded-xl p-5 w-80 shadow-xl">
        <h2 className="text-sm font-semibold text-primary mb-2">{title}</h2>
        <p className="text-xs text-muted mb-4">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FlowRow ───────────────────────────────────────────────────────────────────

function FlowRow({
  flow,
  expanded,
  onToggle,
  selected,
  isLoadingSelected,
  onSelectDesign,
  onNewDesign,
  onUploadFiles,
  onDeleteDesign,
  onDeleteFlow,
}: {
  flow: FlowSummary;
  expanded: boolean;
  onToggle: () => void;
  selected: SelectedDesign | null;
  isLoadingSelected: boolean;
  onSelectDesign: (flowName: string, name: string) => void;
  onNewDesign: (flowName: string) => void;
  onUploadFiles: (flowName: string, files: FileList) => Promise<void>;
  onDeleteDesign: (flowName: string, name: string) => void;
  onDeleteFlow: (flowName: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Live stream while expanded so agent-created designs appear without a manual refresh
  const { data: designsData, isLoading: loadingDesigns, error: designsError } = useDesigns(expanded ? flow.name : null);
  const designs = designsData?.designs ?? null;

  useEffect(() => {
    if (designsError) toastManager.error(formatError(designsError), { duration: 4000 });
  }, [designsError]);

  return (
    <div className="border-b border-primary/50">
      <div className="group flex items-center gap-1.5 px-2 py-2 cursor-pointer hover:bg-hover transition-colors" onClick={onToggle}>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted" />}
        <Workflow className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span className="flex-1 min-w-0 truncate text-xs font-medium text-primary" title={flow.name}>
          {flow.name}
        </span>
        <span className="text-xs text-muted shrink-0">{flow.designCount}</span>
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={event => {
            const files = event.target.files;
            if (!files?.length) return;
            setUploading(true);
            void onUploadFiles(flow.name, files).finally(() => {
              setUploading(false);
              event.target.value = "";
            });
          }}
        />
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            uploadInputRef.current?.click();
          }}
          disabled={uploading}
          title="Upload files to this flow"
          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-primary rounded transition-opacity shrink-0 cursor-pointer disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileUp className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onNewDesign(flow.name);
          }}
          title="New file in this flow"
          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-primary rounded transition-opacity shrink-0 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onDeleteFlow(flow.name);
          }}
          title="Delete flow"
          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-red-500 rounded transition-opacity shrink-0 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="pl-5">
          {loadingDesigns && designs === null ? (
            <div className="px-2 py-2 text-xs text-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading…
            </div>
          ) : designs && designs.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted">No files yet</p>
          ) : (
            designs?.map(design => {
              const isSelected = selected && selected.flowName === flow.name && selected.name === design.name;
              return (
                <div
                  key={design.name}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                    isSelected ? "bg-accent-muted text-accent" : "hover:bg-hover text-primary"
                  }`}
                  onClick={() => onSelectDesign(flow.name, design.name)}
                >
                  <FileCode2 className="w-3 h-3 shrink-0 opacity-70" />
                  <span className="flex-1 min-w-0 truncate text-xs font-mono" title={design.name}>
                    {design.name}
                  </span>
                  {isLoadingSelected && isSelected && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteDesign(flow.name, design.name);
                    }}
                    title="Delete file"
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-red-500 rounded transition-opacity shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── FlowSidebar ───────────────────────────────────────────────────────────────

function FlowSidebar({
  flows,
  flowsLoading,
  expandedFlows,
  onToggleFlow,
  selected,
  isLoadingSelected,
  onSelectDesign,
  onNewDesign,
  onUploadFiles,
  onDeleteDesign,
  onDeleteFlow,
  onNewFlow,
}: {
  flows: FlowSummary[];
  flowsLoading: boolean;
  expandedFlows: Set<string>;
  onToggleFlow: (name: string) => void;
  selected: SelectedDesign | null;
  isLoadingSelected: boolean;
  onSelectDesign: (flowName: string, name: string) => void;
  onNewDesign: (flowName: string) => void;
  onUploadFiles: (flowName: string, files: FileList) => Promise<void>;
  onDeleteDesign: (flowName: string, name: string) => void;
  onDeleteFlow: (flowName: string) => void;
  onNewFlow: () => void;
}) {
  return (
    <div className="h-full flex flex-col border-r border-primary bg-secondary/40">
      <NavigationSidebarHeader
        title="Flows"
        actions={[
          {
            icon: <Plus className="w-3.5 h-3.5" />,
            label: "New flow",
            title: "New flow",
            onClick: onNewFlow,
          },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        {flows.length === 0 ? (
          flowsLoading ? (
            <div className="px-3 py-4 text-xs text-muted flex items-center justify-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading…
            </div>
          ) : (
            <p className="text-xs text-muted px-3 py-4 text-center">No flows yet</p>
          )
        ) : (
          flows.map(flow => (
            <FlowRow
              key={flow.name}
              flow={flow}
              expanded={expandedFlows.has(flow.name)}
              onToggle={() => onToggleFlow(flow.name)}
              selected={selected}
              isLoadingSelected={isLoadingSelected}
              onSelectDesign={onSelectDesign}
              onNewDesign={onNewDesign}
              onUploadFiles={onUploadFiles}
              onDeleteDesign={onDeleteDesign}
              onDeleteFlow={onDeleteFlow}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export default function WebDesignApp() {
  return <WebDesignWorkspace />;
}

// ─── Workspace ─────────────────────────────────────────────────────────────────

function WebDesignWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const { flowName: routeFlowName, designName: routeDesignName } = useParams<{ flowName?: string; designName?: string }>();
  const [theme] = useTheme();
  const { data: flowsData, mutate: refreshFlows, isLoading: flowsLoading, error: flowsError } = useFlows();
  const flows = flowsData?.flows ?? [];

  const [htmlContent, setHtmlContent] = useState(DEFAULT_HTML);
  const [previewSource, setPreviewSource] = useState(DEFAULT_HTML);
  const [fileEncoding, setFileEncoding] = useState<"utf8" | "base64">("utf8");
  const [fileMimeType, setFileMimeType] = useState("text/html");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [autoPreview, setAutoPreview] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 767px)");
    const avoidMobileSplit = () => {
      if (query.matches) setViewMode(current => (current === "split" ? "code" : current));
    };
    avoidMobileSplit();
    query.addEventListener("change", avoidMobileSplit);
    return () => query.removeEventListener("change", avoidMobileSplit);
  }, []);

  // The open design lives in the URL: /web-design/:flowName/:designName
  const selected: SelectedDesign | null = useMemo(
    () => (routeFlowName && routeDesignName ? { flowName: routeFlowName, name: routeDesignName } : null),
    [routeFlowName, routeDesignName],
  );
  const { data: selectedFlowFilesData } = useDesigns(selected?.flowName ?? null);
  const selectedFlowRevision = selectedFlowFilesData?.designs.map(file => `${file.name}:${file.updatedAt}`).join("|") ?? "";
  const selectedKey = selected ? `${selected.flowName}/${selected.name}` : null;
  // Key of the design whose content is currently in the editor, so we don't show a stale document while loading
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // An unsaved document handed in from elsewhere (e.g. opening a file from the filesystem app)
  const [isDraft, setIsDraft] = useState(false);
  const [savedContent, setSavedContent] = useState(DEFAULT_HTML);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDesign, setIsLoadingDesign] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveModal, setSaveModal] = useState<{ mode: "create" | "saveAs"; presetFlowName: string } | null>(null);
  const [newFlowModalOpen, setNewFlowModalOpen] = useState(false);
  const [deleteDesignTarget, setDeleteDesignTarget] = useState<SelectedDesign | null>(null);
  const [deleteFlowTarget, setDeleteFlowTarget] = useState<string | null>(null);

  const [expandedFlows, setExpandedFlows] = useState<Set<string>>(new Set());
  const appliedNavKey = useRef<string | null>(null);

  const { agentId, assignAgent: handleAgentLaunched } = useOwnedAgent("Web Design app");

  const handleStartDesign = useCallback(
    async (prompt: string): Promise<boolean> => {
      try {
        const { id } = await agentRPCClient.createAgent({ agentType: "web-design", headless: false });
        handleAgentLaunched(id);
        await agentRPCClient.sendInput({
          agentId: id,
          input: {
            from: "Web Design app",
            message: `/design ${prompt}`,
          },
        });
        return true;
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
        return false;
      }
    },
    [handleAgentLaunched],
  );

  // Ready == the editor holds the document the URL points at (or an unsaved draft)
  const isDocumentReady = selectedKey !== null ? loadedKey === selectedKey : isDraft;
  const isDirty = isDocumentReady && htmlContent !== savedContent;

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

  const handleToggleFlow = useCallback((name: string) => {
    setExpandedFlows(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  /** Close whatever is open and fall back to the empty state. */
  const closeDocument = useCallback(() => {
    setHtmlContent(DEFAULT_HTML);
    setPreviewSource(DEFAULT_HTML);
    setSavedContent(DEFAULT_HTML);
    setFileEncoding("utf8");
    setFileMimeType("text/html");
    setLoadedKey(null);
    setIsDraft(false);
    setLoadError(null);
    setIsLoadingDesign(false);
    void navigate(WEB_DESIGN_ROOT);
  }, [navigate]);

  /** Apply HTML handed in from Files (or another app) as an unsaved draft. */
  const applyImportedContent = useCallback((content: string) => {
    setHtmlContent(content);
    setPreviewSource(content);
    setSavedContent(content);
    setFileEncoding("utf8");
    setFileMimeType("text/html");
    setLoadedKey(null);
    setIsDraft(true);
    setLoadError(null);
    setIsLoadingDesign(false);
  }, []);

  // Load HTML from FilesApp navigation state whenever a new file payload arrives
  useEffect(() => {
    const state = location.state as FileState | null;
    if (state?.fileContent === undefined) return;
    if (appliedNavKey.current === location.key) return;
    appliedNavKey.current = location.key;
    applyImportedContent(state.fileContent);
    // One-shot payload: land on root as a draft and clear state so later navigations don't re-import
    void navigate(WEB_DESIGN_ROOT, { replace: true, state: null });
  }, [location.key, location.state, navigate, applyImportedContent]);

  /** New designs always live inside a flow, so ask where to put it before opening the editor. */
  const handleNew = useCallback(
    (presetFlowName = "") => {
      closeDocument();
      setSaveModal({ mode: "create", presetFlowName });
    },
    [closeDocument],
  );

  // Selecting a design just changes the URL; the effect below loads whatever the URL points at.
  const handleSelectDesign = useCallback(
    (flowName: string, name: string) => {
      void navigate(designPath(flowName, name));
    },
    [navigate],
  );

  const syncAgentSelection = useCallback(
    (flowName: string, designName: string) => {
      if (!agentId) return;
      webDesignRPCClient
        .updateWebDesignState({
          agentId,
          selectedFlowName: flowName,
          selectedDesignName: designName,
        })
        .catch(() => {});
    },
    [agentId],
  );

  // Keep the agent’s current design in sync so addSelectedDesign can attach it to chat input.
  useEffect(() => {
    if (!agentId || !routeFlowName || !routeDesignName) return;
    syncAgentSelection(routeFlowName, routeDesignName);
  }, [agentId, routeFlowName, routeDesignName, syncAgentSelection]);

  useEffect(() => {
    if (!routeFlowName || !routeDesignName) return;
    const key = `${routeFlowName}/${routeDesignName}`;
    if (key === loadedKey) return;

    let cancelled = false;
    setIsLoadingDesign(true);
    setLoadError(null);
    webDesignRPCClient
      .getDesign({ flowName: routeFlowName, name: routeDesignName })
      .then(({ design }) => {
        if (cancelled) return;
        if (!design) {
          const message = `File "${routeDesignName}" not found in flow "${routeFlowName}"`;
          toastManager.error(message, { duration: 4000 });
          setLoadError(message);
          return;
        }
        setHtmlContent(design.content);
        setPreviewSource(design.content);
        setSavedContent(design.content);
        setFileEncoding(design.encoding);
        setFileMimeType(design.mimeType);
        setLoadedKey(`${design.flowName}/${design.name}`);
        setPreviewRevision(Date.now());
        setIsDraft(false);
        if (design.name !== routeDesignName) {
          void navigate(designPath(design.flowName, design.name), { replace: true });
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        toastManager.error(formatError(e), { duration: 4000 });
        setLoadError(formatError(e));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDesign(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeFlowName, routeDesignName, loadedKey, navigate]);

  // Reveal the design that the URL points at
  useEffect(() => {
    if (!routeFlowName) return;
    setExpandedFlows(prev => (prev.has(routeFlowName) ? prev : new Set(prev).add(routeFlowName)));
  }, [routeFlowName]);

  // Auto-expand flows that gain designs while a design agent is running so mockups stream in live
  useEffect(() => {
    if (!agentId) return;
    setExpandedFlows(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const flow of flows) {
        if (flow.designCount > 0 && !next.has(flow.name)) {
          next.add(flow.name);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [agentId, flows]);

  useEffect(() => {
    if (flowsError) toastManager.error(formatError(flowsError), { duration: 4000 });
  }, [flowsError]);

  const handleSave = useCallback(async () => {
    if (!isDocumentReady) return;
    if (!selected) {
      setSaveModal({ mode: "create", presetFlowName: "" });
      return;
    }
    setIsSaving(true);
    try {
      const { design } = await webDesignRPCClient.updateDesign({
        flowName: selected.flowName,
        name: selected.name,
        content: htmlContent,
        encoding: fileEncoding,
      });
      setSavedContent(design.content);
      setPreviewRevision(Date.now());
      // Re-sync agent attachment content after a successful save
      syncAgentSelection(selected.flowName, selected.name);
      void refreshFlows();
      toastManager.success("Saved", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  }, [isDocumentReady, selected, htmlContent, fileEncoding, refreshFlows, syncAgentSelection]);

  const handleSaveModalSubmit = useCallback(
    async (flowName: string, designName: string) => {
      try {
        const { design } = await webDesignRPCClient.createDesign({ flowName, name: designName, content: htmlContent });
        // Content is already in the editor, so mark it loaded before navigating to avoid a redundant fetch
        setSavedContent(design.content);
        setHtmlContent(design.content);
        setPreviewSource(design.content);
        setFileEncoding(design.encoding);
        setFileMimeType(design.mimeType);
        setPreviewRevision(Date.now());
        setLoadedKey(`${design.flowName}/${design.name}`);
        setIsDraft(false);
        setSaveModal(null);
        setExpandedFlows(prev => new Set(prev).add(flowName));
        void navigate(designPath(design.flowName, design.name));
        void refreshFlows();
        toastManager.success("Saved", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [htmlContent, navigate, refreshFlows],
  );

  const handleNewDesignInFlow = useCallback(
    (flowName: string) => {
      handleNew(flowName);
    },
    [handleNew],
  );

  const handleUploadFiles = useCallback(
    async (flowName: string, files: FileList) => {
      let uploaded = 0;
      const errors: string[] = [];

      for (const file of Array.from(files)) {
        if (!FILE_NAME_PATTERN.test(file.name)) {
          errors.push(`"${file.name}" has an unsupported file name`);
          continue;
        }
        try {
          const content = await readFileAsBase64(file);
          await webDesignRPCClient.createDesign({ flowName, name: file.name, content, encoding: "base64" });
          uploaded++;
        } catch (error: unknown) {
          errors.push(formatError(error));
        }
      }

      if (uploaded > 0) {
        setExpandedFlows(previous => new Set(previous).add(flowName));
        void refreshFlows();
        toastManager.success(`Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"}`, { duration: 2500 });
      }
      if (errors.length > 0) {
        toastManager.error(errors.join("\n"), { duration: 5000 });
      }
    },
    [refreshFlows],
  );

  const handleDeleteDesign = useCallback(
    async (flowName: string, name: string) => {
      try {
        const { success } = await webDesignRPCClient.deleteDesign({ flowName, name });
        if (!success) throw new Error(`File "${name}" could not be deleted from flow "${flowName}"`);
        if (selected && selected.flowName === flowName && selected.name === name) {
          closeDocument();
        }
        setDeleteDesignTarget(null);
        void refreshFlows();
        toastManager.success("Deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [selected, closeDocument, refreshFlows],
  );

  const handleCreateFlow = useCallback(
    async (name: string) => {
      try {
        await webDesignRPCClient.createFlow({ name });
        setNewFlowModalOpen(false);
        setExpandedFlows(prev => new Set(prev).add(name));
        void refreshFlows();
        toastManager.success("Flow created", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [refreshFlows],
  );

  const handleDeleteFlow = useCallback(
    async (flowName: string) => {
      try {
        const { success } = await webDesignRPCClient.deleteFlow({ name: flowName });
        if (!success) throw new Error(`Flow "${flowName}" could not be deleted`);
        if (selected?.flowName === flowName) {
          closeDocument();
        }
        setExpandedFlows(prev => {
          const next = new Set(prev);
          next.delete(flowName);
          return next;
        });
        setDeleteFlowTarget(null);
        void refreshFlows();
        toastManager.success("Flow deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [selected, closeDocument, refreshFlows],
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

  // When an agent (or another client) updates the open design on disk, pull it in
  // if the user has no local unsaved edits so the preview stays current.
  const htmlContentRef = useRef(htmlContent);
  const savedContentRef = useRef(savedContent);
  htmlContentRef.current = htmlContent;
  savedContentRef.current = savedContent;
  useEffect(() => {
    if (!selected || !isDocumentReady || isDirty || isDraft) return;
    let cancelled = false;
    const poll = () => {
      void webDesignRPCClient
        .getDesign({ flowName: selected.flowName, name: selected.name })
        .then(({ design }) => {
          if (cancelled || !design) return;
          // Skip if the user has dirty local edits (race with typing mid-flight)
          if (htmlContentRef.current !== savedContentRef.current) return;
          if (htmlContentRef.current === design.content) return;
          setHtmlContent(design.content);
          setPreviewSource(design.content);
          setSavedContent(design.content);
          setFileEncoding(design.encoding);
          setFileMimeType(design.mimeType);
          setPreviewRevision(Date.now());
          // Keep agent attachment content aligned with the on-disk design
          syncAgentSelection(selected.flowName, selected.name);
        })
        .catch(() => {
          /* ignore transient poll errors */
        });
    };
    const id = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selected, isDocumentReady, isDirty, isDraft, syncAgentSelection]);

  const runPreview = () => setPreviewSource(htmlContent);

  const isTextFile = fileEncoding === "utf8";
  const hostedPreviewUrl = selected
    ? `${previewPath(selected.flowName, selected.name)}?v=${encodeURIComponent(`${previewRevision}:${selectedFlowRevision}`)}`
    : null;
  const previewHtml = useMemo(() => {
    const sanitized = sanitizeDesignHtml(previewSource);
    if (!selected) return sanitized;
    const baseTag = `<base href="${previewFlowPath(selected.flowName)}">`;
    return /<head(\s[^>]*)?>/i.test(sanitized) ? sanitized.replace(/<head(\s[^>]*)?>/i, match => `${match}${baseTag}`) : `${baseTag}${sanitized}`;
  }, [previewSource, selected]);
  const useHostedPreview = !!hostedPreviewUrl && previewSource === savedContent;

  const subtitle = selected ? `${selected.flowName} / ${selected.name}` : isDraft ? "Untitled" : "No design open";

  const mainPane = isDocumentReady ? (
    <EditorPreviewPane
      fileName={selected?.name ?? "index.html"}
      htmlContent={htmlContent}
      hostedPreviewUrl={hostedPreviewUrl}
      previewHtml={previewHtml}
      useHostedPreview={useHostedPreview}
      isTextFile={isTextFile}
      mimeType={fileMimeType}
      theme={theme}
      viewMode={viewMode}
      onChange={handleEditorChange}
    />
  ) : selected && loadError ? (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 bg-primary text-center">
      <p className="text-xs text-red-500 max-w-md">{loadError}</p>
      <button
        type="button"
        onClick={closeDocument}
        className="px-3 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
      >
        Back to designs
      </button>
    </div>
  ) : selected || isLoadingDesign ? (
    <div className="h-full flex items-center justify-center gap-2 bg-primary text-xs text-muted">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading {selected ? `${selected.flowName} / ${selected.name}` : "…"}…
    </div>
  ) : flowsLoading && flows.length === 0 ? (
    <div className="h-full flex items-center justify-center gap-2 bg-primary text-xs text-muted">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading flows…
    </div>
  ) : (
    <EmptyState
      hasFlows={flows.length > 0}
      hasAgent={!!agentId}
      onNewFlow={() => setNewFlowModalOpen(true)}
      onNewDesign={() => handleNew()}
      onStartDesign={handleStartDesign}
    />
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      {saveModal && (
        <SaveModal
          title={saveModal.mode === "create" ? "Save File" : "Save As"}
          initialFlowName={saveModal.presetFlowName || selected?.flowName || ""}
          initialDesignName={saveModal.mode === "saveAs" && selected ? copyFileName(selected.name) : "index.html"}
          flows={flows}
          onSave={handleSaveModalSubmit}
          onClose={() => setSaveModal(null)}
        />
      )}
      {newFlowModalOpen && <NewFlowModal onCreate={handleCreateFlow} onClose={() => setNewFlowModalOpen(false)} />}
      {deleteDesignTarget && (
        <ConfirmModal
          title="Delete file?"
          message={`This will permanently delete "${deleteDesignTarget.name}" from flow "${deleteDesignTarget.flowName}".`}
          onConfirm={() => handleDeleteDesign(deleteDesignTarget.flowName, deleteDesignTarget.name)}
          onClose={() => setDeleteDesignTarget(null)}
        />
      )}
      {deleteFlowTarget && (
        <ConfirmModal
          title="Delete flow?"
          message={`This will permanently delete the flow "${deleteFlowTarget}" and all of its files.`}
          onConfirm={() => handleDeleteFlow(deleteFlowTarget)}
          onClose={() => setDeleteFlowTarget(null)}
        />
      )}

      <AppPageHeader title="Web Design" subtitle={subtitle} icon={<Frame className="w-4 h-4" />} iconGradient="from-purple-500 to-violet-600" size="compact">
        {isDocumentReady && (
          <>
            <div className="flex items-center rounded-lg border border-primary p-0.5 shrink-0" role="group" aria-label="Code and preview view">
              {(
                [
                  { value: "split", label: "Split", title: "Show code and preview", icon: Columns2 },
                  { value: "code", label: "Code", title: "Show code only", icon: Code2 },
                  { value: "preview", label: "Preview", title: "Show preview only", icon: Eye },
                ] as const
              ).map(({ value, label, title, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setViewMode(value)}
                  className={`${value === "split" ? "hidden md:flex" : "flex"} items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer focus-ring ${
                    viewMode === value ? "bg-accent text-white" : "text-muted hover:text-primary hover:bg-hover"
                  }`}
                  aria-pressed={viewMode === value}
                  title={title}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            {isTextFile && (
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={autoPreview}
                  onChange={e => {
                    const enabled = e.target.checked;
                    setAutoPreview(enabled);
                    // Catch up the preview when re-enabling after manual edits
                    if (enabled) setPreviewSource(htmlContent);
                  }}
                  className="w-3.5 h-3.5 accent-control cursor-pointer"
                />
                <span className="text-xs text-muted select-none">Auto-preview</span>
              </label>
            )}

            {/* Manual run button (shown when auto-preview is off) */}
            {isTextFile && !autoPreview && (
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

            {/* Save controls — drafts can be saved even if content is unchanged */}
            <div className="flex items-center gap-1 shrink-0">
              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!isTextFile || isSaving || (!isDirty && !!selected)}
                title={selected ? "Save (Ctrl/⌘+S)" : "Save…"}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {selected ? (isDirty ? "Save" : "Saved") : "Save…"}
              </button>
              {selected && isTextFile && (
                <button
                  type="button"
                  onClick={() => setSaveModal({ mode: "saveAs", presetFlowName: selected.flowName })}
                  title="Save As…"
                  className="px-2 py-1 text-xs text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer"
                >
                  Save As…
                </button>
              )}
            </div>

            {hostedPreviewUrl && (
              <a
                href={hostedPreviewUrl}
                target="_blank"
                rel="noreferrer"
                title="Open hosted preview in a new tab"
                className="p-1.5 text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="sr-only">Open hosted preview in a new tab</span>
              </a>
            )}

            <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />
          </>
        )}

        {/* New file button */}
        <button
          type="button"
          onClick={() => handleNew()}
          title="New file"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-muted hover:bg-accent-muted-hover text-accent text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
        >
          <Plus className="w-3 h-3" />
          New File
        </button>

        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />

        {/* Agent launcher */}
        {!agentId && (
          <AgentLauncherBar
            defaultAgentType="web-design"
            buttonLabel="Start Agent"
            buttonClassName="bg-violet-600 hover:bg-violet-500 text-white shadow-button-primary"
            onLaunch={handleAgentLaunched}
          />
        )}
      </AppPageHeader>

      <WorkspaceShell
        appId="web-design"
        title="Web Design"
        navigationLabel="Design flows and files"
        hasSelection={selected !== null}
        className="flex-1"
        navigation={
          <FlowSidebar
            flows={flows}
            flowsLoading={flowsLoading}
            expandedFlows={expandedFlows}
            onToggleFlow={handleToggleFlow}
            selected={selected}
            isLoadingSelected={isLoadingDesign}
            onSelectDesign={handleSelectDesign}
            onNewDesign={handleNewDesignInFlow}
            onUploadFiles={handleUploadFiles}
            onDeleteDesign={(flowName, name) => setDeleteDesignTarget({ flowName, name })}
            onDeleteFlow={setDeleteFlowTarget}
            onNewFlow={() => setNewFlowModalOpen(true)}
          />
        }
      >
        <ChatDock agentId={agentId} storageKey="webdesign" initialRatio={0.65} headerTitle="Design Agent">
          {mainPane}
        </ChatDock>
      </WorkspaceShell>
    </div>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({
  onNewFlow,
  onNewDesign,
  onStartDesign,
  hasFlows,
  hasAgent,
  className = "h-full",
}: {
  onNewFlow: () => void;
  onNewDesign: () => void;
  onStartDesign: (prompt: string) => Promise<boolean>;
  hasFlows: boolean;
  hasAgent: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!hasAgent) textareaRef.current?.focus();
  }, [hasAgent]);

  const handleSubmit = async () => {
    const trimmed = query.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onStartDesign(trimmed);
      if (ok) setQuery("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${className} flex flex-col items-center justify-center gap-6 p-6 sm:p-8 bg-primary`}>
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg mx-auto">
            <Frame className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-primary">Design with agents</h2>
            <p className="text-sm text-muted mt-1.5 max-w-md mx-auto leading-relaxed">
              {hasFlows ? (
                <>
                  Open a mockup from the <span className="font-medium text-secondary">Flows</span> panel, edit HTML live, or describe screens below and a design
                  agent will write mockups into flows for you.
                </>
              ) : (
                <>
                  Describe the product area and screens you need. A design agent will create a flow and save self-contained HTML mockups you can preview and
                  refine here.
                </>
              )}
            </p>
          </div>
        </div>

        {hasAgent ? (
          <div className="bg-secondary border border-primary rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-muted leading-relaxed">
              A design agent is running in the chat panel below. Designs it writes appear in the Flows sidebar — select one to open the editor and live preview.
            </p>
          </div>
        ) : (
          <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-3">
            <label htmlFor="web-design-landing-query" className="text-xs font-semibold text-muted uppercase tracking-wide">
              Design prompt
            </label>
            <textarea
              id="web-design-landing-query"
              ref={textareaRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              rows={4}
              placeholder="e.g. Onboarding for a notes app: welcome, sign-up, empty state, first note"
              disabled={submitting}
              className="w-full bg-input border border-primary rounded-xl px-3 py-2.5 text-sm text-primary placeholder-muted focus-accent resize-y min-h-[96px] disabled:opacity-60"
              aria-label="Design prompt"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">⌘/Ctrl + Enter to send</p>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !query.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-button-primary"
                aria-label="Start design agent"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Start design
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onNewFlow}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
          >
            <Workflow className="w-3.5 h-3.5" />
            New Flow
          </button>
          <button
            type="button"
            onClick={onNewDesign}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-muted hover:bg-accent-muted-hover text-accent text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Design
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EditorPreviewPane ─────────────────────────────────────────────────────────

function EditorPreviewPane({
  fileName,
  htmlContent,
  hostedPreviewUrl,
  previewHtml,
  useHostedPreview,
  isTextFile,
  mimeType,
  theme,
  viewMode,
  onChange,
  className = "h-full",
}: {
  fileName: string;
  htmlContent: string;
  hostedPreviewUrl: string | null;
  previewHtml: string;
  useHostedPreview: boolean;
  isTextFile: boolean;
  mimeType: string;
  theme: string;
  viewMode: ViewMode;
  onChange: (value: string | undefined) => void;
  className?: string;
}) {
  const codePane = (
    <div className="h-full min-w-0 flex flex-col">
      <div className="shrink-0 px-3 py-1.5 bg-tertiary/60 border-b border-primary flex items-center gap-2">
        <span className="text-xs font-mono font-semibold text-muted uppercase tracking-wider">{fileName}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {isTextFile ? (
          <Editor
            height="100%"
            language={editorLanguage(fileName)}
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
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center bg-primary">
            <FileCode2 className="w-8 h-8 text-muted/60" />
            <p className="text-xs font-medium text-primary">Binary asset</p>
            <p className="text-xs text-muted">{mimeType} files can be previewed or replaced by uploading a new file.</p>
          </div>
        )}
      </div>
    </div>
  );

  const previewPane = (
    <div className="h-full min-w-0 flex flex-col">
      <div className="shrink-0 px-3 py-1.5 bg-tertiary/60 border-b border-primary flex items-center gap-2">
        <span className="text-xs font-mono font-semibold text-muted uppercase tracking-wider">Preview</span>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0" />
      </div>
      {useHostedPreview && hostedPreviewUrl ? (
        <iframe
          key={hostedPreviewUrl}
          className="flex-1 w-full bg-white border-0"
          src={hostedPreviewUrl}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          title="Design preview"
        />
      ) : (
        <iframe
          key={hostedPreviewUrl}
          className="flex-1 w-full bg-white border-0"
          srcDoc={previewHtml}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          title="Design preview"
        />
      )}
    </div>
  );

  if (viewMode === "code") {
    return <div className={className}>{codePane}</div>;
  }

  if (viewMode === "preview") {
    return <div className={className}>{previewPane}</div>;
  }

  return (
    <ResizableSplit direction="horizontal" initialRatio={0.5} minFirst={160} minSecond={160} className={className}>
      <div className="h-full border-r border-primary">{codePane}</div>
      {previewPane}
    </ResizableSplit>
  );
}
