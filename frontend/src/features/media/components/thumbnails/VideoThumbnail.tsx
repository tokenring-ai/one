import type { VideoIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { Video as VideoIcon } from "lucide-react";
import { formatDuration, mediaUrl } from "../../utils.ts";

export default function VideoThumbnail({ video, selected, onClick }: { video: VideoIndexEntry; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg overflow-hidden border-2 transition-all focus:outline-none cursor-pointer group aspect-square bg-tertiary ${
        selected ? "border-accent shadow-accent" : "border-transparent hover:border-white/20"
      }`}
    >
      <video src={mediaUrl(video.filename)} className="w-full h-full object-cover" muted preload="metadata" playsInline />
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors pointer-events-none flex items-center justify-center">
        <VideoIcon className="w-6 h-6 text-white/80 drop-shadow-md" />
      </div>
      {video.duration !== undefined && (
        <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 text-white text-2xs rounded font-mono">{formatDuration(video.duration)}</span>
      )}
      {selected && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-soft shadow-sm" />}
    </button>
  );
}
