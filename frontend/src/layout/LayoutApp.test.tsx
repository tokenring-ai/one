import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { List, MessageSquare, ScrollText } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { renderLayoutApp } from "../test/layout.tsx";
import { type LayoutApi, useLayoutApi } from "./context.ts";
import { defineApp, defineView, type ViewProps } from "./define.ts";
import { usePaneLink, usePanel, usePanelMenu } from "./hooks.ts";
import { containerOf } from "./model.ts";
import { createLayoutRegistry } from "./registry.ts";

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const mounts: Record<string, number> = {};
let captured: LayoutApi | null = null;

const waved = mock((_agentId: string) => {});

function ChatView({ params }: ViewProps) {
  usePanelMenu({ items: [{ id: "wave", label: `Wave at ${params.agentId}`, onSelect: () => waved(params.agentId ?? "") }] });
  useEffect(() => {
    mounts[params.agentId ?? ""] = (mounts[params.agentId ?? ""] ?? 0) + 1;
  }, [params.agentId]);
  return <p data-testid={`chat-${params.agentId}`}>Chat with {params.agentId}</p>;
}

function AgentList() {
  const open = usePaneLink();
  captured = useLayoutApi();
  return (
    <ul>
      {["a", "b", "c"].map(id => (
        <li key={id}>
          <button type="button" onClick={() => open("chat", { agentId: id })}>
            Open {id}
          </button>
        </li>
      ))}
    </ul>
  );
}

function BrowseView() {
  const { routeParams } = usePanel();
  return <p data-testid="browse">item {routeParams?.item ?? "none"}</p>;
}

const registry = createLayoutRegistry({
  kinds: [
    { id: "agent", label: "Agents", plural: "agent chats" },
    { id: "navigator", label: "Navigators", plural: "navigators", presenter: "single" },
    { id: "widget", label: "Widgets", plural: "widgets", presenter: "single" },
  ],
  views: [
    defineView({
      id: "chat",
      kind: "agent",
      title: p => p.agentId ?? "Chat",
      icon: MessageSquare,
      route: "agent/:agentId",
      instanceKey: p => p.agentId ?? "",
      closeHint: "Close the chat. The agent keeps running.",
      component: ChatView,
    }),
    defineView({ id: "agent-list", kind: "navigator", title: "Agents", icon: List, closable: false, component: AgentList }),
    defineView({ id: "logs", kind: "widget", title: "Logs", icon: ScrollText, component: () => <p>log lines</p> }),
    defineView({ id: "browse", kind: "agent", title: "Browse", icon: List, route: "browse/:item?", instanceKey: () => "_", component: BrowseView }),
    defineView({ id: "report", kind: "agent", title: "Report", icon: List, route: ":reportId", component: () => <p>report</p> }),
  ],
  apps: [
    defineApp({
      id: "home",
      path: "/home",
      label: "Home",
      description: "",
      icon: List,
      group: "Build",
      views: ["agent-list", "chat", "logs", "browse"],
      primaryKind: "agent",
      placement: { agent: "right" },
      layout: {
        split: "row",
        sizes: [1, 3],
        children: [
          { presenter: "single", accepts: ["navigator"], items: ["agent-list"] },
          { presenter: "tabs", accepts: ["agent"], primary: true },
        ],
      },
    }),
    // Owns "report", which Home doesn't list: links to it from Home go here.
    defineApp({
      id: "reports",
      path: "/reports",
      label: "Reports",
      description: "",
      icon: List,
      group: "Build",
      views: ["report"],
      primaryKind: "agent",
      layout: { presenter: "tabs", accepts: ["agent"], primary: true },
    }),
  ],
});

const tab = (name: string) => screen.getByRole("tab", { name: new RegExp(`^${name}`) });

