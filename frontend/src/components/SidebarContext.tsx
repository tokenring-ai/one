import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

interface SidebarContextType {
  isSidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebar: () => void;
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  resetToDefaults: () => void;
  localStorageAvailable: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const SIDEBAR_EXPANDED_STORAGE_KEY = "tokenring-sidebar-expanded";
const MOBILE_OPEN_STORAGE_KEY = "tokenring-mobile-open";

function safeParseLocalStorage(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") {
    return defaultValue;
  }
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    // If parsing fails, return default value
    return defaultValue;
  }
}

function safeSetLocalStorage(key: string, value: boolean): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // If storage fails (blocked, full, etc.), return false
    return false;
  }
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Load initial state from localStorage with error handling
  const [isSidebarExpanded, setSidebarExpandedState] = useState<boolean>(() => safeParseLocalStorage(SIDEBAR_EXPANDED_STORAGE_KEY, true));

  const [isMobileOpen, setMobileOpenState] = useState<boolean>(() => safeParseLocalStorage(MOBILE_OPEN_STORAGE_KEY, false));

  // Track localStorage availability for user feedback
  const [localStorageAvailable, setLocalStorageAvailable] = useState<boolean>(() => {
    // Check availability on initial mount
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const testKey = "__localStorage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  });

  // Persist state changes to localStorage with availability check
  useEffect(() => {
    if (!localStorageAvailable) return; // Skip if already known to be unavailable

    const success = safeSetLocalStorage(SIDEBAR_EXPANDED_STORAGE_KEY, isSidebarExpanded);
    if (!success) {
      setLocalStorageAvailable(false);
      console.warn("SidebarContext: localStorage unavailable - sidebar state will not persist across sessions");
    }
  }, [isSidebarExpanded, localStorageAvailable]);

  useEffect(() => {
    if (!localStorageAvailable) return; // Skip if already known to be unavailable

    const success = safeSetLocalStorage(MOBILE_OPEN_STORAGE_KEY, isMobileOpen);
    if (!success) {
      setLocalStorageAvailable(false);
      console.warn("SidebarContext: localStorage unavailable - sidebar state will not persist across sessions");
    }
  }, [isMobileOpen, localStorageAvailable]);

  const setSidebarExpanded = (expanded: boolean) => {
    setSidebarExpandedState(expanded);
  };

  const setMobileOpen = (open: boolean) => {
    setMobileOpenState(open);
  };

  const toggleSidebar = () => {
    setSidebarExpandedState(prev => !prev);
  };

  const toggleMobileSidebar = () => {
    setMobileOpenState(prev => !prev);
  };

  const resetToDefaults = () => {
    setSidebarExpandedState(true);
    setMobileOpenState(false);
  };

  return (
    <SidebarContext.Provider
      value={{
        isSidebarExpanded,
        setSidebarExpanded,
        toggleSidebar,
        isMobileOpen,
        setMobileOpen,
        toggleMobileSidebar,
        resetToDefaults,
        localStorageAvailable,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
