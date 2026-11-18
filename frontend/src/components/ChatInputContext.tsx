import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readLocalStorageState, useLocalStorageState, writeLocalStorageState } from "../hooks/useLocalStorageState.ts";

interface ChatInputState {
  [agentId: string]: string;
}

interface ChatInputContextType {
  getInput: (agentId: string) => string;
  setInput: (agentId: string, value: string) => void;
  clearInput: (agentId: string) => void;
  getStorageError: () => string | null;
  hasStorageError: () => boolean;
  dismissStorageError: () => void;
}

const ChatInputContext = createContext<ChatInputContextType | undefined>(undefined);

const STORAGE_KEY = "tokenring-chat-inputs";

/**
 * Prefills that could not be written to localStorage (private mode, blocked
 * storage, quota). The provider adopts them into its in-memory state, so a
 * "hand to agent" prefill still lands without storage.
 */
const pendingPrefills = new Map<string, string>();
const prefillListeners = new Set<() => void>();

/**
 * Puts text into an agent's chat composer from outside the provider (a
 * dashboard handing an issue to an agent). Instances of the storage hook
 * sharing the key re-read it, so the composer picks the draft up at once;
 * without storage it is handed to the provider in memory instead.
 */
export function prefillChatInput(agentId: string, value: string): void {
  const inputs = readLocalStorageState<ChatInputState>(STORAGE_KEY, {});
  if (writeLocalStorageState(STORAGE_KEY, { ...inputs, [agentId]: value })) {
    pendingPrefills.delete(agentId);
    return;
  }
  pendingPrefills.set(agentId, value);
  for (const listener of prefillListeners) listener();
}

/** Test seam: forget prefills no provider has adopted yet. */
export function resetPendingPrefillsForTests(): void {
  pendingPrefills.clear();
}

const STORAGE_ERROR_MESSAGE = "Chat input history disabled (localStorage unavailable). Your typed messages won't be saved between sessions.";

export function ChatInputProvider({ children }: { children: ReactNode }) {
  const [storageError, setStorageError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);

  const [inputs, setInputs] = useLocalStorageState<ChatInputState>(
    STORAGE_KEY,
    {},
    {
      onError: e => {
        setStorageError(STORAGE_ERROR_MESSAGE);
        console.error("Failed to persist chat inputs:", e);
      },
    },
  );

  // Adopt prefills that storage refused, now (posted before mount) and as they arrive.
  useEffect(() => {
    const adopt = () => {
      if (pendingPrefills.size === 0) return;
      const adopted = Object.fromEntries(pendingPrefills);
      pendingPrefills.clear();
      setInputs(prev => ({ ...prev, ...adopted }));
    };
    adopt();
    prefillListeners.add(adopt);
    return () => {
      prefillListeners.delete(adopt);
    };
  }, [setInputs]);

  const getInput = useCallback((agentId: string) => inputs[agentId] || "", [inputs]);

  const setInput = useCallback(
    (agentId: string, value: string) => {
      // Optimistic clear — onError re-sets the banner if the write fails.
      setStorageError(null);
      setErrorDismissed(false);
      setInputs(prev => ({ ...prev, [agentId]: value }));
    },
    [setInputs],
  );

  const clearInput = useCallback(
    (agentId: string) => {
      setStorageError(null);
      setErrorDismissed(false);
      setInputs(prev => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    },
    [setInputs],
  );

  const getStorageError = useCallback(() => (errorDismissed ? null : storageError), [errorDismissed, storageError]);

  const hasStorageError = useCallback(() => storageError !== null && !errorDismissed, [errorDismissed, storageError]);

  const dismissStorageError = useCallback(() => {
    setErrorDismissed(true);
  }, []);

  // Stable identity keeps every useChatInput consumer from re-rendering on
  // unrelated provider renders (values change only when their data changes).
  const value = useMemo(
    () => ({ getInput, setInput, clearInput, getStorageError, hasStorageError, dismissStorageError }),
    [getInput, setInput, clearInput, getStorageError, hasStorageError, dismissStorageError],
  );

  return <ChatInputContext.Provider value={value}>{children}</ChatInputContext.Provider>;
}

export function useChatInput() {
  const context = useContext(ChatInputContext);
  if (!context) {
    throw new Error("useChatInput must be used within ChatInputProvider");
  }
  return context;
}
