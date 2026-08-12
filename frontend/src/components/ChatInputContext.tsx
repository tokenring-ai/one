import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { useLocalStorageState } from "../hooks/useLocalStorageState.ts";

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

  const getInput = (agentId: string) => inputs[agentId] || "";

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

  const getStorageError = () => (errorDismissed ? null : storageError);

  const hasStorageError = () => storageError !== null && !errorDismissed;

  const dismissStorageError = () => {
    setErrorDismissed(true);
  };

  return (
    <ChatInputContext.Provider value={{ getInput, setInput, clearInput, getStorageError, hasStorageError, dismissStorageError }}>
      {children}
    </ChatInputContext.Provider>
  );
}

export function useChatInput() {
  const context = useContext(ChatInputContext);
  if (!context) {
    throw new Error("useChatInput must be used within ChatInputProvider");
  }
  return context;
}
