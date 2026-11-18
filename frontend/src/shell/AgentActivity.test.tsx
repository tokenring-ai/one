import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

type Agent = { id: string; displayName: string; idle: boolean; pendingQuestions: number; createdAt: number; agentType: string };
let agents: Agent[] | undefined = [];
const loading = false;

void mock.module("../rpc.ts", () => ({
  useAgentList: () => ({ data: agents, isLoading: loading }),
}));

void mock.module("./registry.ts", () => ({ getLayoutRegistry: () => ({ routes: { resolve: () => null }, app: () => undefined }) }));

const { default: AgentActivity } = await import("./AgentActivity.tsx");

const agent = (id: string, pendingQuestions: number): Agent => ({ id, displayName: id, idle: false, pendingQuestions, createdAt: 1, agentType: "code" });
const tree = () => (
  <MemoryRouter>
    <AgentActivity />
  </MemoryRouter>
);
const status = () => screen.getByRole("status");

describe("AgentActivity announcements", () => {
  it("announces when more agents need an answer, not on first load, and leaves focus alone", () => {
    agents = [agent("a", 1)];
    const view = render(tree());
    expect(status()).toHaveTextContent("");
    agents = [agent("a", 1), agent("b", 1)];
    view.rerender(tree());
    expect(status()).toHaveTextContent("2 agents are waiting for your answer");
    expect(document.body).toHaveFocus();
  });

  it("is silent when the count falls or does not change", () => {
    agents = [agent("a", 1), agent("b", 1)];
    const view = render(tree());
    agents = [agent("a", 1)];
    view.rerender(tree());
    agents = [agent("a", 1)];
    view.rerender(tree());
    expect(status()).toHaveTextContent("");
  });

  it("announces the first agent that starts waiting", () => {
    agents = [agent("a", 0)];
    const view = render(tree());
    agents = [agent("a", 2)];
    view.rerender(tree());
    expect(status()).toHaveTextContent("1 agent is waiting for your answer");
  });
});
