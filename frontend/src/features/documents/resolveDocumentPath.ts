import { filesystemRPCClient } from "../../rpc.ts";

/**
 * Path `writeFile` will actually write.
 *
 * That RPC resolves a relative path against the workspace directory.
 * `appendFile` and `readTextFile` pass the path through (process cwd), so a
 * relative path saved here and later appended would be two different files.
 * An absolute workspace is prefixed on the client. A relative workspace is
 * left alone: prefixing it would make `writeFile` resolve the path twice.
 */
export async function resolveDocumentPath(filePath: string): Promise<string> {
  if (filePath.startsWith("/")) return filePath;
  const directories = await filesystemRPCClient.getDefaultDirectories({});
  const workspace = directories.workspaceDirectory.replace(/\/+$/, "");
  if (!workspace.startsWith("/")) return filePath;
  return `${workspace}/${filePath}`;
}
