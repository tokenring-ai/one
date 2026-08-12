import { useEffect, useState } from "react";

/**
 * Return a debounced version of a value.
 * The debounced value updates only after `value` has been stable for `delay` ms.
 *
 * @example
 * const [query, setQuery] = useState("");
 * const debouncedQuery = useDebounce(query, 300);
 * // Use debouncedQuery in useEffect dependencies to avoid firing on every keystroke
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
