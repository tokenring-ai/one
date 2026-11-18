import { useSyncExternalStore } from "react";
import { INITIAL_CONTENT } from "./constants.ts";
import type { TextSelection } from "./types.ts";

/**
 * The open document, shared by the editor, preview and AI-edit panels.
 *
 * In the single-page version these were sibling `useState`s in one component,
 * and the AI panel reached into the editor's `textareaRef` to restore the caret
 * after applying a suggestion. Each panel is now its own React subtree, so the
 * document lives here and the caret hand-off is an explicit request the editor
 * fulfils (see {@link caretRequest}) rather than a cross-component ref poke.
 *
 * The working draft (text, saved baseline, title and file) is also
 * mirrored to localStorage and restored on load. Documents shows unsaved edits
 * as a tab badge rather than a beforeunload prompt, which is only safe if a
 * reload or closed tab cannot lose them.
 */

export interface DocumentsState {
  content: string;
  savedContent: string;
  title: string;
  filePath: string | null;
  selection: TextSelection | null;
  aiPrompt: string;
  /**
   * Asks the editor to place the caret at `position` and take focus. `nonce`
   * makes repeated requests to the same position distinguishable.
   */
  caretRequest: { position: number; nonce: number } | null;
  /**
   * Asks the editor to replace `start..end` with `text` as a native edit, so
   * the browser's undo (Ctrl/⌘+Z) can take it back.
   */
  replaceRequest: { start: number; end: number; text: string; nonce: number } | null;
  /** Asks the AI panel to focus its instruction field. */
  aiFocusNonce: number;
}

export const DRAFT_STORAGE_KEY = "tokenring.documents.draft";
/** Drafts larger than this (in UTF-16 chars, both texts together) are not persisted. */
export const MAX_PERSISTED_DRAFT_CHARS = 1_000_000;

interface PersistedDraft {
  content: string;
  savedContent: string;
  title: string;
  filePath: string | null;
}

function isPersistedDraft(value: unknown): value is PersistedDraft {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.content === "string" &&
    typeof v.savedContent === "string" &&
    typeof v.title === "string" &&
    (v.filePath === null || typeof v.filePath === "string")
  );
}

function readPersistedDraft(): PersistedDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPersistedDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

let lastPersisted: PersistedDraft | null = null;
let pendingWrite: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DELAY_MS = 300;

/** Mirrors the draft shortly after the last change, so typing does not serialise the document per keystroke. */
function persistDraft(): void {
  if (pendingWrite !== null) return;
  pendingWrite = setTimeout(flushDocumentsDraft, PERSIST_DELAY_MS);
}

/** Writes any pending draft now (page hide, tests). */
export function flushDocumentsDraft(): void {
  if (pendingWrite !== null) {
    clearTimeout(pendingWrite);
    pendingWrite = null;
  }
  writeDraft(state);
}

if (typeof window !== "undefined") {
  // A closing tab may not wait for the debounce.
  window.addEventListener("pagehide", flushDocumentsDraft);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushDocumentsDraft();
  });
}

