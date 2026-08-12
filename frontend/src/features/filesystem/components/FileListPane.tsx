import formatError from "@tokenring-ai/utility/error/formatError";
import { Check, Download, Loader2, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import NavigationSidebarHeader from "../../../components/layout/NavigationSidebarHeader.tsx";
import { toastManager } from "../../../components/ui/toast.tsx";
import { cn } from "../../../lib/utils.ts";
import { useDirectoryListing, useWorkspaceFileSearch } from "../../../rpc.ts";
import { downloadWorkspaceFile } from "../downloadFile.ts";
import { getBasename, getFileIcon, isHiddenEntry, isHiddenPath } from "../fsUtils.ts";

interface FileListPaneProps {
  provider: string | null;
  path: string;
  showHidden: boolean;
  onNavigate: (p: string) => void;
  onSelectFile: (f: string) => void;
  selectedFile: string | null;
  selectedPaths: Set<string>;
  onToggleSelected: (f: string) => void;
  onToggleSelectAll: (files: string[]) => void;
  uploadingFiles: string[];
  searchQuery: string;
  onRename?: (file: string) => void;
  onDelete?: (file: string) => void;
}

export default function FileListPane({
  provider,
  path,
  showHidden,
  onNavigate,
  onSelectFile,
  selectedFile,
  selectedPaths,
  onToggleSelected,
  onToggleSelectAll,
  uploadingFiles,
  searchQuery,
  onRename,
  onDelete,
}: FileListPaneProps) {
  const trimmedSearch = searchQuery.trim();
  const isSearching = trimmedSearch.length > 0;

  const listing = useDirectoryListing(provider && !isSearching ? { path, showHidden, provider } : undefined);
  const workspaceSearch = useWorkspaceFileSearch(provider && isSearching ? { provider, query: trimmedSearch, limit: 80 } : undefined);

  const sortedFiles = useMemo(() => {
    if (isSearching) {
      let files = [...(workspaceSearch.data?.files ?? [])];
      if (!showHidden) {
        files = files.filter(f => !isHiddenPath(f));
      }
      return files.sort((a, b) => {
        const dA = a.endsWith("/"),
          dB = b.endsWith("/");
        if (dA && !dB) return -1;
        if (!dA && dB) return 1;
        return a.localeCompare(b);
      });
    }

    if (!listing.data?.files) return [];
    let files = [...listing.data.files];
    if (!showHidden) {
      files = files.filter(f => !isHiddenEntry(f));
    }
    return files.sort((a, b) => {
      const dA = a.endsWith("/"),
        dB = b.endsWith("/");
      if (dA && !dB) return -1;
      if (!dA && dB) return 1;
      return a.localeCompare(b);
    });
  }, [listing.data?.files, workspaceSearch.data?.files, isSearching, showHidden]);

  const fileOnly = sortedFiles.filter(f => !f.endsWith("/"));
  const allSelected = fileOnly.length > 0 && fileOnly.every(f => selectedPaths.has(f));

  const handleRowClick = (file: string) => {
    const isDir = file.endsWith("/");
    if (isDir) {
      const dirPath = file.endsWith("/") ? file.slice(0, -1) : file;
      onNavigate(dirPath);
      return;
    }
    // When searching, opening a file should also jump to its parent directory context is optional;
    // select the file for preview/edit.
    onSelectFile(file);
  };

  const isLoading = isSearching ? workspaceSearch.isLoading : listing.isLoading;
  const loadError = isSearching ? workspaceSearch.error : listing.error;

  // provider can briefly be null while parents load; avoid a false "empty directory" flash
  if (!provider) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <NavigationSidebarHeader title="Files" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-muted animate-spin" />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <NavigationSidebarHeader title="Files" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-muted animate-spin" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <NavigationSidebarHeader title="Files" />
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-red-400">{formatError(loadError)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <NavigationSidebarHeader title="Files" meta={sortedFiles.length} />
      {isSearching && (
        <div className="px-3 py-1.5 border-b border-primary bg-tertiary text-xs text-muted shrink-0">
          {workspaceSearch.data
            ? `${workspaceSearch.data.totalMatches} match${workspaceSearch.data.totalMatches === 1 ? "" : "es"} for “${trimmedSearch}”${
                workspaceSearch.data.totalMatches > sortedFiles.length ? ` · showing ${sortedFiles.length}` : ""
              }`
            : `Searching for “${trimmedSearch}”…`}
        </div>
      )}
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-secondary z-10">
          <tr className="text-xs text-muted font-semibold border-b border-primary">
            <th className="pl-3 pr-2 py-2 w-8">
              <button
                type="button"
                onClick={() => onToggleSelectAll(fileOnly)}
                className={cn(
                  "w-3.5 h-3.5 border rounded-sm flex items-center justify-center transition-all focus-ring cursor-pointer",
                  allSelected ? "border-accent bg-accent" : "border-primary hover:border-muted",
                )}
                aria-label={allSelected ? "Deselect all" : "Select all files"}
                title={allSelected ? "Deselect all" : "Select all files"}
              >
                {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
              </button>
            </th>
            <th className="px-2 py-2 font-medium">Name</th>
            <th className="px-2 py-2 font-medium w-24 hidden md:table-cell">Type</th>
            <th className="px-2 py-2 font-medium w-24 hidden sm:table-cell text-right pr-4">Actions</th>
          </tr>
        </thead>
        <tbody className="text-xs">
          {sortedFiles.map(file => {
            const isDir = file.endsWith("/");
            const name = getBasename(file);
            const isSelectedFile = selectedFile === file;
            const isChecked = selectedPaths.has(file);
            const isUploading = uploadingFiles.includes(name);
            const showPathHint = isSearching && file.includes("/");

            return (
              <tr
                key={file}
                onClick={() => handleRowClick(file)}
                className={cn("group border-b border-primary cursor-pointer transition-colors outline-none", isSelectedFile ? "bg-active" : "hover:bg-hover")}
                tabIndex={0}
                aria-label={`${isDir ? "Directory" : "File"}: ${name}`}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRowClick(file);
                  }
                }}
              >
                <td className="pl-3 pr-2 py-2.5" onClick={e => e.stopPropagation()}>
                  {!isDir && (
                    <button
                      type="button"
                      onClick={() => onToggleSelected(file)}
                      className={cn(
                        "w-3.5 h-3.5 border rounded-sm flex items-center justify-center transition-all focus-ring cursor-pointer",
                        isChecked ? "border-accent bg-accent" : "border-primary hover:border-accent-soft",
                      )}
                      aria-label={isChecked ? `Deselect ${name}` : `Select ${name}`}
                    >
                      {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                    </button>
                  )}
                </td>

                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(file, isDir)}
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn("font-medium truncate block", isSelectedFile ? "text-accent-soft" : "text-primary", isUploading && "text-accent-soft")}
                      >
                        {name}
                      </span>
                      {showPathHint && <span className="text-xs text-dim truncate block">{file}</span>}
                    </div>
                    {isUploading && <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />}
                  </div>
                </td>

                <td className="px-2 py-2.5 text-muted hidden md:table-cell">{isDir ? "folder" : name.includes(".") ? name.split(".").pop() : "—"}</td>

                <td className="px-2 py-2.5 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                    {!isDir && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (!provider) return;
                            await downloadWorkspaceFile(file, provider);
                          } catch {
                            toastManager.error("Download failed", { duration: 3000 });
                          }
                        }}
                        className="p-1 hover:text-primary text-muted focus-ring rounded cursor-pointer"
                        aria-label={`Download ${name}`}
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onRename && (
                      <button
                        type="button"
                        onClick={() => onRename(file)}
                        className="p-1 hover:text-primary text-muted focus-ring rounded cursor-pointer"
                        aria-label={`Rename ${name}`}
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* deleteFile RPC only supports files, not directories */}
                    {onDelete && !isDir && (
                      <button
                        type="button"
                        onClick={() => onDelete(file)}
                        className="p-1 hover:text-red-400 text-muted focus-ring rounded cursor-pointer"
                        aria-label={`Delete ${name}`}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {sortedFiles.length === 0 && (
            <tr>
              <td colSpan={4} className="py-16 text-center text-muted text-sm">
                {isSearching ? `No files matching “${trimmedSearch}”` : "This directory is empty."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
