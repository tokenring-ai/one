import { type ChangeEvent, type RefObject, useCallback, useRef, useState } from "react";
import { useRefSync } from "./useRefSync.ts";

/** How file content is read and passed to `uploadFile`. */
export type FileUploadEncoding = "utf8" | "base64";

export interface FileUploadOptions {
  /** Maximum file size in bytes (default: 5MB for utf8, 10MB for base64) */
  maxSize?: number;
  /** Human-readable size limit for skip/error messages (default derived from encoding) */
  maxSizeLabel?: string;
  /**
   * How to read file content before upload.
   * - `"utf8"`: `file.text()` — text files (default)
   * - `"base64"`: FileReader.readAsDataURL — binary-safe; payload only (no data-URL prefix)
   */
  encoding?: FileUploadEncoding;
  /**
   * Upload a single file. Receives the file name (not full path), content, and encoding.
   * Throws on failure.
   */
  uploadFile: (args: { filePath: string; content: string; encoding: FileUploadEncoding }) => Promise<void>;
  /**
   * Check if a destination already exists. Omit or pass `undefined` to skip existence checks.
   * When `askOverwrite` is true and the file exists, the user is prompted before uploading.
   */
  checkExists?: (args: { filePath: string }) => Promise<{ exists: boolean }>;
  /** Called after all files are processed (success or failure) */
  onComplete?: (result: { uploaded: number; skipped: number; failed: number }) => void;
  /** Prompt for overwrite when `checkExists` reports the file exists (default: true) */
  askOverwrite?: boolean;
  /**
   * Validate a file name before upload.
   * Return `true` to accept, `false` to skip, or a string error message to skip with detail.
   */
  validateFileName?: (name: string) => boolean | string;
  /** Called when a file is skipped (size, exists, or invalid name) */
  onSkip?: (args: { fileName: string; reason: "size" | "exists" | "invalid-name"; detail?: string | undefined }) => void;
  /** Called when a file upload throws */
  onError?: (args: { fileName: string; error: unknown }) => void;
}

export interface UseFileUploadReturn {
  /** Ref for the hidden file input element */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Programmatically open the file picker dialog */
  trigger: () => void;
  /** Handler for the input's onChange event */
  onChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  /** List of file names currently being uploaded */
  uploadingFiles: string[];
  /** Whether any files are currently uploading */
  isUploading: boolean;
  /** Encoding used for file content */
  encoding: FileUploadEncoding;
}

function defaultMaxSize(encoding: FileUploadEncoding): number {
  return encoding === "base64" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
}

function defaultMaxSizeLabel(encoding: FileUploadEncoding): string {
  return encoding === "base64" ? "10 MB" : "5 MB";
}

/** Read a File as a base64 payload (no data-URL prefix). */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read "${file.name}"`));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",", 2)[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}

async function readFileContent(file: File, encoding: FileUploadEncoding): Promise<string> {
  if (encoding === "base64") {
    return readFileAsBase64(file);
  }
  return file.text();
}

/**
 * Manage multi-file upload workflow with progress tracking, size validation,
 * optional overwrite confirmation, and utf8 or base64 content encoding.
 *
 * @example
 * const upload = useFileUpload({
 *   encoding: "base64",
 *   uploadFile: async ({ filePath, content, encoding }) => {
 *     await filesystemRPCClient.writeFile({ path: dest, content, encoding, provider });
 *   },
 *   checkExists: async ({ filePath }) => filesystemRPCClient.exists({ path: dest, provider }),
 *   onComplete: async ({ uploaded }) => {
 *     if (uploaded > 0) await refreshListing();
 *   },
 * });
 *
 * <input ref={upload.inputRef} type="file" multiple onChange={upload.onChange} className="hidden" />
 * <button onClick={upload.trigger}>Upload</button>
 */
export function useFileUpload(options: FileUploadOptions): UseFileUploadReturn {
  const {
    encoding = "utf8",
    maxSize = defaultMaxSize(encoding),
    maxSizeLabel = defaultMaxSizeLabel(encoding),
    uploadFile,
    checkExists,
    onComplete,
    askOverwrite = true,
    validateFileName,
    onSkip,
    onError,
  } = options;

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  // Keep latest callbacks in refs so onChange stays stable across parent re-renders.
  const uploadFileRef = useRefSync(uploadFile);
  const checkExistsRef = useRefSync(checkExists);
  const onCompleteRef = useRefSync(onComplete);
  const validateFileNameRef = useRefSync(validateFileName);
  const onSkipRef = useRefSync(onSkip);
  const onErrorRef = useRefSync(onError);

  const trigger = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      const names = Array.from(files).map(f => f.name);
      setUploadingFiles(names);

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;

      for (const file of Array.from(files)) {
        const validation = validateFileNameRef.current?.(file.name);
        if (validation === false || typeof validation === "string") {
          skipped++;
          onSkipRef.current?.({
            fileName: file.name,
            reason: "invalid-name",
            detail: typeof validation === "string" ? validation : undefined,
          });
          continue;
        }

        if (file.size > maxSize) {
          skipped++;
          onSkipRef.current?.({
            fileName: file.name,
            reason: "size",
            detail: `"${file.name}" exceeds ${maxSizeLabel} limit`,
          });
          continue;
        }

        try {
          if (checkExistsRef.current) {
            const { exists } = await checkExistsRef.current({ filePath: file.name });
            if (exists) {
              if (askOverwrite) {
                const confirmed = window.confirm(`"${file.name}" already exists. Overwrite?`);
                if (!confirmed) {
                  skipped++;
                  onSkipRef.current?.({ fileName: file.name, reason: "exists" });
                  continue;
                }
              } else {
                skipped++;
                onSkipRef.current?.({ fileName: file.name, reason: "exists" });
                continue;
              }
            }
          }

          const content = await readFileContent(file, encoding);
          await uploadFileRef.current({ filePath: file.name, content, encoding });
          uploaded++;
        } catch (error: unknown) {
          failed++;
          onErrorRef.current?.({ fileName: file.name, error });
        }
      }

      setUploadingFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      onCompleteRef.current?.({ uploaded, skipped, failed });
    },
    [encoding, maxSize, maxSizeLabel, askOverwrite],
  );

  return {
    inputRef,
    trigger,
    onChange,
    uploadingFiles,
    isUploading: uploadingFiles.length > 0,
    encoding,
  };
}
