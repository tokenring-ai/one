import type { RemoteEntry, RemoteMount } from "@tokenring-ai/filesystem/remote/RemoteStore";
import formatError from "@tokenring-ai/utility/error/formatError";
import { ChevronRight, Cloud, File as FileIcon, Folder, Loader2 } from "lucide-react";
import { useState } from "react";
import { useDebounce } from "../../hooks/useDebounce.ts";
import { cn } from "../../lib/utils.ts";
import { useRemoteListing, useRemoteMounts, useRemoteSearch } from "../../rpc.ts";
import ModalShell from "../ui/ModalShell.tsx";
import SearchInput from "../ui/SearchInput.tsx";

type Crumb = { url: string; name: string };

export interface RemoteFilePickerProps {
  onClose: () => void;
  /** Called with the chosen file; the picker closes itself afterwards. */
  onPick: (entry: RemoteEntry) => void;
}

/** "Add from Google Drive" (or any remote store): browse or search a mount and pick one file. */
export default function RemoteFilePicker({ onClose, onPick }: RemoteFilePickerProps) {
  const mounts = useRemoteMounts().data?.mounts ?? [];
  const [mountUrl, setMountUrl] = useState<string | null>(null);
  const mount: RemoteMount | undefined = mounts.find(candidate => candidate.url === mountUrl) ?? mounts[0];
  const [trail, setTrail] = useState<Crumb[]>([]);
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);

  const folderUrl = trail.at(-1)?.url ?? mount?.url ?? null;
  const searching = debounced.trim() !== "";
  const listing = useRemoteListing(searching ? null : folderUrl);
  const search = useRemoteSearch(debounced, mount?.url ?? null);
  const active = searching ? search : listing;
  const entries = active.data?.entries ?? [];
  const loading = !active.data && !active.error;

  const switchMount = (url: string) => {
    setMountUrl(url);
    setTrail([]);
  };

  const choose = (entry: RemoteEntry) => {
    if (entry.kind === "folder") {
      setTrail(previous => [...previous, { url: entry.url, name: entry.name }]);
      setQuery("");
      return;
    }
    onPick(entry);
    onClose();
  };

  return (
    <ModalShell
      title={mount ? `Attach from ${mount.label}` : "Attach from cloud storage"}
      onClose={onClose}
      padded={false}
      backdropClassName="p-4"
      width="w-full max-w-lg"
      className="flex flex-col max-h-[min(36rem,90vh)]"
      headerIcon={<Cloud className="w-4 h-4 text-sky-500 shrink-0" />}
      headerClassName="flex items-center justify-between px-5 py-4 border-b border-primary shrink-0"
      titleClassName="truncate"
    >
      <div className="px-5 py-3 space-y-3 border-b border-primary shrink-0">
        {mounts.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-muted">
            Store
            <select
              className="flex-1 rounded-md border border-control bg-transparent px-2 py-1 text-xs text-primary focus-ring"
              value={mount?.url ?? ""}
              onChange={event => switchMount(event.target.value)}
            >
              {mounts.map(candidate => (
                <option key={candidate.url} value={candidate.url}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search names and contents"
          aria-label="Search remote files"
          loading={searching && loading}
          className="w-full"
        />
        {!searching && mount && (
          <nav aria-label="Folder" className="flex flex-wrap items-center gap-1 text-xs text-muted">
            <button type="button" className="hover:text-primary focus-ring rounded" onClick={() => setTrail([])}>
              {mount.label}
            </button>
            {trail.map((crumb, index) => (
              <span key={crumb.url} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3" aria-hidden="true" />
                <button type="button" className="hover:text-primary focus-ring rounded" onClick={() => setTrail(trail.slice(0, index + 1))}>
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
        {!mount ? (
          <p className="text-xs text-muted text-center py-8">No remote stores are configured.</p>
        ) : active.error ? (
          <p className="text-xs text-error text-center py-8">{formatError(active.error)}</p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">{searching ? "Searching…" : "Loading…"}</span>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted text-center py-8">{searching ? "No matching files" : "This folder is empty"}</p>
        ) : (
          <ul className="space-y-0.5" aria-label="Remote files">
            {entries.map(entry => (
              <li key={entry.url}>
                <button
                  type="button"
                  onClick={() => choose(entry)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors focus-ring cursor-pointer",
                    "text-secondary hover:bg-hover hover:text-primary",
                  )}
                >
                  {entry.kind === "folder" ? (
                    <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                  ) : (
                    <FileIcon className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate flex-1">{entry.name}</span>
                  {entry.readsAs && <span className="text-muted shrink-0">as {entry.readsAs}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!searching && listing.data?.cursor && <p className="text-xs text-muted text-center py-2">More items in this folder; search to find them.</p>}
      </div>
    </ModalShell>
  );
}
