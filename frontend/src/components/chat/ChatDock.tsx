import { MessageSquare } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalStorageState } from "../../hooks/useLocalStorageState.ts";
import ResizableSplit from "../ui/ResizableSplit.tsx";
import type { ChatDockMode } from "./ChatDockControls.tsx";
import ChatPanel from "./ChatPanel.tsx";

const FLOAT_MIN_WIDTH = 280;
const FLOAT_MIN_HEIGHT = 220;
const FLOAT_DEFAULT_WIDTH = 420;
const FLOAT_DEFAULT_HEIGHT = 520;
const FLOAT_MARGIN = 16;

interface FloatRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ChatDockProps {
  /** Agent to chat with. When null the dock renders only its children. */
  agentId: string | null;
  /** Distinguishes persisted dock preferences between apps, e.g. "email". */
  storageKey: string;
  /** Placement used the first time this app is opened. Default: "bottom" */
  defaultMode?: ChatDockMode;
  /** Fraction of the container given to the content when docked. Default: 0.6 */
  initialRatio?: number;
  headerTitle?: string;
  /** Called when the user closes the panel, in addition to hiding it. */
  onClose?: () => void;
  children: React.ReactNode;
}

function storageId(storageKey: string) {
  return `chatDock:${storageKey}`;
}

const isMode = (value: unknown): value is ChatDockMode => value === "bottom" || value === "right" || value === "float" || value === "closed";

const isRect = (value: unknown): value is FloatRect =>
  typeof value === "object" && value !== null && ["x", "y", "width", "height"].every(key => typeof (value as Record<string, unknown>)[key] === "number");

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
}

function isCompactViewport(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1023px)").matches;
}

/**
 * Wraps an app's content with a chat panel that can be docked to the bottom or
 * right edge, floated above the content, or closed. The placement is chosen
 * from the controls in the panel's top-right corner and persists per app.
 */
