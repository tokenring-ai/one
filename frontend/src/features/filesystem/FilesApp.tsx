import formatError from "@tokenring-ai/utility/error/formatError";
import { Eye, EyeOff, FilePlus, FileText, FolderOpen, FolderPlus, Info, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSWRConfig } from "swr";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import AgentLaunchPanel from "../../components/ui/AgentLaunchPanel.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import BreadcrumbBar, { type BreadcrumbAction, type BreadcrumbSegment } from "../../components/ui/BreadcrumbBar.tsx";
import ConfirmModal from "../../components/ui/ConfirmModal.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useDebounce } from "../../hooks/useDebounce.ts";
import { useDirtyState } from "../../hooks/useDirtyState.tsx";
import { useEntityDelete } from "../../hooks/useEntityDelete.ts";
import { useFileUpload } from "../../hooks/useFileUpload.ts";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { filesystemRPCClient, useFileContents, useFilesystemProviders } from "../../rpc.ts";
import FileEditorPane from "./components/FileEditorPane.tsx";
import FileListPane from "./components/FileListPane.tsx";
import NamePromptModal from "./components/NamePromptModal.tsx";
import PreviewMetadataPane from "./components/PreviewMetadataPane.tsx";
import { getBasename, getParentPath, isLikelyTextFile, joinPath } from "./fsUtils.ts";

type NamePrompt = { mode: "new-file" } | { mode: "new-folder" } | { mode: "rename"; path: string; isDir: boolean };

/** Max size for Files app uploads (matches user-facing error copy). */
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_UPLOAD_SIZE_MB = 5;

function filesPath(fileId: string | null | undefined): string {
  return fileId ? `/files/${encodeURIComponent(fileId)}` : "/files";
}