describe("LayoutApp", () => {
  beforeEach(() => {
    for (const k of Object.keys(mounts)) delete mounts[k];
    captured = null;
  });
  afterEach(cleanup);

  test("the URL opens and focuses its panel", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a" });
    expect(screen.getByTestId("chat-a")).toBeTruthy();
    expect(tab("a").getAttribute("aria-selected")).toBe("true");
    expect(app.location().pathname).toBe("/home/agent/a");
  });

  test("opening pushes history, tab clicks replace it, and Back refocuses", () => {
    const app = renderLayoutApp({ registry, url: "/home" });
    fireEvent.click(screen.getByText("Open a"));
    fireEvent.click(screen.getByText("Open b"));
    expect(app.location().pathname).toBe("/home/agent/b");
    expect(tab("b").getAttribute("aria-selected")).toBe("true");

    app.go(-1);
    expect(app.location().pathname).toBe("/home/agent/a");
    expect(tab("a").getAttribute("aria-selected")).toBe("true");

    fireEvent.click(tab("b"));
    expect(app.location().pathname).toBe("/home/agent/b");
    // The tab switch replaced the entry: Back goes to the app root, not to a.
    app.go(-1);
    expect(app.location().pathname).toBe("/home");
  });

  test("moving a panel to a new container does not remount it", () => {
    renderLayoutApp({ registry, url: "/home/agent/a" });
    fireEvent.click(screen.getByText("Open b"));
    expect(mounts).toEqual({ a: 1, b: 1 });
    const api = captured!;
    const host = containerOf(api.store.getState(), "chat:a")!;
    act(() => {
      api.store.dispatch({ type: "move", key: "chat:a", target: { beside: host.id, edge: "right" } });
    });
    expect(containerOf(api.store.getState(), "chat:a")?.id).not.toBe(host.id);
    expect(mounts).toEqual({ a: 1, b: 1 });
    const moved = screen.getByTestId("chat-a").closest("section");
    expect(moved?.getAttribute("data-container")).toBe(containerOf(api.store.getState(), "chat:a")?.id ?? "");
  });

  test("a container refuses kinds it does not accept", () => {
    renderLayoutApp({ registry, url: "/home/agent/a" });
    const api = captured!;
    const nav = containerOf(api.store.getState(), "agent-list:_")!;
    const before = api.store.getState();
    act(() => {
      api.store.dispatch({ type: "move", key: "chat:a", target: { container: nav.id } });
    });
    expect(api.store.getState()).toBe(before);
  });

  test("closing the focused tab moves the URL to its neighbour", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a" });
    fireEvent.click(screen.getByText("Open b"));
    fireEvent.click(within(tab("b")).getByRole("button", { name: "Close b" }));
    expect(app.location().pathname).toBe("/home/agent/a");
    expect(screen.queryByTestId("chat-b")).toBeNull();
  });

  test("the phone layout shows one item and tapping a routable item navigates", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a", mobile: true });
    fireEvent.click(screen.getByText("Open b"));
    const strip = screen.getByRole("tablist");
    fireEvent.click(within(strip).getByRole("tab", { name: /^a/ }));
    expect(app.location().pathname).toBe("/home/agent/a");
    expect(within(strip).getByRole("tab", { name: /^a/ }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("LayoutApp navigation races", () => {
  afterEach(cleanup);

  test("a view that opens another view and then closes itself ends on the new view", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a" });
    fireEvent.click(screen.getByText("Open b"));
    const api = captured!;
    act(() => {
      api.open("chat", { agentId: "c" });
      api.close("chat:b");
    });
    expect(app.location().pathname).toBe("/home/agent/c");
    expect(screen.queryByTestId("chat-b")).toBeNull();
  });
});

describe("LayoutApp memory and menus", () => {
  afterEach(cleanup);

  test("a panel that follows the URL is returned to where it was by its tab", () => {
    const app = renderLayoutApp({ registry, url: "/home/browse/x" });
    app.go("/home/browse/y");
    expect(screen.getByTestId("browse").textContent).toBe("item y");
    fireEvent.click(screen.getByText("Open a"));
    expect(app.location().pathname).toBe("/home/agent/a");
    fireEvent.click(tab("Browse"));
    expect(app.location().pathname).toBe("/home/browse/y");
  });

  test("Add view offers this app's unopened views the container accepts", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a" });
    const agentTabs = tab("a").closest("section")!;
    fireEvent.keyDown(within(agentTabs as HTMLElement).getByRole("button", { name: "Container options" }), { key: "Enter" });
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: /^Logs$/ })).toBeNull(); // a widget: this container takes agents only
    fireEvent.click(within(menu).getByRole("menuitem", { name: /^Browse$/ }));
    expect(app.location().pathname).toBe("/home/browse");
    expect(tab("Browse").closest("section")).toBe(agentTabs);
  });
});

