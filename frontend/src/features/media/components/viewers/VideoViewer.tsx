import type { VideoIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { Sparkles } from "lucide-react";
import { formatDuration, mediaUrl } from "../../utils.ts";
import ActionButton from "./ActionButton.tsx";
import ViewerHeader from "./ViewerHeader.tsx";

export default function VideoViewer({ video, onWorkOnVideo, onClose }: { video: VideoIndexEntry; onWorkOnVideo: () => Promise<void>; onClose: () => void }) {
  const subtitleParts: string[] = [];
  if (video.width && video.height) subtitleParts.push(`${video.width}×${video.height}`);
  if (video.duration !== undefined) subtitleParts.push(formatDuration(video.duration));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ViewerHeader
        title={video.filename}
        subtitle={subtitleParts.join(" · ")}
        keywords={video.keywords}
        onClose={onClose}
        actions={
          <ActionButton onClick={() => void onWorkOnVideo()} primary icon={<Sparkles className="w-3.5 h-3.5" />}>
            Work on this video
          </ActionButton>
        }
      />
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-primary">
        <video src={mediaUrl(video.filename)} className="max-w-full max-h-full rounded-xl shadow-lg" controls playsInline />
      </div>
    </div>
  );
}
