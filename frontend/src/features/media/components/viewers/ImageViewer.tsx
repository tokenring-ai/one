import type { ImageIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { Download, Loader2, Sparkles, X, ZoomIn } from "lucide-react";
import { useState } from "react";
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
  const busy = workingOn ?? false;

  const handleDownload = () => {
    try {
      downloadMedia(image.filename);
    } catch {
      toastManager.error("Download failed", { duration: 3000 });
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
          onKeyDown={e => {
            if (e.key === "Escape") setLightbox(false);
          }}
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
            <ActionButton onClick={() => setLightbox(true)} icon={<ZoomIn className="w-3.5 h-3.5" />}>
              Full size
            </ActionButton>
            <ActionButton onClick={handleDownload} icon={<Download className="w-3.5 h-3.5" />}>
              Download
            </ActionButton>
          </>
        }
      />

      <div className="flex-1 overflow-hidden flex items-center justify-center p-4 bg-primary">
        <img
          src={mediaUrl(image.filename)}
          alt={image.keywords.join(", ") || image.filename}
          className="max-w-full max-h-full object-contain rounded-xl shadow-lg cursor-zoom-in"
          onClick={() => setLightbox(true)}
        />
      </div>
    </div>
  );
}