describe("LayoutApp container menu", () => {
  afterEach(cleanup);

  const openMenu = (section: Element) => {
    fireEvent.keyDown(within(section as HTMLElement).getByRole("button", { name: "Container options" }), { key: "Enter" });
    return screen.getByRole("menu");
  };

  test("leads with the shown view's own commands", () => {
    renderLayoutApp({ registry, url: "/home/agent/a" });
    fireEvent.click(screen.getByText("Open b"));
    const menu = within(openMenu(tab("b").closest("section")!));
    expect(menu.queryByRole("menuitem", { name: "Wave at a" })).toBeNull();
    fireEvent.click(menu.getByRole("menuitem", { name: "Wave at b" }));
    expect(waved).toHaveBeenCalledWith("b");
  });

  test("a reset keeps what views set at runtime on panels that stay open", () => {
    renderLayoutApp({ registry, url: "/home/agent/a" });
    act(() => {
      captured!.setTitle("agent-list:_", "Agents (3)");
      captured!.setBadge("agent-list:_", { tone: "info", count: 3 });
      captured!.reset();
    });
    expect(captured!.store.getState().panels["agent-list:_"]).toMatchObject({ title: "Agents (3)", badge: { count: 3 } });
  });

  test("a layout loaded from elsewhere never brings back an old badge", () => {
    renderLayoutApp({ registry, url: "/home/agent/a" });
    const stale = structuredClone(captured!.store.getState());
    stale.panels["agent-list:_"]!.badge = { tone: "info", count: 4 };
    act(() => {
      captured!.store.adoptRemote(stale);
    });
    expect(captured!.store.getState().panels["agent-list:_"]?.badge).toBeUndefined();
  });

  test("a reset keeps the open chat's runtime title", () => {
    renderLayoutApp({ registry, url: "/home/agent/a" });
    act(() => {
      captured!.setTitle("chat:a", "My chat");
      captured!.reset();
    });
    expect(captured!.store.getState().panels["chat:a"]?.title).toBe("My chat");
  });

  test("asks before resetting the layout", () => {
    renderLayoutApp({ registry, url: "/home/agent/a" });
    fireEvent.click(screen.getByText("Open b"));
    fireEvent.click(within(openMenu(tab("b").closest("section")!)).getByRole("menuitem", { name: /Reset layout/ }));
    const dialog = screen.getByRole("dialog");
    // Nothing happens until confirmed.
    expect(captured!.store.getState().panels["chat:a"]).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset layout" }));
    // Back to the template; only what the URL names (b) is opened again.
    expect(captured!.store.getState().panels["chat:a"]).toBeUndefined();
    expect(captured!.store.getState().panels["chat:b"]).toBeDefined();
  });

  test("a view's close hint is the close button's tooltip", () => {
    renderLayoutApp({ registry, url: "/home/agent/a" });
    expect(within(tab("a")).getByRole("button", { name: "Close a" })).toHaveAttribute("title", "Close the chat. The agent keeps running.");
  });
});

