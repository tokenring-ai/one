import { STATUS_STYLES } from "./constants.ts";
import type { PostStatus } from "./types.ts";

export default function StatusBadge({ status }: { status: PostStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.badge}`}>
      <span className={`w-1 h-1 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
