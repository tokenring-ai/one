import type { AudioIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { Music } from "lucide-react";
import { formatDuration } from "../../utils.ts";

export default function AudioThumbnail({ audio, selected, onClick }: { audio: AudioIndexEntry; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg overflow-hidden border-2 transition-all focus:outline-none cursor-pointer group aspect-square ${
        selected ? "border-accent shadow-accent bg-accent-subtle" : "border-transparent hover:border-white/20 bg-tertiary"
      }`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
        <Music className={`w-7 h-7 ${selected ? "text-accent-soft" : "text-muted opacity-60"}`} />
        <span className="text-2xs text-muted truncate max-w-full px-1 font-mono">{audio.filename}</span>
        {audio.duration !== undefined && <span className="text-2xs text-muted opacity-70">{formatDuration(audio.duration)}</span>}
      </div>
      {selected && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-soft shadow-sm" />}
    </button>
  );
}
