import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordInput from "./PasswordInput.tsx";

describe("PasswordInput", () => {
  it("renders a password input by default", () => {
    render(<PasswordInput value="" onChange={() => {}} placeholder="Secret…" aria-label="Secret" />);

    const input = screen.getByLabelText("Secret");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("placeholder", "Secret…");
  });

  it("calls onChange with the typed value", async () => {
    const onChange = mock((_value: string) => {});
    render(<PasswordInput value="" onChange={onChange} aria-label="Secret" />);

    await userEvent.type(screen.getByLabelText("Secret"), "ab");

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.some(call => call[0] === "a")).toBe(true);
    expect(onChange.mock.calls.some(call => call[0] === "b")).toBe(true);
  });

  it("toggles visibility between password and text", async () => {
    render(<PasswordInput value="secret" onChange={() => {}} aria-label="Secret" />);

    const input = screen.getByLabelText("Secret");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show value" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide value" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hide value" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("supports controlled showValue", async () => {
    const onShowValueChange = mock((_show: boolean) => {});
    const { rerender } = render(
      <PasswordInput value="secret" onChange={() => {}} showValue={false} onShowValueChange={onShowValueChange} aria-label="Secret" />,
    );

    expect(screen.getByLabelText("Secret")).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show value" }));
    expect(onShowValueChange).toHaveBeenCalledWith(true);

    rerender(<PasswordInput value="secret" onChange={() => {}} showValue={true} onShowValueChange={onShowValueChange} aria-label="Secret" />);
    expect(screen.getByLabelText("Secret")).toHaveAttribute("type", "text");
  });

  it("hides the toggle when showToggle is false", () => {
    render(<PasswordInput value="x" onChange={() => {}} showToggle={false} aria-label="Secret" />);

    expect(screen.queryByRole("button", { name: "Show value" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Secret")).toHaveAttribute("type", "password");
  });

  it("applies wrapper className", () => {
    const { container } = render(<PasswordInput value="" onChange={() => {}} className="flex-1 min-w-0" aria-label="Secret" />);

    expect(container.firstChild).toHaveClass("relative", "flex-1", "min-w-0");
  });

  it("forwards disabled to the input and toggle", () => {
    render(<PasswordInput value="" onChange={() => {}} disabled aria-label="Secret" />);

    expect(screen.getByLabelText("Secret")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show value" })).toBeDisabled();
  });

  it("forwards autoFocus and onKeyDown", async () => {
    const onKeyDown = mock(() => {});
    render(<PasswordInput value="" onChange={() => {}} autoFocus onKeyDown={onKeyDown} aria-label="Secret" />);

    const input = screen.getByLabelText("Secret");
    expect(input).toHaveFocus();

    await userEvent.type(input, "{Enter}");
    expect(onKeyDown).toHaveBeenCalled();
  });
});
