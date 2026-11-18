import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import Button from "./button.tsx";
import IconButton from "./icon-button.tsx";
import SegmentedControl from "./segmented-control.tsx";
import TextField from "./text-field.tsx";

describe("Button", () => {
  it("calls onClick and exposes its variant", async () => {
    const onClick = mock(() => {});
    render(
      <Button icon={Plus} onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables itself and swaps the label while busy", () => {
    render(
      <Button busy busyLabel="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("IconButton", () => {
  it("uses the label as the accessible name", () => {
    render(<IconButton label="Close" icon={Plus} />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});

describe("TextField", () => {
  it("associates the label and reports an error", async () => {
    const onChange = mock((_value: string) => {});
    render(<TextField label="Name" value="" onChange={onChange} error="Required" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    await userEvent.type(input, "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });
});

describe("SegmentedControl", () => {
  it("selects an option from the keyboard", async () => {
    const onChange = mock((_value: string) => {});
    render(
      <SegmentedControl
        ariaLabel="Theme preference"
        value="light"
        onChange={onChange}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />,
    );
    const dark = screen.getByRole("button", { name: "Dark" });
    expect(dark).toHaveAttribute("aria-pressed", "false");
    dark.focus();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("dark");
  });
});
