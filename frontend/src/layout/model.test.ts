import { describe, expect, test } from "bun:test";
import {
  containerOf,
  containers,
  instantiate,
  type LayoutAction,
  type ModelContext,
  panelKey,
  reduce,
  type ViewLookup,
  validate,
  visibleItem,
} from "./model.ts";
import type { LayoutNode, LayoutState, LayoutTemplate, PanelState, PresenterId } from "./types.ts";

const KINDS: Record<string, string> = { chat: "agent", terminal: "terminal", list: "navigator", logs: "widget", welcome: "page", image: "image" };
const lookup: ViewLookup = viewId => (KINDS[viewId] ? { kind: KINDS[viewId]! } : undefined);
const ctx: ModelContext = {
  app: "test",
  primaryKind: "page",
  placement: { agent: "right", terminal: "bottom" },
  presenterFor: kind => (kind === "navigator" || kind === "widget" ? "single" : kind === "image" ? "carousel" : "tabs"),
};
const TEMPLATE: LayoutTemplate = {
  split: "row",
  sizes: [1, 3],
  children: [
    { presenter: "single", accepts: ["navigator"], items: ["list"] },
    {
      split: "column",
      sizes: [2, 1],
      children: [
        { presenter: "tabs", accepts: ["*"], items: ["welcome"], primary: true },
        { presenter: "accordion", accepts: ["widget"], items: ["logs"] },
      ],
    },
  ],
};

function panel(viewId: string, params: Record<string, string> = {}): PanelState {
  return { key: panelKey(viewId, params), viewId, kind: KINDS[viewId]!, params };
}

