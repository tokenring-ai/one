import { Check, Download, Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toastManager } from "../../../components/ui/toast.tsx";
import { cn } from "../../../lib/utils.ts";
import { filesystemRPCClient, useDirectoryListing } from "../../../rpc.ts";
import { getBasename, getFileIcon } from "../fsUtils.ts";

interface FileListPaneProps {
  provider: string | null;
  path: string;
  onNavigate: (p: string) => void;
  onSelectFile: (f: string) => void;
  selectedFile: string | null;
  selectedPaths: Set<string>;
  onToggleSelected: (f: string) => void;
  onToggleSelectAll: (files: string[]) => void;
  uploadingFiles: string[];
  searchQuery: string;
  onRefresh: () => void;
}

export default function FileListPane({
  provider,
  path,
  onNavigate,
  onSelectFile,
  selectedFile,
  selectedPaths,
  onToggleSelected,
  onToggleSelectAll,
  uploadingFiles,
  searchQuery,
}: FileListPaneProps) {
  const listing = useDirectoryListing(provider ? { path, showHidden: false, provider } : undefined);

  useEffect(() => {
    /* no-op: refresh is triggered externally */
  }, []);

  const sortedFiles = useMemo(() => {
    if (!listing.data?.files) return [];
    let files = [...listing.data.files];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      files = files.filter(f => getBasename(f).toLowerCase().includes(q));
    }
    return files.sort((a, b) => {
      const dA = a.endsWith("/"),
        dB = b.endsWith("/");
      if (dA && !dB) return -1;
      if (!dA && dB) return 1;
      return a.localeCompare(b);
    });
  }, [listing.data?.files, searchQuery]);

  const fileOnly = sortedFiles.filter(f => !f.endsWith("/"));
  const allSelected = fileOnly.length > 0 && fileOnly.every(f => selectedPaths.has(f));

  const handleRowClick = (file: string) => {
    const isDir = file.endsWith("/");
    if (isDir) {
      const dirPath = file.endsWith("/") ? file.slice(0, -1) : file;
      onNavigate(dirPath);
      return;
    }
    onSelectFile(file);
  };

  if (listing.isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-secondary z-10">
          <tr className="text-2xs text-muted font-semibold border-b border-primary">
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
            <th className="px-2 py-2 font-medium w-16 hidden sm:table-cell text-right pr-4">Actions</th>
          </tr>
        </thead>
        <tbody className="text-xs">
          {sortedFiles.map(file => {
            const isDir = file.endsWith("/");
            const name = getBasename(file);
            const isSelectedFile = selectedFile === file;
            const isChecked = selectedPaths.has(file);
            const isUploading = uploadingFiles.includes(name);

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
                  <div className="flex items-center gap-2">
                    {getFileIcon(file, isDir)}
                    <span className={cn("font-medium truncate", isSelectedFile ? "text-accent-soft" : "text-primary", isUploading && "text-accent-soft")}>
                      {name}
                    </span>
                    {isUploading && <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />}
                  </div>
                </td>

                <td className="px-2 py-2.5 text-muted hidden md:table-cell">{isDir ? "folder" : name.includes(".") ? name.split(".").pop() : "—"}</td>

                <td className="px-2 py-2.5 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                    {!isDir && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const result = await filesystemRPCClient.readTextFile({ path: file, provider: provider! });
                            const blob = new Blob([result.content ?? ""], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = name;
                            a.click();
                            URL.revokeObjectURL(url);
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
                  </div>
                </td>
              </tr>
            );
          })}

          {sortedFiles.length === 0 && (
            <tr>
              <td colSpan={4} className="py-16 text-center text-muted text-sm">
                {searchQuery ? `No files matching "${searchQuery}"` : "This directory is empty."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
