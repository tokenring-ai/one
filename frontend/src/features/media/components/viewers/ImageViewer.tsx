import type { ImageIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { Download, ImageIcon, Loader2, Sparkles, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import Lightbox from "../../../../components/ui/Lightbox.tsx";
import { toastManager } from "../../../../components/ui/toast.tsx";
import ViewerHeader from "../../../../components/ui/ViewerHeader.tsx";
import { useLightbox } from "../../../../hooks/useLightbox.ts";
import { useMediaFileUrl, useMediaServeDirectory } from "../../useMediaPaths.ts";
import { aspectLabel, downloadMedia } from "../../utils.ts";
import ActionButton from "./ActionButton.tsx";

export default function ImageViewer({
  image,
  workingOn,
  onWorkOnImage,
  onClose,
}: {
  image: ImageIndexEntry;
  workingOn?: boolean | undefined;
  onWorkOnImage: () => Promise<void>;
  onClose: () => void;
}) {
  const { isOpen: lightbox, open: openLightbox, close: closeLightbox } = useLightbox({ itemKey: image.filename });
  const [loadError, setLoadError] = useState(false);
  const busy = workingOn ?? false;
  const src = useMediaFileUrl(image.filename);
  const serveDirectory = useMediaServeDirectory();

  useEffect(() => {
    setLoadError(false);
  }, [image.filename]);

  const handleDownload = () => {
    void downloadMedia(image.filename, { directory: serveDirectory }).catch(() => {
      toastManager.error("Download failed", { duration: 3000 });
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Lightbox
        open={lightbox && !loadError}
        src={src}
        alt={image.keywords.join(", ") || image.filename}
        onClose={closeLightbox}
        onError={() => setLoadError(true)}
        ariaLabel="Full size image"
      />

      <ViewerHeader
        title={image.filename}
        subtitle={
          image.width != null && image.height != null ? `${image.width}×${image.height} · ${aspectLabel(image.width, image.height)}` : "Dimensions unknown"
        }
        keywords={image.keywords}
        onClose={onClose}
        actions={
          <>
            <ActionButton
              onClick={() => void onWorkOnImage()}
              primary
              disabled={busy}
              icon={busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            >
              {busy ? "Opening..." : "Work on this image"}
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

      <div className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-primary">
        {loadError ? (
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <ImageIcon className="w-10 h-10 text-muted opacity-40" />
            <p className="text-sm text-muted">Failed to load image</p>
            <p className="text-xs text-muted opacity-70 font-mono break-all">{image.filename}</p>
          </div>
        ) : (
          <img
            key={image.filename}
            src={src}
            alt={image.keywords.join(", ") || image.filename}
            className="max-w-full max-h-full object-contain rounded-xl shadow-lg cursor-zoom-in"
            onClick={openLightbox}
            onError={() => setLoadError(true)}
          />
        )}
      </div>
    </div>
  );
}