export default function ChatDock({ agentId, storageKey, defaultMode = "bottom", initialRatio = 0.6, headerTitle, onClose, children }: ChatDockProps) {
  const modeKey = `${storageId(storageKey)}:mode`;
  const rectKey = `${storageId(storageKey)}:float`;

  const [mode, setModeState] = useLocalStorageState<ChatDockMode>(modeKey, defaultMode, {
    deserialize: raw => {
      try {
        const parsed: unknown = JSON.parse(raw);
        return isMode(parsed) ? parsed : defaultMode;
      } catch {
        return defaultMode;
      }
    },
  });

  const [mobileViewport, setMobileViewport] = useState(isMobileViewport);
  const [compactViewport, setCompactViewport] = useState(isCompactViewport);
  const [floatRect, setFloatRect] = useLocalStorageState<FloatRect | null>(rectKey, null, {
    deserialize: raw => {
      try {
        const parsed: unknown = JSON.parse(raw);
        return isRect(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
  });
  const containerRef = useRef<HTMLDivElement>(null);
  // Placement to restore when the panel is reopened after being closed.
  const lastOpenModeRef = useRef<Exclude<ChatDockMode, "closed">>(mode === "closed" ? (defaultMode === "closed" ? "bottom" : defaultMode) : mode);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const compactQuery = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      setMobileViewport(mobileQuery.matches);
      setCompactViewport(compactQuery.matches);
    };
    update();
    mobileQuery.addEventListener("change", update);
    compactQuery.addEventListener("change", update);
    return () => {
      mobileQuery.removeEventListener("change", update);
      compactQuery.removeEventListener("change", update);
    };
  }, []);

  const setMode = useCallback(
    (next: ChatDockMode) => {
      if (next !== "closed") lastOpenModeRef.current = next;
      setModeState(next);
    },
    [setModeState],
  );

  const handleClose = useCallback(() => {
    setMode("closed");
    onClose?.();
  }, [onClose, setMode]);

  // Place the floating panel in the bottom-right corner the first time it is used.
  useEffect(() => {
    if (mode !== "float" || floatRect) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(FLOAT_DEFAULT_WIDTH, Math.max(FLOAT_MIN_WIDTH, rect.width - 2 * FLOAT_MARGIN));
    const height = Math.min(FLOAT_DEFAULT_HEIGHT, Math.max(FLOAT_MIN_HEIGHT, rect.height - 2 * FLOAT_MARGIN));
    setFloatRect({
      x: Math.max(FLOAT_MARGIN, rect.width - width - FLOAT_MARGIN),
      y: Math.max(FLOAT_MARGIN, rect.height - height - FLOAT_MARGIN),
      width,
      height,
    });
  }, [mode, floatRect, setFloatRect]);

  const startFloatGesture = useCallback(
    (event: React.PointerEvent, kind: "move" | "resize") => {
      if (event.button !== 0) return;
      const container = containerRef.current;
      const start = floatRect;
      if (!container || !start) return;

      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;

      const onMove = (e: PointerEvent) => {
        const bounds = container.getBoundingClientRect();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (kind === "move") {
          setFloatRect({
            ...start,
            x: Math.max(0, Math.min(bounds.width - start.width, start.x + dx)),
            y: Math.max(0, Math.min(bounds.height - start.height, start.y + dy)),
          });
        } else {
          setFloatRect({
            ...start,
            width: Math.max(FLOAT_MIN_WIDTH, Math.min(bounds.width - start.x, start.width + dx)),
            height: Math.max(FLOAT_MIN_HEIGHT, Math.min(bounds.height - start.height, start.height + dy)),
          });
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        // Final write is already handled by setFloatRect during the gesture.
      };

      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [floatRect, setFloatRect],
  );

  if (!agentId) return <>{children}</>;

  const effectiveMode: ChatDockMode = compactViewport && (mode === "right" || mode === "float") ? "bottom" : mode;

  const panel = (onHeaderPointerDown?: (event: React.PointerEvent) => void) => (
    <ChatPanel
      // Remount on agent switch so the composer picks up that agent's saved draft.
      key={agentId}
      agentId={agentId}
      dockMode={effectiveMode}
      onDockModeChange={setMode}
      onClose={handleClose}
      {...(onHeaderPointerDown && { onHeaderPointerDown })}
      {...(headerTitle && { headerTitle })}
    />
  );

  if (effectiveMode === "closed") {
    return (
      <div ref={containerRef} className="relative h-full w-full min-h-0">
        {children}
        <button
          type="button"
          onClick={() => setMode(lastOpenModeRef.current)}
          title="Reopen chat"
          aria-label="Reopen chat"
          className="absolute bottom-4 right-4 z-20 w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-white shadow-button-primary flex items-center justify-center focus-ring cursor-pointer transition-colors"
        >
          <MessageSquare className="w-4.5 h-4.5" />
        </button>
      </div>
    );
  }

  // A phone shows one region at a time. Chat replaces the app workspace until
  // its close control returns the user to the content; desktop dock choices do
  // not leak into this viewport class.
  if (mobileViewport) {
    return (
      <div ref={containerRef} className="h-full w-full min-h-0 overflow-hidden bg-primary">
        {panel()}
      </div>
    );
  }

  if (effectiveMode === "float") {
    return (
      <div ref={containerRef} className="relative h-full w-full min-h-0 overflow-hidden">
        {children}
        {floatRect && (
          <div
            className="absolute z-30 flex flex-col overflow-hidden bg-primary border border-primary rounded-xl shadow-card"
            style={{ left: floatRect.x, top: floatRect.y, width: floatRect.width, height: floatRect.height }}
          >
            <div className="flex-1 min-h-0">{panel(event => startFloatGesture(event, "move"))}</div>
            <div
              onPointerDown={event => startFloatGesture(event, "resize")}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
              aria-hidden="true"
            >
              <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-muted/60 rounded-xs" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full min-h-0">
      <ResizableSplit
        key={effectiveMode}
        direction={effectiveMode === "bottom" ? "vertical" : "horizontal"}
        initialRatio={initialRatio}
        minFirst={160}
        minSecond={effectiveMode === "bottom" ? 140 : 260}
        className="h-full"
      >
        <div className="h-full overflow-hidden">{children}</div>
        <div className="h-full overflow-hidden bg-primary">{panel()}</div>
      </ResizableSplit>
    </div>
  );
}
