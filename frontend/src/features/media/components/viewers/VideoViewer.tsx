import type { VideoIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { Download, Loader2, Sparkles } from "lucide-react";
import { toastManager } from "../../../../components/ui/toast.tsx";
import { downloadMedia, formatDuration, mediaUrl } from "../../utils.ts";
import ActionButton from "./ActionButton.tsx";
import ViewerHeader from "./ViewerHeader.tsx";

export default function VideoViewer({
  video,
  workingOn,
  onWorkOnVideo,
  onClose,
}: {
  video: VideoIndexEntry;
  workingOn?: boolean | undefined;
  onWorkOnVideo: () => Promise<void>;
  onClose: () => void;
}) {
  const busy = workingOn ?? false;
  const subtitleParts: string[] = [];
  if (video.width && video.height) subtitleParts.push(`${video.width}×${video.height}`);
  if (video.duration !== undefined) subtitleParts.push(formatDuration(video.duration));

  const handleDownload = () => {
    try {
      downloadMedia(video.filename);
    } catch {
      toastManager.error("Download failed", { duration: 3000 });
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ViewerHeader
        title={video.filename}
        subtitle={subtitleParts.join(" · ")}
        keywords={video.keywords}
        onClose={onClose}
        actions={
          <>
            <ActionButton
              onClick={() => void onWorkOnVideo()}
              primary
              disabled={busy}
              icon={busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            >
              {busy ? "Opening..." : "Work on this video"}
            </ActionButton>
            <ActionButton onClick={handleDownload} icon={<Download className="w-3.5 h-3.5" />}>
              Download
            </ActionButton>
          </>
        }
      />
      <div className="flex-1 overflow-hidden flex flex-col items-center justify-center p-4 bg-primary gap-4">
        <video src={mediaUrl(video.filename)} className="max-w-full max-h-full rounded-xl shadow-lg" controls playsInline />
        {video.prompt && (
          <div className="w-full max-w-2xl">
            <p className="text-2xs font-medium text-muted uppercase tracking-wide mb-1">Prompt</p>
            <p className="text-sm text-secondary italic">{video.prompt}</p>
          </div>
        )}
      </div>
    </div>
  );
}
