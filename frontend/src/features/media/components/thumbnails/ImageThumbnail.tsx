import type { ImageIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import { ImageIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { mediaUrl } from "../../utils.ts";

export default function ImageThumbnail({ image, selected, onClick }: { image: ImageIndexEntry; selected: boolean; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg overflow-hidden border-2 transition-all focus:outline-none cursor-pointer group aspect-square bg-tertiary ${
        selected ? "border-accent shadow-accent" : "border-transparent hover:border-white/20"
      }`}
    >
      {!error ? (
        <>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-muted animate-spin" />
            </div>
          )}
          <img
            src={mediaUrl(image.filename)}
            alt={image.keywords.join(", ") || image.filename}
            className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
          <ImageIcon className="w-5 h-5 text-muted opacity-40" />
          <span className="text-2xs text-muted truncate max-w-full px-1">{image.filename}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
      {selected && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-soft shadow-sm" />}
    </button>
  );
}
