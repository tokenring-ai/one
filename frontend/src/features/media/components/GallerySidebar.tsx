import type { AudioIndexEntry, ImageIndexEntry, VideoIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { FileMusic, ImageIcon, Loader2, RefreshCw, Search, Video as VideoIcon, X } from "lucide-react";
import type { MediaEntry, MediaKind } from "../types.ts";
import AudioThumbnail from "./thumbnails/AudioThumbnail.tsx";
import ImageThumbnail from "./thumbnails/ImageThumbnail.tsx";
import VideoThumbnail from "./thumbnails/VideoThumbnail.tsx";

export default function GallerySidebar({
  kind,
  search,
  loading,
  selectedFilename,
  images,
  videos,
  audios,
  onSearch,
  onSelect,
  onRefresh,
}: {
  kind: MediaKind;
  search: string;
  loading: boolean;
  selectedFilename: string | null;
  images: ImageIndexEntry[];
  videos: VideoIndexEntry[];
  audios: AudioIndexEntry[];
  onSearch: (q: string) => void;
  onSelect: (entry: MediaEntry) => void;
  onRefresh: () => void;
}) {
  const entries: MediaEntry[] = kind === "image" ? images : kind === "video" ? videos : audios;
  const EmptyIcon = kind === "image" ? ImageIcon : kind === "video" ? VideoIcon : FileMusic;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 px-3 py-2 border-b border-primary">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={`Search ${kind}s...`}
            className="w-full bg-input border border-primary rounded-lg py-1.5 pl-8 pr-3 text-xs text-primary placeholder-muted focus-accent transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && entries.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
            <EmptyIcon className="w-8 h-8 text-muted opacity-30" />
            <p className="text-sm text-muted">{search ? `No ${kind}s matching "${search}"` : `No ${kind}s yet`}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {kind === "image" &&
              images.map(img => <ImageThumbnail key={img.filename} image={img} selected={selectedFilename === img.filename} onClick={() => onSelect(img)} />)}
            {kind === "video" &&
              videos.map(v => <VideoThumbnail key={v.filename} video={v} selected={selectedFilename === v.filename} onClick={() => onSelect(v)} />)}
            {kind === "audio" &&
              audios.map(a => <AudioThumbnail key={a.filename} audio={a} selected={selectedFilename === a.filename} onClick={() => onSelect(a)} />)}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-primary px-3 py-2 flex items-center justify-between">
        <span className="text-2xs text-muted">
          {entries.length} {kind}
          {entries.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="p-1 text-muted hover:text-primary transition-colors cursor-pointer rounded focus-ring"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