function assertInvariants(s: LayoutState) {
  const seen = new Set<string>();
  const walk = (n: LayoutNode, parentDir?: string) => {
    if (n.kind === "split") {
      expect(n.children.length).toBeGreaterThanOrEqual(2);
      expect(n.dir).not.toBe(parentDir);
      expect(n.sizes.length).toBe(n.children.length);
      expect(Math.abs(n.sizes.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9);
      for (const c of n.children) walk(c, n.dir);
      return;
    }
    if (!n.primary) expect(n.items.length).toBeGreaterThan(0);
    if (n.presenter === "single") expect(n.items.length).toBeLessThanOrEqual(1);
    for (const k of n.items) {
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      const p = s.panels[k];
      expect(p).toBeDefined();
      expect(n.accepts.includes("*") || n.accepts.includes(p!.kind)).toBe(true);
    }
    if (n.lastActive !== null) expect(n.items).toContain(n.lastActive);
    for (const k of n.expanded ?? []) expect(n.items).toContain(k);
  };
  walk(s.root);
  expect(new Set(Object.keys(s.panels))).toEqual(seen);
}

describe("layout model", () => {
  test("instantiates a template and skips unknown views", () => {
    const s = instantiate({ presenter: "tabs", accepts: ["*"], items: ["welcome", "nope"], primary: true }, ctx, lookup);
    expect(Object.keys(s.panels)).toEqual(["welcome:_"]);
    assertInvariants(s);
  });

  test("an accordion opens every section except the ones its template starts closed", () => {
    const s = instantiate({ presenter: "accordion", accepts: ["*"], items: ["welcome", "logs"], collapsed: ["logs"], primary: true }, ctx, lookup);
    const root = s.root as Extract<LayoutNode, { kind: "container" }>;
    expect(root.items).toEqual(["welcome:_", "logs:_"]);
    expect(root.expanded).toEqual(["welcome:_"]);
  });

  test("splits without sizes divide space equally", () => {
    const s = instantiate(
      {
        split: "column",
        children: [
          { presenter: "single", accepts: ["navigator"], items: ["list"] },
          { presenter: "tabs", accepts: ["*"], items: ["welcome"], primary: true },
        ],
      },
      ctx,
      lookup,
    );
    expect(s.root.kind === "split" ? s.root.sizes : null).toEqual([0.5, 0.5]);
  });

  test("an opened item goes to a container dedicated to its kind, else is created by placement", () => {
    let s = instantiate(TEMPLATE, ctx, lookup);
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "a" }) }, ctx);
    // No agent container yet: the mixed primary container takes it? No: dedicated first, then "*".
    expect(containerOf(s, "chat:a")?.accepts).toEqual(["*"]);
    s = reduce(s, { type: "move", key: "chat:a", target: { beside: containerOf(s, "chat:a")!.id, edge: "right" } }, ctx);
    const agentBox = containerOf(s, "chat:a")!;
    expect(agentBox.accepts).toEqual(["agent"]);
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "b" }) }, ctx);
    expect(containerOf(s, "chat:b")?.id).toBe(agentBox.id);
    s = reduce(s, { type: "open", panel: panel("terminal", { termId: "1" }) }, ctx);
    expect(containerOf(s, "terminal:1")?.accepts).toEqual(["*"]);
    assertInvariants(s);
  });

  test("creates a container at the app's placement when nothing accepts the kind", () => {
    let s = instantiate(
      {
        split: "row",
        sizes: [1, 1],
        children: [
          { presenter: "tabs", accepts: ["page"], items: ["welcome"], primary: true },
          { presenter: "single", accepts: ["navigator"], items: ["list"] },
        ],
      },
      ctx,
      lookup,
    );
    s = reduce(s, { type: "open", panel: panel("terminal", { termId: "1" }) }, ctx);
    const host = containerOf(s, "terminal:1")!;
    expect(host.accepts).toEqual(["terminal"]);
    expect(host.presenter).toBe("tabs");
    assertInvariants(s);
  });

  test("refuses kinds a container does not accept and overfilling a single", () => {
    let s = instantiate(TEMPLATE, ctx, lookup);
    const single = containerOf(s, "list:_")!;
    const accordion = containerOf(s, "logs:_")!;
    const before = s;
    s = reduce(s, { type: "move", key: "welcome:_", target: { container: accordion.id } }, ctx);
    expect(s).toBe(before);
    s = reduce(s, { type: "move", key: "logs:_", target: { container: single.id } }, ctx);
    expect(s).toBe(before);
  });

  test("preview opens replace the previous preview in place", () => {
    let s = instantiate(TEMPLATE, ctx, lookup);
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "a" }), preview: true }, ctx);
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "b" }), preview: true }, ctx);
    expect(s.panels["chat:a"]).toBeUndefined();
    expect(s.panels["chat:b"]?.preview).toBe(true);
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "b" }) }, ctx);
    expect(s.panels["chat:b"]?.preview).toBeUndefined();
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "c" }), preview: true }, ctx);
    expect(s.panels["chat:b"]).toBeDefined();
    assertInvariants(s);
  });

  test("visibleItem shows the most recently activated item, so a non-routable tab can come forward", () => {
    let s = instantiate(TEMPLATE, ctx, lookup);
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "a" }) }, ctx);
    s = reduce(s, { type: "activate", key: "chat:a" }, ctx);
    const host = containerOf(s, "chat:a")!;
    expect(visibleItem(host, "chat:a")).toBe("chat:a");
    // The welcome page has no route: activating it shows it although the URL still names chat:a.
    s = reduce(s, { type: "activate", key: "welcome:_" }, ctx);
    expect(visibleItem(containerOf(s, "welcome:_")!, "chat:a")).toBe("welcome:_");
  });

  test("an open in the background does not change what a container shows; a move does", () => {
    let s = instantiate(TEMPLATE, ctx, lookup);
    const primary = containerOf(s, "welcome:_")!;
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "a" }) }, ctx);
    expect(containerOf(s, "chat:a")!.id).toBe(primary.id);
    expect(visibleItem(containerOf(s, "welcome:_")!, null)).toBe("welcome:_");
    s = reduce(s, { type: "move", key: "chat:a", target: { beside: primary.id, edge: "right" } }, ctx);
    const agents = containerOf(s, "chat:a")!;
    // A second chat opened in the background lands in the agents container without covering chat:a.
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "b" }) }, ctx);
    expect(containerOf(s, "chat:b")!.id).toBe(agents.id);
    expect(visibleItem(containerOf(s, "chat:a")!, null)).toBe("chat:a");
    // Moving it (drag to the front) brings it forward.
    s = reduce(s, { type: "move", key: "chat:b", target: { container: agents.id, index: 0 } }, ctx);
    expect(visibleItem(containerOf(s, "chat:b")!, null)).toBe("chat:b");
  });

  test("accordion toggles and activation expands", () => {
    let s = instantiate(TEMPLATE, ctx, lookup);
    s = reduce(s, { type: "toggle", key: "logs:_" }, ctx);
    expect(containerOf(s, "logs:_")?.expanded).toEqual([]);
    s = reduce(s, { type: "activate", key: "logs:_" }, ctx);
    expect(containerOf(s, "logs:_")?.expanded).toEqual(["logs:_"]);
  });

  test("present refuses single for several items; accepts refuses narrowing past its items", () => {
    let s = instantiate(TEMPLATE, ctx, lookup);
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "a" }) }, ctx);
    const primary = containerOf(s, "welcome:_")!;
    expect(reduce(s, { type: "present", container: primary.id, presenter: "single" }, ctx)).toBe(s);
    expect(reduce(s, { type: "accepts", container: primary.id, accepts: ["page"] }, ctx)).toBe(s);
    const narrowed = reduce(s, { type: "accepts", container: primary.id, accepts: ["page", "agent"] }, ctx);
    expect(containerOf(narrowed, "welcome:_")?.accepts).toEqual(["page", "agent"]);
  });

  test("closing everything keeps the primary container", () => {
    let s = instantiate(TEMPLATE, ctx, lookup);
    for (const key of Object.keys(s.panels)) s = reduce(s, { type: "close", key }, ctx);
    expect(s.root.kind).toBe("container");
    expect(containers(s.root)[0]?.primary).toBe(true);
    assertInvariants(s);
  });

  test("validate round-trips through JSON and rejects foreign records", () => {
    let s = instantiate(TEMPLATE, ctx, lookup);
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "a" }) }, ctx);
    const back = validate(JSON.parse(JSON.stringify(s)), ctx, lookup);
    expect(back).toEqual(s);
    expect(validate({ ...s, app: "other" }, ctx, lookup)).toBeNull();
    expect(validate({ ...s, version: 1 }, ctx, lookup)).toBeNull();
    expect(validate("nonsense", ctx, lookup)).toBeNull();
  });

  test("validate drops views that no longer exist", () => {
    const s = instantiate(TEMPLATE, ctx, lookup);
    const narrower: ViewLookup = id => (id === "logs" ? undefined : lookup(id));
    const back = validate(JSON.parse(JSON.stringify(s)), ctx, narrower)!;
    expect(back.panels["logs:_"]).toBeUndefined();
    assertInvariants(back);
  });

  test("random action sequences keep every invariant", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const pickFrom = <T>(xs: T[]): T | undefined => xs[Math.floor(rand() * xs.length)];
    const presenters: PresenterId[] = ["tabs", "single", "accordion", "carousel"];
    const edges = ["left", "right", "top", "bottom"] as const;
    for (let run = 0; run < 60; run++) {
      let s = instantiate(TEMPLATE, ctx, lookup);
      for (let step = 0; step < 80; step++) {
        const keys = Object.keys(s.panels);
        const boxes = containers(s.root);
        const r = rand();
        let action: LayoutAction | undefined;
        if (r < 0.3) {
          const viewId = pickFrom(["chat", "terminal", "image"])!;
          const p = panel(viewId, { id: String(Math.floor(rand() * 6)) });
          action = { type: "open", panel: p, preview: rand() < 0.3 };
        } else if (r < 0.45 && keys.length) action = { type: "close", key: pickFrom(keys)! };
        else if (r < 0.7 && keys.length && boxes.length) {
          const key = pickFrom(keys)!;
          const box = pickFrom(boxes)!;
          action =
            rand() < 0.5
              ? { type: "move", key, target: { container: box.id, index: Math.floor(rand() * 4) } }
              : { type: "move", key, target: { beside: box.id, edge: pickFrom([...edges])! } };
        } else if (r < 0.8 && boxes.length) action = { type: "present", container: pickFrom(boxes)!.id, presenter: pickFrom(presenters)! };
        else if (r < 0.88 && keys.length) action = { type: "activate", key: pickFrom(keys)! };
        else if (r < 0.94 && keys.length) action = { type: "toggle", key: pickFrom(keys)! };
        else if (s.root.kind === "split") {
          const sizes = s.root.sizes.map(() => rand() + 0.05);
          action = { type: "resize", split: s.root.id, sizes };
        }
        if (!action) continue;
        s = reduce(s, action, ctx);
        assertInvariants(s);
      }
    }
  });
});

