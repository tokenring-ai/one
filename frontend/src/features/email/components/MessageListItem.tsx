import type { EmailMessage } from "@tokenring-ai/email";
import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import ContentListItem from "../../../components/ui/ContentListItem.tsx";
import { messageTimestamp, senderName } from "../utils.ts";

export default function MessageListItem({ msg, selected, onClick }: { msg: EmailMessage; selected: boolean; onClick: () => void }) {
  return (
    <ContentListItem
      selected={selected}
      onClick={onClick}
      title={senderName(msg)}
      status={<span className="text-xs text-muted shrink-0">{formatDate(messageTimestamp(msg))}</span>}
      subtitle={msg.subject || "(no subject)"}
      snippet={msg.snippet || undefined}
      indicator={!msg.isRead ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute right-3 top-3" aria-hidden="true" /> : undefined}
      selectedBorderColor="border-l-red-500"
      emphasized={!msg.isRead}
    />
  );
}
