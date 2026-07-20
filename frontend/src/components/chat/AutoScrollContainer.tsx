import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type React from "react";
import { type ReactNode, useEffect, useRef, useState } from "react";

interface AutoScrollContainerProps {
  children: ReactNode;
  className?: string;
}

export default function AutoScrollContainer({ children, className = "" }: AutoScrollContainerProps) {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const hideButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrollingRef = useRef(false); // Track if user has manually scrolled up

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;
    isAtBottomRef.current = atBottom;

    // Mark that user has manually scrolled up (if they were previously at bottom)
    if (!atBottom && !isUserScrollingRef.current) {
      isUserScrollingRef.current = true;
    }

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
      scrollRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
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
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
    setShowScrollButton(false);
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Keyboard shortcut hint for screen readers */}
      <span id="chat-scroll-hint" className="sr-only">
        Use End key to jump to bottom, Home key to jump to top
      </span>

      <main
        ref={scrollRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className={`flex-1 overflow-y-auto p-0 flex flex-col font-mono text-sm relative scroll-smooth h-full ${className}`}
        role="region"
        aria-label="Chat messages"
        aria-describedby="chat-scroll-hint"
      >
        <div ref={contentRef} className="flex flex-col min-h-full pb-4">
          {children}
        </div>
      </main>
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
            className="absolute right-4 bottom-4 p-1.5 rounded-full bg-accent hover:bg-accent-hover text-white transition-colors z-20 shadow-button focus-ring"
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
