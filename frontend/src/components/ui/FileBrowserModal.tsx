import formatError from "@tokenring-ai/utility/error/formatError";
import { FocusTrap } from "focus-trap-react";
import { File, FileText, Folder, FolderOpen, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils.ts";
import { filesystemRPCClient } from "../../rpc.ts";
import BreadcrumbBar, { type BreadcrumbSegment } from "./BreadcrumbBar.tsx";
import SearchInput from "./SearchInput.tsx";

export interface FileBrowserModalProps {
  /** Available filesystem providers */
  providers: string[];
  /** Initially selected provider */
  initialProvider?: string | null;
  /** File extension filter (e.g., ".md") — null to show all files */
  extensionFilter?: string | null;
  /** Called when the user confirms a file selection */
  onOpen: (path: string, content: string, provider: string) => void;
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

function matchesExtension(path: string, extensionFilter: string | null | undefined): boolean {
  if (!extensionFilter) return true;
  const ext = extensionFilter.startsWith(".") ? extensionFilter : `.${extensionFilter}`;
  return path.toLowerCase().endsWith(ext.toLowerCase());
}

/**
 * Modal dialog for browsing and selecting files from a filesystem provider.
 * Supports provider switching, breadcrumb navigation, debounced workspace search,
 * and optional extension filtering.
 */
export default function FileBrowserModal({
  providers,
  initialProvider,
  extensionFilter = null,
  onOpen,
  onClose,
  title = "Open File",
  searchPlaceholder = "Search files…",
  emptyMessage = "No files here",
  openLabel = "Open",
  focusTrap = true,
}: FileBrowserModalProps) {
  const [provider, setProvider] = useState(initialProvider && providers.includes(initialProvider) ? initialProvider : (providers[0] ?? ""));
  const [path, setPath] = useState(".");
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
  const titleId = useId();

  useEffect(() => {
    if (!provider || !providers.includes(provider)) {
      setProvider(providers[0] ?? "");
    }
  }, [providers, provider]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !opening) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, opening]);

  const loadDirectory = useCallback(async (dir: string, prov: string) => {
    if (!prov) return;
    const gen = ++dirGen.current;
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const result = await filesystemRPCClient.listDirectory({
        path: dir,
        provider: prov,
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

  useEffect(() => {
    if (provider) void loadDirectory(".", provider);
  }, [provider, loadDirectory]);

  // Debounced workspace search (ignore stale responses)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (!q || !provider) {
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
            provider,
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
  }, [query, provider, extensionFilter]);

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
    if (!provider || filePath.endsWith("/")) return;
    setOpening(true);
    setError(null);
    try {
      const result = await filesystemRPCClient.readTextFile({ path: filePath, provider });
      onOpen(filePath, result.content ?? "", provider);
    } catch (e: unknown) {
      setError(formatError(e));
    } finally {
      setOpening(false);
    }
  };

  const breadcrumbSegments: BreadcrumbSegment[] = useMemo(() => {
    if (path === ".") return [];
    const parts = path.split("/");
    return parts.map((part, i) => ({
      label: part,
      value: parts.slice(0, i + 1).join("/"),
    }));
  }, [path]);

  const navigateTo = useCallback(
    (value: string) => {
      void loadDirectory(value, provider);
    },
    [loadDirectory, provider],
  );

  const FileIcon = extensionFilter?.toLowerCase() === ".md" ? FileText : File;

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-secondary border border-primary rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[min(36rem,90vh)]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="w-4 h-4 text-lime-400 shrink-0" />
            <h2 id={titleId} className="text-sm font-semibold text-primary truncate">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={opening}
            className="p-1 text-muted hover:text-primary focus-ring rounded disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 space-y-3 border-b border-primary shrink-0">
          {providers.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Location</label>
              <select
                value={provider}
                onChange={e => {
                  setProvider(e.target.value);
                  setQuery("");
                  setSearchResults(null);
                }}
                disabled={opening}
                className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-ring disabled:opacity-40"
              >
                {providers.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          {!isSearchMode && <BreadcrumbBar segments={breadcrumbSegments} onNavigate={navigateTo} className="h-auto border-0 bg-transparent px-0" />}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
          {!provider ? (
            <p className="text-xs text-muted text-center py-8">No filesystem providers available</p>
          ) : loading || searching ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">{searching ? "Searching…" : "Loading…"}</span>
            </div>
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
                          void loadDirectory(clean, provider);
                          setQuery("");
                          setSearchResults(null);
                        } else {
                          setSelected(item);
                        }
                      }}
                      onDoubleClick={() => {
                        if (isDir) {
                          void loadDirectory(clean, provider);
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

        {error && (
          <div className="px-5 py-2 border-t border-primary shrink-0">
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="flex gap-2 px-5 py-3 border-t border-primary shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={opening}
            className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selected && void handleOpen(selected)}
            disabled={!selected || opening || !provider}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {opening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileIcon className="w-3.5 h-3.5" />}
            {openLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (!focusTrap) return dialog;
  return <FocusTrap>{dialog}</FocusTrap>;
}