function writeDraft(next: DocumentsState): void {
  if (
    lastPersisted &&
    lastPersisted.content === next.content &&
    lastPersisted.savedContent === next.savedContent &&
    lastPersisted.title === next.title &&
    lastPersisted.filePath === next.filePath
  ) {
    return;
  }
  const draft: PersistedDraft = {
    content: next.content,
    savedContent: next.savedContent,
    title: next.title,
    filePath: next.filePath,
  };
  lastPersisted = draft;
  try {
    // The untouched welcome document needs no draft.
    const pristine = draft.content === INITIAL_CONTENT && draft.savedContent === INITIAL_CONTENT && draft.filePath === null;
    if (pristine || draft.content.length + draft.savedContent.length > MAX_PERSISTED_DRAFT_CHARS) {
      // Too large to mirror: drop any older draft rather than restore stale text later.
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable (private mode / quota): the in-memory document still works.
  }
}

function initialState(): DocumentsState {
  const draft = readPersistedDraft();
  return {
    ...blankState(),
    ...draft,
  };
}

function blankState(): DocumentsState {
  return {
    content: INITIAL_CONTENT,
    savedContent: INITIAL_CONTENT,
    title: "Untitled Document",
    filePath: null,
    selection: null,
    aiPrompt: "",
    caretRequest: null,
    replaceRequest: null,
    aiFocusNonce: 0,
  };
}

let state: DocumentsState = initialState();
const listeners = new Set<() => void>();

function set(patch: Partial<DocumentsState>) {
  state = { ...state, ...patch };
  persistDraft();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DocumentsState {
  return state;
}

export function useDocumentsState(): DocumentsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function titleFromPath(path: string): string {
  const name = path.split("/").pop() || path;
  return name.replace(/\.md$/i, "") || "Untitled Document";
}

export function setContent(content: string): void {
  set({ content });
}

export function setSelection(selection: TextSelection | null): void {
  set({ selection });
}

export function setTitle(title: string): void {
  set({ title });
}

export function setAiPrompt(aiPrompt: string): void {
  set({ aiPrompt });
}

/**
 * A canonical path for the same file (relative `notes.md` → `/workspace/notes.md`)
 * keeps a custom title. A different file name takes its title from the path.
 */
function pathUpdate(filePath: string | undefined): Partial<Pick<DocumentsState, "filePath" | "title">> {
  if (filePath === undefined || filePath === state.filePath) return {};
  if (state.filePath !== null && titleFromPath(filePath) === titleFromPath(state.filePath)) return { filePath };
  return { filePath, title: titleFromPath(filePath) };
}

/**
 * Records a completed write. `content` is what was sent to disk, not the store's
 * current text: the user may have kept typing while the write was in flight, and
 * those edits must stay dirty rather than becoming the saved baseline.
 */
export function markSaved(patch: { content: string; filePath?: string }): void {
  set({
    savedContent: patch.content,
    ...pathUpdate(patch.filePath),
  });
}

/**
 * Appends text to the open document. A clean document stays clean: the same
 * bytes were just written to the file, so a later save must not drop them.
 * `filePath`, when the write was retargeted onto an absolute path, is that path.
 */
export function appendDocumentText(text: string, filePath?: string): void {
  const wasClean = state.content === state.savedContent;
  const next = state.content + text;
  set(wasClean ? { content: next, savedContent: next, ...pathUpdate(filePath) } : { content: next, ...pathUpdate(filePath) });
}

/** Replaces the whole document — opening a file, starting a new one. */
export function loadDocument(opts: { content: string; path: string | null; title?: string | undefined }): void {
  set({
    content: opts.content,
    savedContent: opts.content,
    filePath: opts.path,
    title: opts.title ?? (opts.path ? titleFromPath(opts.path) : "Untitled Document"),
    selection: null,
    aiPrompt: "",
    caretRequest: null,
    replaceRequest: null,
  });
}

export function resetToNewDocument(): void {
  loadDocument({ content: INITIAL_CONTENT, path: null, title: "Untitled Document" });
}

/**
 * Applies an AI suggestion over the selection. The editor performs the edit
 * (see {@link replaceRequest}) so it lands on the textarea's undo stack.
 */
export function applyEditToSelection(replacement: string, selection: TextSelection): void {
  set({
    selection: null,
    aiPrompt: "",
    replaceRequest: { start: selection.start, end: selection.end, text: replacement, nonce: (state.replaceRequest?.nonce ?? 0) + 1 },
  });
}

/**
 * Fallback for {@link applyEditToSelection} when the editor cannot perform a
 * native edit: splices the text in directly and asks for the caret.
 */
export function spliceContent(start: number, end: number, text: string): void {
  set({
    content: state.content.slice(0, start) + text + state.content.slice(end),
    caretRequest: { position: start + text.length, nonce: (state.caretRequest?.nonce ?? 0) + 1 },
  });
}

export function clearReplaceRequest(): void {
  if (state.replaceRequest) set({ replaceRequest: null });
}

/** "Ask AI" from the editor: the AI panel focuses its instruction field. */
export function requestAiFocus(): void {
  set({ aiFocusNonce: state.aiFocusNonce + 1 });
}

export function clearCaretRequest(): void {
  if (state.caretRequest) set({ caretRequest: null });
}

/** Test seam: back to the welcome document, with any persisted draft dropped. */
export function resetDocumentsStore(): void {
  if (pendingWrite !== null) {
    clearTimeout(pendingWrite);
    pendingWrite = null;
  }
  lastPersisted = null;
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
  state = blankState();
  for (const listener of listeners) listener();
}

/** Test seam: re-reads the persisted draft, as a page reload would. */
export function reloadDocumentsStoreFromStorage(): void {
  flushDocumentsDraft();
  lastPersisted = null;
  state = initialState();
  for (const listener of listeners) listener();
}