export default function FilesApp() {
  const navigate = useNavigate();
  const { fileId: routeFileId } = useParams<{ fileId?: string }>();
  // URL is the source of truth for which file is open (params are already decoded).
  const selectedFile = routeFileId ?? null;

  const { agentId, initialising, error } = useHeadlessAgent({
    appName: "Files app",
    preferredTypes: ["coder"],
    noTypesMessage: "No agent types available",
  });
  const fsProviders = useFilesystemProviders();
  const { mutate: globalMutate } = useSWRConfig();
  const [providerOverride, setProviderOverride] = useState<string | null>(null);

  const providers = fsProviders.data?.providers ?? [];
  const provider = useMemo(() => {
    if (providerOverride && providers.includes(providerOverride)) return providerOverride;
    return providers[0] ?? null;
  }, [providerOverride, providers]);

  const [path, setPath] = useState(".");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Debounce search for workspace-wide search
  const debouncedSearch = useDebounce(searchQuery, 250);

  const [saving, setSaving] = useState(false);
  const fileContent = useFileContents(selectedFile && isLikelyTextFile(selectedFile) ? selectedFile : undefined, provider ?? undefined);

  const [updatedContent, setUpdatedContent] = useState<string | null>(null);
  const [namePrompt, setNamePrompt] = useState<NamePrompt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [fileView, setFileView] = useState<"editor" | "details">("editor");

  // When deep-linking to a file, open its parent directory in the list.
  useEffect(() => {
    if (!selectedFile) return;
    const parent = getParentPath(selectedFile);
    setPath(parent);
    setFileView(isLikelyTextFile(selectedFile) ? "editor" : "details");
  }, [selectedFile]);

  const editorContent = updatedContent ?? fileContent.data?.content ?? "";
  const diskContent = fileContent.data?.content ?? "";
  const { isDirty, confirmDiscard } = useDirtyState({
    current: editorContent,
    saved: diskContent,
  });

  const selectFile = useCallback(
    (file: string | null, options?: { replace?: boolean }) => {
      // Re-selecting the open file reloads content from disk (e.g. external/agent edits).
      if (file === selectedFile) {
        if (file && isLikelyTextFile(file)) {
          if (isDirty && !confirmDiscard()) return;
          setUpdatedContent(null);
          void fileContent.mutate();
        }
        return;
      }
      if (!confirmDiscard()) return;
      setUpdatedContent(null);
      void navigate(filesPath(file), options?.replace ? { replace: true } : undefined);
    },
    [selectedFile, confirmDiscard, navigate, isDirty, fileContent],
  );

  const navigateTo = useCallback(
    (nextPath: string) => {
      if (nextPath === path && !selectedFile) {
        setSearchQuery("");
        return;
      }
      if (selectedFile && !confirmDiscard()) return;
      setUpdatedContent(null);
      setPath(nextPath);
      setSearchQuery("");
      // Clear file selection when browsing directories so the URL matches list focus.
      if (selectedFile) {
        void navigate("/files");
      }
    },
    [path, selectedFile, confirmDiscard, navigate],
  );

  const refreshListing = useCallback(async () => {
    await globalMutate(
      key => typeof key === "string" && (key.startsWith("/filesystem/listDirectory/") || key.startsWith("/filesystem/searchWorkspaceFiles/")),
      undefined,
      { revalidate: true },
    );
  }, [globalMutate]);

  const entityDelete = useEntityDelete({
    currentRouteId: selectedFile,
    navigateToOverview: () => {
      setUpdatedContent(null);
      void navigate("/files", { replace: true });
    },
    refreshList: () => {
      void refreshListing();
    },
    clearLocalState: id => {
      setSelectedPaths(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    successMessage: name => `Deleted ${getBasename(name)}`,
    errorMessage: error => `Delete failed: ${formatError(error)}`,
    successDuration: 2000,
    errorDuration: 4000,
  });

  /** Binary-safe uploads via base64 so images and other non-text files are not corrupted. */
  const upload = useFileUpload({
    encoding: "base64",
    maxSize: MAX_UPLOAD_SIZE,
    maxSizeLabel: `${MAX_UPLOAD_SIZE_MB} MB`,
    uploadFile: async ({ filePath, content, encoding }) => {
      if (!provider) throw new Error("No filesystem provider");
      const dest = joinPath(path, filePath);
      await filesystemRPCClient.writeFile({ path: dest, content, encoding, provider });
    },
    checkExists: async ({ filePath }) => {
      if (!provider) return { exists: false };
      const dest = joinPath(path, filePath);
      return filesystemRPCClient.exists({ path: dest, provider });
    },
    onSkip: ({ reason, detail }) => {
      if (reason === "size" && detail) {
        toastManager.error(detail, { duration: 3000 });
      } else if (reason === "invalid-name" && detail) {
        toastManager.error(detail, { duration: 3000 });
      }
    },
    onError: ({ fileName, error }) => {
      toastManager.error(`Failed to upload "${fileName}": ${formatError(error)}`, { duration: 3000 });
    },
    onComplete: async ({ uploaded }) => {
      await refreshListing();
      if (uploaded > 0) {
        toastManager.success(uploaded === 1 ? "Uploaded 1 file" : `Uploaded ${uploaded} files`, { duration: 2000 });
      }
    },
  });

  /** Refresh directory listing and, when safe, the open text file. */
  const handleRefresh = useCallback(async () => {
    await refreshListing();
    if (selectedFile && isLikelyTextFile(selectedFile) && !isDirty) {
      await fileContent.mutate();
    }
  }, [refreshListing, selectedFile, isDirty, fileContent]);

  const breadcrumbSegments = useMemo((): BreadcrumbSegment[] => {
    if (path === ".") return [];
    const parts = path.split("/");
    return parts.map((part, i) => ({
      label: part,
      value: parts.slice(0, i + 1).join("/"),
    }));
  }, [path]);

  const breadcrumbActions = useMemo((): BreadcrumbAction[] => {
    return [
      {
        icon: RefreshCw,
        onClick: () => void handleRefresh(),
        ariaLabel: "Refresh",
        title: "Refresh",
      },
      {
        icon: showHidden ? EyeOff : Eye,
        label: showHidden ? "Hide hidden" : "Show hidden",
        onClick: () => setShowHidden(v => !v),
        ariaLabel: showHidden ? "Hide hidden files" : "Show hidden files",
        title: showHidden ? "Hide hidden files" : "Show hidden files",
      },
      {
        icon: FilePlus,
        label: "New file",
        labelBreakpoint: "md",
        onClick: () => setNamePrompt({ mode: "new-file" }),
        ariaLabel: "New file",
        title: "New file",
      },
      {
        icon: FolderPlus,
        label: "New folder",
        labelBreakpoint: "md",
        onClick: () => setNamePrompt({ mode: "new-folder" }),
        ariaLabel: "New folder",
        title: "New folder",
      },
      {
        icon: Plus,
        label: "Upload",
        onClick: upload.trigger,
        ariaLabel: "Upload files",
        title: "Upload files",
      },
    ];
  }, [handleRefresh, showHidden, upload.trigger]);

  const handleSave = useCallback(async () => {
    if (!selectedFile || !provider || !isLikelyTextFile(selectedFile)) return;
    setSaving(true);
    try {
      await filesystemRPCClient.writeFile({ path: selectedFile, content: editorContent, provider });
      await fileContent.mutate(() => ({ content: editorContent }));
      setUpdatedContent(null);
      toastManager.success("Saved", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(`Save failed: ${formatError(e)}`, { duration: 3000 });
    } finally {
      setSaving(false);
    }
  }, [selectedFile, provider, editorContent, fileContent]);

  // ⌘/Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty) void handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, isDirty]);

  const toggleSelected = useCallback((file: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((files: string[]) => {
    setSelectedPaths(prev => {
      const allIn = files.every(f => prev.has(f));
      const next = new Set(prev);
      if (allIn) {
        files.forEach(f => {
          next.delete(f);
        });
      } else {
        files.forEach(f => {
          next.add(f);
        });
      }
      return next;
    });
  }, []);

  const validateEntryName = (name: string): string | null => {
    if (!name.trim()) return "Name is required";
    if (name.includes("/") || name.includes("\\")) return "Name cannot contain path separators";
    if (name === "." || name === "..") return "Invalid name";
    return null;
  };

  const handleNamePromptSubmit = async (name: string) => {
    if (!provider || !namePrompt) return;
    const action = namePrompt.mode === "rename" ? "Rename" : namePrompt.mode === "new-file" ? "Create file" : "Create folder";
    try {
      if (namePrompt.mode === "new-file") {
        if (selectedFile && !confirmDiscard()) return;
        const dest = joinPath(path, name);
        await filesystemRPCClient.writeFile({ path: dest, content: "", provider });
        await refreshListing();
        setUpdatedContent(null);
        // Navigate directly — selectFile would re-check dirty against stale state.
        void navigate(filesPath(dest));
        setNamePrompt(null);
        toastManager.success(`Created ${name}`, { duration: 2000 });
        return;
      }
      if (namePrompt.mode === "new-folder") {
        const dest = joinPath(path, name);
        await filesystemRPCClient.createDirectory({ path: dest, provider, recursive: true });
        await refreshListing();
        setNamePrompt(null);
        toastManager.success(`Created folder ${name}`, { duration: 2000 });
        return;
      }
      // Remaining mode is always "rename" after the branches above.
      const parent = getParentPath(namePrompt.path);
      const newPath = joinPath(parent, name);
      const oldPath = namePrompt.isDir ? (namePrompt.path.endsWith("/") ? namePrompt.path.slice(0, -1) : namePrompt.path) : namePrompt.path;
      if (oldPath === newPath) {
        setNamePrompt(null);
        return;
      }
      await filesystemRPCClient.rename({ oldPath, newPath, provider });
      await refreshListing();
      // Keep editor draft when renaming the open file (path changes, content stays).
      if (selectedFile === namePrompt.path || selectedFile === oldPath) {
        const nextFile = namePrompt.isDir ? `${newPath}/` : newPath;
        void navigate(filesPath(nextFile), { replace: true });
      }
      setSelectedPaths(prev => {
        if (!prev.has(namePrompt.path) && !prev.has(oldPath)) return prev;
        const next = new Set(prev);
        next.delete(namePrompt.path);
        next.delete(oldPath);
        if (!namePrompt.isDir) next.add(newPath);
        return next;
      });
      setNamePrompt(null);
      toastManager.success(`Renamed to ${name}`, { duration: 2000 });
    } catch (e: unknown) {
      const message = `${action} failed: ${formatError(e)}`;
      toastManager.error(message, { duration: 4000 });
      // Re-throw so NamePromptModal keeps the dialog open and shows the error.
      throw new Error(message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!provider || !deleteTarget) return;
    if (deleteTarget.endsWith("/")) {
      toastManager.error("Deleting folders is not supported from the Files app", { duration: 4000 });
      setDeleteTarget(null);
      return;
    }
    const pathToDelete = deleteTarget;
    setDeleteTarget(null);
    await entityDelete.deleteEntity(pathToDelete, pathToDelete, async () => {
      await filesystemRPCClient.deleteFile({ path: pathToDelete, provider });
    });
  };

  const deleting = entityDelete.isDeleting;

  const openRename = (file: string) => {
    const isDir = file.endsWith("/");
    setNamePrompt({ mode: "rename", path: file, isDir });
  };

  const switchProvider = (next: string) => {
    if (next === provider) return;
    if (!confirmDiscard()) return;
    setProviderOverride(next);
    setPath(".");
    setUpdatedContent(null);
    setSelectedPaths(new Set());
    setSearchQuery("");
    if (selectedFile) void navigate("/files", { replace: true });
  };

  if (initialising) {
    return <LoadingState message="Starting file browser…" className="bg-primary h-full w-full" />;
  }

  if (error || !agentId) {
    return (
      <ErrorState
        title="File Browser Unavailable"
        error={error ?? "Unknown error"}
        onRetry={() => window.location.reload()}
        variant="page"
        className="bg-primary"
      />
    );
  }

  if (fsProviders.error) {
    return (
      <ErrorState
        title="Could not load filesystem providers"
        error={formatError(fsProviders.error)}
        onRetry={() => void fsProviders.mutate()}
        variant="page"
        className="bg-primary"
      />
    );
  }

  if (fsProviders.isLoading || (!provider && !fsProviders.data)) {
    return <LoadingState message="Loading filesystems…" className="bg-primary h-full w-full" />;
  }

  if (!provider) {
    return (
      <ErrorState
        title="No filesystem providers"
        error="Configure a filesystem provider to browse and edit files."
        onRetry={() => void fsProviders.mutate()}
        variant="page"
        className="bg-primary"
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      <AppPageHeader title="Files" subtitle="Browse · edit · create · search" icon={<FolderOpen className="w-4 h-4" />} iconGradient="from-accent to-blue-600">
        {providers.length > 1 && (
          <select
            value={provider}
            onChange={e => switchProvider(e.target.value)}
            className="bg-input border border-primary rounded-lg px-2 py-1.5 text-xs text-primary focus-ring cursor-pointer"
            aria-label="Filesystem provider"
          >
            {providers.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search workspace…" aria-label="Search workspace files" className="w-48" />
      </AppPageHeader>

      <BreadcrumbBar segments={breadcrumbSegments} onNavigate={navigateTo} actions={breadcrumbActions} />
      <input ref={upload.inputRef} type="file" multiple onChange={e => void upload.onChange(e)} className="hidden" />

      <WorkspaceShell
        appId="files"
        title="Files"
        navigationLabel="Workspace files"
        hasSelection={selectedFile !== null}
        className="flex-1"
        navigation={
          <FileListPane
            provider={provider}
            path={path}
            showHidden={showHidden}
            onNavigate={navigateTo}
            onSelectFile={selectFile}
            selectedFile={selectedFile}
            selectedPaths={selectedPaths}
            onToggleSelected={toggleSelected}
            onToggleSelectAll={toggleSelectAll}
            uploadingFiles={upload.uploadingFiles}
            searchQuery={debouncedSearch}
            onRename={openRename}
            onDelete={setDeleteTarget}
          />
        }
      >
        <div className="h-full min-h-0 flex flex-col">
          {selectedFile && (
            <div
              className="min-[1440px]:hidden h-10 shrink-0 flex items-center gap-1 p-1 border-b border-primary bg-secondary"
              role="tablist"
              aria-label="File view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={fileView === "editor"}
                onClick={() => setFileView("editor")}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium focus-ring ${fileView === "editor" ? "bg-active text-primary" : "text-muted hover:text-primary hover:bg-hover"}`}
              >
                <FileText className="w-3.5 h-3.5" /> Editor
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fileView === "details"}
                onClick={() => setFileView("details")}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium focus-ring ${fileView === "details" ? "bg-active text-primary" : "text-muted hover:text-primary hover:bg-hover"}`}
              >
                <Info className="w-3.5 h-3.5" /> Preview & details
              </button>
            </div>
          )}
          <div className="flex-1 min-h-0 flex">
            <div className={`${fileView === "editor" ? "flex" : "hidden"} min-[1440px]:flex flex-1 min-w-0 min-h-0 flex-col`}>
              <FileEditorPane
                file={selectedFile}
                content={editorContent}
                onContentChange={setUpdatedContent}
                isLoading={!!selectedFile && isLikelyTextFile(selectedFile) && fileContent.isLoading}
                hasData={!!fileContent.data}
                isDirty={isDirty}
                saving={saving}
                onSave={() => void handleSave()}
                loadError={fileContent.error ? formatError(fileContent.error) : null}
              />
            </div>
            <div
              className={`${fileView === "details" ? "flex" : "hidden"} min-[1440px]:flex min-[1440px]:w-80 min-[1600px]:w-96 shrink-0 min-w-0 min-h-0 flex-col border-l border-primary bg-secondary`}
            >
              <PreviewMetadataPane
                file={selectedFile}
                provider={provider}
                selectedPaths={selectedPaths}
                onToggleSelected={toggleSelected}
                onClose={() => selectFile(null)}
                isDirty={isDirty}
                saving={saving}
                onSave={handleSave}
                onRename={openRename}
                onDelete={setDeleteTarget}
              />
            </div>
          </div>
        </div>
      </WorkspaceShell>

      {selectedPaths.size > 0 && (
        <AgentLaunchPanel
          selectedItems={selectedPaths}
          itemLabel="file"
          onClear={() => setSelectedPaths(new Set())}
          attachItemToAgent={async (agentId, file) => {
            await filesystemRPCClient.addFileToChat({ agentId, file });
          }}
          onNavigateToAgent={agentId => {
            void navigate(`/agent/${agentId}`);
          }}
        />
      )}

      {namePrompt && (
        <NamePromptModal
          title={namePrompt.mode === "new-file" ? "New file" : namePrompt.mode === "new-folder" ? "New folder" : "Rename"}
          label={namePrompt.mode === "new-folder" ? "Folder name" : "File name"}
          initialValue={namePrompt.mode === "rename" ? getBasename(namePrompt.path) : ""}
          placeholder={namePrompt.mode === "new-folder" ? "my-folder" : "example.ts"}
          confirmText={namePrompt.mode === "rename" ? "Rename" : "Create"}
          validate={validateEntryName}
          onSubmit={handleNamePromptSubmit}
          onClose={() => setNamePrompt(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete"
          message={`Delete “${getBasename(deleteTarget)}”? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          variant="danger"
        />
      )}
    </div>
  );
}
