import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { readLocalStorageState, useLocalStorageState, writeLocalStorageState } from "./useLocalStorageState.ts";

describe("readLocalStorageState / writeLocalStorageState", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns initialValue when the key is missing", () => {
    expect(readLocalStorageState("missing", 42)).toBe(42);
  });

  it("round-trips JSON values", () => {
    writeLocalStorageState("k", { a: 1 });
    expect(readLocalStorageState("k", { a: 0 })).toEqual({ a: 1 });
  });

  it("uses custom serialize / deserialize", () => {
    writeLocalStorageState("theme", "dark", { serialize: String });
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(
      readLocalStorageState("theme", "system", {
        deserialize: raw => (raw === "light" || raw === "dark" || raw === "system" ? raw : "system"),
      }),
    ).toBe("dark");
  });

  it("falls back to initialValue on invalid JSON", () => {
    localStorage.setItem("bad", "{not-json");
    expect(readLocalStorageState("bad", "fallback")).toBe("fallback");
  });

  it("calls onError and returns false when write fails and ignoreErrors is true", () => {
    const onError = (error: unknown) => {
      errors.push(error);
    };
    const errors: unknown[] = [];
    const setItem = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      expect(writeLocalStorageState("k", "v", { onError })).toBe(false);
      expect(errors).toHaveLength(1);
    } finally {
      setItem.mockRestore();
    }
  });

  it("rethrows when ignoreErrors is false", () => {
    const setItem = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      expect(() => writeLocalStorageState("k", "v", { ignoreErrors: false })).toThrow("QuotaExceededError");
    } finally {
      setItem.mockRestore();
    }
  });
});

describe("useLocalStorageState", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("initializes from initialValue when storage is empty", () => {
    const { result } = renderHook(() => useLocalStorageState("count", 0));
    expect(result.current[0]).toBe(0);
  });

  it("restores a stored value on mount", () => {
    localStorage.setItem("count", "7");
    const { result } = renderHook(() => useLocalStorageState("count", 0));
    expect(result.current[0]).toBe(7);
  });

  it("persists updates to localStorage", () => {
    const { result } = renderHook(() => useLocalStorageState("count", 0));
    act(() => {
      result.current[1](3);
    });
    expect(result.current[0]).toBe(3);
    expect(localStorage.getItem("count")).toBe("3");
  });

  it("supports functional updates", () => {
    const { result } = renderHook(() => useLocalStorageState("count", 1));
    act(() => {
      result.current[1](n => n + 1);
    });
    expect(result.current[0]).toBe(2);
    expect(localStorage.getItem("count")).toBe("2");
  });

  it("uses custom serialize to filter before write", () => {
    type Ev = { id: string; source: "local" | "rpc" };
    const { result } = renderHook(() =>
      useLocalStorageState<Ev[]>("events", [], {
        serialize: all => JSON.stringify(all.filter(e => e.source !== "rpc")),
        deserialize: raw => {
          try {
            const parsed: unknown = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as Ev[]) : [];
          } catch {
            return [];
          }
        },
      }),
    );

    act(() => {
      result.current[1]([
        { id: "1", source: "local" },
        { id: "2", source: "rpc" },
      ]);
    });

    expect(result.current[0]).toEqual([
      { id: "1", source: "local" },
      { id: "2", source: "rpc" },
    ]);
    expect(JSON.parse(localStorage.getItem("events") ?? "[]")).toEqual([{ id: "1", source: "local" }]);
  });

  it("falls back to in-memory state when setItem throws", () => {
    const setItem = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      const { result } = renderHook(() => useLocalStorageState("count", 0));
      act(() => {
        result.current[1](9);
      });
      expect(result.current[0]).toBe(9);
    } finally {
      setItem.mockRestore();
    }
  });

  it("invokes onError when write fails", () => {
    const errors: unknown[] = [];
    const setItem = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      const { result } = renderHook(() =>
        useLocalStorageState("count", 0, {
          onError: e => {
            errors.push(e);
          },
        }),
      );
      act(() => {
        result.current[1](1);
      });
      expect(errors).toHaveLength(1);
      expect(result.current[0]).toBe(1);
    } finally {
      setItem.mockRestore();
    }
  });

  it("re-reads storage when the key changes", () => {
    localStorage.setItem("a", JSON.stringify("alpha"));
    localStorage.setItem("b", JSON.stringify("beta"));
    const { result, rerender } = renderHook(({ key }) => useLocalStorageState(key, "default"), {
      initialProps: { key: "a" },
    });
    expect(result.current[0]).toBe("alpha");

    rerender({ key: "b" });
    expect(result.current[0]).toBe("beta");
  });
});
