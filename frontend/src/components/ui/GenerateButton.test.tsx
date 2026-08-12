import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rocket } from "lucide-react";
import GenerateButton from "./GenerateButton.tsx";

describe("GenerateButton", () => {
  it("renders idle label with sparkles affordance", () => {
    const { container } = render(
      <GenerateButton onClick={() => {}} disabled={false} loading={false}>
        Generate Image
      </GenerateButton>,
    );

    expect(screen.getByRole("button", { name: /generate image/i })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("shows spinner and loading label while loading", () => {
    const { container } = render(
      <GenerateButton onClick={() => {}} disabled loading>
        Generate Image
      </GenerateButton>,
    );

    const button = screen.getByRole("button", { name: /generating/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toHaveTextContent("Generate Image");
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("calls onClick when enabled", async () => {
    const onClick = mock(() => {});
    render(
      <GenerateButton onClick={onClick} disabled={false} loading={false}>
        Generate Image
      </GenerateButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: /generate image/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const onClick = mock(() => {});
    render(
      <GenerateButton onClick={onClick} disabled loading={false}>
        Generate Image
      </GenerateButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: /generate image/i }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies default pink-to-rose gradient classes", () => {
    render(
      <GenerateButton onClick={() => {}} disabled={false} loading={false}>
        Generate
      </GenerateButton>,
    );

    expect(screen.getByRole("button", { name: /generate/i })).toHaveClass("from-pink-600", "to-rose-600");
  });

  it("accepts a custom gradient", () => {
    render(
      <GenerateButton onClick={() => {}} disabled={false} loading={false} gradient="from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500">
        Generate
      </GenerateButton>,
    );

    const button = screen.getByRole("button", { name: /generate/i });
    expect(button).toHaveClass("from-violet-600", "to-indigo-600");
    expect(button).not.toHaveClass("from-pink-600");
  });

  it("accepts a custom loading label", () => {
    render(
      <GenerateButton onClick={() => {}} disabled loading loadingLabel="Creating...">
        Generate Image
      </GenerateButton>,
    );

    expect(screen.getByRole("button", { name: /creating/i })).toBeInTheDocument();
  });

  it("accepts a custom icon", () => {
    const { container } = render(
      <GenerateButton onClick={() => {}} disabled={false} loading={false} icon={Rocket}>
        Blast off
      </GenerateButton>,
    );

    expect(screen.getByRole("button", { name: /blast off/i })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("is full-width by default", () => {
    render(
      <GenerateButton onClick={() => {}} disabled={false} loading={false}>
        Generate
      </GenerateButton>,
    );

    expect(screen.getByRole("button", { name: /generate/i })).toHaveClass("w-full");
  });

  it("forwards className and data-testid", () => {
    render(
      <GenerateButton onClick={() => {}} disabled={false} loading={false} className="mt-4" data-testid="gen-btn">
        Generate
      </GenerateButton>,
    );

    const button = screen.getByTestId("gen-btn");
    expect(button).toHaveClass("mt-4", "w-full");
  });
});
