import formatError from "@tokenring-ai/utility/error/formatError";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, useCalendarEvents, useCalendarProviders, workflowRPCClient } from "../../rpc.ts";
import DayView from "./components/DayView.tsx";
import EventModal from "./components/EventModal.tsx";
import MonthView from "./components/MonthView.tsx";
import ProviderSelector from "./components/ProviderSelector.tsx";
import RpcEventDetail from "./components/RpcEventDetail.tsx";
import WeekView from "./components/WeekView.tsx";
import { MONTHS } from "./constants.ts";
import { addDays, startOfWeek, toDateKey } from "./dateUtils.ts";
import { rpcToLocalEvent } from "./rpcToLocalEvent.ts";
import { loadEvents, saveEvents } from "./storage.ts";
import type { CalendarEvent, ViewMode } from "./types.ts";

export default function CalendarApp() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [defaultHour, setDefaultHour] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  // Calendar provider state
  const providers = useCalendarProviders();
  const [provider, setProvider] = useState<string | null>(null);
  const [rpcDetailEvent, setRpcDetailEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    const available = providers.data?.providers ?? [];
    if (!available[0]) return;
    if (!provider || !available.includes(provider)) {
      setProvider(available[0]);
    }
  }, [providers.data, provider]);

  const { fetchFrom, fetchTo } = useMemo(() => {
    let from: Date, to: Date;
    if (view === "month") {
      from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (view === "week") {
      from = startOfWeek(cursor);
      to = addDays(from, 7);
      to.setHours(23, 59, 59, 999);
    } else {
      from = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      to = addDays(from, 1);
    }
    return { fetchFrom: from.toISOString(), fetchTo: to.toISOString() };
  }, [view, cursor]);

  const rpcEventsResult = useCalendarEvents(provider ?? undefined, fetchFrom, fetchTo);

  const allEvents = useMemo(() => {
    const rpc = (rpcEventsResult.data?.events ?? []).map(rpcToLocalEvent);
    return [...events, ...rpc];
  }, [events, rpcEventsResult.data]);

  // Persist events
  useEffect(() => {
    saveEvents(events);
  }, [events]);

  // Navigation
  const goNext = useCallback(() => {
    setCursor(c => {
      const n = new Date(c);
      if (view === "month") n.setMonth(n.getMonth() + 1);
      else if (view === "week") n.setDate(n.getDate() + 7);
      else n.setDate(n.getDate() + 1);
      return n;
    });
  }, [view]);

  const goPrev = useCallback(() => {
    setCursor(c => {
      const n = new Date(c);
      if (view === "month") n.setMonth(n.getMonth() - 1);
      else if (view === "week") n.setDate(n.getDate() - 7);
      else n.setDate(n.getDate() - 1);
      return n;
    });
  }, [view]);

  const goToday = useCallback(() => {
    if (view === "month") setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    else setCursor(new Date(today));
  }, [view, today]);

  // Title bar label
  const titleLabel = useMemo(() => {
    if (view === "month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "week") {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      if (ws.getMonth() === we.getMonth()) return `${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`;
      return `${MONTHS[ws.getMonth()]!.slice(0, 3)} – ${MONTHS[we.getMonth()]!.slice(0, 3)} ${we.getFullYear()}`;
    }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
  }, [view, cursor]);

  // Open new-event modal
  const openNew = useCallback(
    (date?: Date, hour?: number) => {
      setEditingEvent(null);
      setDefaultDate(toDateKey(date ?? today));
      setDefaultHour(hour ?? null);
      setModalOpen(true);
    },
    [today],
  );

  const openEdit = useCallback((ev: CalendarEvent) => {
    if (ev.source === "rpc") {
      setRpcDetailEvent(ev);
      return;
    }
    setEditingEvent(ev);
    setDefaultDate(ev.date);
    setDefaultHour(null);
    setModalOpen(true);
  }, []);

  // Day click in month view → switch to day view
  const handleDayClick = useCallback((date: Date) => {
    setCursor(date);
    setView("day");
  }, []);

  // Slot click in week/day view → open new event
  const handleSlotClick = useCallback(
    (date: Date, hour: number) => {
      openNew(date, hour);
    },
    [openNew],
  );

  const handleSaveEvent = useCallback((ev: CalendarEvent) => {
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === ev.id);
      return idx >= 0 ? prev.map((e, i) => (i === idx ? ev : e)) : [...prev, ev];
    });
    setModalOpen(false);
  }, []);

  const handleDeleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setModalOpen(false);
  }, []);

  const handleRunEvent = useCallback(
    async (ev: CalendarEvent) => {
      setRunning(true);
      try {
        if (ev.type === "workflow" && ev.workflowKey) {
          const { id } = await workflowRPCClient.spawnWorkflow({ name: ev.workflowKey, headless: false });
          setModalOpen(false);
          void navigate(`/agent/${id}`);
        } else if (ev.type === "agent" && ev.agentType) {
          const { id } = await agentRPCClient.createAgent({ agentType: ev.agentType, headless: false });
          setModalOpen(false);
          void navigate(`/agent/${id}`);
        }
      } catch (error) {
        toastManager.error(formatError(error));
      } finally {
        setRunning(false);
      }
    },
    [navigate],
  );

  // View-specific props
  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary shrink-0 bg-primary">
        {/* Nav arrows + today */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            className="p-1.5 rounded-lg hover:bg-hover text-muted hover:text-primary transition-colors cursor-pointer"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="p-1.5 rounded-lg hover:bg-hover text-muted hover:text-primary transition-colors cursor-pointer"
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-semibold border border-primary rounded-lg hover:bg-hover text-primary transition-colors cursor-pointer ml-1"
          >
            Today
          </button>
        </div>

        {/* Title */}
        <h2 className="text-sm font-bold text-primary ml-1 flex items-center gap-2">
          <CalendarDays size={16} className="text-sky-500" />
          {titleLabel}
        </h2>

        <div className="flex-1" />

        {/* Provider selector */}
        <ProviderSelector
          provider={provider}
          availableProviders={providers.data?.providers ?? []}
          loading={providers.isLoading}
          onProviderChange={setProvider}
        />

        {/* View switcher */}
        <div className="flex items-center bg-secondary border border-primary rounded-lg p-0.5 text-xs font-medium">
          {(["month", "week", "day"] as ViewMode[]).map(v => (
            <button
              type="button"
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 rounded-md capitalize transition-all cursor-pointer",
                view === v ? "bg-sky-500 text-white shadow-sm" : "text-muted hover:text-primary",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* New event */}
        <button
          type="button"
          onClick={() => openNew()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm"
        >
          <Plus size={14} /> New event
        </button>
      </div>

      {/* Calendar body */}
      {view === "month" && (
        <MonthView year={cursor.getFullYear()} month={cursor.getMonth()} today={today} events={allEvents} onDayClick={handleDayClick} onEventClick={openEdit} />
      )}
      {view === "week" && <WeekView weekStart={weekStart} today={today} events={allEvents} onSlotClick={handleSlotClick} onEventClick={openEdit} />}
      {view === "day" && <DayView date={cursor} today={today} events={allEvents} onSlotClick={handleSlotClick} onEventClick={openEdit} />}

      {/* Scheduler event modal */}
      {modalOpen && (
        <EventModal
          event={editingEvent}
          defaultDate={defaultDate}
          defaultHour={defaultHour}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onRun={handleRunEvent}
          running={running}
        />
      )}

      {/* RPC calendar event detail */}
      {rpcDetailEvent && <RpcEventDetail event={rpcDetailEvent} onClose={() => setRpcDetailEvent(null)} />}
    </div>
  );
}
