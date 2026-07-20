import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

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

export function ChatInputProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputs] = useState<ChatInputState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [storageError, setStorageError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
      setStorageError(null);
      setErrorDismissed(false);
    } catch (e) {
      // User-friendly error message with actionable guidance
      setStorageError("Chat input history disabled (localStorage unavailable). Your typed messages won't be saved between sessions.");
      console.error("Failed to persist chat inputs:", e);
    }
  }, [inputs]);

  const getInput = (agentId: string) => inputs[agentId] || "";

  const setInput = (agentId: string, value: string) => {
    setInputs(prev => ({ ...prev, [agentId]: value }));
  };

  const clearInput = (agentId: string) => {
    setInputs(prev => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
  };

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
