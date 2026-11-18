import { beforeEach, describe, expect, it, mock } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

const SECRET = "GOCSPX-never-shown-again";
const CLIENT_ID = "1234567890-abc.apps.googleusercontent.com";
const REDIRECT = "http://127.0.0.1:14008/oauth/google/callback";

type Account = { name: string; email: string; gmail: boolean; calendar: boolean; drive: boolean; connected: boolean };
type Setup = {
  redirectUris: string[];
  canSaveCredentials: boolean;
  clientIdSource: "vault" | "environment" | "settings" | "none";
  clientSecretSource: "vault" | "environment" | "settings" | "none";
  clientId?: string;
  credentialsReady: boolean;
  accounts: Account[];
};

type Attempt = {
  id: string;
  name: string;
  email: string;
  services?: ("gmail" | "calendar" | "drive")[];
  state: "waiting" | "finishing" | "connected" | "failed" | "cancelled";
  authorizationUrl?: string;
  connectedEmail?: string;
  error?: { code: string; title: string; message: string; tryThis: string[]; details: string };
};

const notReady: Setup = {
  redirectUris: [REDIRECT],
  canSaveCredentials: true,
  clientIdSource: "none",
  clientSecretSource: "none",
  credentialsReady: false,
  accounts: [],
};
const ready: Setup = { ...notReady, clientIdSource: "vault", clientSecretSource: "vault", clientId: CLIENT_ID, credentialsReady: true };
const waiting: Attempt = {
  id: "a1",
  name: "elena@example.com",
  email: "elena@example.com",
  state: "waiting",
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
};

let setupData: Setup;
let attemptData: Attempt | null;
const getSetup = mock(async (_input: object) => setupData);
const getConnectStatus = mock(async (_input: object) => ({ attempt: attemptData }));
const saveCredentials = mock(
  async (_input: { clientId: string; clientSecret: string }): Promise<Record<string, unknown>> => ({ status: "success", setup: ready }),
);
const startConnect = mock(async (_input: { email: string; services: string[] }): Promise<Record<string, unknown>> => ({ status: "started", attempt: waiting }));
const updateAccountServices = mock(
  async (_input: { name: string; services: string[] }): Promise<Record<string, unknown>> => ({ status: "saved", message: "Saved.", accounts: [] }),
);
const disconnectAccount = mock(
  async (_input: { name: string }): Promise<Record<string, unknown>> => ({ status: "disconnected", revoke: "confirmed", message: "Gone.", accounts: [] }),
);
const cancelConnect = mock(async (_input: object) => ({ status: "success" }));
const unlock = mock(async (_input: { password?: string }) => ({ success: true, message: "Vault unlocked" }));
const getStatus = mock(async (_input: object) => ({ unlocked: false, passwordSource: "keychain", canChangePassword: true }));

void mock.module("../../rpc.ts", () => ({
  // The Users view is part of the Configuration views these tests load; it is not exercised here.
  useMe: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  useUserList: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  usePendingAccessLinks: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  useRemoteAccessInfo: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  usersRPCClient: {},
  chatRPCClient: {},
  usePermissionGrants: () => ({ data: { status: "success", grants: [], maxGrantLevel: 8 }, isLoading: false, error: undefined, mutate: async () => undefined }),
  useProviderStatuses: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  aiRPCClient: {},
  googleRPCClient: { getSetup, getConnectStatus, saveCredentials, startConnect, cancelConnect, updateAccountServices, disconnectAccount },
  vaultRPCClient: { unlock, getStatus },
  useConfigSchema: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  useConfigValues: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  configRPCClient: {},
}));

const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutView } = await import("../../test/layout.tsx");
const { CONFIGURATION_VIEWS } = await import("./views.tsx");
const view = CONFIGURATION_VIEWS.find(candidate => candidate.id === "configuration-connect-google")!;

type Tab = { opener: unknown; location: { href: string }; close: ReturnType<typeof mock> };
let tab: Tab;
const open = mock((_url?: string, _target?: string, _features?: string): Tab | null => tab);

const renderView = () => renderLayoutView(view);
const step = (n: number, title: string) => within(screen.getByRole("region", { name: `Step ${n}: ${title}` }));

