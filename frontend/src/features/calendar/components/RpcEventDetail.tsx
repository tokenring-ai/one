import { Calendar, CalendarDays, MapPin } from "lucide-react";
import DetailModal, { type DetailModalMetadataItem } from "../../../components/ui/DetailModal.tsx";
import type { CalendarEvent } from "../types.ts";

export default function RpcEventDetail({
  event,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void | Promise<void>;
}) {
  const timeLabel = event.allDay ? "All day" : event.startTime ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}` : null;

  const metadata: DetailModalMetadataItem[] = [
    {
      icon: CalendarDays,
      value: (
        <>
          {event.date}
          {timeLabel ? ` · ${timeLabel}` : ""}
        </>
      ),
    },
    ...(event.provider ? [{ label: "Provider", value: event.provider }] : []),
    ...(event.location ? [{ icon: MapPin, value: event.location }] : []),
    ...(!event.location && !event.description ? [{ value: <span className="text-xs italic">No additional details</span> }] : []),
  ];

  return (
    <DetailModal
      icon={Calendar}
      title={event.title}
      metadata={metadata}
      {...(event.description ? { description: event.description } : {})}
      onClose={onClose}
      onEdit={() => onEdit(event)}
      onDestructive={() => onDelete(event)}
      destructiveConfirmMessage={`Delete “${event.title}”? This cannot be undone.`}
    />
  );
}
