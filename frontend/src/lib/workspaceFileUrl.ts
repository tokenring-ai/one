/**
 * Build an HTTP URL for a workspace file served by the filesystem plugin.
 *
 * ```
 * /api/fs/{workspace-relative path...}
 * /api/fs//{absolute host path...}
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

/** @param filePath An absolute host path, or one relative to the workspace directory. */
export function workspaceFileUrl(filePath: string, options: WorkspaceFileUrlOptions = {}): string {
  // A leading slash is preserved (as a doubled slash after the prefix) so the server
  // can tell an absolute path from a workspace-relative one. See FileSystemHttpResource.
  const base = `/api/fs/${encodeWorkspacePath(filePath)}`;
  return options.download ? `${base}?download=1` : base;
}
