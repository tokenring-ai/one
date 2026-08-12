import { describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Search } from "lucide-react";
import EmptyStateWithPrompt from "./EmptyStateWithPrompt.tsx";

const baseProps = {
  icon: Search,
  iconGradient: "from-indigo-500 to-violet-600",
  title: "Start researching",
  descriptionWithContent: "Select existing research from Topics.",
  descriptionEmpty: "Describe what you want to research below.",
  hasContent: false,
  agentRunningMessage: "A research agent is running.",
  hasAgent: false,
  promptLabel: "Research prompt",
  promptPlaceholder: "e.g. Solid-state batteries",
  submitLabel: "Start research",
  submitAriaLabel: "Start research agent",
  promptAriaLabel: "Research query",
  onSubmit: mock(async () => true),
};

describe("EmptyStateWithPrompt", () => {
  it("renders title, empty description, and prompt form when no agent", () => {
    render(<EmptyStateWithPrompt {...baseProps} />);

    expect(screen.getByText("Start researching")).toBeInTheDocument();
    expect(screen.getByText("Describe what you want to research below.")).toBeInTheDocument();
    expect(screen.getByLabelText("Research query")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start research agent" })).toBeInTheDocument();
  });

  it("shows the with-content description when hasContent is true", () => {
    render(<EmptyStateWithPrompt {...baseProps} hasContent />);

    expect(screen.getByText("Select existing research from Topics.")).toBeInTheDocument();
    expect(screen.queryByText("Describe what you want to research below.")).not.toBeInTheDocument();
  });

  it("shows the agent-running card instead of the prompt form when hasAgent", () => {
    render(<EmptyStateWithPrompt {...baseProps} hasAgent />);

    expect(screen.getByText("A research agent is running.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Research query")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start research agent" })).not.toBeInTheDocument();
  });

  it("disables submit when the prompt is empty", () => {
    render(<EmptyStateWithPrompt {...baseProps} />);

    expect(screen.getByRole("button", { name: "Start research agent" })).toBeDisabled();
  });

  it("submits the trimmed prompt and clears on success", async () => {
    const onSubmit = mock(async () => true);
    const user = userEvent.setup();
    render(<EmptyStateWithPrompt {...baseProps} onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText("Research query");
    await user.type(textarea, "  Solid-state batteries  ");
    await user.click(screen.getByRole("button", { name: "Start research agent" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Solid-state batteries"));
    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  it("keeps the prompt when onSubmit returns false", async () => {
    const onSubmit = mock(async () => false);
    const user = userEvent.setup();
    render(<EmptyStateWithPrompt {...baseProps} onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText("Research query");
    await user.type(textarea, "Keep this");
    await user.click(screen.getByRole("button", { name: "Start research agent" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Keep this"));
    expect(textarea).toHaveValue("Keep this");
  });

  it("submits via ⌘/Ctrl+Enter", async () => {
    const onSubmit = mock(async () => true);
    const user = userEvent.setup();
    render(<EmptyStateWithPrompt {...baseProps} onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText("Research query");
    await user.type(textarea, "Keyboard submit");
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Keyboard submit"));
  });

  it("renders secondary actions", () => {
    render(<EmptyStateWithPrompt {...baseProps} secondaryActions={<button type="button">New Flow</button>} />);

    expect(screen.getByRole("button", { name: "New Flow" })).toBeInTheDocument();
  });

  it("shows submitting label while the request is in flight", async () => {
    let resolveSubmit!: (value: boolean) => void;
    const onSubmit = mock(
      () =>
        new Promise<boolean>(resolve => {
          resolveSubmit = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<EmptyStateWithPrompt {...baseProps} onSubmit={onSubmit} submittingLabel="Launching…" />);

    await user.type(screen.getByLabelText("Research query"), "topic");
    await user.click(screen.getByRole("button", { name: "Start research agent" }));

    expect(screen.getByText("Launching…")).toBeInTheDocument();
    resolveSubmit(true);
    await waitFor(() => expect(screen.queryByText("Launching…")).not.toBeInTheDocument());
  });
});
