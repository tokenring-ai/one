import type { VideoIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { Download, Loader2, Sparkles, Video as VideoIcon, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import Lightbox from "../../../../components/ui/Lightbox.tsx";
import { toastManager } from "../../../../components/ui/toast.tsx";
import ViewerHeader from "../../../../components/ui/ViewerHeader.tsx";
import { useLightbox } from "../../../../hooks/useLightbox.ts";
import { useMediaFileUrl, useMediaServeDirectory } from "../../useMediaPaths.ts";
import { downloadMedia, formatDuration } from "../../utils.ts";
import ActionButton from "./ActionButton.tsx";

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
  const { isOpen: lightbox, open: openLightbox, close: closeLightbox } = useLightbox({ itemKey: video.filename });
  const [loadError, setLoadError] = useState(false);
  const busy = workingOn ?? false;
  const src = useMediaFileUrl(video.filename);
  const serveDirectory = useMediaServeDirectory();

  useEffect(() => {
    setLoadError(false);
  }, [video.filename]);

  const subtitleParts: string[] = [];
  if (video.width && video.height) subtitleParts.push(`${video.width}×${video.height}`);
  if (video.duration !== undefined) subtitleParts.push(formatDuration(video.duration));

  const handleDownload = () => {
    void downloadMedia(video.filename, { directory: serveDirectory }).catch(() => {
      toastManager.error("Download failed", { duration: 3000 });
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Lightbox open={lightbox && !loadError} src={src} type="video" onClose={closeLightbox} onError={() => setLoadError(true)} ariaLabel="Full size video" />

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
            <ActionButton onClick={openLightbox} disabled={loadError} icon={<ZoomIn className="w-3.5 h-3.5" />}>
              Full size
            </ActionButton>
            <ActionButton onClick={handleDownload} icon={<Download className="w-3.5 h-3.5" />}>
              Download
            </ActionButton>
          </>
        }
      />
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center justify-center p-4 bg-primary gap-4">
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          {loadError ? (
            <div className="flex flex-col items-center gap-2 text-center px-4">
              <VideoIcon className="w-10 h-10 text-muted opacity-40" />
              <p className="text-sm text-muted">Failed to load video</p>
              <p className="text-xs text-muted opacity-70 font-mono break-all">{video.filename}</p>
            </div>
          ) : (
            <video
              key={video.filename}
              src={src}
              className="max-w-full max-h-full rounded-xl shadow-lg cursor-zoom-in"
              controls
              playsInline
              onDoubleClick={openLightbox}
              onError={() => setLoadError(true)}
            >
              <track kind="captions" />
            </video>
          )}
        </div>
        {video.prompt && (
          <div className="w-full max-w-2xl shrink-0">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Prompt</p>
            <p className="text-sm text-secondary italic line-clamp-4">{video.prompt}</p>
          </div>
        )}
      </div>
    </div>
  );
}
