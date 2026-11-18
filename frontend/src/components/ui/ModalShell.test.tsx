import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";

let lastFocusTrapOptions: unknown;
// focus-trap refuses to activate in jsdom; record the options ModalShell passes instead.
const PassThroughFocusTrap = ({ children, focusTrapOptions }: { children: ReactNode; focusTrapOptions?: unknown }) => {
  lastFocusTrapOptions = focusTrapOptions;
  return children;
};
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: ModalShell } = await import("./ModalShell.tsx");

function pressEscape(target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function Nested({ onOuterClose, onInnerClose }: { onOuterClose: () => void; onInnerClose: () => void }) {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerOpen, setInnerOpen] = useState(false);
  return (
    <ModalShell
      open={outerOpen}
      title="Outer"
      onClose={() => {
        onOuterClose();
        setOuterOpen(false);
      }}
    >
      <button type="button" onClick={() => setInnerOpen(true)}>
        open inner
      </button>
      <ModalShell
        open={innerOpen}
        title="Inner"
        onClose={() => {
          onInnerClose();
          setInnerOpen(false);
        }}
      >
        inner body
      </ModalShell>
    </ModalShell>
  );
}

describe("ModalShell Escape handling", () => {
  afterEach(() => cleanup());

  it("closes only the topmost of two nested modals per Escape", () => {
    const onOuterClose = mock();
    const onInnerClose = mock();
    render(<Nested onOuterClose={onOuterClose} onInnerClose={onInnerClose} />);
    act(() => {
      screen.getByRole("button", { name: "open inner" }).click();
    });
    expect(screen.getByRole("dialog", { name: "Inner" })).toBeInTheDocument();

    pressEscape();
    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Inner" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();

    pressEscape();
    expect(onOuterClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Outer" })).not.toBeInTheDocument();
  });

  it("keeps the topmost modal's ownership across re-renders", () => {
    const outerClose = mock();
    const innerClose = mock();
    const { rerender } = render(
      <>
        <ModalShell title="Outer" onClose={outerClose}>
          outer
        </ModalShell>
        <ModalShell title="Inner" onClose={innerClose}>
          inner
        </ModalShell>
      </>,
    );
    // New onClose identities on the outer modal must not move it back on top.
    rerender(
      <>
        <ModalShell title="Outer" onClose={() => outerClose()}>
          outer
        </ModalShell>
        <ModalShell title="Inner" onClose={innerClose}>
          inner
        </ModalShell>
      </>,
    );

    pressEscape();
    expect(innerClose).toHaveBeenCalledTimes(1);
    expect(outerClose).not.toHaveBeenCalled();
  });

  it("a busy topmost modal swallows Escape instead of letting the one beneath close", () => {
    const outerClose = mock();
    const innerClose = mock();
    render(
      <>
        <ModalShell title="Outer" onClose={outerClose}>
          outer
        </ModalShell>
        <ModalShell title="Inner" onClose={innerClose} busy>
          inner
        </ModalShell>
      </>,
    );

    pressEscape();
    expect(innerClose).not.toHaveBeenCalled();
    expect(outerClose).not.toHaveBeenCalled();
  });

  it("ignores an Escape something inside already handled (defaultPrevented)", () => {
    const onClose = mock();
    render(
      <ModalShell title="Editor" onClose={onClose}>
        <input
          aria-label="Search"
          onKeyDown={event => {
            if (event.key === "Escape") event.preventDefault();
          }}
        />
      </ModalShell>,
    );

    pressEscape(screen.getByLabelText("Search"));
    expect(onClose).not.toHaveBeenCalled();

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("turns off focus-trap's own Escape handling, which would preventDefault first", () => {
    render(
      <ModalShell title="Trap" onClose={() => {}}>
        body
      </ModalShell>,
    );
    expect(lastFocusTrapOptions).toMatchObject({ escapeDeactivates: false });
  });
});
