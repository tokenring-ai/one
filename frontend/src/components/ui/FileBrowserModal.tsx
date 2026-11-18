import formatError from "@tokenring-ai/utility/error/formatError";
import { File, FileText, Folder, FolderOpen, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils.ts";
import { filesystemRPCClient } from "../../rpc.ts";
import BreadcrumbBar, { type BreadcrumbSegment } from "./BreadcrumbBar.tsx";
import ModalShell from "./ModalShell.tsx";
import SearchInput from "./SearchInput.tsx";

export interface FileBrowserModalProps {
  /** File extension filter (e.g., ".md") — null to show all files */
  extensionFilter?: string | null;
  /** Called when the user confirms a file selection */
  onOpen: (path: string, content: string) => void;
  /** Called when the modal is dismissed */
  onClose: () => void;
  /** Dialog title (default: "Open File") */
  title?: string;
  /** Search placeholder text (default: "Search files…") */
  searchPlaceholder?: string;
  /** Empty state message (default: "No files here") */
  emptyMessage?: string;
  /** Label on the confirm button (default: "Open") */
  openLabel?: string;
  /** Whether to trap focus inside the dialog (default: true) */
  focusTrap?: boolean;
}

function basename(p: string): string {
  const clean = p.endsWith("/") ? p.slice(0, -1) : p;
  return clean.split("/").pop() || p;
}

interface DefaultDirectories {
  workingDirectory: string;
  workspaceDirectory: string;
}

/**
 * Where browsing starts. `writeFile` resolves a relative path against the
 * workspace directory, but `listDirectory` / `readTextFile` pass the path
 * through (process cwd), so never start at `"."`.
 */
function browseRoot(directories: DefaultDirectories): string | null {
  const workspace = directories.workspaceDirectory.replace(/\/+$/, "");
  if (!workspace || workspace === ".") return null;
  return workspace;
}

/** Keep an absolute listing entry; otherwise join it onto `dir` so it cannot be resolved against a different directory later. */
function resolveAgainst(dir: string, entry: string): string {
  if (entry.startsWith("/")) return entry;
  if (!dir || dir === ".") return entry;
  const base = dir.replace(/\/+$/, "");
  if (entry === base || entry.startsWith(`${base}/`)) return entry;
  return `${base}/${entry}`;
}

function segmentsUnder(root: string, path: string): BreadcrumbSegment[] {
  if (path === root) return [];
  const base = root.replace(/\/+$/, "");
  const relative = root === "." ? path : path.startsWith(`${base}/`) ? path.slice(base.length + 1) : null;
  if (!relative || relative === ".") return [];
  const parts = relative.split("/").filter(Boolean);
  return parts.map((part, index) => {
    const rel = parts.slice(0, index + 1).join("/");
    return { label: part, value: root === "." ? rel : `${base}/${rel}` };
  });
}

function matchesExtension(path: string, extensionFilter: string | null | undefined): boolean {
  if (!extensionFilter) return true;
  const ext = extensionFilter.startsWith(".") ? extensionFilter : `.${extensionFilter}`;
  return path.toLowerCase().endsWith(ext.toLowerCase());
}

/**
 * Modal dialog for browsing and selecting host files.
 * Supports breadcrumb navigation, debounced workspace search,
 * and optional extension filtering.
 */
export default function FileBrowserModal({
  extensionFilter = null,
  onOpen,
  onClose,
  title = "Open File",
  searchPlaceholder = "Search files…",
  emptyMessage = "No files here",
  openLabel = "Open",
  focusTrap = true,
}: FileBrowserModalProps) {
  const [path, setPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<DefaultDirectories | null>(null);
  const [directoriesError, setDirectoriesError] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGen = useRef(0);
  const dirGen = useRef(0);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const dirs = await filesystemRPCClient.getDefaultDirectories({});
        if (!controller.signal.aborted) setDirectories(dirs);
      } catch (error: unknown) {
        if (!controller.signal.aborted) setDirectoriesError(formatError(error));
      }
    })();
    return () => controller.abort();
  }, []);

  const loadDirectory = useCallback(async (dir: string) => {
    const gen = ++dirGen.current;
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const result = await filesystemRPCClient.listDirectory({
        path: dir,
        showHidden: false,
        recursive: false,
      });
      if (gen !== dirGen.current) return;
      setFiles(result.files);
      setPath(dir);
    } catch (e: unknown) {
      if (gen !== dirGen.current) return;
      setError(formatError(e));
      setFiles([]);
    } finally {
      if (gen === dirGen.current) setLoading(false);
    }
  }, []);

  const root = directories ? browseRoot(directories) : null;
  const rootError = directoriesError ?? (directories && !root ? "Workspace directory is unavailable" : null);
  const waitingForRoot = !directories && !directoriesError;

  useEffect(() => {
    if (!directories) return;
    const nextRoot = browseRoot(directories);
    if (!nextRoot) return;
    void loadDirectory(nextRoot);
  }, [directories, loadDirectory]);

  // Debounced workspace search (ignore stale responses)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (!q) {
      searchGen.current += 1;
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const gen = ++searchGen.current;
    searchTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const result = await filesystemRPCClient.searchWorkspaceFiles({
            query: q,
            limit: 80,
          });
          if (gen !== searchGen.current) return;
          setSearchResults(result.files.filter(f => matchesExtension(f, extensionFilter)));
        } catch (e: unknown) {
          if (gen !== searchGen.current) return;
          setError(formatError(e));
          setSearchResults([]);
        } finally {
          if (gen === searchGen.current) setSearching(false);
        }
      })();
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, extensionFilter]);

  const listing = useMemo(() => {
    const items = [...files];
    items.sort((a, b) => {
      const dA = a.endsWith("/");
      const dB = b.endsWith("/");
      if (dA && !dB) return -1;
      if (!dA && dB) return 1;
      return a.localeCompare(b);
    });
    return items.filter(f => f.endsWith("/") || matchesExtension(f, extensionFilter));
  }, [files, extensionFilter]);

  const displayItems = searchResults ?? listing;
  const isSearchMode = searchResults !== null;

  const handleOpen = async (filePath: string) => {
    if (filePath.endsWith("/")) return;
    // Search hits are workspace-relative (or already absolute). Directory entries are relative to the folder being listed.
    const anchor = isSearchMode ? (root && root !== "." ? root : (path ?? ".")) : (path ?? root ?? ".");
    const resolved = resolveAgainst(anchor, filePath);
    setOpening(true);
    setError(null);
    try {
      const result = await filesystemRPCClient.readTextFile({ path: resolved });
      onOpen(resolved, result.content ?? "");
    } catch (e: unknown) {
      setError(formatError(e));
    } finally {
      setOpening(false);
    }
  };

  const breadcrumbSegments: BreadcrumbSegment[] = useMemo(() => {
    if (!root || !path) return [];
    return segmentsUnder(root, path);
  }, [root, path]);

  const navigateTo = useCallback(
    (value: string) => {
      void loadDirectory(value);
    },
    [loadDirectory],
  );

  const FileIcon = extensionFilter?.toLowerCase() === ".md" ? FileText : File;

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      busy={opening}
      focusTrap={focusTrap}
      padded={false}
      backdropClassName="p-4"
      width="w-full max-w-lg"
      className="flex flex-col max-h-[min(36rem,90vh)]"
      headerIcon={<FolderOpen className="w-4 h-4 text-lime-400 shrink-0" />}
      headerClassName="flex items-center justify-between px-5 py-4 border-b border-primary shrink-0"
      titleClassName="truncate"
      footerClassName="shrink-0 border-t border-primary px-5 py-3"
      confirmLabel={openLabel}
      confirmIcon={FileIcon}
      confirmDisabled={!selected}
      onConfirm={() => selected && void handleOpen(selected)}
    >
      <div className="px-5 py-3 space-y-3 border-b border-primary shrink-0">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          loading={searching}
          inputRef={searchRef}
          inputProps={{ disabled: opening }}
          className="w-full"
        />

        {!isSearchMode && root && path && (
          <BreadcrumbBar segments={breadcrumbSegments} rootValue={root} onNavigate={navigateTo} className="h-auto border-0 bg-transparent px-0" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
        {waitingForRoot || loading || searching ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">{searching ? "Searching…" : "Loading…"}</span>
          </div>
        ) : rootError ? (
          <p className="text-xs text-muted text-center py-8">Could not open this folder</p>
        ) : displayItems.length === 0 ? (
          <p className="text-xs text-muted text-center py-8">{isSearchMode ? "No matching files" : emptyMessage}</p>
        ) : (
          <ul className="space-y-0.5" aria-label="Files">
            {displayItems.map(item => {
              const isDir = item.endsWith("/");
              const clean = isDir ? item.slice(0, -1) : item;
              const name = basename(item);
              const isSelected = selected === clean || selected === item;
              return (
                <li key={item}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={opening}
                    onClick={() => {
                      if (isDir) {
                        void loadDirectory(resolveAgainst(path ?? root ?? ".", clean));
                        setQuery("");
                        setSearchResults(null);
                      } else {
                        setSelected(item);
                      }
                    }}
                    onDoubleClick={() => {
                      if (isDir) {
                        void loadDirectory(resolveAgainst(path ?? root ?? ".", clean));
                        setQuery("");
                        setSearchResults(null);
                      } else {
                        void handleOpen(item);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors focus-ring cursor-pointer",
                      isSelected ? "bg-accent/15 text-primary" : "text-secondary hover:bg-hover hover:text-primary",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    {isDir ? <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <FileIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                    <span className="truncate flex-1">{isSearchMode ? item : name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(rootError ?? error) && (
        <div className="px-5 py-2 border-t border-primary shrink-0">
          <p className="text-xs text-red-400" role="alert">
            {rootError ?? error}
          </p>
        </div>
      )}
    </ModalShell>
  );
}
