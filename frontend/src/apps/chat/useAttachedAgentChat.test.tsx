import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { FileText, MessageSquare } from "lucide-react";
import { useState } from "react";
import { defineApp, defineView, type ViewProps } from "../../layout/define.ts";
import { createLayoutRegistry } from "../../layout/registry.ts";
import { renderLayoutApp } from "../../test/layout.tsx";
import { getChatExtras } from "./chatExtras.ts";
import { useAttachedAgentChat } from "./useAttachedAgentChat.ts";

function ChatStub({ params }: ViewProps) {
  return <p>chat {params.agentId}</p>;
}

function Editor() {
  const [agentId, setAgentId] = useState<string | null>("a");
  useAttachedAgentChat({ agentId, extraAttachments: agentId ? [{ id: "f", label: "notes.md" } as never] : undefined });
  return (
    <div>
      <button type="button" onClick={() => setAgentId("b")}>
        Switch to b
      </button>
      <button type="button" onClick={() => setAgentId(null)}>
        Detach
      </button>
    </div>
  );
}

const registry = createLayoutRegistry({
  kinds: [
    { id: "agent", label: "Agents", plural: "agent chats" },
    { id: "doc", label: "Docs", plural: "documents" },
  ],
  views: [
    defineView({ id: "editor", kind: "doc", title: "Editor", icon: FileText, route: "", component: Editor }),
    defineView({
      id: "chat",
      kind: "agent",
      title: p => p.agentId ?? "",
      icon: MessageSquare,
      route: "agent/:agentId",
      instanceKey: p => p.agentId ?? "",
      component: ChatStub,
    }),
  ],
  apps: [
    defineApp({
      id: "docs",
      path: "/docs",
      label: "Docs",
      description: "",
      icon: FileText,
      group: "Build",
      views: ["editor", "chat"],
      primaryKind: "doc",
      placement: { agent: "right" },
      layout: { presenter: "tabs", accepts: ["doc"], items: ["editor"], primary: true },
    }),
  ],
});

describe("useAttachedAgentChat", () => {
  afterEach(cleanup);

  it("opens the attached agent's chat beside the app without taking focus", () => {
    const app = renderLayoutApp({ registry, url: "/docs" });
    expect(screen.getByRole("tab", { name: /^a/ })).toBeTruthy();
    expect(app.location().pathname).toBe("/docs");
    expect(getChatExtras("a").attachments).toHaveLength(1);
  });

  it("closes the previous agent's chat when switching or detaching", () => {
    renderLayoutApp({ registry, url: "/docs" });
    fireEvent.click(screen.getByText("Switch to b"));
    expect(screen.queryByRole("tab", { name: /^a/ })).toBeNull();
    expect(screen.getByRole("tab", { name: /^b/ })).toBeTruthy();
    fireEvent.click(screen.getByText("Detach"));
    expect(screen.queryByRole("tab", { name: /^b/ })).toBeNull();
    expect(getChatExtras("b").attachments).toHaveLength(0);
  });
});