describe("landing views", () => {
  const landingCtx: ModelContext = { ...ctx, isLanding: viewId => viewId === "welcome" };
  const page = (id: string): PanelState => ({ key: panelKey("doc", { id }), viewId: "doc", kind: "page", params: { id } });

  test("retire once something else is activated in their container, and only there", () => {
    let s = instantiate(TEMPLATE, landingCtx, lookup);
    s = reduce(s, { type: "open", panel: page("a") }, landingCtx);
    // Opening in the background leaves the landing in place.
    expect(s.panels["welcome:_"]).toBeDefined();
    s = reduce(s, { type: "activate", key: panelKey("doc", { id: "a" }) }, landingCtx);
    expect(s.panels["welcome:_"]).toBeUndefined();
    expect(s.panels["list:_"]).toBeDefined();
    assertInvariants(s);
  });

  test("activating the landing itself keeps it", () => {
    const s = reduce(instantiate(TEMPLATE, landingCtx, lookup), { type: "activate", key: "welcome:_" }, landingCtx);
    expect(s.panels["welcome:_"]).toBeDefined();
  });

  test("retire when an item is dragged into their container", () => {
    let s = instantiate(TEMPLATE, landingCtx, lookup);
    s = reduce(s, { type: "open", panel: panel("chat", { agentId: "x" }) }, landingCtx);
    const primary = containerOf(s, "welcome:_")!;
    s = reduce(s, { type: "move", key: panelKey("chat", { agentId: "x" }), target: { container: primary.id, index: 0 } }, landingCtx);
    expect(s.panels["welcome:_"]).toBeUndefined();
    assertInvariants(s);
  });
});

describe("app layout versions", () => {
  test("a saved layout from another version of the app's default is discarded", () => {
    const v2: ModelContext = { ...ctx, layoutVersion: 2 };
    const saved = JSON.parse(JSON.stringify(instantiate(TEMPLATE, ctx, lookup)));
    expect(validate(saved, v2, lookup)).toBeNull();
    const fresh = JSON.parse(JSON.stringify(instantiate(TEMPLATE, v2, lookup)));
    expect(validate(fresh, v2, lookup)).not.toBeNull();
    // Apps without a version (user-saved apps) keep whatever they saved.
    expect(validate(fresh, ctx, lookup)).not.toBeNull();
  });
});
