import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter } from "react-router-dom";

const emptyTokens = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCachedTokens: 0,
  totalReasoningTokens: 0,
};
const emptyLatency = {
  requestCount: 0,
  avgElapsedMs: 0,
  avgTimeToFirstTokenMs: 0,
  avgTokensPerSecond: 0,
};
const emptyErrors = {
  errorsByProvider: {} as Record<string, number>,
  errorsByType: {} as Record<string, number>,
  retryCount: 0,
};
const emptyActivity = {
  totalSteps: 0,
  totalToolCalls: 0,
  toolCallsByName: {} as Record<string, number>,
};

const sampleSummary = {
  agents: [
    {
      agentId: "agent-active-1",
      displayName: "Code Engineer #1",
      agentType: "code",
      idle: false,
      total: 0.42,
      costs: {
        "Chat (OpenAI:gpt-4o)": 0.3,
        "Image Generation (OpenAI:dall-e-3)": 0.1,
        "Web Search": 0.02,
      },
      tokens: {
        totalInputTokens: 12000,
        totalOutputTokens: 3400,
        totalCachedTokens: 800,
        totalReasoningTokens: 200,
      },
      latency: {
        requestCount: 8,
        avgElapsedMs: 450,
        avgTimeToFirstTokenMs: 120,
        avgTokensPerSecond: 42,
        p50ElapsedMs: 400,
        p95ElapsedMs: 900,
      },
      errors: {
        errorsByProvider: { OpenAI: 1 },
        errorsByType: { rateLimit: 1 },
        retryCount: 2,
      },
      activity: {
        totalSteps: 12,
        totalToolCalls: 7,
        toolCallsByName: { read_file: 4, search: 3 },
      },
    },
    {
      agentId: "agent-idle-2",
      displayName: "Researcher",
      agentType: "research",
      idle: true,
      total: 0.05,
      costs: { "Chat (OpenAI:gpt-4o-mini)": 0.05 },
      tokens: {
        totalInputTokens: 500,
        totalOutputTokens: 100,
        totalCachedTokens: 0,
        totalReasoningTokens: 0,
      },
      latency: {
        requestCount: 1,
        avgElapsedMs: 200,
        avgTimeToFirstTokenMs: 50,
        avgTokensPerSecond: 20,
      },
      errors: emptyErrors,
      activity: {
        totalSteps: 1,
        totalToolCalls: 0,
        toolCallsByName: {},
      },
    },
  ],
  totalsByCategory: {
    "Chat (OpenAI:gpt-4o)": 0.3,
    "Image Generation (OpenAI:dall-e-3)": 0.1,
    "Web Search": 0.02,
    "Chat (OpenAI:gpt-4o-mini)": 0.05,
  },
  grandTotal: 0.47,
  agentCount: 2,
  activeAgentCount: 1,
  tokens: {
    totalInputTokens: 12500,
    totalOutputTokens: 3500,
    totalCachedTokens: 800,
    totalReasoningTokens: 200,
  },
  latency: {
    requestCount: 9,
    avgElapsedMs: 422,
    avgTimeToFirstTokenMs: 112,
    avgTokensPerSecond: 39,
  },
  errors: {
    errorsByProvider: { OpenAI: 1 },
    errorsByType: { rateLimit: 1 },
    retryCount: 2,
  },
  activity: {
    totalSteps: 13,
    totalToolCalls: 7,
    toolCallsByName: { read_file: 4, search: 3 },
  },
};

const emptySummary = {
  agents: [],
  totalsByCategory: {},
  grandTotal: 0,
  agentCount: 0,
  activeAgentCount: 0,
  tokens: emptyTokens,
  latency: emptyLatency,
  errors: emptyErrors,
  activity: emptyActivity,
};

const resetAgentCosts = mock(async (_args: { agentId: string }) => ({ status: "success" as const }));
const mutate = mock(async () => undefined);

let summaryState: {
  data: typeof sampleSummary | typeof emptySummary | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
};

void mock.module("../../rpc.ts", () => ({
  useCostSummary: () => ({
    data: summaryState.data,
    error: summaryState.error,
    isLoading: summaryState.isLoading,
    isValidating: summaryState.isValidating,
    mutate,
  }),
  metricsRPCClient: { resetAgentCosts },
}));

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: MetricsDashboard } = await import("./MetricsDashboard.tsx");

function renderDashboard() {
  return render(
    <MemoryRouter>
      <MetricsDashboard />
    </MemoryRouter>,
  );
}

