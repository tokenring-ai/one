import type { VideoIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { Video as VideoIcon } from "lucide-react";
import { useState } from "react";
import { useMediaFileUrl } from "../../useMediaPaths.ts";
import { formatDuration } from "../../utils.ts";

export default function VideoThumbnail({ video, selected, onClick }: { video: VideoIndexEntry; selected: boolean; onClick: () => void }) {
  const [error, setError] = useState(false);
  const src = useMediaFileUrl(video.filename);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg overflow-hidden border-2 transition-all focus:outline-none cursor-pointer group aspect-square bg-tertiary ${
        selected ? "border-accent shadow-accent" : "border-transparent hover:border-white/20"
      }`}
    >
      {!error ? (
        <video src={src} className="w-full h-full object-cover" muted preload="metadata" playsInline onError={() => setError(true)} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
          <VideoIcon className="w-5 h-5 text-muted opacity-40" />
          <span className="text-xs text-muted truncate max-w-full px-1">{video.filename}</span>
        </div>
      )}
      {!error && (
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors pointer-events-none flex items-center justify-center">
          <VideoIcon className="w-6 h-6 text-white/80 drop-shadow-md" />
        </div>
      )}
      {!error && video.duration !== undefined && (
        <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 text-white text-xs rounded font-mono">{formatDuration(video.duration)}</span>
      )}
      {selected && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-soft shadow-sm" />}
    </button>
  );
}
