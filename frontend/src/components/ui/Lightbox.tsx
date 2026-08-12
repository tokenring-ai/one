import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEventListener } from "../../hooks/useEventListener.ts";
import { cn } from "../../lib/utils.ts";
import { toastManager } from "./toast.tsx";

export type LightboxMediaType = "image" | "video";

export interface LightboxProps {
  /** Whether the lightbox is open */
  open: boolean;
  /** Media source URL */
  src: string;
  /** Alt text for images (ignored for video) */
  alt?: string;
  /** Close callback (backdrop click, close button, Escape, or media load error) */
  onClose: () => void;
  /**
   * Called when the media fails to load (after the default error toast, unless
   * `errorMessage` is false). The lightbox also calls `onClose`.
   */
  onError?: () => void;
  /**
   * Media kind. Defaults to `"image"`.
   * Video renders with native controls and plays inline.
   */
  type?: LightboxMediaType;
  /** Additional classes for the image or video element */
  mediaClassName?: string;
  /**
   * Alias for `mediaClassName` (image-centric name from the original design).
   * Prefer `mediaClassName` for new call sites.
   */
  imageClassName?: string;
  /** Accessibility label for the dialog */
  ariaLabel?: string;
  /**
   * Toast message on load failure. Defaults to a type-specific message.
   * Pass `false` to suppress the toast (caller can handle via `onError`).
   */
  errorMessage?: string | false;
}

const defaultErrorMessage: Record<LightboxMediaType, string> = {
  image: "Failed to load full-size image",
  video: "Failed to load full-size video",
};

/**
 * Fullscreen overlay for viewing an image or video at full size.
 * Closes on backdrop click, close button, Escape, or media load error.
 *
 * Pair with `useLightbox` for open state, item-key reset, and optional guards.
 *
 * @example
 * const { isOpen, open, close } = useLightbox({ itemKey: image.filename });
 * <Lightbox open={isOpen} src={url} alt="…" onClose={close} />
 *
 * @example video
 * <Lightbox open={isOpen} src={url} type="video" onClose={close} ariaLabel="Full size video" />
 */
export default function Lightbox({
  open,
  src,
  alt = "",
  onClose,
  onError,
  type = "image",
  mediaClassName,
  imageClassName,
  ariaLabel = type === "video" ? "Full size video" : "Full size image",
  errorMessage,
}: LightboxProps) {
  // Escape must be handled on document — the backdrop is not focused.
  // Safe to stack with useLightbox's Escape handler (both call onClose / set closed).
  useEventListener(
    "keydown",
    e => {
      if (e.key === "Escape") onClose();
    },
    { target: document, enabled: open },
  );

  if (!open) return null;

  const mediaClasses = cn("max-w-full max-h-full object-contain rounded-lg shadow-2xl", mediaClassName ?? imageClassName);

  const handleMediaError = () => {
    if (errorMessage !== false) {
      toastManager.error(errorMessage ?? defaultErrorMessage[type], { duration: 3000 });
    }
    onError?.();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      // Only the backdrop itself — not the media or close button — should dismiss
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {type === "video" ? (
        <video key={src} src={src} className={mediaClasses} controls playsInline autoPlay onError={handleMediaError}>
          <track kind="captions" />
        </video>
      ) : (
        <img key={src} src={src} alt={alt} className={mediaClasses} onError={handleMediaError} />
      )}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer focus-ring"
        aria-label="Close full size"
      >
        <X className="w-5 h-5" />
      </button>
    </div>,
    document.body,
  );
}
