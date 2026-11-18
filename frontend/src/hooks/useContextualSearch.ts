import { useEffect, useRef, useState } from "react";
import { chatRPCClient } from "../rpc.ts";
import { useDebounce } from "./useDebounce.ts";

export type ContextualSearchItem = {
  id: string;
  tag: string;
  title: string;
  subtitle?: string;
  categoryId: string;
  categoryLabel: string;
  score?: number;
};

export type ContextualSearchCategory = {
  id: string;
  label: string;
  items: ContextualSearchItem[];
};

export type ContextualSearchPendingProvider = {
  id: string;
  categoryId: string;
  categoryLabel: string;
};

const SEARCH_DEBOUNCE_MS = 200;

export function useContextualSearch(agentId: string, query: string | null) {
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const [categories, setCategories] = useState<ContextualSearchCategory[]>([]);
  const [pending, setPending] = useState<ContextualSearchPendingProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const generationRef = useRef(0);

  useEffect(() => {
    if (debouncedQuery === null) {
      generationRef.current += 1;
      setCategories([]);
      setPending([]);
      setIsLoading(false);
      return;
    }

    const generation = ++generationRef.current;
    const abortController = new AbortController();
    setCategories([]);
    setPending([]);
    setIsLoading(true);

    void (async () => {
      try {
        for await (const chunk of chatRPCClient.searchContext({ agentId, query: debouncedQuery }, abortController.signal)) {
          if (generation !== generationRef.current) return;
          if (chunk.status !== "success") {
            setCategories([]);
            setPending([]);
            setIsLoading(false);
            return;
          }
          setCategories(chunk.categories);
          setPending(chunk.pending);
          setIsLoading(chunk.pending.length > 0);
        }
      } catch {
        if (generation !== generationRef.current || abortController.signal.aborted) return;
        setCategories([]);
        setPending([]);
      } finally {
        if (generation === generationRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [agentId, debouncedQuery]);

  return { categories, pending, isLoading };
}
