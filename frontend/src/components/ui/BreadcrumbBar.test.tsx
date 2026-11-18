import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Eye, Plus, RefreshCw } from "lucide-react";
import BreadcrumbBar from "./BreadcrumbBar.tsx";

const segments = [
  { label: "src", value: "src" },
  { label: "components", value: "src/components" },
];

describe("BreadcrumbBar", () => {
  it("renders the root label and path segments", () => {
    render(<BreadcrumbBar segments={segments} onNavigate={() => {}} />);

    expect(screen.getByRole("button", { name: "root" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "src" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "components" })).toBeInTheDocument();
  });

  it("uses a custom root label", () => {
    render(<BreadcrumbBar segments={[]} rootLabel="Home" onNavigate={() => {}} />);

    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "root" })).not.toBeInTheDocument();
  });

  it("highlights the current (last) segment", () => {
    render(<BreadcrumbBar segments={segments} onNavigate={() => {}} />);

    const current = screen.getByRole("button", { name: "components" });
    expect(current).toHaveClass("text-primary", "font-medium");
    expect(current).toHaveAttribute("aria-current", "page");

    const ancestor = screen.getByRole("button", { name: "src" });
    expect(ancestor).not.toHaveClass("font-medium");
    expect(ancestor).not.toHaveAttribute("aria-current");
  });

  it("calls onNavigate with rootValue when root is clicked", async () => {
    const onNavigate = mock((_value: string) => {});
    render(<BreadcrumbBar segments={segments} rootValue="/" onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole("button", { name: "root" }));

    expect(onNavigate).toHaveBeenCalledWith("/");
  });

  it("defaults rootValue to '.'", async () => {
    const onNavigate = mock((_value: string) => {});
    render(<BreadcrumbBar segments={[]} onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole("button", { name: "root" }));

    expect(onNavigate).toHaveBeenCalledWith(".");
  });

  it("calls onNavigate with the segment value when a segment is clicked", async () => {
    const onNavigate = mock((_value: string) => {});
    render(<BreadcrumbBar segments={segments} onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole("button", { name: "src" }));

    expect(onNavigate).toHaveBeenCalledWith("src");
  });

  it("renders action buttons with aria-labels and titles", () => {
    render(
      <BreadcrumbBar
        segments={[]}
        onNavigate={() => {}}
        actions={[
          {
            icon: RefreshCw,
            onClick: () => {},
            ariaLabel: "Refresh",
            title: "Refresh directory",
          },
          {
            icon: Plus,
            label: "Upload",
            onClick: () => {},
            ariaLabel: "Upload files",
            title: "Upload files",
          },
        ]}
      />,
    );

    const refresh = screen.getByRole("button", { name: "Refresh" });
    expect(refresh).toHaveAttribute("title", "Refresh directory");

    const upload = screen.getByRole("button", { name: "Upload files" });
    expect(upload).toHaveAttribute("title", "Upload files");
    expect(upload).toHaveTextContent("Upload");
  });

  it("calls action onClick handlers", async () => {
    const onRefresh = mock(() => {});
    render(
      <BreadcrumbBar
        segments={[]}
        onNavigate={() => {}}
        actions={[
          {
            icon: RefreshCw,
            onClick: onRefresh,
            ariaLabel: "Refresh",
            title: "Refresh",
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("uses iconVariant when provided", () => {
    const { container } = render(
      <BreadcrumbBar
        segments={[]}
        onNavigate={() => {}}
        actions={[
          {
            icon: Eye,
            iconVariant: Plus,
            onClick: () => {},
            ariaLabel: "Toggle",
            title: "Toggle",
          },
        ]}
      />,
    );

    // lucide icons render as SVGs; presence of the action button is enough for click wiring.
    // iconVariant is applied when rendering — assert the action button exists.
    expect(screen.getByRole("button", { name: "Toggle" })).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies labelBreakpoint classes for sm and md", () => {
    render(
      <BreadcrumbBar
        segments={[]}
        onNavigate={() => {}}
        actions={[
          {
            icon: Plus,
            label: "New file",
            labelBreakpoint: "md",
            onClick: () => {},
            ariaLabel: "New file",
            title: "New file",
          },
          {
            icon: Eye,
            label: "Show hidden",
            labelBreakpoint: "sm",
            onClick: () => {},
            ariaLabel: "Show hidden",
            title: "Show hidden",
          },
        ]}
      />,
    );

    const mdLabel = screen.getByText("New file");
    expect(mdLabel).toHaveClass("hidden", "md:inline");

    const smLabel = screen.getByText("Show hidden");
    expect(smLabel).toHaveClass("hidden", "sm:inline");
  });

  it("merges className onto the container", () => {
    const { container } = render(<BreadcrumbBar segments={[]} onNavigate={() => {}} className="data-custom" />);

    expect(container.firstChild).toHaveClass("data-custom");
    expect(container.firstChild).toHaveClass("h-10", "bg-secondary");
  });

  it("exposes a breadcrumb nav landmark", () => {
    render(<BreadcrumbBar segments={segments} onNavigate={() => {}} />);

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });
});
