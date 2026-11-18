import { afterEach, describe, expect, test } from "bun:test";
import { List, MessageSquare } from "lucide-react";
import { defineApp, defineView } from "./define.ts";
import { attachPersistence, initialLayout, type LayoutRemote, layoutRecordId, type RemoteLayout } from "./persistence.ts";
import { createLayoutRegistry } from "./registry.ts";
import { LayoutStore } from "./store.ts";

const registry = createLayoutRegistry({
  kinds: [{ id: "agent", label: "Agents", plural: "agent chats" }],
  views: [
    defineView({
      id: "chat",
      kind: "agent",
      title: p => p.agentId ?? "Chat",
      icon: MessageSquare,
      route: "agent/:agentId",
      instanceKey: p => p.agentId ?? "",
      component: () => null,
    }),
  ],
  apps: [
    defineApp({
      id: "persist",
      path: "/persist",
      label: "Persist",
      description: "",
      icon: List,
      group: "Build",
      views: ["chat"],
      primaryKind: "agent",
      layout: { presenter: "tabs", accepts: ["agent"], primary: true },
    }),
  ],
});
const APP = "persist";
const RECORD = layoutRecordId(APP);

function newStore(initial?: unknown) {
  return new LayoutStore(registry.modelContext(APP), registry.lookup, registry.app(APP)!.layout, initial);
}

function openChat(store: LayoutStore, agentId: string) {
  store.dispatch({ type: "open", panel: { key: `chat:${agentId}`, viewId: "chat", kind: "agent", params: { agentId } } });
}

const panelKeys = (store: LayoutStore) => Object.keys(store.getState().panels).sort();

/** A remote with the dashboard service's conflict rule: a defined expected stamp older than the record conflicts. */
function fakeRemote(get: (id: string) => Promise<RemoteLayout | null>) {
  const records = new Map<string, RemoteLayout>();
  const saves: { expected: number | undefined }[] = [];
  let stamp = 100;
  const remote: LayoutRemote = {
    get,
    async save(id, layout, expected) {
      saves.push({ expected });
      const existing = records.get(id);
      if (existing && expected !== undefined && existing.updatedAt > expected) return { status: "conflict", record: existing };
      stamp += 1;
      records.set(id, { layout, updatedAt: stamp });
      return { status: "ok", updatedAt: stamp };
    },
    async remove(id) {
      records.delete(id);
    },
    list: async () => [],
  };
  return { remote, records, saves };
}

/** The user's saved layout on the server: chats x and y. */
function savedLayout(): RemoteLayout {
  const other = newStore();
  openChat(other, "x");
  openChat(other, "y");
  return { layout: JSON.stringify(other.getState()), updatedAt: 50 };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 650));

describe("layout persistence", () => {
  afterEach(() => localStorage.clear());

  test("edits made while the saved layout loads never overwrite it; the saved layout is adopted", async () => {
    let resolveGet!: (record: RemoteLayout | null) => void;
    const { remote, records, saves } = fakeRemote(() => new Promise(resolve => (resolveGet = resolve)));
    const saved = savedLayout();
    records.set(RECORD, saved);

    const store = newStore(initialLayout(APP));
    const detach = attachPersistence(store, APP, remote);
    openChat(store, "template-edit");
    await settle();
    // The debounced save waits behind the load.
    expect(saves).toEqual([]);

    resolveGet(saved);
    await settle();
    expect(panelKeys(store)).toEqual(["chat:x", "chat:y"]);
    expect(records.get(RECORD)).toEqual(saved);
    detach();
  });

  test("when the load fails with no local copy, the next save is create-only and adopts the existing layout", async () => {
    const { remote, records, saves } = fakeRemote(() => Promise.reject(new Error("offline")));
    const saved = savedLayout();
    records.set(RECORD, saved);

    const store = newStore(initialLayout(APP));
    const detach = attachPersistence(store, APP, remote);
    openChat(store, "template-edit");
    await settle();

    expect(saves[0]?.expected).toBe(0);
    expect(records.get(RECORD)).toEqual(saved);
    expect(panelKeys(store)).toEqual(["chat:x", "chat:y"]);
    // Now in sync: the next edit saves on top of the adopted record.
    openChat(store, "z");
    await settle();
    expect(saves.at(-1)?.expected).toBe(saved.updatedAt);
    expect(JSON.parse(records.get(RECORD)!.layout).panels["chat:z"]).toBeDefined();
    detach();
  });

  test("when the load fails and nothing is saved yet, the first save creates the record", async () => {
    const { remote, records } = fakeRemote(() => Promise.reject(new Error("offline")));
    const store = newStore(initialLayout(APP));
    const detach = attachPersistence(store, APP, remote);
    openChat(store, "a");
    await settle();
    expect(JSON.parse(records.get(RECORD)!.layout).panels["chat:a"]).toBeDefined();
    detach();
  });
});
