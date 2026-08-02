import formatError from "@tokenring-ai/utility/error/formatError";
import { ChevronRight, FileText, Folder, FolderOpen, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../../lib/utils.ts";
import { filesystemRPCClient } from "../../../rpc.ts";

export interface OpenDocumentModalProps {
  providers: string[];
  initialProvider?: string | null;
  onOpen: (path: string, content: string, provider: string) => void;
  onClose: () => void;
}

function basename(p: string): string {
  const clean = p.endsWith("/") ? p.slice(0, -1) : p;
  return clean.split("/").pop() || p;
}

function isMarkdown(path: string): boolean {
  return /\.md$/i.test(path);
}

export default function OpenDocumentModal({ providers, initialProvider, onOpen, onClose }: OpenDocumentModalProps) {
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

  useEffect(() => {
    if (!provider && providers[0]) setProvider(providers[0]);
  }, [providers, provider]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Escape closes the modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !opening) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, opening]);

  const loadDirectory = useCallback(async (dir: string, prov: string) => {
    if (!prov) return;
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
      setFiles(result.files);
      setPath(dir);
    } catch (e: unknown) {
      setError(formatError(e));
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (provider) void loadDirectory(".", provider);
  }, [provider, loadDirectory]);

  // Debounced workspace search for markdown files (ignore stale responses)
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
          setSearchResults(result.files.filter(isMarkdown));
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
  }, [query, provider]);

  const listing = useMemo(() => {
    const items = [...files];
    items.sort((a, b) => {
      const dA = a.endsWith("/"),
        dB = b.endsWith("/");
      if (dA && !dB) return -1;
      if (!dA && dB) return 1;
      return a.localeCompare(b);
    });
    // Show directories + markdown files only
    return items.filter(f => f.endsWith("/") || isMarkdown(f));
  }, [files]);

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
      setOpening(false);
    }
  };

  const parts = path === "." ? [] : path.split("/");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-doc-title"
        className="bg-secondary border border-primary rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[min(36rem,90vh)]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="w-4 h-4 text-lime-400 shrink-0" />
            <h2 id="open-doc-title" className="text-sm font-semibold text-primary truncate">
              Open Document
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary focus-ring rounded" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 space-y-3 border-b border-primary shrink-0">
          {providers.length > 1 && (
            <div className="space-y-1">
              <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Location</label>
              <select
                value={provider}
                onChange={e => {
                  setProvider(e.target.value);
                  setQuery("");
                  setSearchResults(null);
                }}
                className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-ring"
              >
                {providers.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search markdown files…"
              className="w-full bg-input border border-primary rounded-lg pl-8 pr-3 py-2 text-xs text-primary placeholder-muted focus-accent"
              aria-label="Search markdown files"
            />
          </div>

          {!isSearchMode && (
            <div className="flex items-center gap-0.5 text-xs text-muted min-w-0 overflow-hidden">
              <button
                type="button"
                onClick={() => void loadDirectory(".", provider)}
                className="hover:text-primary shrink-0 focus-ring rounded px-1 cursor-pointer"
              >
                root
              </button>
              {parts.map((part, i) => (
                <span key={`${part}-${i}`} className="flex items-center gap-0.5 min-w-0">
                  <ChevronRight className="w-3 h-3 shrink-0 text-dim" />
                  <button
                    type="button"
                    onClick={() => void loadDirectory(parts.slice(0, i + 1).join("/"), provider)}
                    className={cn("hover:text-primary truncate focus-ring rounded px-1 cursor-pointer", i === parts.length - 1 && "text-primary font-medium")}
                  >
                    {part}
                  </button>
                </span>
              ))}
            </div>
          )}
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
            <p className="text-xs text-muted text-center py-8">{isSearchMode ? "No matching markdown files" : "No markdown files or folders here"}</p>
          ) : (
            <ul className="space-y-0.5" aria-label="Documents">
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
                        if (!isDir) void handleOpen(item);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors focus-ring cursor-pointer",
                        isSelected ? "bg-accent/15 text-primary" : "text-secondary hover:bg-hover hover:text-primary",
                      )}
                    >
                      {isDir ? <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
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
            <p className="text-2xs text-red-400" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="flex gap-2 px-5 py-3 border-t border-primary shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selected && void handleOpen(selected)}
            disabled={!selected || opening || !provider}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {opening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
