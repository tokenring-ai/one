import formatError from "@tokenring-ai/utility/error/formatError";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ErrorState from "../../components/ui/ErrorState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, calendarRPCClient, useCalendarProviders, useTypedSWR, workflowRPCClient } from "../../rpc.ts";
import DayView from "./components/DayView.tsx";
import EventModal from "./components/EventModal.tsx";
import MonthView from "./components/MonthView.tsx";
import ProviderSelector from "./components/ProviderSelector.tsx";
import RpcEventDetail from "./components/RpcEventDetail.tsx";
import WeekView from "./components/WeekView.tsx";
import { MONTHS } from "./constants.ts";
import { addDays, eventRangeToIso, startOfWeek, toDateKey } from "./dateUtils.ts";
import { rpcToLocalEvent } from "./rpcToLocalEvent.ts";
import { loadEvents, saveEvents } from "./storage.ts";
import type { CalendarEvent, ViewMode } from "./types.ts";

/** Google Calendar maxResults defaults to 10 when omitted — request enough for a dense month. */
const EVENTS_FETCH_LIMIT = 250;

export default function CalendarApp() {
  const navigate = useNavigate();
  const { provider: routeProvider } = useParams<{ provider?: string }>();
  // URL is the source of truth for which provider is open (params are already decoded).
  const provider = routeProvider ?? null;

  // Recompute each render so "Today" and highlighting stay correct across midnight
  const today = new Date();

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadEvents());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [defaultHour, setDefaultHour] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calendar provider state
  const providers = useCalendarProviders();
  const [rpcDetailEvent, setRpcDetailEvent] = useState<CalendarEvent | null>(null);

  const openProvider = useCallback(
    (name: string | null, options?: { replace?: boolean }) => {
      const path = name ? `/calendar/${encodeURIComponent(name)}` : "/calendar";
      void navigate(path, options?.replace ? { replace: true } : undefined);
    },
    [navigate],
  );

  useEffect(() => {
    if (providers.isLoading) return;
    const available = providers.data?.providers ?? [];
    if (!available[0]) {
      if (routeProvider) openProvider(null, { replace: true });
      return;
    }
    if (!provider || !available.includes(provider)) {
      openProvider(available[0], { replace: true });
    }
  }, [providers.data, providers.isLoading, provider, routeProvider, openProvider]);

  // Visible range including month-grid padding days so adjacent-month cells stay populated
  const { fetchFrom, fetchTo } = useMemo(() => {
    let from: Date, to: Date;
    if (view === "month") {
      const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      from = startOfWeek(firstOfMonth);
      // 6-week grid (42 days), exclusive end at start of day after last cell
      to = addDays(from, 42);
    } else if (view === "week") {
      from = startOfWeek(cursor);
      to = addDays(from, 7);
    } else {
      from = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      from.setHours(0, 0, 0, 0);
      to = addDays(from, 1);
    }
    return { fetchFrom: from.toISOString(), fetchTo: to.toISOString() };
  }, [view, cursor]);

  const rpcEventsResult = useTypedSWR(
    provider ? `/calendar/getUpcomingEvents/${provider}/${fetchFrom}/${fetchTo}/${EVENTS_FETCH_LIMIT}` : null,
    () =>
      calendarRPCClient.getUpcomingEvents({
        provider: provider!,
        from: fetchFrom,
        to: fetchTo,
        limit: EVENTS_FETCH_LIMIT,
      }),
    { refreshInterval: 30000 },
  );

  const allEvents = useMemo(() => {
    const rpc = (rpcEventsResult.data?.events ?? []).map(ev => rpcToLocalEvent(ev, provider!));
    // Local events only (RPC events come from the provider fetch)
    const local = events.filter(e => e.source !== "rpc");
    return [...local, ...rpc];
  }, [events, rpcEventsResult.data, provider]);

  // Persist local events
  useEffect(() => {
    saveEvents(events.filter(e => e.source !== "rpc"));
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
    const t = new Date();
    if (view === "month") setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
    else setCursor(new Date(t));
  }, [view]);

  const titleLabel = useMemo(() => {
    if (view === "month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "week") {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      if (ws.getMonth() === we.getMonth() && ws.getFullYear() === we.getFullYear()) {
        return `${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`;
      }
      if (ws.getFullYear() === we.getFullYear()) {
        return `${MONTHS[ws.getMonth()]!.slice(0, 3)} – ${MONTHS[we.getMonth()]!.slice(0, 3)} ${we.getFullYear()}`;
      }
      return `${MONTHS[ws.getMonth()]!.slice(0, 3)} ${ws.getFullYear()} – ${MONTHS[we.getMonth()]!.slice(0, 3)} ${we.getFullYear()}`;
    }
    return `${MONTHS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
  }, [view, cursor]);

  const openNew = useCallback((date?: Date, hour?: number) => {
    setEditingEvent(null);
    setDefaultDate(toDateKey(date ?? new Date()));
    setDefaultHour(hour ?? null);
    setModalOpen(true);
  }, []);

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

  const openRpcEdit = useCallback((ev: CalendarEvent) => {
    setRpcDetailEvent(null);
    setEditingEvent(ev);
    setDefaultDate(ev.date);
    setDefaultHour(null);
    setModalOpen(true);
  }, []);

  const handleDayClick = useCallback((date: Date) => {
    setCursor(date);
    setView("day");
  }, []);

  const handleSlotClick = useCallback(
    (date: Date, hour: number) => {
      openNew(date, hour);
    },
    [openNew],
  );

  const refreshRpc = useCallback(() => {
    void rpcEventsResult.mutate();
  }, [rpcEventsResult]);

  const handleSaveEvent = useCallback(
    async (ev: CalendarEvent) => {
      // Provider-backed calendar event (create or update)
      if (ev.type === "calendar" && ev.source === "rpc" && (ev.provider || provider)) {
        const p = ev.provider ?? provider!;
        setSaving(true);
        try {
          const { startAt, endAt } = eventRangeToIso({
            date: ev.date,
            ...(ev.allDay !== undefined && { allDay: ev.allDay }),
            ...(ev.startTime && { startTime: ev.startTime }),
            ...(ev.endTime && { endTime: ev.endTime }),
          });
          const isUpdate = Boolean(editingEvent?.source === "rpc" && editingEvent.id);
          if (isUpdate) {
            await calendarRPCClient.updateEvent({
              id: editingEvent!.id,
              provider: p,
              updatedData: {
                title: ev.title,
                startAt,
                endAt,
                allDay: ev.allDay ?? false,
                description: ev.description ?? "",
                location: ev.location ?? "",
              },
            });
            toastManager.success("Event updated");
          } else {
            await calendarRPCClient.createEvent({
              provider: p,
              title: ev.title,
              startAt,
              endAt,
              allDay: ev.allDay ?? false,
              ...(ev.description ? { description: ev.description } : {}),
              ...(ev.location ? { location: ev.location } : {}),
            });
            toastManager.success("Event created");
          }
          await rpcEventsResult.mutate();
          setModalOpen(false);
          setEditingEvent(null);
        } catch (error) {
          toastManager.error(formatError(error));
        } finally {
          setSaving(false);
        }
        return;
      }

      // Local agent / workflow / offline calendar events
      const { provider: _provider, ...rest } = ev;
      const localEvent: CalendarEvent = {
        ...rest,
        source: "local",
      };
      setEvents(prev => {
        const idx = prev.findIndex(e => e.id === localEvent.id);
        return idx >= 0 ? prev.map((e, i) => (i === idx ? localEvent : e)) : [...prev, localEvent];
      });
      setModalOpen(false);
      setEditingEvent(null);
    },
    [editingEvent, provider, rpcEventsResult],
  );

  const handleDeleteEvent = useCallback(
    async (ev: CalendarEvent) => {
      if (ev.source === "rpc") {
        const p = ev.provider ?? provider;
        if (!p) {
          toastManager.error("No calendar provider selected");
          return;
        }
        setSaving(true);
        try {
          await calendarRPCClient.deleteEvent({ id: ev.id, provider: p });
          toastManager.success("Event deleted");
          await rpcEventsResult.mutate();
          setModalOpen(false);
          setEditingEvent(null);
          setRpcDetailEvent(null);
        } catch (error) {
          toastManager.error(formatError(error));
        } finally {
          setSaving(false);
        }
        return;
      }

      setEvents(prev => prev.filter(e => e.id !== ev.id));
      setModalOpen(false);
      setEditingEvent(null);
    },
    [provider, rpcEventsResult],
  );

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

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const availableProviders = providers.data?.providers ?? [];
  const providersLoading = providers.isLoading;
  const providersError = providers.error;
  const eventsLoading = Boolean(provider) && rpcEventsResult.isLoading && !rpcEventsResult.data;
  const eventsRefreshing = Boolean(provider) && rpcEventsResult.isValidating && Boolean(rpcEventsResult.data);
  const eventsError = provider ? rpcEventsResult.error : undefined;
  const noProviders = !providersLoading && !providersError && availableProviders.length === 0;

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary shrink-0 bg-primary flex-wrap">
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

        <h2 className="text-sm font-bold text-primary ml-1 flex items-center gap-2">
          <CalendarDays size={16} className="text-sky-500" />
          {titleLabel}
        </h2>

        {(eventsLoading || eventsRefreshing) && (
          <span className="text-xs text-muted flex items-center gap-1 ml-1" role="status">
            <Loader2 className="w-3 h-3 animate-spin" />
            {eventsLoading ? "Loading events…" : "Refreshing…"}
          </span>
        )}

        <div className="flex-1" />

        <ProviderSelector
          provider={provider}
          availableProviders={availableProviders}
          loading={providersLoading}
          error={providersError}
          onProviderChange={name => openProvider(name)}
          onRetry={() => void providers.mutate()}
        />

        {provider && (
          <button
            type="button"
            onClick={refreshRpc}
            disabled={rpcEventsResult.isValidating}
            className="p-1.5 rounded-lg hover:bg-hover text-muted hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh events"
            aria-label="Refresh events"
          >
            <RefreshCw size={14} className={cn(rpcEventsResult.isValidating && "animate-spin")} />
          </button>
        )}

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

        <button
          type="button"
          onClick={() => openNew()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm"
        >
          <Plus size={14} /> New event
        </button>
      </div>

      {/* Provider / events status banners */}
      {providersError && (
        <div className="shrink-0 border-b border-primary">
          <ErrorState
            title="Failed to load calendar providers"
            error={providersError}
            onRetry={() => void providers.mutate()}
            variant="inline"
            className="py-2"
          />
        </div>
      )}
      {eventsError && (
        <div className="shrink-0 border-b border-primary">
          <ErrorState
            title={`Failed to load events${provider ? ` from ${provider}` : ""}`}
            error={eventsError}
            onRetry={refreshRpc}
            variant="inline"
            className="py-2"
          />
        </div>
      )}
      {noProviders && (
        <div className="shrink-0 px-4 py-2 border-b border-primary bg-secondary/50 text-xs text-muted">
          No calendar providers configured. You can still create local workflow/agent events. Add a calendar plugin (e.g. Google Calendar) to sync remote
          events.
        </div>
      )}

      {/* Calendar body — keep grid visible while RPC loads so local events stay usable */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        {view === "month" && (
          <MonthView
            year={cursor.getFullYear()}
            month={cursor.getMonth()}
            today={today}
            events={allEvents}
            onDayClick={handleDayClick}
            onEventClick={openEdit}
          />
        )}
        {view === "week" && <WeekView weekStart={weekStart} today={today} events={allEvents} onSlotClick={handleSlotClick} onEventClick={openEdit} />}
        {view === "day" && <DayView date={cursor} today={today} events={allEvents} onSlotClick={handleSlotClick} onEventClick={openEdit} />}
        {eventsLoading && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-8 bg-primary/40" aria-hidden>
            <div className="flex items-center gap-2 rounded-lg border border-primary bg-secondary/90 px-3 py-1.5 text-xs text-muted shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading calendar events…
            </div>
          </div>
        )}
      </div>

      {/* Event modal (local + RPC edit/create) */}
      {modalOpen && (
        <EventModal
          event={editingEvent}
          defaultDate={defaultDate}
          defaultHour={defaultHour}
          provider={provider}
          onClose={() => {
            if (!saving && !running) {
              setModalOpen(false);
              setEditingEvent(null);
            }
          }}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onRun={handleRunEvent}
          running={running}
          saving={saving}
        />
      )}

      {/* RPC calendar event detail */}
      {rpcDetailEvent && <RpcEventDetail event={rpcDetailEvent} onClose={() => setRpcDetailEvent(null)} onEdit={openRpcEdit} onDelete={handleDeleteEvent} />}
    </div>
  );
}
