import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParsedFormQuestion, ParsedTextQuestion, ParsedTreeSelectQuestion } from "@tokenring-ai/agent/question";
import FormInlineQuestion from "./form-inline.tsx";
import TextInlineQuestion from "./text-inline.tsx";
import TreeInlineQuestion from "./tree-inline.tsx";

const sendInteractionResponseMock = mock();
const toastErrorMock = mock();

void mock.module("../../../rpc.ts", () => ({
  agentRPCClient: { sendInteractionResponse: sendInteractionResponseMock },
  filesystemRPCClient: { listDirectory: mock(() => Promise.resolve({ files: [] })) },
}));
void mock.module("../../ui/toast.tsx", () => ({
  toastManager: { error: toastErrorMock, warning: mock(), success: mock(), info: mock() },
  notificationManager: { add: mock() },
}));

const textQuestion: ParsedTextQuestion = { type: "text", label: "Name", required: false, defaultValue: "", expectedLines: 1, masked: false };

function renderText(onClose = mock()) {
  render(<TextInlineQuestion question={textQuestion} agentId="a1" requestId="r1" interactionId="i1" onClose={onClose} autoFocus={false} />);
  return {
    onClose,
    input: screen.getByRole("textbox"),
    submit: screen.getByRole("button", { name: /submit/i }),
    cancel: screen.getByRole("button", { name: /cancel/i }),
  };
}

describe("question answers", () => {
  beforeEach(() => {
    sendInteractionResponseMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("re-enables the question and shows the error when the answer fails to send", async () => {
    const user = userEvent.setup();
    sendInteractionResponseMock.mockRejectedValueOnce(new Error("WebSocket closed"));
    const { onClose, input, submit, cancel } = renderText();
    await user.type(input, "Ada");
    await user.click(submit);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("WebSocket closed"));
    expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining("WebSocket closed"), expect.anything());
    expect(onClose).not.toHaveBeenCalled();
    expect(input).not.toBeDisabled();
    expect(submit).not.toBeDisabled();
    expect(cancel).not.toBeDisabled();

    // The user can retry.
    sendInteractionResponseMock.mockResolvedValueOnce({ status: "success" });
    await user.click(submit);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(sendInteractionResponseMock).toHaveBeenCalledTimes(2);
  });

  it("treats agentNotFound as a failure instead of closing the question", async () => {
    const user = userEvent.setup();
    sendInteractionResponseMock.mockResolvedValueOnce({ status: "agentNotFound" });
    const { onClose, submit } = renderText();
    await user.click(submit);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("The agent is no longer running."));
    expect(onClose).not.toHaveBeenCalled();
    expect(submit).not.toBeDisabled();
  });

  it("refuses a cancel while a submit is in flight (and vice versa)", async () => {
    const user = userEvent.setup();
    let resolveSend: (value: unknown) => void = () => {};
    sendInteractionResponseMock.mockImplementation(() => new Promise(resolve => (resolveSend = resolve)));
    const { onClose, input, submit, cancel } = renderText();
    await user.type(input, "Ada");
    await user.click(submit);
    await waitFor(() => expect(cancel).toBeDisabled());
    expect(submit).toBeDisabled();

    // Escape is the keyboard cancel; it must not send a second answer either.
    fireEvent.keyDown(input, { key: "Escape" });
    expect(sendInteractionResponseMock).toHaveBeenCalledTimes(1);

    await act(async () => resolveSend({ status: "success" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables submit while a cancel is in flight", async () => {
    const user = userEvent.setup();
    sendInteractionResponseMock.mockImplementation(() => new Promise(() => {}));
    const { submit, cancel } = renderText();
    await user.click(cancel);
    await waitFor(() => expect(submit).toBeDisabled());
    expect(cancel).toBeDisabled();
    expect(sendInteractionResponseMock).toHaveBeenCalledTimes(1);
    expect(sendInteractionResponseMock.mock.calls[0]?.[0]).toMatchObject({ response: { result: null } });
  });

  it("re-enables a tree question after a failed answer", async () => {
    const user = userEvent.setup();
    sendInteractionResponseMock.mockRejectedValueOnce(new Error("boom"));
    const question = {
      type: "treeSelect",
      label: "Pick",
      defaultValue: ["a"],
      minimumSelections: 0,
      allowFreeform: false,
      tree: [{ name: "A", value: "a" }],
    } as ParsedTreeSelectQuestion;
    const onClose = mock();
    render(<TreeInlineQuestion question={question} agentId="a1" requestId="r1" interactionId="i1" onClose={onClose} autoFocus={false} />);
    const submit = screen.getByRole("button", { name: /submit/i });
    await user.click(submit);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("boom"));
    expect(submit).not.toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores Escape on a form while its final answer is in flight", async () => {
    const user = userEvent.setup();
    let resolveSend: (value: unknown) => void = () => {};
    sendInteractionResponseMock.mockImplementation(() => new Promise(resolve => (resolveSend = resolve)));
    const question: ParsedFormQuestion = {
      type: "form",
      sections: [{ name: "S", fields: { name: textQuestion } }],
    };
    const onClose = mock();
    render(<FormInlineQuestion question={question} agentId="a1" requestId="r1" interactionId="i1" onClose={onClose} autoFocus={false} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "Ada{Enter}");
    expect(sendInteractionResponseMock).toHaveBeenCalledTimes(1);

    // Escape (the keyboard cancel) and a repeated Enter are both refused while sending.
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(input).toBeDisabled());
    expect(sendInteractionResponseMock).toHaveBeenCalledTimes(1);

    await act(async () => resolveSend({ status: "success" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
