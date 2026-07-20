import { FolderOpen, Search, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { filesystemRPCClient, useDirectoryListing, useFileContents, useFilesystemProviders } from "../../rpc.ts";
import AgentLaunchPanel from "./components/AgentLaunchPanel.tsx";
import BreadcrumbBar from "./components/BreadcrumbBar.tsx";
import FileEditorPane from "./components/FileEditorPane.tsx";
import FileListPane from "./components/FileListPane.tsx";
import PreviewMetadataPane from "./components/PreviewMetadataPane.tsx";

export default function FilesApp() {
  const { agentId, initialising, error } = useHeadlessAgent({
    appName: "Files app",
    preferredTypes: ["coder"],
    noTypesMessage: "No agent types available",
  });
  const fsProviders = useFilesystemProviders();
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    const newProvider = fsProviders.data?.providers[0];
    if (!provider && newProvider) {
      setProvider(newProvider);
    }
  }, [fsProviders.data, provider]);

  const [path, setPath] = useState(".");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listing = useDirectoryListing(agentId && provider ? { path, showHidden, provider } : undefined);

  const [saving, setSaving] = useState(false);
  const fileContent = useFileContents(selectedFile ?? undefined, provider ?? undefined);

  const [updatedContent, setUpdatedContent] = useState<string | null>(null);

  const editorContent = updatedContent ?? fileContent.data?.content ?? "";

  const handleSave = async () => {
    if (!selectedFile || !agentId || !provider) return;
    setSaving(true);
    try {
      await filesystemRPCClient.writeFile({ path: selectedFile, content: editorContent, provider });
      await fileContent.mutate(() => ({ content: editorContent }));
      setUpdatedContent(null);

      toastManager.success("Saved", { duration: 2000 });
    } catch {
      toastManager.error("Save failed", { duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const isDirty = editorContent !== (fileContent.data?.content ?? "");

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
    if (!agentId || !provider) return;
    const files = e.target.files;
    if (!files?.length) return;
    const MAX = 5 * 1024 * 1024;
    const names = Array.from(files).map(f => f.name);
    setUploadingFiles(names);
    for (const file of Array.from(files)) {
      if (file.size > MAX) {
        toastManager.error(`"${file.name}" exceeds 5 MB limit`, { duration: 3000 });
        continue;
      }
      try {
        const content = await file.text();
        const dest = path === "." ? file.name : `${path}/${file.name}`;
        await filesystemRPCClient.writeFile({ path: dest, content, provider });
      } catch {
        toastManager.error(`Failed to upload "${file.name}"`, { duration: 3000 });
      }
    }
    setUploadingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await listing.mutate();
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

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      <AppPageHeader
        title="Files"
        subtitle="Browse files · select · launch agent"
        icon={<FolderOpen className="w-4 h-4" />}
        iconGradient="from-accent to-blue-600"
      >
        {(fsProviders.data?.providers.length ?? 0) > 1 && (
          <select
            value={provider ?? ""}
            onChange={e => {
              setProvider(e.target.value);
              setPath(".");
              setSelectedFile(null);
            }}
            className="bg-input border border-primary rounded-lg px-2 py-1.5 text-xs text-primary focus-ring cursor-pointer"
            aria-label="Filesystem provider"
          >
            {fsProviders.data!.providers.map(p => (
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
            placeholder="Search files…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-input border border-primary rounded-lg py-1.5 pl-8 pr-7 text-xs text-primary placeholder-muted focus-accent w-44 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary focus-ring rounded p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </AppPageHeader>

      <BreadcrumbBar
        path={path}
        onNavigate={p => {
          setPath(p);
          setSelectedFile(null);
        }}
        showHidden={showHidden}
        onToggleHidden={() => setShowHidden(v => !v)}
        onUpload={() => fileInputRef.current?.click()}
        onRefresh={() => listing.mutate()}
      />
      <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />

      <ResizableSplit direction="vertical" initialRatio={0.5} minFirst={180} minSecond={150} className="flex-1 min-h-0">
        <ResizableSplit direction="horizontal" initialRatio={0.66} minFirst={220} minSecond={180} className="h-full">
          <FileListPane
            provider={provider}
            path={path}
            onNavigate={p => {
              setPath(p);
              setSelectedFile(null);
            }}
            onSelectFile={setSelectedFile}
            selectedFile={selectedFile}
            selectedPaths={selectedPaths}
            onToggleSelected={toggleSelected}
            onToggleSelectAll={toggleSelectAll}
            uploadingFiles={uploadingFiles}
            searchQuery={searchQuery}
            onRefresh={() => listing.mutate()}
          />
          <PreviewMetadataPane
            agentId={agentId}
            file={selectedFile}
            provider={provider}
            selectedPaths={selectedPaths}
            onToggleSelected={toggleSelected}
            onClose={() => setSelectedFile(null)}
            isDirty={isDirty}
            saving={saving}
            onSave={handleSave}
          />
        </ResizableSplit>
        <FileEditorPane
          file={selectedFile}
          content={editorContent}
          onContentChange={setUpdatedContent}
          isLoading={fileContent.isLoading}
          hasData={!!fileContent.data}
        />
      </ResizableSplit>

      {selectedPaths.size > 0 && <AgentLaunchPanel selectedPaths={selectedPaths} onClear={() => setSelectedPaths(new Set())} />}
    </div>
  );
}
