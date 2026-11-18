import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type React from "react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { scrollBehavior } from "../../lib/motion.ts";

interface AutoScrollContainerProps {
  children: ReactNode;
  className?: string;
  /** An agent is streaming into this transcript; assistive tech is told it is still changing. */
  busy?: boolean;
}

export default function AutoScrollContainer({ children, className = "", busy = false }: AutoScrollContainerProps) {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const hideButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrollingRef = useRef(false); // Track if user has manually scrolled up
  /** True while a programmatic smooth scroll animates; its intermediate scroll events are not the user's. */
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintId = useId();

  const endProgrammaticScroll = () => {
    programmaticScrollRef.current = false;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
      programmaticScrollTimeoutRef.current = null;
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;

    if (programmaticScrollRef.current) {
      // Mid-animation positions must not flip follow mode off; the animation
      // ends once the bottom is reached (or the safety timeout fires).
      if (atBottom) endProgrammaticScroll();
      else return;
    }

    isAtBottomRef.current = atBottom;
    // Follow mode tracks the user's position: scrolling up pauses it, and
    // reaching the bottom again (by any means) resumes it.
    isUserScrollingRef.current = !atBottom;

    // Clear any pending hide timeout
    if (hideButtonTimeoutRef.current) {
      clearTimeout(hideButtonTimeoutRef.current);
      hideButtonTimeoutRef.current = null;
    }

    if (!atBottom) {
      setShowScrollButton(true);
    } else if (showScrollButton) {
      // Add a small delay before hiding to prevent flickering
      hideButtonTimeoutRef.current = setTimeout(() => {
        setShowScrollButton(false);
        hideButtonTimeoutRef.current = null;
      }, 100);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "End") {
      event.preventDefault();
      scrollToBottom();
    } else if (event.key === "Home") {
      event.preventDefault();
      endProgrammaticScroll();
      scrollRef.current?.scrollTo({
        top: 0,
        behavior: scrollBehavior(),
      });
    }
  };

  // Auto-scroll to bottom on mount if there's content
  useEffect(() => {
    if (!hasInitializedRef.current && scrollRef.current && contentRef.current) {
      // Wait for content to be rendered
      const timer = setTimeout(() => {
        if (scrollRef.current && contentRef.current) {
          const { scrollHeight } = scrollRef.current;
          isAtBottomRef.current = true;
          scrollRef.current.scrollTo({
            top: scrollHeight,
            behavior: "instant",
          });
          setShowScrollButton(false);
          hasInitializedRef.current = true;
        }
      }, 0);

      return () => clearTimeout(timer);
    }
  }, []);

  // Cleanup hide timeout on unmount
  useEffect(() => {
    return () => {
      if (hideButtonTimeoutRef.current) {
        clearTimeout(hideButtonTimeoutRef.current);
      }
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!contentRef.current || !scrollRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // Only auto-scroll if user hasn't manually scrolled up
      if (isAtBottomRef.current && !isUserScrollingRef.current && scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "instant",
        });
      }
    });

    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const scrollToBottom = () => {
    isAtBottomRef.current = true;
    isUserScrollingRef.current = false; // Reset user scroll state
    // Ignore the animation's own scroll events; a timeout guards against a
    // scroll that never lands exactly at the bottom (e.g. content shrank).
    endProgrammaticScroll();
    programmaticScrollRef.current = true;
    programmaticScrollTimeoutRef.current = setTimeout(endProgrammaticScroll, 1000);
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: scrollBehavior(),
    });
    setShowScrollButton(false);
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Keyboard shortcut hint for screen readers */}
      <span id={hintId} className="sr-only">
        Use End key to jump to bottom, Home key to jump to top
      </span>

      {/* A panel can be one of several chat views, so this must not be a
          second <main> landmark: App already renders the page's main. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        // A wheel or touch during the jump animation hands control back to the user.
        onWheel={endProgrammaticScroll}
        onTouchStart={endProgrammaticScroll}
        onKeyDown={handleKeyDown}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable scroll region so the End/Home shortcuts apply
        tabIndex={0}
        className={`flex-1 overflow-y-auto p-0 flex flex-col text-sm relative scroll-smooth h-full outline-none ${className}`}
        // A log, but not a live one: streamed tokens must not be read out. The chat's status region
        // announces turn start/finish instead, and new entries can be reached by reading the log.
        role="log"
        aria-live="off"
        aria-relevant="additions"
        aria-busy={busy}
        aria-label="Chat messages"
        aria-describedby={hintId}
      >
        <div ref={contentRef} className="flex flex-col min-h-full pb-4">
          {children}
        </div>
      </div>
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                type: "spring",
                damping: 20,
                stiffness: 300,
              },
            }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute right-4 bottom-4 p-1.5 rounded-full btn-accent transition-colors z-20 shadow-button focus-ring"
            title="Scroll to bottom"
            aria-label="Scroll to bottom of chat"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
