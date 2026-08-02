import formatError from "@tokenring-ai/utility/error/formatError";
import { FolderOpen, Search, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSWRConfig } from "swr";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { filesystemRPCClient, useFileContents, useFilesystemProviders } from "../../rpc.ts";
import AgentLaunchPanel from "./components/AgentLaunchPanel.tsx";
import BreadcrumbBar from "./components/BreadcrumbBar.tsx";
import FileEditorPane from "./components/FileEditorPane.tsx";
import FileListPane from "./components/FileListPane.tsx";
import NamePromptModal from "./components/NamePromptModal.tsx";
import PreviewMetadataPane from "./components/PreviewMetadataPane.tsx";
import { getBasename, getParentPath, isLikelyTextFile, joinPath } from "./fsUtils.ts";

type NamePrompt = { mode: "new-file" } | { mode: "new-folder" } | { mode: "rename"; path: string; isDir: boolean };

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const fileContent = useFileContents(selectedFile && isLikelyTextFile(selectedFile) ? selectedFile : undefined, provider ?? undefined);

  const [updatedContent, setUpdatedContent] = useState<string | null>(null);
  const [namePrompt, setNamePrompt] = useState<NamePrompt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // When deep-linking to a file, open its parent directory in the list.
  useEffect(() => {
    if (!selectedFile) return;
    const parent = getParentPath(selectedFile);
    setPath(parent);
  }, [selectedFile]);

  // Debounce search for workspace-wide search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const editorContent = updatedContent ?? fileContent.data?.content ?? "";
  const isDirty = updatedContent !== null && updatedContent !== (fileContent.data?.content ?? "");

  const confirmDiscardIfDirty = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm("You have unsaved changes. Discard them?");
  }, [isDirty]);

  const selectFile = useCallback(
    (file: string | null, options?: { replace?: boolean }) => {
      if (file === selectedFile) return;
      if (!confirmDiscardIfDirty()) return;
      setUpdatedContent(null);
      void navigate(filesPath(file), options?.replace ? { replace: true } : undefined);
    },
    [selectedFile, confirmDiscardIfDirty, navigate],
  );

  const navigateTo = useCallback(
    (nextPath: string) => {
      if (nextPath === path && !selectedFile) {
        setSearchQuery("");
        return;
      }
      if (selectedFile && !confirmDiscardIfDirty()) return;
      setUpdatedContent(null);
      setPath(nextPath);
      setSearchQuery("");
      // Clear file selection when browsing directories so the URL matches list focus.
      if (selectedFile) {
        void navigate("/files");
      }
    },
    [path, selectedFile, confirmDiscardIfDirty, navigate],
  );

  const refreshListing = useCallback(async () => {
    await globalMutate(
      key => typeof key === "string" && (key.startsWith("/filesystem/listDirectory/") || key.startsWith("/filesystem/searchWorkspaceFiles/")),
      undefined,
      { revalidate: true },
    );
  }, [globalMutate]);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!provider) return;
    const files = e.target.files;
    if (!files?.length) return;
    const MAX = 5 * 1024 * 1024;
    const names = Array.from(files).map(f => f.name);
    setUploadingFiles(names);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (file.size > MAX) {
        toastManager.error(`"${file.name}" exceeds 5 MB limit`, { duration: 3000 });
        continue;
      }
      try {
        const content = await file.text();
        const dest = joinPath(path, file.name);
        await filesystemRPCClient.writeFile({ path: dest, content, provider });
        ok += 1;
      } catch (err: unknown) {
        toastManager.error(`Failed to upload "${file.name}": ${formatError(err)}`, { duration: 3000 });
      }
    }
    setUploadingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refreshListing();
    if (ok > 0) toastManager.success(ok === 1 ? "Uploaded 1 file" : `Uploaded ${ok} files`, { duration: 2000 });
  };

  const validateEntryName = (name: string): string | null => {
    if (!name.trim()) return "Name is required";
    if (name.includes("/") || name.includes("\\")) return "Name cannot contain path separators";
    if (name === "." || name === "..") return "Invalid name";
    return null;
  };

  const handleNamePromptSubmit = async (name: string) => {
    if (!provider || !namePrompt) return;
    if (namePrompt.mode === "new-file") {
      if (selectedFile && !confirmDiscardIfDirty()) return;
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
  };

  const handleDeleteConfirm = async () => {
    if (!provider || !deleteTarget) return;
    if (deleteTarget.endsWith("/")) {
      toastManager.error("Deleting folders is not supported from the Files app", { duration: 4000 });
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await filesystemRPCClient.deleteFile({ path: deleteTarget, provider });
      if (selectedFile === deleteTarget) {
        setUpdatedContent(null);
        void navigate("/files", { replace: true });
      }
      setSelectedPaths(prev => {
        const next = new Set(prev);
        next.delete(deleteTarget);
        return next;
      });
      await refreshListing();
      toastManager.success(`Deleted ${getBasename(deleteTarget)}`, { duration: 2000 });
      setDeleteTarget(null);
    } catch (e: unknown) {
      toastManager.error(`Delete failed: ${formatError(e)}`, { duration: 4000 });
    } finally {
      setDeleting(false);
    }
  };

  const openRename = (file: string) => {
    const isDir = file.endsWith("/");
    setNamePrompt({ mode: "rename", path: file, isDir });
  };

  const switchProvider = (next: string) => {
    if (next === provider) return;
    if (!confirmDiscardIfDirty()) return;
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
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search workspace…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-input border border-primary rounded-lg py-1.5 pl-8 pr-7 text-xs text-primary placeholder-muted focus-accent w-48 transition-all"
            aria-label="Search workspace files"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary focus-ring rounded p-0.5 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </AppPageHeader>

      <BreadcrumbBar
        path={path}
        onNavigate={navigateTo}
        showHidden={showHidden}
        onToggleHidden={() => setShowHidden(v => !v)}
        onUpload={() => fileInputRef.current?.click()}
        onRefresh={() => void refreshListing()}
        onNewFile={() => setNamePrompt({ mode: "new-file" })}
        onNewFolder={() => setNamePrompt({ mode: "new-folder" })}
      />
      <input ref={fileInputRef} type="file" multiple onChange={e => void handleUpload(e)} className="hidden" />

      <ResizableSplit direction="vertical" initialRatio={0.5} minFirst={180} minSecond={150} className="flex-1 min-h-0">
        <ResizableSplit direction="horizontal" initialRatio={0.66} minFirst={220} minSecond={180} className="h-full">
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
            uploadingFiles={uploadingFiles}
            searchQuery={debouncedSearch}
            onRefresh={() => void refreshListing()}
            onRename={openRename}
            onDelete={setDeleteTarget}
          />
          <PreviewMetadataPane
            agentId={agentId}
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
        </ResizableSplit>
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
      </ResizableSplit>

      {selectedPaths.size > 0 && <AgentLaunchPanel selectedPaths={selectedPaths} onClear={() => setSelectedPaths(new Set())} />}

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
        <ConfirmDialog
          title="Delete"
          message={`Delete “${getBasename(deleteTarget)}”? This cannot be undone.`}
          confirmText={deleting ? "Deleting…" : "Delete"}
          onConfirm={() => {
            if (!deleting) void handleDeleteConfirm();
          }}
          onCancel={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          variant="danger"
        />
      )}
    </div>
  );
}
