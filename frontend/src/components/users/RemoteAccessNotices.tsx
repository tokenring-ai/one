import { AlertTriangle } from "lucide-react";
import { OPERATIONS_HTTPS_URL, REMOTE_ACCESS_GUIDE_URL } from "./constants.ts";

export interface RemoteAccessFacts {
  isLoopback: boolean;
  isHttps: boolean;
  /** Backend wording for everything that is wrong with the address, when the caller may ask for it. */
  warnings?: readonly string[];
}

const linkClass = "underline underline-offset-2 hover:text-primary focus-ring rounded-sm";

/**
 * The two ways an access link can fail its owner, shown BEFORE a link is made: it points at localhost (a phone cannot
 * open it) or at plain http (anyone on the network can read it). Nothing is disabled; the risk is stated plainly.
 * Administrators pass the server's own answer; members cannot ask for it, so the page's own address stands in.
 */
export default function RemoteAccessNotices({ facts }: { facts: RemoteAccessFacts }) {
  const notices: Array<{ key: string; body: React.ReactNode }> = [];
  if (facts.isLoopback) {
    notices.push({
      key: "loopback",
      body: (
        <>
          These links only work on this computer (localhost). A phone cannot open them. Open TokenRing from this computer's network address, or set a public URL
          (
          <a href={REMOTE_ACCESS_GUIDE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            see the guide
          </a>
          ).
        </>
      ),
    });
  }
  if (!facts.isHttps && !facts.isLoopback) {
    notices.push({
      key: "http",
      body: (
        <>
          This connection is not encrypted. Anyone on your network could read the link. Use https (
          <a href={OPERATIONS_HTTPS_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            see the operations guide
          </a>
          ).
        </>
      ),
    });
  }
  // Other server warnings (for example "kept in memory only") that the two notices above do not already say.
  for (const [index, text] of (facts.warnings ?? []).entries()) {
    if (/only works on this computer|not encrypted/i.test(text)) continue;
    notices.push({ key: `server-${index}`, body: text });
  }
  if (notices.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Warnings about this address">
      {notices.map(notice => (
        <li key={notice.key} className="flex items-start gap-2 rounded-md border border-warning bg-warning-subtle px-3 py-2 text-sm text-primary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span className="min-w-0">{notice.body}</span>
        </li>
      ))}
    </ul>
  );
}