describe("MetricsDashboard", () => {
  beforeEach(() => {
    resetAgentCosts.mockClear();
    mutate.mockClear();
    summaryState = {
      data: sampleSummary,
      error: undefined,
      isLoading: false,
      isValidating: false,
    };
  });

  it("renders summary cards, categories, and agents", () => {
    renderDashboard();

    expect(screen.getByTestId("metrics-dashboard")).toBeInTheDocument();
    expect(screen.getByText("Session total")).toBeInTheDocument();
    expect(screen.getByText("Chat & models")).toBeInTheDocument();
    expect(screen.getByText("Media")).toBeInTheDocument();
    expect(screen.getByText("Active now")).toBeInTheDocument();
    expect(screen.getByText("Tokens")).toBeInTheDocument();
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-performance-stats")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-detail-panels")).toBeInTheDocument();
    expect(screen.getByText("Code Engineer #1")).toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-category-bars")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-spend-mix")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Live");
  });

  it("shows loading state when no data yet", () => {
    summaryState = { data: undefined, error: undefined, isLoading: true, isValidating: true };
    renderDashboard();
    expect(screen.getByText("Loading metrics…")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Connecting");
  });

  it("does not claim Live status while waiting for the first snapshot", () => {
    summaryState = { data: undefined, error: undefined, isLoading: false, isValidating: false };
    renderDashboard();
    expect(screen.getByText("Waiting for metrics…")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Connecting");
  });

  it("shows error state with retry", async () => {
    const user = userEvent.setup();
    summaryState = {
      data: undefined,
      error: new Error("stream failed"),
      isLoading: false,
      isValidating: false,
    };
    renderDashboard();

    expect(screen.getByText("Unable to load metrics")).toBeInTheDocument();
    expect(screen.getByText(/stream failed/)).toBeInTheDocument();
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Error");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mutate).toHaveBeenCalled();
  });

  it("shows empty agents state", () => {
    summaryState = { data: emptySummary, error: undefined, isLoading: false, isValidating: false };
    renderDashboard();
    expect(screen.getByTestId("metrics-agents-empty")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-category-empty")).toBeInTheDocument();
  });

  it("filters agents by Active tab", async () => {
    const user = userEvent.setup();
    renderDashboard();

    // FilterTabs concatenates label + count into the accessible name (no space): "Active1".
    await user.click(screen.getByRole("button", { name: "Active1" }));
    expect(screen.getByText("Code Engineer #1")).toBeInTheDocument();
    expect(screen.queryByText("Researcher")).not.toBeInTheDocument();
  });

  it("filters agents by search", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.type(screen.getByTestId("metrics-agent-search"), "research");
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.queryByText("Code Engineer #1")).not.toBeInTheDocument();
  });

  it("expands agent cost breakdown", async () => {
    const user = userEvent.setup();
    renderDashboard();

    const expandButtons = screen.getAllByRole("button", { name: /Expand cost breakdown/i });
    await user.click(expandButtons[0]!);
    const breakdown = screen.getByTestId("metrics-agent-breakdown");
    expect(breakdown).toBeInTheDocument();
    expect(breakdown).toHaveTextContent("Web Search");
    expect(breakdown).toHaveTextContent("OpenAI:gpt-4o");
    expect(screen.getByTestId("metrics-agent-tokens")).toHaveTextContent("12k");
    expect(screen.getByTestId("metrics-agent-latency")).toHaveTextContent("450ms");
    expect(screen.getByTestId("metrics-agent-activity")).toHaveTextContent("read_file");
    expect(screen.getByTestId("metrics-agent-errors")).toHaveTextContent("rateLimit");
  });

  it("confirms and resets agent metrics", async () => {
    const user = userEvent.setup();
    renderDashboard();

    const resetButtons = screen.getAllByTestId("metrics-reset-agent");
    await user.click(resetButtons[0]!);

    expect(screen.getByText("Reset metrics?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset metrics" }));

    await waitFor(() => {
      expect(resetAgentCosts).toHaveBeenCalledWith({ agentId: "agent-active-1" });
    });
    expect(mutate).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText("Reset metrics?")).not.toBeInTheDocument();
    });
  });

  it("closes reset dialog after confirm even when reset RPC fails", async () => {
    const user = userEvent.setup();
    resetAgentCosts.mockImplementationOnce(async () => {
      throw new Error("reset failed");
    });
    renderDashboard();

    await user.click(screen.getAllByTestId("metrics-reset-agent")[0]!);
    expect(screen.getByText("Reset metrics?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset metrics" }));

    await waitFor(() => {
      expect(resetAgentCosts).toHaveBeenCalledWith({ agentId: "agent-active-1" });
    });
    // Promise-based confirm closes before the RPC; failures toast and leave the dialog closed.
    await waitFor(() => {
      expect(screen.queryByText("Reset metrics?")).not.toBeInTheDocument();
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("cancels reset confirmation", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getAllByTestId("metrics-reset-agent")[0]!);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Reset metrics?")).not.toBeInTheDocument();
    expect(resetAgentCosts).not.toHaveBeenCalled();
  });

  it("triggers refresh", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByTestId("metrics-refresh"));
    expect(mutate).toHaveBeenCalled();
  });

  it("shows stale banner when stream errors but data exists", () => {
    summaryState = {
      data: sampleSummary,
      error: new Error("connection lost"),
      isLoading: false,
      isValidating: false,
    };
    renderDashboard();
    const banner = screen.getByTestId("metrics-stale-banner");
    expect(banner).toHaveTextContent("connection lost");
    expect(banner).toHaveTextContent("last known snapshot");
    // Keep the banner single-line — no stack dump.
    expect(banner.textContent ?? "").not.toMatch(/\s+at\s+/);
    expect(screen.getByTestId("metrics-live-status")).toHaveTextContent("Reconnecting");
  });

  it("shows filtered-empty state when search matches nothing", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.type(screen.getByTestId("metrics-agent-search"), "zzz-no-match");
    expect(screen.getByTestId("metrics-agents-filtered-empty")).toBeInTheDocument();
  });
});
