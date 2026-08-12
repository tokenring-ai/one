/**
 * Build an HTTP URL for a workspace file served by the filesystem plugin.
 *
 * ```
 * /api/fs/{provider}/{path...}
 * ```
 */
export type WorkspaceFileUrlOptions = {
  /** When true, appends `?download=1` so the server sets Content-Disposition: attachment. */
  download?: boolean;
};

/** Encode each path segment so slashes remain path separators. */
export function encodeWorkspacePath(filePath: string): string {
  return filePath
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");
}

/**
 * @param provider Filesystem provider name (e.g. `posix`)
 * @param filePath Path as used by filesystem RPC for that provider
 */
export function workspaceFileUrl(provider: string, filePath: string, options: WorkspaceFileUrlOptions = {}): string {
  const clean = filePath.replace(/^\/+/, "");
  const base = `/api/fs/${encodeURIComponent(provider)}/${encodeWorkspacePath(clean)}`;
  return options.download ? `${base}?download=1` : base;
}
