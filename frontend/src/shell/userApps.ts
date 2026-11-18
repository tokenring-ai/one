/**
 * User-saved apps: a named arrangement saved from a shipped app, served at
 * `/my/<slug>`. The arrangement lives in the layout record (`layout-my-<slug>`)
 * together with its name; the app manifest is the base app's, renamed.
 */
import { useSyncExternalStore } from "react";
import { forgetLayout, type LayoutRemote, layoutRecordId, saveNewLayout } from "../layout/persistence.ts";
import type { AppManifest, LayoutState, UserAppMeta } from "../layout/types.ts";

export const USER_APP_PREFIX = "my-";
export const USER_APP_BASE_PATH = "/my";

export interface UserApp {
  /** App id, `my-<slug>`. */
  id: string;
  slug: string;
  meta: UserAppMeta;
}

interface Snapshot {
  loaded: boolean;
  apps: readonly UserApp[];
}

let snapshot: Snapshot = { loaded: false, apps: [] };
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribeUserApps(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUserApps(): Snapshot {
  return snapshot;
}

export function useUserApps(): Snapshot {
  return useSyncExternalStore(subscribeUserApps, getUserApps, getUserApps);
}

export function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "app"
  );
}

/** Candidate slugs for a name, skipping ones this client knows are taken. */
function* slugCandidates(label: string): Generator<string> {
  const base = slugify(label);
  const taken = new Set(snapshot.apps.map(a => a.slug));
  for (let n = 1; n <= MAX_SLUG_ATTEMPTS; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!taken.has(slug)) yield slug;
  }
}

const MAX_SLUG_ATTEMPTS = 100;

/** A user app's manifest: the base app's views and template under the user's name and path. */
export function userAppManifest(app: UserApp, base: AppManifest): AppManifest {
  // A saved app is its own arrangement: the base's layout version never discards it.
  const { aliases: _aliases, layoutVersion: _layoutVersion, ...rest } = base;
  return { ...rest, id: app.id, path: `${USER_APP_BASE_PATH}/${app.slug}`, label: app.meta.label, basedOn: base.id, hidden: false };
}

export async function loadUserApps(remote: LayoutRemote): Promise<void> {
  try {
    const records = await remote.list();
    const recordPrefix = layoutRecordId(USER_APP_PREFIX);
    const apps = records.flatMap(record => {
      if (!record.app || !record.id.startsWith(recordPrefix)) return [];
      const slug = record.id.slice(recordPrefix.length);
      return slug ? [{ id: `${USER_APP_PREFIX}${slug}`, slug, meta: record.app }] : [];
    });
    publish({ loaded: true, apps: apps.sort((a, b) => a.meta.label.localeCompare(b.meta.label)) });
  } catch (error) {
    console.warn("[shell] could not load saved apps", error);
    publish({ ...snapshot, loaded: true });
  }
}

/**
 * Saves the given layout as a new app and returns its path. The in-memory list
 * may be stale or failed to load, so each slug is claimed create-only: one the
 * server already has is skipped, never overwritten.
 */
export async function createUserApp(label: string, base: AppManifest, layout: LayoutState, remote: LayoutRemote | null): Promise<string> {
  const meta: UserAppMeta = { label: label.trim(), icon: "layout", basedOn: base.basedOn ?? base.id };
  for (const slug of slugCandidates(label)) {
    const id = `${USER_APP_PREFIX}${slug}`;
    const copy: LayoutState = { ...structuredClone(layout), app: id, maximized: null };
    if (!(await saveNewLayout(id, copy, remote, meta, { createOnly: true }))) continue;
    publish({ loaded: true, apps: [...snapshot.apps, { id, slug, meta }].sort((a, b) => a.meta.label.localeCompare(b.meta.label)) });
    return `${USER_APP_BASE_PATH}/${slug}`;
  }
  throw new Error(`Could not find a free name for "${meta.label}"`);
}

export async function renameUserApp(id: string, label: string, layout: LayoutState, remote: LayoutRemote | null): Promise<void> {
  const app = snapshot.apps.find(a => a.id === id);
  if (!app) return;
  const meta: UserAppMeta = { ...app.meta, label: label.trim() };
  await saveNewLayout(id, layout, remote, meta);
  publish({ ...snapshot, apps: snapshot.apps.map(a => (a.id === id ? { ...a, meta } : a)) });
}

export async function deleteUserApp(id: string, remote: LayoutRemote | null): Promise<void> {
  await forgetLayout(id, remote);
  publish({ ...snapshot, apps: snapshot.apps.filter(a => a.id !== id) });
}

/** Test hook. */
export function resetUserAppsForTests(apps: UserApp[] = [], loaded = true) {
  publish({ loaded, apps });
}
