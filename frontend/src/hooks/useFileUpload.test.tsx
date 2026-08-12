import { afterEach, beforeEach, describe, expect, it, jest, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { ChangeEvent, MutableRefObject } from "react";
import { readFileAsBase64, useFileUpload } from "./useFileUpload.ts";

function makeFile(name: string, content: string, options?: { type?: string; sizeOverride?: number }): File {
  const file = new File([content], name, { type: options?.type ?? "text/plain" });
  if (options?.sizeOverride != null) {
    Object.defineProperty(file, "size", { value: options.sizeOverride });
  }
  return file;
}

function makeChangeEvent(files: File[]): ChangeEvent<HTMLInputElement> {
  const input = document.createElement("input");
  input.type = "file";
  Object.defineProperty(input, "files", {
    value: {
      length: files.length,
      item: (i: number) => files[i] ?? null,
      [Symbol.iterator]: function* () {
        for (const f of files) yield f;
      },
      ...Object.fromEntries(files.map((f, i) => [i, f])),
    },
  });
  return { target: input } as unknown as ChangeEvent<HTMLInputElement>;
}

describe("readFileAsBase64", () => {
  it("returns base64 payload without data-URL prefix", async () => {
    const file = makeFile("a.bin", "hello");
    const b64 = await readFileAsBase64(file);
    expect(b64).toBe(btoa("hello"));
    expect(b64.includes(",")).toBe(false);
    expect(b64.startsWith("data:")).toBe(false);
  });
});

describe("useFileUpload", () => {
  let confirmSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    confirmSpy = mock(() => true);
    // jsdom may not define window.confirm; use a writable mock
    Object.defineProperty(window, "confirm", {
      configurable: true,
      writable: true,
      value: confirmSpy,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks?.();
  });

  it("reads utf8 content by default and reports upload counts", async () => {
    const uploadFile = mock(async (_args: { filePath: string; content: string; encoding: string }) => undefined);
    const onComplete = mock();

    const { result } = renderHook(() =>
      useFileUpload({
        uploadFile,
        onComplete,
      }),
    );

    expect(result.current.encoding).toBe("utf8");
    expect(result.current.isUploading).toBe(false);

    await act(async () => {
      await result.current.onChange(makeChangeEvent([makeFile("a.txt", "hello world")]));
    });

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile.mock.calls[0]?.[0]).toEqual({
      filePath: "a.txt",
      content: "hello world",
      encoding: "utf8",
    });
    expect(onComplete).toHaveBeenCalledWith({ uploaded: 1, skipped: 0, failed: 0 });
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadingFiles).toEqual([]);
  });

  it("reads base64 content when encoding is base64", async () => {
    const uploadFile = mock(async (_args: { filePath: string; content: string; encoding: string }) => undefined);
    const binary = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const file = new File([binary], "img.png", { type: "image/png" });

    const { result } = renderHook(() =>
      useFileUpload({
        encoding: "base64",
        uploadFile,
      }),
    );

    expect(result.current.encoding).toBe("base64");

    await act(async () => {
      await result.current.onChange(makeChangeEvent([file]));
    });

    expect(uploadFile).toHaveBeenCalledTimes(1);
    const args = uploadFile.mock.calls[0]?.[0];
    expect(args).toBeDefined();
    expect(args!.filePath).toBe("img.png");
    expect(args!.encoding).toBe("base64");
    // Round-trip: decode base64 back to original bytes
    const decoded = Uint8Array.from(atob(args!.content), c => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("skips files over maxSize and invokes onSkip", async () => {
    const uploadFile = mock(async () => undefined);
    const onSkip = mock();
    const onComplete = mock();

    const { result } = renderHook(() =>
      useFileUpload({
        maxSize: 10,
        maxSizeLabel: "10 B",
        uploadFile,
        onSkip,
        onComplete,
      }),
    );

    await act(async () => {
      await result.current.onChange(makeChangeEvent([makeFile("big.txt", "short", { sizeOverride: 100 })]));
    });

    expect(uploadFile).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledWith({
      fileName: "big.txt",
      reason: "size",
      detail: `"big.txt" exceeds 10 B limit`,
    });
    expect(onComplete).toHaveBeenCalledWith({ uploaded: 0, skipped: 1, failed: 0 });
  });

  it("skips invalid file names via validateFileName", async () => {
    const uploadFile = mock(async () => undefined);
    const onSkip = mock();

    const { result } = renderHook(() =>
      useFileUpload({
        uploadFile,
        validateFileName: name => (/^[a-z]+$/.test(name) ? true : `bad name: ${name}`),
        onSkip,
      }),
    );

    await act(async () => {
      await result.current.onChange(makeChangeEvent([makeFile("Bad Name!.txt", "x")]));
    });

    expect(uploadFile).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledWith({
      fileName: "Bad Name!.txt",
      reason: "invalid-name",
      detail: "bad name: Bad Name!.txt",
    });
  });

  it("prompts for overwrite when checkExists reports true", async () => {
    const uploadFile = mock(async () => undefined);
    confirmSpy.mockReturnValue(true);

    const { result } = renderHook(() =>
      useFileUpload({
        uploadFile,
        checkExists: async () => ({ exists: true }),
      }),
    );

    await act(async () => {
      await result.current.onChange(makeChangeEvent([makeFile("a.txt", "hi")]));
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  it("skips when overwrite is declined", async () => {
    const uploadFile = mock(async () => undefined);
    const onSkip = mock();
    confirmSpy.mockReturnValue(false);

    const { result } = renderHook(() =>
      useFileUpload({
        uploadFile,
        checkExists: async () => ({ exists: true }),
        onSkip,
      }),
    );

    await act(async () => {
      await result.current.onChange(makeChangeEvent([makeFile("a.txt", "hi")]));
    });

    expect(uploadFile).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledWith({ fileName: "a.txt", reason: "exists" });
  });

  it("counts failures and invokes onError", async () => {
    const err = new Error("network");
    const uploadFile = mock(async () => {
      throw err;
    });
    const onError = mock();
    const onComplete = mock();

    const { result } = renderHook(() =>
      useFileUpload({
        uploadFile,
        onError,
        onComplete,
      }),
    );

    await act(async () => {
      await result.current.onChange(makeChangeEvent([makeFile("a.txt", "hi")]));
    });

    expect(onError).toHaveBeenCalledWith({ fileName: "a.txt", error: err });
    expect(onComplete).toHaveBeenCalledWith({ uploaded: 0, skipped: 0, failed: 1 });
  });

  it("trigger opens the file input", () => {
    const { result } = renderHook(() =>
      useFileUpload({
        uploadFile: async () => undefined,
      }),
    );

    const click = mock();
    // Assign a real input so trigger can call .click()
    const input = document.createElement("input");
    input.click = click as unknown as typeof input.click;
    // inputRef is a RefObject; assign via mutable cast for the test
    (result.current.inputRef as MutableRefObject<HTMLInputElement | null>).current = input;

    act(() => {
      result.current.trigger();
    });

    expect(click).toHaveBeenCalled();
  });
});
