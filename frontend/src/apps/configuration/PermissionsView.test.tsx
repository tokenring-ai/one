import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { toastManager } from "../../components/ui/toast.tsx";

type Grant = { id: string; summary?: string; grantedAt: string; lastUsedAt?: string; uses: number; source: "global" | "workspace"; ignoredReason?: string };

let grants: Grant[] = [];
const mutate = mock(async () => undefined);
const revokePermissionGrant = mock(
  async (_args: { id: string }): Promise<{ status: "success"; id: string } | { status: "notFound" } | { status: "rejected"; message: string }> => ({
    status: "success",
    id: "x",
  }),
);

// Spread the real module: the registry imports more than this view uses.
const realRpc = await import("../../rpc.ts");
void mock.module("../../rpc.ts", () => ({
  ...realRpc,
  usePermissionGrants: () => ({ data: { status: "success", grants, maxGrantLevel: 8 }, isLoading: false, isValidating: false, error: undefined, mutate }),
  chatRPCClient: { ...realRpc.chatRPCClient, revokePermissionGrant },
}));

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutView } = await import("../../test/layout.tsx");
const { CONFIGURATION_VIEWS } = await import("./views.tsx");
const view = CONFIGURATION_VIEWS.find(candidate => candidate.id === "configuration-permissions")!;

describe("Permissions view", () => {
  beforeEach(() => {
    localStorage.clear();
    mutate.mockClear();
    revokePermissionGrant.mockClear();
    revokePermissionGrant.mockImplementation(async () => ({ status: "success", id: "x" }));
    grants = [];
  });

  it("explains what a permission is and how grants are created when there are none", () => {
    renderLayoutView(view);
    expect(screen.getByRole("heading", { name: "Things TokenRing may do without asking" })).toBeInTheDocument();
    expect(screen.getByText(/can never be allowed without asking/)).toBeInTheDocument();
    expect(screen.getByText(/highest safety level a permission can cover here is 8/)).toBeInTheDocument();
    expect(screen.getByText(/cannot grant/)).toBeInTheDocument();
    expect(screen.getByText("Nothing is allowed without asking yet")).toBeInTheDocument();
    expect(screen.getByText(/you choose Always allow/)).toBeInTheDocument();
  });

  it("lists grants with usage, source and ignored warnings", () => {
    grants = [
      {
        id: "blog.mysite.publish",
        summary: "Publish posts on mysite",
        grantedAt: "2026-11-16T09:12:00Z",
        lastUsedAt: "2026-11-18T07:00:04Z",
        uses: 3,
        source: "global",
      },
      { id: "x.*.post", grantedAt: "2026-11-16T09:12:00Z", uses: 0, source: "workspace", ignoredReason: "workspace file is writable by agents" },
    ];
    renderLayoutView(view);
    const first = within(screen.getByRole("listitem", { name: "blog.mysite.publish" }));
    expect(first.getByText("Publish posts on mysite")).toBeInTheDocument();
    expect(first.getByText("3 uses")).toBeInTheDocument();
    expect(first.getByText(/Last used/)).toBeInTheDocument();
    expect(first.queryByText("Workspace")).toBeNull();
    const second = within(screen.getByRole("listitem", { name: "x.*.post" }));
    expect(second.getByText("never used")).toBeInTheDocument();
    expect(second.getByText("Workspace")).toBeInTheDocument();
    expect(second.getByText(/Not in effect: workspace file is writable by agents/)).toBeInTheDocument();
  });

  it("revokes by exact id after a confirm that says what will ask again", async () => {
    const user = userEvent.setup();
    grants = [{ id: "blog.*.publish", summary: "Publish posts on any blog", grantedAt: "2026-11-16T09:12:00Z", uses: 1, source: "global" }];
    renderLayoutView(view);
    await user.click(screen.getByRole("button", { name: "Revoke blog.*.publish" }));
    expect(revokePermissionGrant).not.toHaveBeenCalled();
    expect(screen.getByText(/Agents will ask for approval again before they publish posts on any blog/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revokePermissionGrant).toHaveBeenCalledWith({ id: "blog.*.publish" }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
  });

  it("toasts the backend's message when revoking is rejected", async () => {
    const user = userEvent.setup();
    const errorToast = spyOn(toastManager, "error").mockImplementation(() => "");
    revokePermissionGrant.mockImplementation(async () => ({ status: "rejected", message: "Config file is read-only" }));
    grants = [{ id: "blog.mysite.publish", grantedAt: "2026-11-16T09:12:00Z", uses: 1, source: "global" }];
    renderLayoutView(view);
    await user.click(screen.getByRole("button", { name: "Revoke blog.mysite.publish" }));
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("Config file is read-only")));
  });
});
