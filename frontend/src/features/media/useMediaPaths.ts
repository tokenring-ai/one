import { useMediaLibraryConfiguration } from "../../rpc.ts";
import { DEFAULT_MEDIA_SERVE_DIRECTORY, type MediaUrlOptions, mediaUrl } from "./utils.ts";

/** Working-directory-relative media directory for `/api/fs` URLs. */
export function useMediaServeDirectory(): string {
  const { data } = useMediaLibraryConfiguration();
  return data?.serveDirectory ?? DEFAULT_MEDIA_SERVE_DIRECTORY;
}

/** HTTP URL for a media library file using the configured serve directory. */
export function useMediaFileUrl(filename: string, options: Omit<MediaUrlOptions, "directory"> = {}): string {
  const directory = useMediaServeDirectory();
  return mediaUrl(filename, { ...options, directory });
}