async function fillAndSave(user: ReturnType<typeof userEvent.setup>) {
  const form = within(screen.getByRole("form", { name: "Google client credentials" }));
  await user.type(form.getByLabelText("Client ID"), CLIENT_ID);
  await user.type(form.getByLabelText("Client secret"), SECRET);
  await user.click(form.getByRole("button", { name: "Save" }));
}

describe("Connect Google wizard", () => {
  beforeEach(() => {
    setupData = notReady;
    attemptData = null;
    for (const fn of [
      getSetup,
      getConnectStatus,
      saveCredentials,
      startConnect,
      cancelConnect,
      updateAccountServices,
      disconnectAccount,
      unlock,
      getStatus,
      open,
    ])
      fn.mockClear();
    saveCredentials.mockImplementation(async () => ({ status: "success", setup: ready }));
    startConnect.mockImplementation(async () => ({ status: "started", attempt: waiting }));
    tab = { opener: "window", location: { href: "" }, close: mock(() => {}) };
    window.open = open as unknown as typeof window.open;
  });

  it("starts with the plain explanation and the not-connected state", async () => {
    renderView();
    expect(await screen.findByRole("heading", { name: "Connect Google" })).toBeInTheDocument();
    expect(step(1, "What you will do, and why").getByText(/small private access pass/)).toBeInTheDocument();
    expect(screen.queryByTestId("connect-google-credentials-saved")).not.toBeInTheDocument();
    expect(step(5, "Connect").getByRole("button", { name: "Connect" })).toBeDisabled();
    expect(step(5, "Connect").getByText("Finish step 3 first.")).toBeInTheDocument();
  });

  it("lists the instructions, the exact redirect address to copy, and opens the Google Cloud console", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Connect Google" });
    const guide = step(2, "Create your Google access");
    await guide.findByText(REDIRECT);
    expect(guide.getByText(/Web application/)).toBeInTheDocument();
    expect(guide.getByText(/Test users/)).toBeInTheDocument();
    expect(guide.getByText("Gmail API")).toBeInTheDocument();
    expect(guide.getByText("Google Calendar API")).toBeInTheDocument();

    await user.click(guide.getByRole("button", { name: "Copy address" }));
    expect(await navigator.clipboard.readText()).toBe(REDIRECT);

    await user.click(guide.getByRole("button", { name: "Open Google Cloud console" }));
    expect(open).toHaveBeenCalledWith("https://console.cloud.google.com/", "_blank", "noopener,noreferrer");
  });

  it("saves the Client ID and a masked secret, then never shows the secret again", async () => {
    const user = userEvent.setup();
    renderView();
    const form = within(await screen.findByRole("form", { name: "Google client credentials" }));
    expect(form.getByLabelText("Client secret")).toHaveAttribute("type", "password");

    await fillAndSave(user);

    expect(saveCredentials).toHaveBeenCalledWith({ clientId: CLIENT_ID, clientSecret: SECRET });
    const saved = await screen.findByTestId("connect-google-credentials-saved");
    expect(saved).toHaveTextContent("saved in your encrypted vault");
    expect(saved).toHaveTextContent(CLIENT_ID);
    expect(saved).toHaveTextContent("never shown again");
    expect(document.body.innerHTML).not.toContain(SECRET);
    expect(document.body.textContent).not.toContain(SECRET);
    for (const input of Array.from(document.querySelectorAll("input"))) expect(input.value).not.toContain(SECRET);
    expect(step(5, "Connect").getByRole("button", { name: "Connect" })).toBeDisabled(); // no email yet
  });

  it("drops the secret from the page even when saving fails", async () => {
    const user = userEvent.setup();
    saveCredentials.mockImplementation(async () => ({ status: "invalid", message: "That does not look like a Google Client ID." }));
    renderView();
    await screen.findByRole("form", { name: "Google client credentials" });
    await fillAndSave(user);

    expect(await screen.findByText("That does not look like a Google Client ID.")).toBeInTheDocument();
    for (const input of Array.from(document.querySelectorAll("input"))) expect(input.value).not.toContain(SECRET);
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it("offers to unlock the vault when it is locked", async () => {
    setupData = { ...notReady, canSaveCredentials: false };
    renderView();
    expect(await screen.findByTestId("ai-providers-vault-locked")).toBeInTheDocument();
    expect(screen.getAllByText(/encrypted file on this computer/).length).toBeGreaterThan(0);
  });

  it("shows the unlock offer when saving finds the vault locked", async () => {
    const user = userEvent.setup();
    saveCredentials.mockImplementation(async () => ({ status: "vaultLocked", message: "Your keys are locked. Unlock them first." }));
    renderView();
    await screen.findByRole("form", { name: "Google client credentials" });
    expect(screen.queryByTestId("ai-providers-vault-locked")).not.toBeInTheDocument();
    await fillAndSave(user);

    expect(await screen.findByTestId("ai-providers-vault-locked")).toBeInTheDocument();
    expect(screen.getByText("Your keys are locked. Unlock them first.")).toBeInTheDocument();
  });

  it("explains that the access was set up outside the screen when it comes from the environment", async () => {
    setupData = { ...ready, clientIdSource: "environment", clientSecretSource: "environment" };
    renderView();
    expect(await screen.findByText(/set up outside this screen/)).toBeInTheDocument();
  });

  it("connects: opens Google's sign-in in a new tab, shows progress, then success with links to Email and Calendar", async () => {
    const user = userEvent.setup();
    setupData = ready;
    renderView();
    const form = within(await screen.findByRole("form", { name: "Connect a Google account" }));
    await user.type(form.getByLabelText("Your Google email address"), "elena@example.com");
    await user.click(form.getByRole("button", { name: "Connect" }));

    expect(startConnect).toHaveBeenCalledWith({ email: "elena@example.com", services: ["gmail", "calendar"] });
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    await waitFor(() => expect(tab.location.href).toBe(waiting.authorizationUrl as string));
    expect(tab.opener).toBeNull();
    expect(await screen.findByTestId("connect-google-progress")).toHaveTextContent("Waiting for you to finish signing in");

    attemptData = { ...waiting, state: "connected", connectedEmail: "elena@example.com" };
    const success = await screen.findByTestId("connect-google-success", undefined, { timeout: 4000 });
    expect(success).toHaveTextContent("Connected as elena@example.com");
    expect(success).toHaveTextContent("Email (Gmail), Calendar");
    expect(within(success).getByRole("link", { name: /Open Email/ })).toHaveAttribute("href", "/email");
    expect(within(success).getByRole("link", { name: /Open Calendar/ })).toHaveAttribute("href", "/calendar");
  });

  it("gives a link when the browser blocks the new tab", async () => {
    const user = userEvent.setup();
    setupData = ready;
    open.mockImplementationOnce(() => null);
    renderView();
    await user.type(await screen.findByLabelText("Your Google email address"), "elena@example.com");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    const link = await screen.findByRole("link", { name: "Open Google sign-in" });
    expect(link).toHaveAttribute("href", waiting.authorizationUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/blocked the new tab/)).toBeInTheDocument();
  });

  it("can stop waiting", async () => {
    const user = userEvent.setup();
    setupData = ready;
    attemptData = waiting;
    cancelConnect.mockImplementationOnce(async () => {
      attemptData = { ...waiting, state: "cancelled" };
      return { status: "success" };
    });
    renderView();
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(cancelConnect).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("connect-google-progress")).not.toBeInTheDocument());
  });

  it("resumes a sign-in that is still going on after a reload", async () => {
    setupData = ready;
    attemptData = { ...waiting, state: "finishing" };
    renderView();
    expect(await screen.findByTestId("connect-google-progress")).toHaveTextContent("Finishing up");
  });

  const failures = [
    ["accessDenied", "Google did not let this account in", /test user/],
    ["redirectUriMismatch", "Google does not recognise this app's return address", /redirect address/],
    ["wrongClient", "Google did not accept the client ID and secret", /Web application/],
    ["invalidGrant", "Google's sign-in code did not work", /used or took too long/],
    ["noRefreshToken", "Google did not give lasting access", /lasting access/],
    ["timedOut", "The sign-in did not finish", /never heard back/],
    ["exchangeFailed", "Signing in with Google did not complete", /would not finish/],
  ] as const;
  for (const [code, title, cause] of failures) {
    it(`explains a ${code} failure in plain words`, async () => {
      const user = userEvent.setup();
      setupData = ready;
      attemptData = {
        ...waiting,
        state: "failed",
        error: { code, title, message: String(cause.source), tryThis: ["Do the first thing", "Do the second thing"], details: `raw ${code}` },
      };
      delete attemptData.authorizationUrl;
      renderView();

      const failure = await screen.findByTestId("connect-google-failure");
      expect(failure).toHaveAttribute("data-code", code);
      expect(within(failure).getByText(title)).toBeInTheDocument();
      expect(within(failure).getByText("Do the first thing")).toBeInTheDocument();
      await user.click(within(failure).getByRole("button", { name: "Copy details" }));
      expect(await navigator.clipboard.readText()).toBe(`raw ${code}`);

      await user.click(within(failure).getByRole("button", { name: "Try again" }));
      expect(startConnect).toHaveBeenCalled();
    });
  }

  it("shows an unknown failure verbatim with details to copy", async () => {
    const user = userEvent.setup();
    setupData = ready;
    attemptData = {
      ...waiting,
      state: "failed",
      error: {
        code: "unknown",
        title: "Connecting to Google failed",
        message: "Weird error 42 from nowhere",
        tryThis: ["Press Connect to try again."],
        details: "Weird error 42 from nowhere",
      },
    };
    renderView();
    const failure = await screen.findByTestId("connect-google-failure");
    expect(within(failure).getByText("Weird error 42 from nowhere")).toBeInTheDocument();
    await user.click(within(failure).getByRole("button", { name: "Copy details" }));
    expect(await navigator.clipboard.readText()).toBe("Weird error 42 from nowhere");
  });

  it("shows the unlock offer for a vault-locked failure", async () => {
    setupData = ready;
    attemptData = {
      ...waiting,
      state: "failed",
      error: {
        code: "vaultLocked",
        title: "Your keys are locked",
        message: "The vault is locked.",
        tryThis: ["Unlock the vault, then press Connect again."],
        details: "Vault is uninitialized or locked",
      },
    };
    renderView();
    expect(await screen.findByTestId("connect-google-failure")).toHaveAttribute("data-code", "vaultLocked");
    expect(screen.getByTestId("ai-providers-vault-locked")).toBeInTheDocument();
  });

  it("reports when the server refuses to start the sign-in", async () => {
    const user = userEvent.setup();
    setupData = ready;
    startConnect.mockImplementation(async () => ({ status: "invalid", message: "Enter the Google email address you want to connect, like name@gmail.com." }));
    renderView();
    await user.type(await screen.findByLabelText("Your Google email address"), "elena");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText(/like name@gmail.com/)).toBeInTheDocument();
    expect(tab.close).toHaveBeenCalled();
  });

  describe("choosing services", () => {
    it("asks what TokenRing should use, with Email and Calendar ticked and Drive not, and says plainly what each allows", async () => {
      setupData = ready;
      renderView();
      await screen.findByRole("group", { name: "Google services" });
      const choose = step(4, "What should TokenRing use?");
      expect(choose.getByRole("checkbox", { name: "Email (Gmail)" })).toBeChecked();
      expect(choose.getByRole("checkbox", { name: "Calendar" })).toBeChecked();
      expect(choose.getByRole("checkbox", { name: "Files (Google Drive)" })).not.toBeChecked();
      expect(choose.getByText(/read, write drafts, send and organise your mail/)).toBeInTheDocument();
      expect(choose.getByText(/read and change your calendar events/)).toBeInTheDocument();
      expect(choose.getByText(/read and change ALL files in your Google Drive/)).toBeInTheDocument();
    });

    it("sends exactly the ticked services, including Drive when it is ticked", async () => {
      const user = userEvent.setup();
      setupData = ready;
      renderView();
      await user.click(await screen.findByRole("checkbox", { name: "Files (Google Drive)" }));
      await user.click(screen.getByRole("checkbox", { name: "Calendar" }));
      await user.type(screen.getByLabelText("Your Google email address"), "elena@example.com");
      await user.click(screen.getByRole("button", { name: "Connect" }));
      expect(startConnect).toHaveBeenCalledWith({ email: "elena@example.com", services: ["gmail", "drive"] });
    });

    it("will not connect until at least one service is ticked", async () => {
      const user = userEvent.setup();
      setupData = ready;
      renderView();
      await user.type(await screen.findByLabelText("Your Google email address"), "elena@example.com");
      await user.click(screen.getByRole("checkbox", { name: "Email (Gmail)" }));
      await user.click(screen.getByRole("checkbox", { name: "Calendar" }));

      expect(step(4, "What should TokenRing use?").getByRole("alert")).toHaveTextContent("Choose at least one.");
      expect(step(5, "Connect").getByRole("button", { name: "Connect" })).toBeDisabled();
      expect(startConnect).not.toHaveBeenCalled();
    });

    it("links to Email and Calendar only for the services that were linked", async () => {
      const user = userEvent.setup();
      setupData = ready;
      startConnect.mockImplementation(async () => ({ status: "started", attempt: { ...waiting, services: ["drive"] } }));
      renderView();
      await user.click(await screen.findByRole("checkbox", { name: "Files (Google Drive)" }));
      await user.click(screen.getByRole("checkbox", { name: "Email (Gmail)" }));
      await user.click(screen.getByRole("checkbox", { name: "Calendar" }));
      await user.type(screen.getByLabelText("Your Google email address"), "elena@example.com");
      await user.click(screen.getByRole("button", { name: "Connect" }));
      attemptData = { ...waiting, services: ["drive"], state: "connected", connectedEmail: "elena@example.com" };

      const success = await screen.findByTestId("connect-google-success", undefined, { timeout: 4000 });
      expect(success).toHaveTextContent("Linked: Files (Google Drive).");
      expect(within(success).queryByRole("link", { name: /Open Email/ })).not.toBeInTheDocument();
      expect(within(success).queryByRole("link", { name: /Open Calendar/ })).not.toBeInTheDocument();
    });
  });

  describe("connected accounts", () => {
    const elena: Account = { name: "elena@example.com", email: "elena@example.com", gmail: true, calendar: true, drive: false, connected: true };
    const mark: Account = { name: "mark@example.com", email: "mark@example.com", gmail: true, calendar: false, drive: true, connected: false };
    const row = (email: string) => within(screen.getByTestId(`connect-google-account-${email}`));

    it("lists each account with its email, a chip for each linked service and its status", async () => {
      setupData = { ...ready, accounts: [elena, mark] };
      renderView();
      const accounts = await screen.findByTestId("connect-google-accounts");
      expect(accounts).toHaveTextContent("elena@example.com");
      expect(accounts).toHaveTextContent("mark@example.com");

      const elenaServices = row("elena@example.com").getByRole("list", { name: "Services linked to elena@example.com" });
      expect(
        within(elenaServices)
          .getAllByRole("listitem")
          .map(item => item.textContent),
      ).toEqual(["Email (Gmail)", "Calendar"]);
      expect(row("elena@example.com").getByText("Connected")).toBeInTheDocument();
      const markServices = row("mark@example.com").getByRole("list", { name: "Services linked to mark@example.com" });
      expect(
        within(markServices)
          .getAllByRole("listitem")
          .map(item => item.textContent),
      ).toEqual(["Email (Gmail)", "Files (Google Drive)"]);
      expect(row("mark@example.com").getByText("Needs sign-in")).toBeInTheDocument();
    });

    it("takes a service away without sending the person to Google", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [{ ...elena, drive: true }] };
      updateAccountServices.mockImplementation(async () => ({
        status: "saved",
        message: "TokenRing no longer uses Files (Google Drive) for this account.",
        accounts: [elena],
      }));
      renderView();
      await user.click(await screen.findByRole("button", { name: "Change services for elena@example.com" }));
      const form = within(screen.getByRole("form", { name: "Change services for elena@example.com" }));
      expect(form.getByRole("checkbox", { name: "Files (Google Drive)" })).toBeChecked();
      expect(form.getByRole("button", { name: "Save" })).toBeDisabled(); // nothing changed yet
      await user.click(form.getByRole("checkbox", { name: "Files (Google Drive)" }));
      expect(form.getByText(/only stops TokenRing using it/)).toBeInTheDocument();
      await user.click(form.getByRole("button", { name: "Save" }));

      expect(updateAccountServices).toHaveBeenCalledWith({ name: "elena@example.com", services: ["gmail", "calendar"] });
      expect(open).not.toHaveBeenCalled();
      expect(await screen.findByTestId("connect-google-notice")).toHaveTextContent("no longer uses Files (Google Drive)");
      expect(row("elena@example.com").queryByText("Files (Google Drive)")).not.toBeInTheDocument();
    });

    it("will not save an account with no service", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [{ ...elena, calendar: false }] };
      renderView();
      await user.click(await screen.findByRole("button", { name: "Change services for elena@example.com" }));
      const form = within(screen.getByRole("form", { name: "Change services for elena@example.com" }));
      await user.click(form.getByRole("checkbox", { name: "Email (Gmail)" }));
      expect(form.getByRole("alert")).toHaveTextContent("Choose at least one.");
      expect(form.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("adding a service re-runs Google's consent and shows the same progress", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [elena] };
      const consent: Attempt = { ...waiting, services: ["gmail", "calendar", "drive"] };
      updateAccountServices.mockImplementation(async () => ({ status: "needsConsent", attempt: consent }));
      renderView();
      await user.click(await screen.findByRole("button", { name: "Change services for elena@example.com" }));
      const form = within(screen.getByRole("form", { name: "Change services for elena@example.com" }));
      await user.click(form.getByRole("checkbox", { name: "Files (Google Drive)" }));
      expect(form.getByText(/Google asks for your permission again/)).toBeInTheDocument();
      await user.click(form.getByRole("button", { name: "Save and ask Google" }));

      expect(updateAccountServices).toHaveBeenCalledWith({ name: "elena@example.com", services: ["gmail", "calendar", "drive"] });
      expect(open).toHaveBeenCalledWith("about:blank", "_blank");
      await waitFor(() => expect(tab.location.href).toBe(waiting.authorizationUrl as string));
      expect(await row("elena@example.com").findByTestId("connect-google-progress")).toHaveTextContent("Waiting for you to finish signing in");
      // The connect form below is not taken over by it.
      expect(screen.getByRole("form", { name: "Connect a Google account" })).toBeInTheDocument();

      attemptData = { ...consent, state: "connected", connectedEmail: "elena@example.com" };
      setupData = { ...ready, accounts: [{ ...elena, drive: true }] };
      expect(await screen.findByTestId("connect-google-notice", undefined, { timeout: 4000 })).toHaveTextContent("Services updated");
      expect(screen.queryByTestId("connect-google-success")).not.toBeInTheDocument();
      await waitFor(() => expect(row("elena@example.com").getByText("Files (Google Drive)")).toBeInTheDocument());
    });

    it("shows the failure of a consent in the account's row, with a way to try again", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [elena] };
      updateAccountServices.mockImplementation(async () => ({ status: "needsConsent", attempt: { ...waiting, services: ["gmail", "calendar", "drive"] } }));
      renderView();
      await user.click(await screen.findByRole("button", { name: "Change services for elena@example.com" }));
      await user.click(
        within(screen.getByRole("form", { name: "Change services for elena@example.com" })).getByRole("checkbox", { name: "Files (Google Drive)" }),
      );
      await user.click(screen.getByRole("button", { name: "Save and ask Google" }));

      attemptData = {
        ...waiting,
        services: ["gmail", "calendar", "drive"],
        state: "failed",
        error: {
          code: "accessDenied",
          title: "Google did not let this account in",
          message: "Not a test user.",
          tryThis: ["Add the test user"],
          details: "access_denied",
        },
      };
      const failure = await within(screen.getByTestId("connect-google-account-elena@example.com")).findByTestId("connect-google-failure", undefined, {
        timeout: 4000,
      });
      expect(failure).toHaveTextContent("Google did not let this account in");
      updateAccountServices.mockClear();
      await user.click(within(failure).getByRole("button", { name: "Try again" }));
      expect(updateAccountServices).toHaveBeenCalledWith({ name: "elena@example.com", services: ["gmail", "calendar", "drive"] });
    });

    it("shows a refusal from the server in the form", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [elena] };
      updateAccountServices.mockImplementation(async () => ({ status: "invalid", message: "Could not change the services." }));
      renderView();
      await user.click(await screen.findByRole("button", { name: "Change services for elena@example.com" }));
      const form = within(screen.getByRole("form", { name: "Change services for elena@example.com" }));
      await user.click(form.getByRole("checkbox", { name: "Email (Gmail)" }));
      await user.click(form.getByRole("button", { name: "Save" }));
      expect(await form.findByRole("alert")).toHaveTextContent("Could not change the services.");
    });

    it("asks before disconnecting, and says exactly what will happen", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [elena] };
      renderView();
      await user.click(await screen.findByRole("button", { name: "Disconnect elena@example.com" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Disconnect elena@example.com?")).toBeInTheDocument();
      for (const text of [
        /ask Google to take back its access/,
        /delete the saved sign-in/,
        /encrypted vault/,
        /remove the account from your settings/,
        /Nothing in your Google account is deleted/,
        /Client ID and Client secret stay/,
        /Google did not confirm/,
      ]) {
        expect(within(dialog).getByText(text)).toBeInTheDocument();
      }
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(disconnectAccount).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("disconnects, removes the account from the list and reports that Google confirmed", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [elena, mark] };
      disconnectAccount.mockImplementation(async () => ({
        status: "disconnected",
        revoke: "confirmed",
        message: "elena@example.com is disconnected. TokenRing deleted its saved sign-in and Google confirmed the access was taken back.",
        accounts: [mark],
      }));
      renderView();
      await user.click(await screen.findByRole("button", { name: "Disconnect elena@example.com" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));

      expect(disconnectAccount).toHaveBeenCalledWith({ name: "elena@example.com" });
      const notice = await screen.findByTestId("connect-google-notice");
      expect(notice).toHaveTextContent("Google confirmed the access was taken back");
      expect(screen.queryByTestId("connect-google-account-elena@example.com")).not.toBeInTheDocument();
      expect(screen.getByTestId("connect-google-account-mark@example.com")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("tells the truth when Google did not confirm, while the account is still removed", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [elena] };
      disconnectAccount.mockImplementation(async () => ({
        status: "disconnected",
        revoke: "notConfirmed",
        message: "elena@example.com is disconnected. TokenRing deleted its saved sign-in, but Google did not confirm that the access was taken back.",
        accounts: [],
      }));
      renderView();
      await user.click(await screen.findByRole("button", { name: "Disconnect elena@example.com" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));

      const notice = await screen.findByTestId("connect-google-notice");
      expect(notice).toHaveTextContent("Google did not confirm");
      expect(notice).not.toHaveTextContent("Google confirmed");
      expect(screen.queryByTestId("connect-google-accounts")).not.toBeInTheDocument();
    });

    it("keeps the dialog and the account when the vault is locked", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [elena] };
      disconnectAccount.mockImplementation(async () => ({ status: "vaultLocked", message: "Your keys are locked. Unlock them, then try again." }));
      renderView();
      await user.click(await screen.findByRole("button", { name: "Disconnect elena@example.com" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));

      expect(await within(screen.getByRole("dialog")).findByText(/Your keys are locked/)).toBeInTheDocument();
      expect(screen.getByTestId("connect-google-account-elena@example.com")).toBeInTheDocument();
      expect(screen.getByTestId("ai-providers-vault-locked")).toBeInTheDocument();
    });

    it("never puts a token, a secret or a sign-in code on the page", async () => {
      const user = userEvent.setup();
      setupData = { ...ready, accounts: [elena] };
      renderView();
      await user.click(await screen.findByRole("button", { name: "Change services for elena@example.com" }));
      expect(document.body.innerHTML).not.toMatch(/refresh|access_token|GOCSPX|client_secret/i);
      for (const input of Array.from(document.querySelectorAll("input"))) expect(input.value).not.toContain(SECRET);
    });
  });

  it("shows which accounts are already connected", async () => {
    setupData = { ...ready, accounts: [{ name: "elena@example.com", email: "elena@example.com", gmail: true, calendar: true, drive: false, connected: true }] };
    renderView();
    expect(await screen.findByTestId("connect-google-accounts")).toHaveTextContent("elena@example.com");
  });
});
