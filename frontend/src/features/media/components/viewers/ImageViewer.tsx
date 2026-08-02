import type { ImageIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { Download, ImageIcon, Loader2, Sparkles, X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { toastManager } from "../../../../components/ui/toast.tsx";
import { aspectLabel, downloadMedia, mediaUrl } from "../../utils.ts";
import ActionButton from "./ActionButton.tsx";
import ViewerHeader from "./ViewerHeader.tsx";

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
  const [lightbox, setLightbox] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const busy = workingOn ?? false;

  useEffect(() => {
    setLightbox(false);
    setLoadError(false);
  }, [image.filename]);

  // Escape must be handled on document — the lightbox backdrop is not focused.
  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  const handleDownload = () => {
    void downloadMedia(image.filename).catch(() => {
      toastManager.error("Download failed", { duration: 3000 });
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {lightbox && !loadError && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Full size image"
        >
          <img
            src={mediaUrl(image.filename)}
            alt={image.keywords.join(", ") || image.filename}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close full size"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <ViewerHeader
        title={image.filename}
        subtitle={`${image.width}×${image.height} · ${aspectLabel(image.width, image.height)}`}
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
            <ActionButton onClick={() => setLightbox(true)} disabled={loadError} icon={<ZoomIn className="w-3.5 h-3.5" />}>
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
            <p className="text-2xs text-muted opacity-70 font-mono break-all">{image.filename}</p>
          </div>
        ) : (
          <img
            key={image.filename}
            src={mediaUrl(image.filename)}
            alt={image.keywords.join(", ") || image.filename}
            className="max-w-full max-h-full object-contain rounded-xl shadow-lg cursor-zoom-in"
            onClick={() => setLightbox(true)}
            onError={() => setLoadError(true)}
          />
        )}
      </div>
    </div>
  );
}
