import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

const TOKEN = "3q2-7wG4n0x8Yk1b9hZpA5uR6tVdLmCsQe_JfXoIhNa";
const LINK = `http://192.168.1.20:14008/#access=${TOKEN}`;

type User = {
  username: string;
  role: "admin" | "member";
  source: "config" | "managed";
  hasPassword: boolean;
  createdAt: number | null;
  createdBy: string | null;
  lastLoginAt: number | null;
  activeSessions: number;
  pendingAccessLinks: number;
};

let me: { username: string; role: "admin" | "member"; source: "config" | "managed" } = { username: "admin", role: "admin", source: "config" };
let users: User[] = [];
let links: Array<{ id: string; username: string; createdAt: number; expiresAt: number; createdBy: string | null }> = [];
let info = {
  baseUrl: "http://192.168.1.20:14008",
  baseUrlSource: "request",
  isLoopback: false,
  isHttps: false,
  warnings: [] as string[],
  storeProblem: null as string | null,
};

const mutate = mock(async () => undefined);
const swr = <T,>(data: T) => ({ data, isLoading: false, isValidating: false, error: undefined, mutate });
const createUser = mock(async (_args: Record<string, unknown>): Promise<Record<string, unknown>> => ({}));
const createMyAccessLink = mock(async (_args: Record<string, unknown>) => ({ id: "l1", url: LINK, expiresAt: Date.now() + 15 * 60_000 }));
const removeUser = mock(async (_args: { username: string }) => ({ ok: true }));
const revokeAccessLink = mock(async (_args: { id: string }) => ({ revoked: true }));
const signOutUser = mock(async (_args: { username: string }) => ({ ok: true }));

const realRpc = await import("../../rpc.ts");
void mock.module("../../rpc.ts", () => ({
  ...realRpc,
  useMe: () => swr(me),
  useUserList: () => swr({ users, storeProblem: null }),
  usePendingAccessLinks: () => swr({ links }),
  useRemoteAccessInfo: (enabled = true) => (enabled ? swr(info) : swr(undefined)),
  usersRPCClient: { createUser, createMyAccessLink, removeUser, revokeAccessLink, signOutUser },
}));

const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutView } = await import("../../test/layout.tsx");
const { CONFIGURATION_VIEWS } = await import("./views.tsx");
const view = CONFIGURATION_VIEWS.find(candidate => candidate.id === "configuration-users")!;

/** Everything a Storage holds, as one string. */
function dump(storage: Storage): string {
  return Object.keys(storage)
    .map(key => `${key}=${storage.getItem(key)}`)
    .join("\n");
}

const person = (overrides: Partial<User>): User => ({
  username: "maria",
  role: "member",
  source: "managed",
  hasPassword: false,
  createdAt: 1,
  createdBy: "admin",
  lastLoginAt: null,
  activeSessions: 0,
  pendingAccessLinks: 0,
  ...overrides,
});

