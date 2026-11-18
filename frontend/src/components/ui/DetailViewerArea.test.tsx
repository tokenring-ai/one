import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookOpen, FilePlus, WifiOff } from "lucide-react";
import DetailViewerArea from "./DetailViewerArea.tsx";

type Item = { id: string; title: string };

const emptyState = {
  icon: BookOpen,
  iconBadgeClassName: "bg-linear-to-br from-rose-500 to-pink-600",
  title: "No post selected",
  hint: "Select a post from the list.",
  ctaLabel: "New post",
  ctaIcon: FilePlus,
};

const baseProps = {
  ready: true,
  hasSelection: false,
  data: null as Item | null,
  loading: false,
  emptyState: {
    ...emptyState,
    onCta: () => {},
  },
  renderContent: (item: Item) => <div data-testid="content">{item.title}</div>,
};

describe("DetailViewerArea", () => {
  it("shows ready loading message while prerequisites are met", () => {
    render(<DetailViewerArea {...baseProps} ready={false} readyLoadingMessage="Connecting to blog service…" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Connecting to blog service…")).toBeInTheDocument();
  });

  it("shows notReady empty state when prerequisites fail", () => {
    render(
      <DetailViewerArea
        {...baseProps}
        ready={false}
        notReady={{
          icon: WifiOff,
          title: "No blog providers configured",
          hint: "Configure a provider in settings.",
        }}
      />,
    );

    expect(screen.getByText("No blog providers configured")).toBeInTheDocument();
    expect(screen.getByText("Configure a provider in settings.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows empty state with CTA when ready and nothing is selected", async () => {
    const onCta = mock(() => {});
    render(<DetailViewerArea {...baseProps} emptyState={{ ...emptyState, onCta }} />);

    expect(screen.getByText("No post selected")).toBeInTheDocument();
    expect(screen.getByText("Select a post from the list.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /new post/i }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it("shows content when data is available", () => {
    render(<DetailViewerArea {...baseProps} hasSelection data={{ id: "1", title: "Hello World" }} loading={false} />);

    expect(screen.getByTestId("content")).toHaveTextContent("Hello World");
  });

  it("shows error state with retry when selection fails to load", async () => {
    const onRetry = mock(() => {});
    render(
      <DetailViewerArea
        {...baseProps}
        hasSelection
        data={null}
        error={new Error("Network down")}
        loading={false}
        errorTitle="Failed to load post"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Failed to load post")).toBeInTheDocument();
    expect(screen.getByText("Network down")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows loading state while selected item is loading", () => {
    render(<DetailViewerArea {...baseProps} hasSelection data={null} loading loadingMessage="Loading post…" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading post…")).toBeInTheDocument();
  });

  it("prefers content over loading when data is already present", () => {
    render(<DetailViewerArea {...baseProps} hasSelection data={{ id: "1", title: "Cached Post" }} loading loadingMessage="Loading post…" />);

    expect(screen.getByTestId("content")).toHaveTextContent("Cached Post");
    expect(screen.queryByText("Loading post…")).not.toBeInTheDocument();
  });

  it("prefers error over loading when both are set without data", () => {
    render(<DetailViewerArea {...baseProps} hasSelection data={null} error={new Error("boom")} loading={false} errorTitle="Failed to load post" />);

    expect(screen.getByText("Failed to load post")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows loading when selected with neither data nor error (transitional)", () => {
    render(<DetailViewerArea {...baseProps} hasSelection data={null} loading={false} loadingMessage="Loading post…" />);

    expect(screen.getByText("Loading post…")).toBeInTheDocument();
  });
});
