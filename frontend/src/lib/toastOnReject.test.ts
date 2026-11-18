import { beforeEach, describe, expect, it, mock } from "bun:test";

const toastError = mock((_message: string, _opts?: { duration?: number }) => "id");
const toastWarning = mock((_message: string, _opts?: { duration?: number }) => "id");

void mock.module("../components/ui/toast.tsx", () => ({
  toastManager: {
    error: toastError,
    warning: toastWarning,
    success: mock(),
    info: mock(),
    remove: mock(),
  },
}));

const { toastOnReject } = await import("./toastOnReject.ts");

describe("toastOnReject", () => {
  beforeEach(() => {
    toastError.mockClear();
    toastWarning.mockClear();
  });

  it("does nothing when the promise resolves", async () => {
    toastOnReject(Promise.resolve("ok"));
    await Promise.resolve();
    expect(toastError).not.toHaveBeenCalled();
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("toasts formatError(message) on rejection by default", async () => {
    toastOnReject(Promise.reject(new Error("network down")));
    await Promise.resolve();
    await Promise.resolve();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(String(toastError.mock.calls[0]![0])).toContain("network down");
    expect(toastError.mock.calls[0]![1]).toEqual({ duration: 5000 });
  });

  it("uses a custom string message", async () => {
    toastOnReject(Promise.reject(new Error("ignored")), { message: "Failed to refresh", duration: 3000 });
    await Promise.resolve();
    await Promise.resolve();
    expect(toastError).toHaveBeenCalledWith("Failed to refresh", { duration: 3000 });
  });

  it("uses a message factory", async () => {
    toastOnReject(Promise.reject(new Error("boom")), {
      message: err => `Refresh failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(toastError).toHaveBeenCalledWith("Refresh failed: boom", { duration: 5000 });
  });

  it("can emit a warning toast", async () => {
    toastOnReject(Promise.reject(new Error("soft")), { type: "warning", message: "Soft failure" });
    await Promise.resolve();
    await Promise.resolve();
    expect(toastWarning).toHaveBeenCalledWith("Soft failure", { duration: 5000 });
    expect(toastError).not.toHaveBeenCalled();
  });
});