describe("Users view", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    me = { username: "admin", role: "admin", source: "config" };
    users = [
      person({ username: "admin", role: "admin", source: "config", activeSessions: 2, lastLoginAt: 1_700_000_000_000 }),
      person({ username: "maria", pendingAccessLinks: 1 }),
    ];
    links = [{ id: "link-1", username: "maria", createdAt: 1, expiresAt: Date.now() + 3_600_000, createdBy: "admin" }];
    info = { baseUrl: "http://192.168.1.20:14008", baseUrlSource: "request", isLoopback: false, isHttps: false, warnings: [], storeProblem: null };
    for (const fn of [createUser, createMyAccessLink, removeUser, revokeAccessLink, signOutUser, mutate]) fn.mockClear();
  });

  it("lists users with role, config and activity details for an administrator", () => {
    renderLayoutView(view);
    const admin = screen.getByRole("listitem", { name: "admin" });
    expect(within(admin).getByText("Administrator")).toBeInTheDocument();
    expect(within(admin).getByText("Set in the config file")).toBeInTheDocument();
    expect(within(admin).getByText("2 devices")).toBeInTheDocument();
    const maria = screen.getByRole("listitem", { name: "maria" });
    expect(within(maria).getByText("Member")).toBeInTheDocument();
    expect(within(maria).queryByText("Set in the config file")).toBeNull();
    expect(within(maria).getByText(/Waiting links/).parentElement).toHaveTextContent("Waiting links: 1");
    expect(screen.getByRole("heading", { name: "Pending access links" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke the link for maria" })).toBeInTheDocument();
  });

  it("warns about plain http before any link is made, and about localhost", () => {
    info = { ...info, isLoopback: true, isHttps: false, warnings: ["Accounts created here are kept in memory only and will be lost on restart."] };
    renderLayoutView(view);
    expect(screen.getByText(/These links only work on this computer \(localhost\)/)).toBeInTheDocument();
    expect(screen.getByText(/kept in memory only/)).toBeInTheDocument();
    // localhost is not "unencrypted" in a way a network could read.
    expect(screen.queryByText(/This connection is not encrypted/)).toBeNull();
  });

  it("shows members only the 'ask an administrator' state and their own phone sign-in", () => {
    me = { username: "maria", role: "member", source: "managed" };
    renderLayoutView(view);
    expect(screen.getByText("Only an administrator manages users")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add user" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Users" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show a QR code for my phone" })).toBeInTheDocument();
  });

  it("validates the username live and keeps Add user out of the way until it is valid", async () => {
    const user = userEvent.setup();
    renderLayoutView(view);
    await user.click(screen.getByRole("button", { name: "Add user" }));
    const dialog = screen.getByRole("dialog", { name: "Add user" });
    await user.type(within(dialog).getByLabelText("Username"), "Maria");
    expect(within(dialog).getByText(/may contain only lowercase letters/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add user" }));
    expect(createUser).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/a member can still ask the assistant to do most things an administrator can, subject to approvals/i)).toBeInTheDocument();
  });

  it("creates a user with a link, shows the QR and notice once, and discards the link on Done", async () => {
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map(name => spyOn(console, name));
    createUser.mockResolvedValue({ user: person({ username: "sam" }), link: { id: "l2", url: LINK, expiresAt: Date.now() + 24 * 3_600_000 } });
    const user = userEvent.setup();
    renderLayoutView(view);
    await user.click(screen.getByRole("button", { name: "Add user" }));
    const form = screen.getByRole("dialog", { name: "Add user" });
    expect(within(form).getByText(/This connection is not encrypted/)).toBeInTheDocument();
    await user.type(within(form).getByLabelText("Username"), "sam");
    await user.click(within(form).getByRole("button", { name: "Add user" }));

    expect(createUser).toHaveBeenCalledWith({ username: "sam", role: "member", method: "accessLink", expiresInMinutes: 1440 });
    const result = await screen.findByRole("dialog", { name: "User created" });
    expect(within(result).getByText(/signs in as/)).toHaveTextContent(/This link signs in as sam\. Treat it like a password\. It works once and expires at/);
    const qr = within(result).getByRole("img", { name: /QR code that signs in as sam/ });
    expect(qr.getAttribute("aria-label")).not.toContain(TOKEN);
    expect(within(result).getByText(LINK)).toBeInTheDocument();
    expect(within(result).getByText(/Shown only once/)).toBeInTheDocument();
    expect(within(result).getByRole("button", { name: "Print" })).toBeInTheDocument();
    // Not in storage, not in the address bar, not in any attribute.
    expect([localStorage, sessionStorage].map(dump).join("\n")).not.toContain(TOKEN);
    expect(window.location.href).not.toContain(TOKEN);
    expect([...document.querySelectorAll("*")].some(el => [...el.attributes].some(attr => attr.value.includes(TOKEN)))).toBe(false);

    await user.click(within(result).getByRole("button", { name: "Done" }));
    expect(screen.queryByText(LINK)).toBeNull();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    for (const spy of consoleSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
      spy.mockRestore();
    }
  });

  it("surfaces a last-administrator refusal plainly", async () => {
    removeUser.mockRejectedValueOnce(new Error("This is the last administrator and cannot be removed."));
    users = [person({ username: "maria", role: "admin" })];
    const user = userEvent.setup();
    renderLayoutView(view);
    await user.click(screen.getByRole("button", { name: "Actions for maria" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
    const confirm = await screen.findByRole("dialog", { name: "Remove maria" });
    expect(confirm).toHaveTextContent(/removed straight away/);
    await user.click(within(confirm).getByRole("button", { name: "Remove user" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not remove maria: This is the last administrator and cannot be removed.");
  });

  it("revokes a pending link", async () => {
    const user = userEvent.setup();
    renderLayoutView(view);
    await user.click(screen.getByRole("button", { name: "Revoke the link for maria" }));
    await waitFor(() => expect(revokeAccessLink).toHaveBeenCalledWith({ id: "link-1" }));
  });

  it("lets a member make a link for themselves, with the address warning shown before it is made", async () => {
    me = { username: "maria", role: "member", source: "managed" };
    createMyAccessLink.mockResolvedValue({ id: "l3", url: LINK, expiresAt: Date.now() + 15 * 60_000 });
    const user = userEvent.setup();
    renderLayoutView(view);
    await user.click(screen.getByRole("button", { name: "Show a QR code for my phone" }));
    const form = screen.getByRole("dialog", { name: "Sign in on another device" });
    // jsdom's own address is localhost: the member cannot ask the server, so the page address stands in.
    expect(within(form).getByText(/These links only work on this computer/)).toBeInTheDocument();
    expect(within(form).getByLabelText("Link expires after")).toHaveValue("15");
    await user.click(within(form).getByRole("button", { name: "Create link and QR code" }));
    expect(createMyAccessLink).toHaveBeenCalledWith({ expiresInMinutes: 15 });
    const result = await screen.findByRole("dialog", { name: "Sign in on another device" });
    expect(within(result).getByRole("img", { name: /signs in as maria/ })).toBeInTheDocument();
    expect(within(result).getByText(LINK)).toBeInTheDocument();
  });
});
