/**
 * Layout persistence: localStorage for first paint, a remote store (the
 * dashboard RPC) as the source of truth across devices. Saves are debounced
 * and serialised; a conflict means another client saved first, and we adopt
 * its layout.
 *
 * A saved layout is never overwritten blind: until this browser has seen a
 * server stamp, saves are create-only (expected stamp 0), so an existing
 * record comes back as a conflict and is adopted instead.
 */
import type { LayoutStore } from "./store.ts";
import type { UserAppMeta } from "./types.ts";

export interface RemoteLayout {
  layout: string;
  updatedAt: number;
}

export interface RemoteLayoutSummary {
  id: string;
  updatedAt: number;
  app?: UserAppMeta;
}

export interface LayoutRemote {
  get(id: string): Promise<RemoteLayout | null>;
  /** `app` marks the record as a user app; omitted, the server keeps whatever it stored. */
  save(
    id: string,
    layout: string,
    expectedUpdatedAt: number | undefined,
    app?: UserAppMeta,
  ): Promise<{ status: "ok"; updatedAt: number } | { status: "conflict"; record: RemoteLayout }>;
  remove(id: string): Promise<void>;
  list(): Promise<RemoteLayoutSummary[]>;
}

interface LocalRecord {
  layout: unknown;
  updatedAt: number | null;
}

const LOCAL_PREFIX = "tokenring-layout:";
/** Expected stamp for a save that must not replace an existing record (server stamps are positive). */
const CREATE_ONLY = 0;
const SAVE_DELAY_MS = 500;

/** Remote record id for an app. Kebab-case to satisfy the RPC's id rule. */
export function layoutRecordId(appId: string): string {
  return `layout-${appId}`;
}

function readLocal(appId: string): LocalRecord | null {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + appId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalRecord>;
    return { layout: parsed.layout, updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : null };
  } catch {
    return null;
  }
}

function writeLocal(appId: string, record: LocalRecord) {
  try {
    localStorage.setItem(LOCAL_PREFIX + appId, JSON.stringify(record));
  } catch {
    // Storage full or blocked: the remote copy still saves.
  }
}

function clearLocal(appId: string) {
  try {
    localStorage.removeItem(LOCAL_PREFIX + appId);
  } catch {
    // ignore
  }
}

/** The locally cached layout for first paint, or undefined. */
export function initialLayout(appId: string): unknown {
  return readLocal(appId)?.layout;
}

/**
 * Wires a store to local + remote storage. Returns a disposer that flushes
 * a pending save.
 */
export function attachPersistence(store: LayoutStore, appId: string, remote: LayoutRemote | null): () => void {
  let serverStamp: number | undefined = readLocal(appId)?.updatedAt ?? undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let disposed = false;
  let dirtySinceLoad = false;
  /** The layout as last saved to or adopted from the server; a save of the same layout is skipped. */
  let synced: string | null = null;

  const push = () => {
    timer = null;
    if (!remote) return;
    chain = chain.then(async () => {
      try {
        const json = JSON.stringify(store.getState());
        if (json === synced) return;
        const result = await remote.save(layoutRecordId(appId), json, serverStamp ?? CREATE_ONLY);
        if (result.status === "ok") {
          serverStamp = result.updatedAt;
          synced = json;
          writeLocal(appId, { layout: store.getState(), updatedAt: serverStamp });
        } else {
          serverStamp = result.record.updatedAt;
          // A record we can't use (newer schema, corrupt): replace it, now knowingly, with ours.
          if (!adopt(result.record) && !disposed) schedule();
        }
      } catch (error) {
        console.warn("[layout] save failed; keeping the local copy", error);
      }
    });
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, SAVE_DELAY_MS);
  };

  const adopt = (record: RemoteLayout): boolean => {
    try {
      if (!store.adoptRemote(JSON.parse(record.layout))) return false;
      synced = JSON.stringify(store.getState());
      writeLocal(appId, { layout: store.getState(), updatedAt: record.updatedAt });
      return true;
    } catch {
      return false;
    }
  };

  const unsubscribe = store.subscribe(change => {
    if (change === "remote") return;
    dirtySinceLoad = true;
    writeLocal(appId, { layout: store.getState(), updatedAt: serverStamp ?? null });
    schedule();
  });

  if (remote) {
    // Queued first, so every save waits for the initial load to settle.
    chain = chain.then(async () => {
      try {
        const record = await remote.get(layoutRecordId(appId));
        if (disposed || !record) return;
        if (serverStamp === undefined) {
          // Never synced: whatever is on screen is the template (or an unsynced local copy), not the user's
          // saved layout. The saved one wins, even over edits made while it loaded.
          serverStamp = record.updatedAt;
          adopt(record);
        } else if (!dirtySinceLoad && record.updatedAt > serverStamp) {
          // Newer than what this browser last saw and not edited since. With edits, the next save
          // conflicts on the stale stamp and adopts the server copy then.
          serverStamp = record.updatedAt;
          adopt(record);
        }
      } catch (error) {
        // serverStamp stays as it was; without one the next save is create-only.
        console.warn("[layout] could not load the saved layout", error);
      }
    });
  }

  return () => {
    disposed = true;
    unsubscribe();
    if (timer) {
      clearTimeout(timer);
      push();
    }
  };
}

/**
 * Saves a layout under a new or given record (a user app) remotely, then locally.
 * With `createOnly`, an existing record is left alone and this returns false.
 */
export async function saveNewLayout(
  appId: string,
  layout: unknown,
  remote: LayoutRemote | null,
  app: UserAppMeta,
  { createOnly = false }: { createOnly?: boolean } = {},
): Promise<boolean> {
  if (!remote) {
    if (createOnly && readLocal(appId)) return false;
    writeLocal(appId, { layout, updatedAt: null });
    return true;
  }
  const result = await remote.save(layoutRecordId(appId), JSON.stringify(layout), createOnly ? CREATE_ONLY : undefined, app);
  if (result.status !== "ok") return false;
  writeLocal(appId, { layout, updatedAt: result.updatedAt });
  return true;
}

/** Forget an app's saved layout everywhere (used by "Reset" when the user wants the shipped layout back for good). */
export async function forgetLayout(appId: string, remote: LayoutRemote | null): Promise<void> {
  clearLocal(appId);
  await remote?.remove(layoutRecordId(appId));
}