describe("LayoutApp open beside", () => {
  afterEach(cleanup);

  test("opens an item in a new container split off another panel's, and moves an open one there", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a" });
    const api = captured!;
    act(() => api.open("chat", { agentId: "b" }, { beside: { edge: "right", of: "chat:a" } }));
    expect(app.location().pathname).toBe("/home/agent/b");
    const state = api.store.getState();
    const left = containerOf(state, "chat:a")!;
    const right = containerOf(state, "chat:b")!;
    expect(right.id).not.toBe(left.id);
    act(() => api.open("chat", { agentId: "c" }));
    act(() => captured!.open("chat", { agentId: "c" }, { beside: { edge: "bottom", of: "chat:b" } }));
    const after = captured!.store.getState();
    expect(containerOf(after, "chat:c")!.id).not.toBe(containerOf(after, "chat:b")!.id);
    expect(Object.keys(after.panels).filter(k => k === "chat:c")).toHaveLength(1);
  });
});

describe("LayoutApp batch close", () => {
  afterEach(cleanup);

  test("closing the focused panel together with a sibling moves the URL once, to one that stays open", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a" });
    fireEvent.click(screen.getByText("Open b"));
    fireEvent.click(screen.getByText("Open c"));
    expect(app.location().pathname).toBe("/home/agent/c");
    act(() => captured!.closeMany(["chat:c", "chat:b"]));
    expect(app.location().pathname).toBe("/home/agent/a");
    expect(Object.keys(captured!.store.getState().panels).filter(k => k.startsWith("chat:"))).toEqual(["chat:a"]);
  });
});

describe("LayoutApp views from other apps", () => {
  afterEach(cleanup);

  test("open a view the app doesn't list at its own app's URL, without adding it here", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a" });
    expect(captured!.urlFor("report", { reportId: "q3" })).toBe("/reports/q3");
    act(() => captured!.open("report", { reportId: "q3" }));
    expect(app.location().pathname).toBe("/reports/q3");
    expect(Object.keys(captured!.store.getState().panels).some(k => k.startsWith("report:"))).toBe(false);
  });
});

describe("LayoutApp undo keeps the URL on the shown panel", () => {
  afterEach(cleanup);

  test("undoing a close brings the panel back and focuses it; redo closes it again", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a" });
    fireEvent.click(screen.getByText("Open b"));
    fireEvent.click(within(tab("b")).getByRole("button", { name: "Close b" }));
    expect(app.location().pathname).toBe("/home/agent/a");

    fireEvent.keyDown(tab("a"), { key: "z", ctrlKey: true });
    expect(app.location().pathname).toBe("/home/agent/b");
    expect(tab("b").getAttribute("aria-selected")).toBe("true");
    expect(captured!.visibility.get("chat:b")).toBe(true);
    expect(captured!.visibility.get("chat:a")).toBe(false);

    act(() => captured!.redo());
    expect(app.location().pathname).toBe("/home/agent/a");
    expect(tab("a").getAttribute("aria-selected")).toBe("true");
  });
});

describe("LayoutApp maximize", () => {
  afterEach(cleanup);

  test("panels outside the maximized container report not visible, and visible again on restore", () => {
    renderLayoutApp({ registry, url: "/home/agent/a" });
    const api = captured!;
    expect(api.visibility.get("agent-list:_")).toBe(true);
    const host = containerOf(api.store.getState(), "chat:a")!;
    act(() => {
      api.store.dispatch({ type: "maximize", container: host.id });
    });
    expect(api.visibility.get("agent-list:_")).toBe(false);
    expect(api.visibility.get("chat:a")).toBe(true);
    act(() => {
      api.store.dispatch({ type: "maximize", container: null });
    });
    expect(api.visibility.get("agent-list:_")).toBe(true);
  });
});

describe("LayoutApp tab keyboard", () => {
  afterEach(cleanup);

  test("arrow keys select the neighbouring tab and move focus to it", () => {
    const app = renderLayoutApp({ registry, url: "/home/agent/a" });
    fireEvent.click(screen.getByText("Open b"));
    fireEvent.click(screen.getByText("Open c"));
    act(() => tab("a").focus());
    fireEvent.keyDown(tab("a"), { key: "ArrowRight" });
    expect(app.location().pathname).toBe("/home/agent/b");
    expect(document.activeElement).toBe(tab("b"));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(app.location().pathname).toBe("/home/agent/c");
    expect(document.activeElement).toBe(tab("c"));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tab("b"));
  });
});
