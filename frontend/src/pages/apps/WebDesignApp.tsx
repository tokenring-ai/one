import Editor from "@monaco-editor/react";
import formatError from "@tokenring-ai/utility/error/formatError";
import { ChevronDown, ChevronRight, FileCode2, Frame, Loader2, Play, Plus, Save, Trash2, Workflow, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatPanel from "../../components/chat/ChatPanel.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useOwnedAgent } from "../../hooks/useOwnedAgent.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import { sanitizeDesignHtml } from "../../lib/sanitizeHtml.ts";
import { useFlows, webDesignRPCClient } from "../../rpc.ts";

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

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const WEB_DESIGN_ROOT = "/web-design";
const designPath = (flowName: string, designName: string) => `${WEB_DESIGN_ROOT}/${encodeURIComponent(flowName)}/${encodeURIComponent(designName)}`;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FlowSummary {
  name: string;
  designCount: number;
  updatedAt: string;
}

interface DesignSummary {
  flowName: string;
  name: string;
  size: number;
  updatedAt: string;
}

interface SelectedDesign {
  flowName: string;
  name: string;
}

interface FileState {
  fileContent?: string;
}

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
  const isValid = NAME_PATTERN.test(trimmedFlow) && NAME_PATTERN.test(trimmedDesign);

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
            <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Flow</label>
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
            {trimmedFlow && !NAME_PATTERN.test(trimmedFlow) && (
              <p className="text-2xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Design name</label>
            <input
              ref={designInputRef}
              type="text"
              value={designValue}
              onChange={e => setDesignValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !saving) void handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="login-page"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
            />
            {trimmedDesign && !NAME_PATTERN.test(trimmedDesign) && (
              <p className="text-2xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>
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
  const isValid = NAME_PATTERN.test(trimmed);

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
            <p className="text-2xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>
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
  refreshSignal,
  onSelectDesign,
  onNewDesign,
  onDeleteDesign,
  onDeleteFlow,
}: {
  flow: FlowSummary;
  expanded: boolean;
  onToggle: () => void;
  selected: SelectedDesign | null;
  isLoadingSelected: boolean;
  refreshSignal: number;
  onSelectDesign: (flowName: string, name: string) => void;
  onNewDesign: (flowName: string) => void;
  onDeleteDesign: (flowName: string, name: string) => void;
  onDeleteFlow: (flowName: string) => void;
}) {
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLoadingDesigns(true);
    webDesignRPCClient
      .listDesigns({ flowName: flow.name })
      .then(res => {
        if (!cancelled) setDesigns(res.designs);
      })
      .catch((e: unknown) => {
        if (!cancelled) toastManager.error(formatError(e), { duration: 4000 });
      })
      .finally(() => {
        if (!cancelled) setLoadingDesigns(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshSignal is an intentional refetch trigger
  }, [expanded, flow.name, refreshSignal]);

  return (
    <div className="border-b border-primary/50">
      <div className="group flex items-center gap-1.5 px-2 py-2 cursor-pointer hover:bg-hover transition-colors" onClick={onToggle}>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted" />}
        <Workflow className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span className="flex-1 min-w-0 truncate text-xs font-medium text-primary" title={flow.name}>
          {flow.name}
        </span>
        <span className="text-2xs text-muted shrink-0">{flow.designCount}</span>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onNewDesign(flow.name);
          }}
          title="New design in this flow"
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
            <div className="px-2 py-2 text-2xs text-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading…
            </div>
          ) : designs && designs.length === 0 ? (
            <p className="px-2 py-2 text-2xs text-muted">No designs yet</p>
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
                    title="Delete design"
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
  expandedFlows,
  onToggleFlow,
  selected,
  isLoadingSelected,
  designsRefreshSignal,
  onSelectDesign,
  onNewDesign,
  onDeleteDesign,
  onDeleteFlow,
  onNewFlow,
}: {
  flows: FlowSummary[];
  expandedFlows: Set<string>;
  onToggleFlow: (name: string) => void;
  selected: SelectedDesign | null;
  isLoadingSelected: boolean;
  designsRefreshSignal: number;
  onSelectDesign: (flowName: string, name: string) => void;
  onNewDesign: (flowName: string) => void;
  onDeleteDesign: (flowName: string, name: string) => void;
  onDeleteFlow: (flowName: string) => void;
  onNewFlow: () => void;
}) {
  return (
    <div className="h-full flex flex-col border-r border-primary bg-secondary/40">
      <div className="shrink-0 px-3 py-1.5 bg-tertiary/60 border-b border-primary flex items-center justify-between gap-2">
        <span className="text-2xs font-mono font-semibold text-muted uppercase tracking-wider">Flows</span>
        <button
          type="button"
          onClick={onNewFlow}
          title="New flow"
          className="p-1 text-muted hover:text-primary hover:bg-hover rounded transition-colors focus-ring cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {flows.length === 0 ? (
          <p className="text-2xs text-muted px-3 py-4 text-center">No flows yet</p>
        ) : (
          flows.map(flow => (
            <FlowRow
              key={flow.name}
              flow={flow}
              expanded={expandedFlows.has(flow.name)}
              onToggle={() => onToggleFlow(flow.name)}
              selected={selected}
              isLoadingSelected={isLoadingSelected}
              refreshSignal={designsRefreshSignal}
              onSelectDesign={onSelectDesign}
              onNewDesign={onNewDesign}
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
  const location = useLocation();
  const fileState = (location.state as FileState | null) ?? null;

  return <WebDesignWorkspace initialContent={fileState?.fileContent} />;
}

// ─── Workspace ─────────────────────────────────────────────────────────────────

function WebDesignWorkspace({ initialContent }: { initialContent: string | undefined }) {
  const navigate = useNavigate();
  const { flowName: routeFlowName, designName: routeDesignName } = useParams<{ flowName?: string; designName?: string }>();
  const [theme] = useTheme();
  const { data: flowsData, mutate: refreshFlows } = useFlows();
  const flows = flowsData?.flows ?? [];

  const seedContent = initialContent ?? DEFAULT_HTML;
  const [htmlContent, setHtmlContent] = useState(seedContent);
  const [previewSource, setPreviewSource] = useState(seedContent);
  const [autoPreview, setAutoPreview] = useState(true);

  // The open design lives in the URL: /web-design/:flowName/:designName
  const selected: SelectedDesign | null = useMemo(
    () => (routeFlowName && routeDesignName ? { flowName: routeFlowName, name: routeDesignName } : null),
    [routeFlowName, routeDesignName],
  );
  const selectedKey = selected ? `${selected.flowName}/${selected.name}` : null;
  // Key of the design whose content is currently in the editor, so we don't show a stale document while loading
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // An unsaved document handed in from elsewhere (e.g. opening a file from the filesystem app)
  const [isDraft, setIsDraft] = useState(initialContent !== undefined);
  const [savedContent, setSavedContent] = useState(seedContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDesign, setIsLoadingDesign] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveModal, setSaveModal] = useState<{ mode: "create" | "saveAs"; presetFlowName: string } | null>(null);
  const [newFlowModalOpen, setNewFlowModalOpen] = useState(false);
  const [deleteDesignTarget, setDeleteDesignTarget] = useState<SelectedDesign | null>(null);
  const [deleteFlowTarget, setDeleteFlowTarget] = useState<string | null>(null);

  const [expandedFlows, setExpandedFlows] = useState<Set<string>>(new Set());
  const [designsRefreshSignal, setDesignsRefreshSignal] = useState(0);
  const bumpDesignsRefresh = useCallback(() => setDesignsRefreshSignal(n => n + 1), []);

  const { agentId, assignAgent: handleAgentLaunched } = useOwnedAgent("Web Design app");

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
    setLoadedKey(null);
    setIsDraft(false);
    void navigate(WEB_DESIGN_ROOT);
  }, [navigate]);

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
          const message = `Design "${routeDesignName}" not found in flow "${routeFlowName}"`;
          toastManager.error(message, { duration: 4000 });
          setLoadError(message);
          return;
        }
        setHtmlContent(design.content);
        setPreviewSource(design.content);
        setSavedContent(design.content);
        setLoadedKey(key);
        setIsDraft(false);
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

  const handleSave = useCallback(async () => {
    if (!isDocumentReady) return;
    if (!selected) {
      setSaveModal({ mode: "create", presetFlowName: "" });
      return;
    }
    setIsSaving(true);
    try {
      const { design } = await webDesignRPCClient.updateDesign({ flowName: selected.flowName, name: selected.name, content: htmlContent });
      setSavedContent(design.content);
      bumpDesignsRefresh();
      void refreshFlows();
      toastManager.success("Saved", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  }, [isDocumentReady, selected, htmlContent, bumpDesignsRefresh, refreshFlows]);

  const handleSaveModalSubmit = useCallback(
    async (flowName: string, designName: string) => {
      try {
        const { design } = await webDesignRPCClient.createDesign({ flowName, name: designName, content: htmlContent });
        // Content is already in the editor, so mark it loaded before navigating to avoid a redundant fetch
        setSavedContent(design.content);
        setLoadedKey(`${design.flowName}/${design.name}`);
        setIsDraft(false);
        setSaveModal(null);
        setExpandedFlows(prev => new Set(prev).add(flowName));
        void navigate(designPath(design.flowName, design.name));
        bumpDesignsRefresh();
        void refreshFlows();
        toastManager.success("Saved", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [htmlContent, navigate, bumpDesignsRefresh, refreshFlows],
  );

  const handleNewDesignInFlow = useCallback(
    (flowName: string) => {
      handleNew(flowName);
    },
    [handleNew],
  );

  const handleDeleteDesign = useCallback(
    async (flowName: string, name: string) => {
      try {
        await webDesignRPCClient.deleteDesign({ flowName, name });
        if (selected && selected.flowName === flowName && selected.name === name) {
          closeDocument();
        }
        setDeleteDesignTarget(null);
        bumpDesignsRefresh();
        void refreshFlows();
        toastManager.success("Deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [selected, closeDocument, bumpDesignsRefresh, refreshFlows],
  );

  const handleCreateFlow = useCallback(
    async (name: string) => {
      try {
        await webDesignRPCClient.createFlow({ name });
        setNewFlowModalOpen(false);
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
        await webDesignRPCClient.deleteFlow({ name: flowName });
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

  const runPreview = () => setPreviewSource(htmlContent);

  const previewHtml = useMemo(() => sanitizeDesignHtml(previewSource), [previewSource]);

  const subtitle = selected ? `${selected.flowName} / ${selected.name}` : isDraft ? "Untitled" : "No design open";

  const mainPane = isDocumentReady ? (
    <EditorPreviewPane htmlContent={htmlContent} previewHtml={previewHtml} theme={theme} onChange={handleEditorChange} />
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
  ) : selected ? (
    <div className="h-full flex items-center justify-center gap-2 bg-primary text-xs text-muted">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading {selected.flowName} / {selected.name}…
    </div>
  ) : (
    <EmptyState onNewFlow={() => setNewFlowModalOpen(true)} onNewDesign={() => handleNew()} hasFlows={flows.length > 0} />
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      {saveModal && (
        <SaveModal
          title={saveModal.mode === "create" ? "Save Design" : "Save As"}
          initialFlowName={saveModal.presetFlowName || selected?.flowName || ""}
          initialDesignName={saveModal.mode === "saveAs" && selected ? `${selected.name}-copy` : ""}
          flows={flows}
          onSave={handleSaveModalSubmit}
          onClose={() => setSaveModal(null)}
        />
      )}
      {newFlowModalOpen && <NewFlowModal onCreate={handleCreateFlow} onClose={() => setNewFlowModalOpen(false)} />}
      {deleteDesignTarget && (
        <ConfirmModal
          title="Delete design?"
          message={`This will permanently delete "${deleteDesignTarget.name}" from flow "${deleteDesignTarget.flowName}".`}
          onConfirm={() => handleDeleteDesign(deleteDesignTarget.flowName, deleteDesignTarget.name)}
          onClose={() => setDeleteDesignTarget(null)}
        />
      )}
      {deleteFlowTarget && (
        <ConfirmModal
          title="Delete flow?"
          message={`This will permanently delete the flow "${deleteFlowTarget}" and all of its designs.`}
          onConfirm={() => handleDeleteFlow(deleteFlowTarget)}
          onClose={() => setDeleteFlowTarget(null)}
        />
      )}

      <AppPageHeader title="Web Design" subtitle={subtitle} icon={<Frame className="w-4 h-4" />} iconGradient="from-purple-500 to-violet-600" size="compact">
        {isDocumentReady && (
          <>
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
                title={selected ? "Save (Ctrl/⌘+S)" : "Save…"}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {selected ? "Save" : "Save…"}
              </button>
              {selected && (
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

            <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />
          </>
        )}

        {/* New design button */}
        <button
          type="button"
          onClick={() => handleNew()}
          title="New design"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-muted hover:bg-accent-muted-hover text-accent text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
        >
          <Plus className="w-3 h-3" />
          New
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

      {/* ── Horizontal split: flow/design tree (left) | editor+preview / agent chat (right) ──── */}
      <ResizableSplit direction="horizontal" initialRatio={0.18} minFirst={180} minSecond={320} className="flex-1 min-h-0">
        <FlowSidebar
          flows={flows}
          expandedFlows={expandedFlows}
          onToggleFlow={handleToggleFlow}
          selected={selected}
          isLoadingSelected={isLoadingDesign}
          designsRefreshSignal={designsRefreshSignal}
          onSelectDesign={handleSelectDesign}
          onNewDesign={handleNewDesignInFlow}
          onDeleteDesign={(flowName, name) => setDeleteDesignTarget({ flowName, name })}
          onDeleteFlow={setDeleteFlowTarget}
          onNewFlow={() => setNewFlowModalOpen(true)}
        />

        {agentId ? (
          <ResizableSplit direction="vertical" initialRatio={0.65} minFirst={120} minSecond={120} className="h-full min-h-0">
            {mainPane}
            <div className="h-full overflow-hidden bg-primary">
              <ChatPanel agentId={agentId} />
            </div>
          </ResizableSplit>
        ) : (
          mainPane
        )}
      </ResizableSplit>
    </div>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({
  onNewFlow,
  onNewDesign,
  hasFlows,
  className = "h-full",
}: {
  onNewFlow: () => void;
  onNewDesign: () => void;
  hasFlows: boolean;
  className?: string;
}) {
  return (
    <div className={`${className} flex items-center justify-center p-6 bg-primary`}>
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
          <Frame className="w-6 h-6 text-white" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-primary">No design open</h2>
          <p className="text-xs text-muted leading-relaxed">
            {hasFlows
              ? "Pick a design from the Flows panel on the left to open it, or create a new flow and add a design to it."
              : "Create a flow in the Flows panel on the left, then add a design to it. Designs always live inside a flow."}
          </p>
        </div>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer"
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
        <iframe className="flex-1 w-full bg-white border-0" srcDoc={previewHtml} sandbox="allow-scripts" referrerPolicy="no-referrer" title="Design preview" />
      </div>
    </ResizableSplit>
  );
}
