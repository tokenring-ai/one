import { triggerDownloadFromUrl } from "../../lib/triggerDownloadFromUrl.ts";
import { workspaceFileUrl } from "../../lib/workspaceFileUrl.ts";
import { getBasename } from "./fsUtils.ts";

/**
 * Download a workspace file via the filesystem HTTP endpoint.
 */
export async function downloadWorkspaceFile(path: string, provider: string): Promise<void> {
  const name = getBasename(path);
  await triggerDownloadFromUrl({
    url: workspaceFileUrl(provider, path, { download: true }),
    filename: name,
  });
}
