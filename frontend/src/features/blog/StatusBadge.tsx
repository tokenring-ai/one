import StatusBadge from "../../components/ui/StatusBadge.tsx";
import { STATUS_STYLES } from "./constants.ts";
import type { PostStatus } from "./types.ts";

/** Blog post status pill (draft / published / scheduled / …). */
export default function BlogStatusBadge({ status }: { status: PostStatus }) {
  const s = STATUS_STYLES[status];
  return <StatusBadge label={s.label} dotColor={s.dot} colorClass={s.badge} />;
}
