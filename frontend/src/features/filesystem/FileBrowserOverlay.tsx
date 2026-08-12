import formatError from "@tokenring-ai/utility/error/formatError";
import { FocusTrap } from "focus-trap-react";
import { Check, ChevronRight, Download, Edit, Eye, EyeOff, File, Folder, Plus, Save, Trash2, X } from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import CodeEditor from "../../components/editor/CodeEditor.tsx";
import MarkdownEditor from "../../components/editor/MarkdownEditor.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useDebounce } from "../../hooks/useDebounce.ts";
import { useEventListener } from "../../hooks/useEventListener.ts";
import { useFileUpload } from "../../hooks/useFileUpload.ts";
import { cn } from "../../lib/utils.ts";
import { filesystemRPCClient, useDirectoryListing, useFileContents, useFilesystemState } from "../../rpc.ts";
import { downloadWorkspaceFile } from "./downloadFile.ts";
import { getBasename, getFileIcon } from "./fsUtils.ts";

interface FileBrowserOverlayProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function FileBrowserOverlay({ agentId, isOpen, onClose }: FileBrowserOverlayProps) {
  const [path, setPath] = useState(".");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [previewHeight, setPreviewHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [editorContent, setEditorContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const initialFocusRef = useRef<HTMLDivElement>(null);
  const fileTableRef = useRef<HTMLTableElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fsState = useFilesystemState(agentId);
  const fsStateData = fsState.data?.status === "success" ? fsState.data : null;
  const provider = fsStateData?.provider ?? null;
  const directoryListing = useDirectoryListing(provider ? { path, showHidden: showHiddenFiles, provider } : undefined);
  const fileContent = useFileContents(selectedFile ?? undefined, provider ?? undefined);

  const upload = useFileUpload({
    encoding: "base64",
    maxSize: 5 * 1024 * 1024,
    maxSizeLabel: "5 MB",
    uploadFile: async ({ filePath, content, encoding }) => {
      if (!provider) throw new Error("No filesystem provider");
      const targetPath = path === "." ? filePath : `${path}/${filePath}`;
      await filesystemRPCClient.writeFile({ path: targetPath, content, encoding, provider });
    },
    askOverwrite: false,
    onSkip: ({ fileName, reason, detail }) => {
      if (reason === "size") {
        toastManager.error(detail ?? `File "${fileName}" is too large. Maximum size is 5MB.`, { duration: 3000 });
      }
    },
    onError: ({ fileName, error }) => {
      console.error("Failed to upload file:", error);
      toastManager.error(`Failed to upload "${fileName}"`, { duration: 3000 });
    },
    onComplete: async () => {
      await directoryListing.mutate();
    },
  });

  React.useEffect(() => {
    if (isOpen && initialFocusRef.current) {
      initialFocusRef.current.focus();
    }
  }, [isOpen]);

  const sortedFiles = useMemo(() => {
    if (!directoryListing.data?.files) return [];
    let files = [...directoryListing.data.files];

    if (debouncedSearch) {
      files = files.filter(f => getBasename(f).toLowerCase().includes(debouncedSearch.toLowerCase()));
    }

    return files.sort((a, b) => {
      const isDirA = a.endsWith("/");
      const isDirB = b.endsWith("/");
      if (isDirA && !isDirB) return -1;
      if (!isDirA && isDirB) return 1;
      return a.localeCompare(b);
    });
  }, [directoryListing.data?.files, debouncedSearch]);

  useEventListener(
    "keydown",
    e => {
      if (!fileTableRef.current) return;

      const rows = Array.from(fileTableRef.current.querySelectorAll<HTMLTableRowElement>("tbody tr"));
      const currentIndex = rows.findIndex(row => row.classList.contains("ring-2") && row.classList.contains("ring-accent"));

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = currentIndex < rows.length - 1 ? currentIndex + 1 : 0;
          const nextRow = rows[nextIndex];
          if (nextRow) {
            nextRow.focus();
            nextRow.scrollIntoView({ block: "nearest" });
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : rows.length - 1;
          const prevRow = rows[prevIndex];
          if (prevRow) {
            prevRow.focus();
            prevRow.scrollIntoView({ block: "nearest" });
          }
          break;
        }
        case "Home":
          {
            e.preventDefault();
            const firstItem = rows[0];
            if (firstItem) {
              firstItem.focus();
              firstItem.scrollIntoView({ block: "start" });
            }
          }
          break;
        case "End":
          {
            e.preventDefault();
            const lastItem = rows[rows.length - 1];
            if (lastItem) {
              lastItem.focus();
              lastItem.scrollIntoView({ block: "end" });
            }
          }
          break;
        case "Escape":
          if (document.activeElement !== searchInputRef.current) {
            e.preventDefault();
            onClose();
          }
          break;
      }
    },
    { target: document, enabled: isOpen },
  );

  useEventListener(
    "keydown",
    e => {
      if (e.key === "Escape" && document.activeElement === searchInputRef.current && searchQuery) {
        e.preventDefault();
        e.stopPropagation();
        setSearchQuery("");
      }
    },
    { target: document },
  );

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    const fileToSave = selectedFile;
    const contentToSave = editorContent;
    setIsSaving(true);
    try {
      if (!provider) throw new Error("No filesystem provider");
      await filesystemRPCClient.writeFile({ path: fileToSave, content: contentToSave, provider });
      await fileContent.mutate();
    } catch (error: unknown) {
      toastManager.error(`Failed to save "${getBasename(fileToSave)}": ${formatError(error)}`, { duration: 5000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  useEventListener(
    "mousemove",
    e => {
      const container = document.querySelector(".file-browser-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;
      setPreviewHeight(Math.max(200, Math.min(newHeight, rect.height - 200)));
    },
    { target: document, enabled: isResizing },
  );

  useEventListener(
    "mouseup",
    () => {
      setIsResizing(false);
    },
    { target: document, enabled: isResizing },
  );

  if (!isOpen) return null;

  const handleFileClick = async (file: string) => {
    const isDir = file.endsWith("/");
    const fullPath = isDir ? file.slice(0, -1) : file;
    try {
      if (!provider) return;
      const { stats } = await filesystemRPCClient.stat({ path: fullPath, provider });

      if (stats.exists) {
        if (stats.isDirectory) {
          setPath(fullPath);
          setSelectedFile(null);
        } else {
          setSelectedFile(file);
        }
      }
    } catch (error: unknown) {
      toastManager.error(`Failed to open "${getBasename(file)}": ${formatError(error)}`, { duration: 5000 });
    }
  };

  const handleAddFile = async (file: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await filesystemRPCClient.addFileToChat({ agentId, file });
      await fsState.mutate();
      toastManager.success(`Added ${getBasename(file)} to chat`, { duration: 2000 });
    } catch (error: unknown) {
      console.error("Failed to add file:", error);
      toastManager.error("Failed to add file to chat", { duration: 3000 });
    }
  };

  const handleRemoveFile = async (file: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await filesystemRPCClient.removeFileFromChat({ agentId, file });
      await fsState.mutate();
      toastManager.info(`Removed ${getBasename(file)} from chat`, { duration: 2000 });
    } catch (error: unknown) {
      console.error("Failed to remove file:", error);
      toastManager.error("Failed to remove file to chat", { duration: 3000 });
    }
  };

  const handleDownload = async (file: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const cleanFile = file.endsWith("/") ? file.slice(0, -1) : file;
    try {
      if (!provider) return;
      await downloadWorkspaceFile(cleanFile, provider);
    } catch (error: unknown) {
      toastManager.error(`Failed to download "${getBasename(cleanFile)}": ${formatError(error)}`, { duration: 5000 });
    }
  };

  const breadcrumbs = path === "." ? [] : path.split("/");

  return (
    <FocusTrap active={isOpen}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
        <div
          ref={initialFocusRef}
          tabIndex={-1}
          className="w-full max-w-6xl h-[85vh] bg-secondary border border-primary rounded-xl shadow-xl flex flex-col overflow-hidden ring-1 ring-white/5 relative file-browser-container"
        >
          <div className="h-12 border-b border-primary flex items-center justify-between px-4 bg-secondary shrink-0 select-none">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted">
                <Folder size={16} />
                <span className="text-xs font-medium tracking-wide">File Browser</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search files..."
                aria-label="Search files"
                clearAriaLabel="Clear search (or press Escape)"
                className="w-48"
                inputRef={searchInputRef}
              />
              <button type="button" onClick={onClose} className="text-muted hover:text-primary transition-colors focus-ring" aria-label="Close file browser">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            <div className="flex-1 flex flex-col bg-primary min-w-0">
              <div className="h-10 border-b border-primary flex px-4 shrink-0">
                <div className="flex flex-1 items-center gap-1 text-xs text-muted min-w-0">
                  <button
                    type="button"
                    className="hover:text-primary cursor-pointer shrink-0 focus-ring rounded-md px-1"
                    onClick={() => setPath(".")}
                    aria-label="Go to root directory"
                  >
                    root
                  </button>
                  {breadcrumbs.length > 3 ? (
                    <>
                      <ChevronRight size={10} className="shrink-0" />
                      <span className="text-dim">...</span>
                      <ChevronRight size={10} className="shrink-0" />
                      <button
                        type="button"
                        className="hover:text-primary cursor-pointer truncate focus-ring rounded-md px-1"
                        onClick={() => setPath(breadcrumbs.slice(0, -1).join("/"))}
                        aria-label={`Go to ${breadcrumbs[breadcrumbs.length - 2]}`}
                      >
                        {breadcrumbs[breadcrumbs.length - 2]}
                      </button>
                      <ChevronRight size={10} className="shrink-0" />
                      <span className="text-primary truncate">{breadcrumbs[breadcrumbs.length - 1]}</span>
                    </>
                  ) : (
                    breadcrumbs.map((part, i) => (
                      <React.Fragment key={i}>
                        <ChevronRight size={10} className="shrink-0" />
                        <button
                          type="button"
                          className="hover:text-primary cursor-pointer truncate focus-ring rounded-md px-1"
                          onClick={() => setPath(breadcrumbs.slice(0, i + 1).join("/"))}
                          aria-label={`Go to ${part}`}
                        >
                          {part}
                        </button>
                      </React.Fragment>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-hover text-muted text-xs transition-colors focus-ring"
                    aria-label={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
                  >
                    {showHiddenFiles ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showHiddenFiles ? "Hide" : "Show"} Hidden
                  </button>
                </div>
                <button
                  type="button"
                  onClick={upload.trigger}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-hover text-muted text-xs transition-colors focus-ring"
                  aria-label="Upload files"
                >
                  <Plus size={14} />
                  Upload
                </button>
                <input ref={upload.inputRef} type="file" multiple onChange={e => void upload.onChange(e)} className="hidden" />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <table ref={fileTableRef} className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs text-muted font-semibold border-b border-primary">
                      <th className="pl-2 pr-4 py-2 font-medium w-8">
                        <div className="w-3 h-3 border border-primary rounded-sm bg-tertiary"></div>
                      </th>
                      <th className="px-2 py-2 font-medium">Name</th>
                      <th className="px-2 py-2 font-medium w-24 hidden sm:table-cell">Size</th>
                      <th className="px-2 py-2 font-medium w-32 hidden sm:table-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {sortedFiles.map((file, i) => {
                      const isDir = file.endsWith("/");
                      const displayName = getBasename(file);
                      const isSelected = selectedFile === file;
                      const isInChat = fsStateData?.selectedFiles.includes(file);

                      return (
                        <tr
                          key={i}
                          onClick={() => handleFileClick(file)}
                          className={cn(
                            "group transition-colors border-b border-primary cursor-pointer focus-ring outline-none",
                            isSelected ? "bg-active ring-2 ring-accent ring-inset" : "hover:bg-hover",
                          )}
                          tabIndex={0}
                          role="button"
                          aria-label={`${isDir ? "Open directory" : "Select file"} ${displayName}`}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              void handleFileClick(file);
                            }
                          }}
                        >
                          <td className="pl-2 pr-4 py-2">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                if (isInChat) {
                                  void handleRemoveFile(file);
                                } else {
                                  void handleAddFile(file);
                                }
                              }}
                              className={cn(
                                "w-3 h-3 border rounded-sm flex items-center justify-center transition-all focus-ring",
                                isInChat ? "border-accent bg-accent shadow-sm" : "border-primary hover:border-muted",
                              )}
                              aria-label={isInChat ? `Remove ${displayName} from chat` : `Add ${displayName} to chat`}
                            >
                              {isInChat && <Check size={12} className="text-white" />}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <div
                              className={cn("flex items-center gap-2 font-medium", isSelected ? "text-accent-soft" : isDir ? "text-primary" : "text-primary")}
                            >
                              {getFileIcon(file, isDir, 16, "overlay")}
                              <span className={cn(upload.uploadingFiles.includes(displayName) && "text-accent-soft")}>{displayName}</span>
                              {upload.uploadingFiles.includes(displayName) && (
                                <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin ml-1" title="Uploading...">
                                  <span className="sr-only">Uploading</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-muted hidden sm:table-cell">
                            {isDir ? "-" : upload.uploadingFiles.includes(displayName) ? "Uploading..." : "---"}
                          </td>
                          <td className="px-2 py-2 text-muted hidden sm:table-cell">
                            {upload.uploadingFiles.includes(displayName) ? (
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" title="Uploading...">
                                  <span className="sr-only">Uploading</span>
                                </div>
                                <span className="text-accent-soft text-xs">Uploading</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isDir && (
                                  <button
                                    type="button"
                                    onClick={e => handleDownload(file, e)}
                                    className="p-1.5 hover:text-primary focus-ring rounded-md"
                                    aria-label={`Download ${displayName}`}
                                  >
                                    <Download size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    if (isInChat) {
                                      void handleRemoveFile(file);
                                    } else {
                                      void handleAddFile(file);
                                    }
                                  }}
                                  className={cn(
                                    "p-1.5 focus-ring rounded-md",
                                    isInChat ? "text-red-400 hover:text-red-300" : "text-accent-soft hover:text-accent",
                                  )}
                                  aria-label={isInChat ? `Remove ${displayName} from chat` : `Add ${displayName} to chat`}
                                >
                                  {isInChat ? <Trash2 size={14} /> : <Plus size={14} />}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {sortedFiles.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted text-sm">
                          No files found in this directory.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="h-9 border-t border-primary bg-tertiary flex items-center justify-between px-4 shrink-0">
                <span className="text-xs text-muted">{fsStateData?.selectedFiles.length ?? 0} items in chat</span>
              </div>

              {upload.uploadingFiles.length > 0 && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
                  <div className="bg-secondary border border-primary rounded-lg p-4 flex items-center gap-3 shadow-lg">
                    <div className="w-5 h-5 border-2 border-muted border-t-accent rounded-full animate-spin" />
                    <span className="text-sm text-primary">
                      Uploading {upload.uploadingFiles.length} file{upload.uploadingFiles.length > 1 ? "s" : ""}...
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="w-80 bg-tertiary border-l border-primary flex-col shrink-0 hidden md:flex">
              {selectedFile ? (
                <>
                  <div className="p-4 border-b border-primary flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-tertiary flex items-center justify-center shrink-0">
                      {getFileIcon(selectedFile, false, 24, "overlay")}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-primary truncate" title={selectedFile}>
                        {getBasename(selectedFile)}
                      </h3>
                      <p className="text-xs text-muted mt-0.5">{selectedFile.split(".").pop()?.toUpperCase()} File</p>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-2 gap-2 border-b border-primary">
                    <button
                      type="button"
                      onClick={() => (fsStateData?.selectedFiles.includes(selectedFile) ? handleRemoveFile(selectedFile) : handleAddFile(selectedFile))}
                      className={cn(
                        "col-span-2 flex items-center justify-center gap-2 text-white text-xs font-medium py-2 rounded-lg shadow-lg transition-all active:scale-[0.98] focus-ring",
                        fsStateData?.selectedFiles.includes(selectedFile)
                          ? "bg-red-600 hover:bg-red-500 shadow-red-500/20"
                          : "bg-accent hover:bg-accent-hover shadow-button-primary",
                      )}
                      aria-label={fsStateData?.selectedFiles.includes(selectedFile) ? "Remove from chat" : "Add to chat"}
                    >
                      {fsStateData?.selectedFiles.includes(selectedFile) ? (
                        <>
                          <Trash2 size={16} />
                          Remove from Chat
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          Add to Chat
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={e => handleDownload(selectedFile, e)}
                      className="flex items-center justify-center gap-2 bg-tertiary hover:bg-hover text-muted text-xs font-medium py-1.5 rounded-md border border-primary transition-colors focus-ring"
                      aria-label="Download file"
                    >
                      <Download size={14} />
                      Download
                    </button>
                    <button
                      type="button"
                      className="flex items-center justify-center gap-2 bg-tertiary hover:bg-hover text-muted text-xs font-medium py-1.5 rounded-md border border-primary transition-colors focus-ring"
                      aria-label="Edit file"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                  </div>

                  <div className="p-3 text-xs text-muted space-y-1 bg-tertiary">
                    <div className="flex justify-between">
                      <span>Path</span>
                      <span className="text-primary truncate ml-4" title={selectedFile}>
                        {selectedFile}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="text-primary">{selectedFile.split(".").pop()}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted p-8 text-center">
                  <File size={48} className="mb-4 opacity-10" />
                  <p className="text-sm">Select a file from the explorer to view its contents.</p>
                </div>
              )}
            </div>
          </div>

          {selectedFile && (
            <div style={{ height: `${previewHeight}px` }} className="bg-tertiary border-t border-primary flex flex-col shrink-0 relative">
              <div onMouseDown={handleMouseDown} className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-accent/50 transition-colors z-10" />
              <div className="px-4 py-2 flex items-center justify-between border-b border-primary bg-secondary">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted uppercase tracking-widest">Preview</span>
                  <span className="text-xs text-muted">•</span>
                  <span className="text-xs text-primary font-medium">{getBasename(selectedFile)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveFile}
                    disabled={isSaving || !editorContent || editorContent === fileContent.data?.content}
                    className="flex items-center gap-1.5 text-muted hover:text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors focus-ring rounded-md px-2 py-1"
                    aria-label="Save file"
                  >
                    <Save size={14} />
                    <span className="text-xs">{isSaving ? "Saving..." : "Save"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-muted hover:text-primary transition-colors focus-ring rounded-md p-1"
                    aria-label="Close preview"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar bg-primary relative">
                {fileContent.data ? (
                  selectedFile.endsWith(".md") ? (
                    <MarkdownEditor key={selectedFile} content={fileContent.data.content ?? ""} onContentChange={setEditorContent} />
                  ) : (
                    <CodeEditor key={selectedFile} file={selectedFile} content={fileContent.data.content ?? ""} onContentChange={setEditorContent} />
                  )
                ) : (
                  <div className="h-full flex items-center justify-center text-muted p-4 text-center text-xs">Loading content...</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </FocusTrap>
  );
}
