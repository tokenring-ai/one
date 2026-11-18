import { beforeEach, describe, expect, it, mock } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

type Counts = Record<"chat" | "embedding" | "image" | "video" | "speech" | "transcription" | "reranking", number>;

type Provider = {
  name: string;
  provider: string;
  kind: "cloud" | "local" | "custom";
  description: string;
  keyUrl?: string;
  needsKey: boolean;
  keyEnv?: string;
  keySource: "environment" | "vault" | "settings" | "none";
  baseURL?: string;
  catalog?: string;
  editableModels: boolean;
  models: Counts;
  state: "connected" | "needsKey" | "offline";
  message: string;
};

type Template = {
  name: string;
  provider: string;
  kind: "cloud" | "local";
  description: string;
  keyUrl?: string;
  needsKey: boolean;
  keyEnv?: string;
  keyInVault: boolean;
  baseURL?: string;
  catalog?: string;
  catalogModels?: number;
};

const noModels: Counts = { chat: 0, embedding: 0, image: 0, video: 0, speech: 0, transcription: 0, reranking: 0 };

const openai: Provider = {
  name: "OpenAI",
  provider: "openai",
  kind: "cloud",
  description: "GPT models",
  needsKey: true,
  keyEnv: "OPENAI_API_KEY",
  keySource: "vault",
  catalog: "openai",
  editableModels: false,
  models: { ...noModels, chat: 12, image: 2 },
  state: "connected",
  message: "Connected",
};
const box: Provider = {
  name: "Box",
  provider: "generic",
  kind: "custom",
  description: "Custom OpenAI-compatible server",
  needsKey: false,
  keySource: "none",
  baseURL: "http://10.0.0.2:8000/v1",
  editableModels: true,
  models: { ...noModels, chat: 1 },
  state: "connected",
  message: "Connected",
};

const anthropicTemplate: Template = {
  name: "Anthropic",
  provider: "anthropic",
  kind: "cloud",
  description: "Claude models",
  keyUrl: "https://console.anthropic.com/settings/keys",
  needsKey: true,
  keyEnv: "ANTHROPIC_API_KEY",
  keyInVault: false,
  catalog: "anthropic",
  catalogModels: 9,
};
const groqTemplate: Template = {
  name: "Groq",
  provider: "groq",
  kind: "cloud",
  description: "Fast hosted open models",
  needsKey: true,
  keyEnv: "GROQ_API_KEY",
  keyInVault: true,
  catalog: "groq",
  catalogModels: 14,
};
const llamaTemplate: Template = {
  name: "Llama",
  provider: "openaiCompatible",
  kind: "local",
  description: "Ollama, llama.cpp or vLLM running on this machine",
  needsKey: false,
  keyInVault: false,
  baseURL: "http://127.0.0.1:11434/v1",
};

const discovered = [
  { id: "llama3:8b", kind: "chat", maxContextLength: 8192 },
  {
    id: "openai/gpt-oss-20b",
    kind: "chat",
    maxContextLength: 131072,
    catalogMatch: { catalog: "groq", model: "openai/gpt-oss-20b", costPerMillionInputTokens: 0.075, costPerMillionOutputTokens: 0.3, maxContextLength: 131072 },
  },
  { id: "nomic-embed", kind: "embedding" },
];

let providersData: { providers: Provider[]; templates: Template[]; canSaveKeys: boolean; catalogWarning?: string };
const providersMutate = mock(async () => providersData);
const connectProvider = mock(async (_input: unknown): Promise<Record<string, unknown>> => ({ status: "success", provider: openai }));
const disconnectProvider = mock(async (_input: unknown): Promise<Record<string, unknown>> => ({ status: "success", message: "Disconnected" }));
const getProviderModels = mock(async (_input: { name: string }): Promise<Record<string, unknown>> => ({ status: "invalid", message: "unset" }));
const updateProviderModels = mock(async (_input: unknown): Promise<Record<string, unknown>> => ({ status: "success", provider: box }));
const discoverModels = mock(async (_input: unknown): Promise<Record<string, unknown>> => ({ status: "success", models: discovered }));
const updateCatalog = mock(async (_input: unknown): Promise<Record<string, unknown>> => ({ status: "success", path: "/x", providers: [] }));
const unlock = mock(async (_input: { password?: string }) => ({ success: true, message: "Vault unlocked" }));
let vaultPasswordSource = "keychain";
let vaultExists = true;
const getStatus = mock(async (_input: object) => ({ unlocked: false, vaultExists, passwordSource: vaultPasswordSource, canChangePassword: true }));
const createVault = mock(async (_input: { password: string }) => ({ success: true, message: "Vault created and unlocked.", passwordStored: true }));

void mock.module("../../rpc.ts", () => ({
  // The Users view is part of the Configuration views these tests load; it is not exercised here.
  useMe: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  useUserList: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  usePendingAccessLinks: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  useRemoteAccessInfo: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  usersRPCClient: {},
  chatRPCClient: {},
  googleRPCClient: {},
  usePermissionGrants: () => ({ data: { status: "success", grants: [], maxGrantLevel: 8 }, isLoading: false, error: undefined, mutate: async () => undefined }),
  useProviderStatuses: () => ({ data: providersData, isLoading: false, isValidating: false, error: undefined, mutate: providersMutate }),
  aiRPCClient: { connectProvider, disconnectProvider, getProviderModels, updateProviderModels, discoverModels, updateCatalog },
  vaultRPCClient: { unlock, getStatus, createVault },
  useConfigSchema: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  useConfigValues: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  configRPCClient: {},
}));

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutView } = await import("../../test/layout.tsx");
const { CONFIGURATION_VIEWS } = await import("./views.tsx");
const view = CONFIGURATION_VIEWS.find(candidate => candidate.id === "configuration-ai-providers")!;

const renderView = () => renderLayoutView(view);
const card = (name: string) => within(screen.getByRole("listitem", { name }));
const row = (name: string) => within(screen.getByRole("row", { name }));

/** The rest of the providers are folded away until asked for. */
async function openMoreProviders(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^More providers/ }));
}

async function findModels(user: ReturnType<typeof userEvent.setup>) {
  const form = within(screen.getByRole("form", { name: "Add a custom server" }));
  await user.type(form.getByLabelText("Name"), "Box2");
  await user.type(form.getByLabelText("Where it runs (server address)"), "http://10.0.0.3:8000/v1");
  await user.type(form.getByLabelText("API key (optional)"), "secret");
  await user.click(form.getByRole("button", { name: "Find models" }));
  expect(discoverModels).toHaveBeenCalledWith({ baseURL: "http://10.0.0.3:8000/v1", endpointType: "openai", apiKey: "secret" });
  await screen.findByRole("table", { name: "Box2 models" });
  return form;
}

describe("AI providers view", () => {
  beforeEach(() => {
    providersData = { providers: [openai, box], templates: [groqTemplate, anthropicTemplate, llamaTemplate], canSaveKeys: true };
    providersMutate.mockClear();
    connectProvider.mockClear();
    connectProvider.mockImplementation(async () => ({
      status: "success",
      provider: { ...openai, name: "Anthropic", catalog: "anthropic", models: { ...noModels, chat: 3 } },
    }));
    disconnectProvider.mockClear();
    disconnectProvider.mockImplementation(async () => ({ status: "success", message: "Disconnected OpenAI." }));
    getProviderModels.mockClear();
    getProviderModels.mockImplementation(async ({ name }) =>
      name === "OpenAI"
        ? {
            status: "success",
            editable: false,
            addServerModels: false,
            models: {
              chat: { "gpt-5": { costPerMillionInputTokens: 1.25, costPerMillionOutputTokens: 10, maxContextLength: 400000 } },
              image: { "gpt-image-1": { costPerImage: 0.04 } },
            },
          }
        : {
            status: "success",
            editable: true,
            addServerModels: false,
            models: { chat: { llama3: { providerModelId: "llama3:8b", costPerMillionInputTokens: 0, maxContextLength: 8192 } }, embedding: {} },
          },
    );
    updateProviderModels.mockClear();
    updateProviderModels.mockImplementation(async () => ({ status: "success", provider: box }));
    discoverModels.mockClear();
    discoverModels.mockImplementation(async () => ({ status: "success", models: discovered }));
    updateCatalog.mockClear();
    updateCatalog.mockImplementation(async () => ({ status: "success", path: "/x", providers: [] }));
    unlock.mockClear();
    getStatus.mockClear();
    vaultPasswordSource = "keychain";
    vaultExists = true;
    createVault.mockClear();
    createVault.mockImplementation(async () => ({ success: true, message: "Vault created and unlocked.", passwordStored: true }));
    unlock.mockImplementation(async () => ({ success: true, message: "Vault unlocked" }));
  });

  it("lists connected providers apart from the templates that can be connected", async () => {
    const user = userEvent.setup();
    renderView();
    const connected = within(screen.getByRole("list", { name: "Connected providers" }));
    expect(connected.getAllByRole("listitem").map(item => item.getAttribute("aria-label"))).toEqual(["OpenAI", "Box"]);
    expect(card("OpenAI").getByText("12 chat models · 2 image models")).toBeInTheDocument();
    expect(card("OpenAI").getByText(/Key saved in the vault/)).toBeInTheDocument();
    // Only catalog providers show their list; only custom ones can edit it.
    expect(card("OpenAI").getByRole("button", { name: "OpenAI models" })).toBeInTheDocument();
    expect(card("OpenAI").queryByRole("button", { name: "Edit OpenAI models" })).not.toBeInTheDocument();
    expect(card("Box").getByRole("button", { name: "Edit Box models" })).toBeInTheDocument();

    // Recommended providers come first; the rest are folded under "More providers".
    const recommended = within(screen.getByRole("list", { name: "Recommended providers" }));
    expect(recommended.getAllByRole("listitem").map(item => item.getAttribute("aria-label"))).toEqual(["Anthropic"]);
    expect(card("Anthropic").getByText(/Makes Claude/)).toBeInTheDocument();
    expect(card("Anthropic").getByText(/long password that lets TokenRing use your account/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Available providers" })).not.toBeInTheDocument();
    const more = screen.getByRole("button", { name: "More providers (2)" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    const available = within(screen.getByRole("list", { name: "Available providers" }));
    expect(available.getAllByRole("listitem").map(item => item.getAttribute("aria-label"))).toEqual(["Groq", "Llama"]);
    expect(card("Anthropic").getByText("Copies 9 models from the catalog")).toBeInTheDocument();
    expect(card("Anthropic").queryByText("Key already in your vault")).not.toBeInTheDocument();
    const keyLink = card("Anthropic").getByRole("link", { name: /Get a key/ });
    expect(keyLink).toHaveAttribute("href", "https://console.anthropic.com/settings/keys");
    expect(keyLink).toHaveAttribute("rel", "noopener noreferrer");
    const keyInput = card("Anthropic").getByLabelText("Anthropic API key");
    expect(keyInput).toHaveAttribute("type", "password");
    expect(keyInput).toHaveAttribute("autocomplete", "off");

    expect(card("Groq").getByText("Key already in your vault")).toBeInTheDocument();
    expect(card("Groq").getByLabelText("Groq API key")).toHaveAttribute("placeholder", "Leave blank to use the saved key");
    expect(card("Llama").getByLabelText("Llama server address")).toHaveValue("http://127.0.0.1:11434/v1");
    expect(card("Llama").getByText("Where it runs (server address)")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-providers-vault-locked")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-providers-none-connected")).not.toBeInTheDocument();
  });

  it("warns when nothing is connected", () => {
    providersData = { providers: [], templates: [anthropicTemplate], canSaveKeys: true };
    renderView();
    expect(screen.getByTestId("ai-providers-none-connected")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Connected providers" })).not.toBeInTheDocument();
  });

  it("connects a template with the typed key and clears the input", async () => {
    const user = userEvent.setup();
    renderView();
    const input = card("Anthropic").getByLabelText("Anthropic API key");
    const connect = card("Anthropic").getByRole("button", { name: "Connect Anthropic" });
    expect(connect).toBeDisabled();

    await user.type(input, "sk-ant-123");
    await user.click(connect);

    expect(connectProvider).toHaveBeenCalledWith({ template: "Anthropic", apiKey: "sk-ant-123" });
    await waitFor(() => expect(input).toHaveValue(""));
    expect(providersMutate).toHaveBeenCalled();
  });

  it("connects a template whose key is already in the vault without asking for one", async () => {
    const user = userEvent.setup();
    renderView();
    await openMoreProviders(user);
    const connect = card("Groq").getByRole("button", { name: "Connect Groq" });
    expect(connect).toBeEnabled();
    await user.click(connect);
    expect(connectProvider).toHaveBeenCalledWith({ template: "Groq" });
  });

  it("connects a local template at the typed address and waits for it to come up", async () => {
    const user = userEvent.setup();
    const llama: Provider = { ...box, name: "Llama", kind: "local", editableModels: false, models: noModels, state: "offline", message: "Nothing answered" };
    connectProvider.mockImplementation(async () => {
      providersData = { ...providersData, providers: [...providersData.providers, llama], templates: [groqTemplate, anthropicTemplate] };
      return { status: "success", provider: llama };
    });
    renderView();
    await openMoreProviders(user);
    const address = card("Llama").getByLabelText("Llama server address");
    await user.clear(address);
    await user.type(address, "http://localhost:8080/v1");
    await user.click(card("Llama").getByRole("button", { name: "Connect Llama" }));
    expect(connectProvider).toHaveBeenCalledWith({ template: "Llama", baseURL: "http://localhost:8080/v1" });
    expect(await card("Llama").findByText("Connecting…")).toBeInTheDocument();
  });

  it("shows the server's failure on the card and keeps the key for a retry", async () => {
    const user = userEvent.setup();
    connectProvider.mockImplementation(async () => ({ status: "invalid", message: "That key was rejected." }));
    renderView();
    const input = card("Anthropic").getByLabelText("Anthropic API key");
    await user.type(input, "bad");
    await user.click(card("Anthropic").getByRole("button", { name: "Connect Anthropic" }));
    expect(await card("Anthropic").findByText("That key was rejected.")).toBeInTheDocument();
    expect(input).toHaveValue("bad");
  });

  it("asks to unlock the vault when a save comes back vaultLocked, and unlocking calls the vault", async () => {
    const user = userEvent.setup();
    connectProvider.mockImplementation(async () => ({ status: "vaultLocked", message: "The vault is locked. Unlock it to save the key." }));
    renderView();
    await user.type(card("Anthropic").getByLabelText("Anthropic API key"), "sk-ant-123");
    await user.click(card("Anthropic").getByRole("button", { name: "Connect Anthropic" }));

    const callout = within(await screen.findByTestId("ai-providers-vault-locked"));
    expect(callout.getByText("Unlock your keys to continue")).toBeInTheDocument();
    expect(callout.getByText(/Your keys are kept in an encrypted file on this computer/)).toBeInTheDocument();
    expect(callout.getByRole("link", { name: "Open the Vault" })).toHaveAttribute("href", "/vault");
    expect(card("Anthropic").getByText(/The vault is locked/)).toBeInTheDocument();

    // The common case needs no typing: the saved password is tried first.
    expect(callout.queryByLabelText("Vault password")).not.toBeInTheDocument();
    await user.click(callout.getByRole("button", { name: "Use a password instead" }));
    await user.type(callout.getByLabelText("Vault password"), "hunter22");
    await user.click(callout.getByRole("button", { name: "Unlock with password" }));
    expect(unlock).toHaveBeenCalledWith({ password: "hunter22" });
    await waitFor(() => expect(screen.queryByTestId("ai-providers-vault-locked")).not.toBeInTheDocument());
  });

  it("unlocks with the saved password first and reports a failed unlock", async () => {
    const user = userEvent.setup();
    providersData = { ...providersData, canSaveKeys: false };
    unlock.mockImplementation(async () => ({ success: false, message: "Wrong password" }));
    renderView();
    const callout = within(screen.getByTestId("ai-providers-vault-locked"));
    await user.click(callout.getByRole("button", { name: "Unlock" }));
    expect(unlock).toHaveBeenCalledWith({});
    expect(await callout.findByText("Wrong password")).toBeInTheDocument();
  });

  it("explains a vault password that comes from the environment and opens the password box", async () => {
    vaultPasswordSource = "environment";
    providersData = { ...providersData, canSaveKeys: false };
    renderView();
    const callout = within(screen.getByTestId("ai-providers-vault-locked"));
    expect(await callout.findByText("Your keys are locked")).toBeInTheDocument();
    expect(callout.getByText(/TR_VAULT_PASSWORD/)).toBeInTheDocument();
    expect(callout.getByLabelText("Vault password")).toBeInTheDocument();
    expect(callout.getByText(/Type the vault password you chose/)).toBeInTheDocument();
  });

  describe("when no vault exists yet", () => {
    beforeEach(() => {
      vaultExists = false;
      providersData = { ...providersData, canSaveKeys: false };
    });

    it("shows Set up your vault instead of Unlock, with the rules and a Create vault button", async () => {
      renderView();
      const callout = within(await screen.findByTestId("ai-providers-vault-setup"));
      expect(callout.getByText("Set up your vault")).toBeInTheDocument();
      expect(callout.getByText(/encrypted file on this computer/)).toBeInTheDocument();
      expect(callout.getByText(/At least 10 characters/)).toBeInTheDocument();
      expect(callout.getByText(/cannot recover this password/)).toBeInTheDocument();
      expect(callout.getByLabelText("New vault password")).toBeInTheDocument();
      expect(callout.getByLabelText("Confirm vault password")).toBeInTheDocument();
      expect(callout.getByRole("button", { name: "Create vault" })).toBeInTheDocument();
      expect(callout.queryByRole("button", { name: "Unlock" })).not.toBeInTheDocument();
      expect(screen.queryByTestId("ai-providers-vault-locked")).not.toBeInTheDocument();
    });

    it("refuses mismatched and too-short passwords without calling the server", async () => {
      const user = userEvent.setup();
      renderView();
      const callout = within(await screen.findByTestId("ai-providers-vault-setup"));
      await user.type(callout.getByLabelText("New vault password"), "short");
      await user.type(callout.getByLabelText("Confirm vault password"), "short");
      await user.click(callout.getByRole("button", { name: "Create vault" }));
      expect(await callout.findByText(/Use at least 10 characters/)).toBeInTheDocument();

      await user.clear(callout.getByLabelText("New vault password"));
      await user.clear(callout.getByLabelText("Confirm vault password"));
      await user.type(callout.getByLabelText("New vault password"), "a long enough one");
      await user.type(callout.getByLabelText("Confirm vault password"), "a long enough two");
      await user.click(callout.getByRole("button", { name: "Create vault" }));
      expect(await callout.findByText(/do not match/)).toBeInTheDocument();
      expect(createVault).not.toHaveBeenCalled();
    });

    it("creates the vault, clears both fields, and never puts the password anywhere visible", async () => {
      const user = userEvent.setup();
      let release: (() => void) | undefined;
      createVault.mockImplementation(
        () =>
          new Promise(resolve => {
            release = () => resolve({ success: true, message: "Vault created and unlocked.", passwordStored: true });
          }),
      );
      renderView();
      const callout = within(await screen.findByTestId("ai-providers-vault-setup"));
      await user.type(callout.getByLabelText("New vault password"), "a long enough password");
      await user.type(callout.getByLabelText("Confirm vault password"), "a long enough password");
      await user.click(callout.getByRole("button", { name: "Create vault" }));
      expect(createVault).toHaveBeenCalledWith({ password: "a long enough password" });
      // While the request is out, the typed password is already gone from the page.
      expect(callout.getByLabelText("New vault password")).toHaveValue("");
      expect(callout.getByLabelText("Confirm vault password")).toHaveValue("");
      release?.();
      await waitFor(() => expect(providersMutate).toHaveBeenCalled());
      expect(document.body.textContent).not.toContain("a long enough password");
    });

    it("says honestly when the password could not be saved on this computer", async () => {
      const user = userEvent.setup();
      createVault.mockImplementation(async () => ({
        success: true,
        message: "Vault created and unlocked. The password could not be saved on this computer, so you will need to enter it every time TokenRing starts.",
        passwordStored: false,
      }));
      renderView();
      const callout = within(await screen.findByTestId("ai-providers-vault-setup"));
      await user.type(callout.getByLabelText("New vault password"), "a long enough password");
      await user.type(callout.getByLabelText("Confirm vault password"), "a long enough password");
      await user.click(callout.getByRole("button", { name: "Create vault" }));
      expect(await callout.findByText(/every time TokenRing starts/)).toBeInTheDocument();
    });

    it("shows the server's refusal and keeps the form", async () => {
      const user = userEvent.setup();
      createVault.mockImplementation(async () => ({ success: false, message: "A vault already exists on this computer", passwordStored: false }));
      renderView();
      const callout = within(await screen.findByTestId("ai-providers-vault-setup"));
      await user.type(callout.getByLabelText("New vault password"), "a long enough password");
      await user.type(callout.getByLabelText("Confirm vault password"), "a long enough password");
      await user.click(callout.getByRole("button", { name: "Create vault" }));
      expect(await callout.findByText("A vault already exists on this computer")).toBeInTheDocument();
      expect(callout.getByRole("button", { name: "Create vault" })).toBeInTheDocument();
    });

    it("leads Connect with a key to the setup step instead of sending the key to a vault that cannot hold it", async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByTestId("ai-providers-vault-setup");
      await user.type(card("Anthropic").getByLabelText("Anthropic API key"), "sk-ant-123");
      await user.click(card("Anthropic").getByRole("button", { name: "Connect Anthropic" }));
      expect(connectProvider).not.toHaveBeenCalled();
      expect(await card("Anthropic").findByText(/Set up your vault first/)).toBeInTheDocument();
      // The key stays typed so nothing is lost once the vault exists.
      expect(card("Anthropic").getByLabelText("Anthropic API key")).toHaveValue("sk-ant-123");
    });

    it("still connects a provider that needs no key", async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByTestId("ai-providers-vault-setup");
      await openMoreProviders(user);
      await user.click(card("Llama").getByRole("button", { name: "Connect Llama" }));
      expect(connectProvider).toHaveBeenCalled();
    });
  });

  it("keeps the general wording when the vault status cannot be read", async () => {
    getStatus.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    providersData = { ...providersData, canSaveKeys: false };
    renderView();
    const callout = within(screen.getByTestId("ai-providers-vault-locked"));
    await waitFor(() => expect(getStatus).toHaveBeenCalled());
    expect(callout.getByText("Unlock your keys to continue")).toBeInTheDocument();
  });

  it("filters the folded-away providers and opens them while searching", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: "More providers (2)" }));
    await user.type(screen.getByLabelText("Find a provider"), "fast");
    expect(
      within(screen.getByRole("list", { name: "Available providers" }))
        .getAllByRole("listitem")
        .map(item => item.getAttribute("aria-label")),
    ).toEqual(["Groq"]);
    await user.clear(screen.getByLabelText("Find a provider"));
    await user.type(screen.getByLabelText("Find a provider"), "zzz");
    expect(screen.getByText('No provider matches "zzz".')).toBeInTheDocument();
  });

  it("shows a catalog provider's model list read-only", async () => {
    const user = userEvent.setup();
    renderView();
    const toggle = card("OpenAI").getByRole("button", { name: "OpenAI models" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(getProviderModels).toHaveBeenCalledWith({ name: "OpenAI" });

    const table = within(await screen.findByRole("table", { name: "OpenAI models" }));
    expect(card("OpenAI").getByText(/From the model catalog — updated with Update models/)).toBeInTheDocument();
    const gpt = within(table.getByRole("row", { name: /gpt-5/ }));
    expect(gpt.getByText("$1.25")).toBeInTheDocument();
    expect(gpt.getByText("$10")).toBeInTheDocument();
    expect(gpt.getByText("400,000")).toBeInTheDocument();
    expect(table.getByText("gpt-image-1")).toBeInTheDocument();
    expect(table.queryAllByRole("textbox")).toHaveLength(0);
    expect(table.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(updateProviderModels).not.toHaveBeenCalled();
  });

  it("asks before disconnecting, and can also delete the key from the vault", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(card("OpenAI").getByRole("button", { name: "Disconnect OpenAI" }));
    let dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/Its key stays in the vault/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(disconnectProvider).not.toHaveBeenCalled();

    await user.click(card("OpenAI").getByRole("button", { name: "Disconnect OpenAI" }));
    dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByLabelText("Also delete the key from the vault"));
    await user.click(dialog.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(disconnectProvider).toHaveBeenCalledWith({ name: "OpenAI", forgetKey: true }));
    expect(providersMutate).toHaveBeenCalled();
  });

  it("disconnects keeping the key unless asked, and shows a refusal on the row", async () => {
    const user = userEvent.setup();
    disconnectProvider.mockImplementation(async () => ({ status: "invalid", message: "OpenAI is configured in a settings file this screen can't change." }));
    renderView();
    await user.click(card("OpenAI").getByRole("button", { name: "Disconnect OpenAI" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(disconnectProvider).toHaveBeenCalledWith({ name: "OpenAI", forgetKey: false }));
    expect(await card("OpenAI").findByText(/settings file this screen can't change/)).toBeInTheDocument();
  });

  it("updates the model catalog and summarises what changed", async () => {
    const user = userEvent.setup();
    updateCatalog.mockImplementation(async () => ({
      status: "success",
      path: "/home/me/.config/tokenring/models.yaml",
      providers: [{ name: "OpenAI", added: ["a", "b", "c", "d", "e"], changed: Array.from({ length: 12 }, (_, i) => `m${i}`), removed: ["x", "y", "z"] }],
    }));
    renderView();
    await user.click(screen.getByRole("button", { name: "Update models" }));
    expect(updateCatalog).toHaveBeenCalledWith({});
    expect(await screen.findByText("OpenAI: 5 added, 12 changed, 3 removed")).toBeInTheDocument();
    expect(providersMutate).toHaveBeenCalled();

    updateCatalog.mockImplementation(async () => ({ status: "success", path: "/x", providers: [] }));
    await user.click(screen.getByRole("button", { name: "Update models" }));
    expect(await screen.findByText("Already up to date")).toBeInTheDocument();

    updateCatalog.mockImplementation(async () => ({ status: "failed", message: "Couldn't download the catalog." }));
    await user.click(screen.getByRole("button", { name: "Update models" }));
    expect(await screen.findByText("Couldn't download the catalog.")).toBeInTheDocument();
  });

  it("adds a custom server from the models it lists, prefilled from the catalog", async () => {
    const user = userEvent.setup();
    renderView();
    const form = await findModels(user);

    // Prices and context come from the catalog match; the server's context length too.
    expect(row("openai/gpt-oss-20b").getByLabelText("openai/gpt-oss-20b input price")).toHaveValue(0.075);
    expect(row("openai/gpt-oss-20b").getByLabelText("openai/gpt-oss-20b output price")).toHaveValue(0.3);
    expect(row("openai/gpt-oss-20b").getByText("Prices from groq/openai/gpt-oss-20b")).toBeInTheDocument();
    expect(row("llama3:8b").getByLabelText("llama3:8b context length")).toHaveValue(8192);
    expect(row("nomic-embed").getByLabelText("nomic-embed kind")).toHaveValue("embedding");
    expect(row("nomic-embed").getByLabelText("nomic-embed output price")).toBeDisabled();

    const name = row("openai/gpt-oss-20b").getByLabelText("openai/gpt-oss-20b name");
    await user.clear(name);
    await user.type(name, "gpt-oss-20b");
    await user.click(row("llama3:8b").getByLabelText("Include llama3:8b"));
    await user.type(row("nomic-embed").getByLabelText("nomic-embed input price"), "0.01");
    await user.click(screen.getByRole("button", { name: "Add server" }));

    await waitFor(() =>
      expect(connectProvider).toHaveBeenCalledWith({
        custom: {
          name: "Box2",
          endpointType: "openai",
          baseURL: "http://10.0.0.3:8000/v1",
          apiKey: "secret",
          models: {
            chat: {
              "gpt-oss-20b": {
                providerModelId: "openai/gpt-oss-20b",
                costPerMillionInputTokens: 0.075,
                costPerMillionOutputTokens: 0.3,
                maxContextLength: 131072,
              },
            },
            embedding: { "nomic-embed": { costPerMillionInputTokens: 0.01 } },
          },
          addServerModels: false,
        },
      }),
    );
    // Cleared after success, key included.
    await waitFor(() => expect(form.getByLabelText("Name")).toHaveValue(""));
    expect(form.getByLabelText("API key (optional)")).toHaveValue("");
    expect(screen.queryByTestId("provider-model-editor")).not.toBeInTheDocument();
  });

  it("asks before saving models without prices next to priced ones", async () => {
    const user = userEvent.setup();
    renderView();
    await findModels(user);
    await user.click(row("nomic-embed").getByLabelText("Include nomic-embed"));
    await user.click(screen.getByRole("button", { name: "Add server" }));

    const dialog = within(await screen.findByRole("dialog"));
    // Save is off while the question is open, so a second click can't ask (and save) again.
    expect(screen.getByRole("button", { name: "Add server" })).toBeDisabled();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(dialog.getByText("1 model has no price; cost tracking will show $0 for it.")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(connectProvider).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Add server" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save anyway" }));
    await waitFor(() => expect(connectProvider).toHaveBeenCalledTimes(1));
  });

  it("saves an embedding model under the server's id, even one switched from chat", async () => {
    const user = userEvent.setup();
    discoverModels.mockImplementation(async () => ({
      status: "success",
      models: [
        { id: "org/embed-x", kind: "embedding" },
        { id: "org/embed-y", kind: "chat" },
      ],
    }));
    renderView();
    await findModels(user);
    expect(row("org/embed-x").getByLabelText("org/embed-x name")).toHaveValue("org/embed-x");
    expect(row("org/embed-x").getByLabelText("org/embed-x name")).toBeDisabled();
    expect(row("org/embed-x").getByLabelText("org/embed-x server model id")).toBeEnabled();

    const name = row("org/embed-y").getByLabelText("org/embed-y name");
    await user.clear(name);
    await user.type(name, "embed-y");
    await user.selectOptions(row("org/embed-y").getByLabelText("org/embed-y kind"), "embedding");
    expect(row("org/embed-y").getByLabelText("org/embed-y name")).toHaveValue("org/embed-y");
    await user.click(screen.getByRole("button", { name: "Add server" }));

    await waitFor(() => expect(connectProvider).toHaveBeenCalledTimes(1));
    const input = connectProvider.mock.calls[0]?.[0] as { custom: { models: unknown } };
    expect(input.custom.models).toEqual({ chat: {}, embedding: { "org/embed-x": {}, "org/embed-y": {} } });
  });

  it("locks the server's address while finding its models", async () => {
    const user = userEvent.setup();
    let answer: (value: Record<string, unknown>) => void = () => {};
    discoverModels.mockImplementation(() => new Promise(resolve => (answer = resolve)));
    renderView();
    const form = within(screen.getByRole("form", { name: "Add a custom server" }));
    await user.type(form.getByLabelText("Name"), "Box2");
    await user.type(form.getByLabelText("Where it runs (server address)"), "http://10.0.0.3:8000/v1");
    await user.click(form.getByRole("button", { name: "Find models" }));
    expect(form.getByLabelText("Where it runs (server address)")).toBeDisabled();
    expect(form.getByLabelText("API key (optional)")).toBeDisabled();
    expect(form.getByLabelText("Compatible with")).toBeDisabled();

    answer({ status: "success", models: discovered });
    await screen.findByRole("table", { name: "Box2 models" });
    expect(form.getByLabelText("Where it runs (server address)")).toBeEnabled();
  });

  it("shows a warning about an unusable model catalog", () => {
    providersData = { ...providersData, catalogWarning: "The downloaded model catalog is corrupt; using the built-in one." };
    renderView();
    expect(screen.getByTestId("ai-providers-catalog-warning")).toHaveTextContent("The downloaded model catalog is corrupt");
  });

  it("refuses invalid numbers and an empty list", async () => {
    const user = userEvent.setup();
    renderView();
    await findModels(user);
    await user.type(row("llama3:8b").getByLabelText("llama3:8b input price"), "-1");
    await user.click(screen.getByRole("button", { name: "Add server" }));
    expect(await screen.findByText(/llama3:8b: input price must be a number of 0 or more/)).toBeInTheDocument();

    await user.click(screen.getByLabelText("Include every model"));
    await user.click(screen.getByRole("button", { name: "Add server" }));
    expect(await screen.findByText(/Check at least one model/)).toBeInTheDocument();
    expect(connectProvider).not.toHaveBeenCalled();
  });

  it("adds a custom server that uses every model it lists, without a list", async () => {
    const user = userEvent.setup();
    renderView();
    const form = within(screen.getByRole("form", { name: "Add a custom server" }));
    await user.type(form.getByLabelText("Name"), "Box2");
    await user.selectOptions(form.getByLabelText("Compatible with"), "anthropic");
    await user.type(form.getByLabelText("Where it runs (server address)"), "http://10.0.0.3:8000");
    await user.click(form.getByLabelText("Use every model the server lists"));
    await user.click(form.getByRole("button", { name: "Add server" }));
    expect(discoverModels).not.toHaveBeenCalled();
    expect(connectProvider).toHaveBeenCalledWith({
      custom: { name: "Box2", endpointType: "anthropic", baseURL: "http://10.0.0.3:8000", addServerModels: true },
    });
  });

  it("shows a custom server failure under the form", async () => {
    const user = userEvent.setup();
    discoverModels.mockImplementation(async () => ({ status: "unreachable", message: "Couldn't list models at http://10.0.0.3:8000/v1" }));
    renderView();
    const form = within(screen.getByRole("form", { name: "Add a custom server" }));
    await user.type(form.getByLabelText("Name"), "Box2");
    await user.type(form.getByLabelText("Where it runs (server address)"), "http://10.0.0.3:8000/v1");
    await user.click(form.getByRole("button", { name: "Find models" }));
    expect(await screen.findByText("Couldn't list models at http://10.0.0.3:8000/v1")).toBeInTheDocument();
    expect(form.getByLabelText("Name")).toHaveValue("Box2");
  });

  it("edits an existing custom provider's models", async () => {
    const user = userEvent.setup();
    discoverModels.mockImplementation(async () => ({
      status: "success",
      models: [
        { id: "llama3:8b", kind: "chat" },
        { id: "qwen3:4b", kind: "chat" },
      ],
    }));
    renderView();
    await user.click(card("Box").getByRole("button", { name: "Edit Box models" }));
    expect(getProviderModels).toHaveBeenCalledWith({ name: "Box" });
    await screen.findByRole("table", { name: "Box models" });
    expect(row("llama3:8b").getByLabelText("llama3:8b name")).toHaveValue("llama3");

    // Re-discovering adds what's new, unchecked.
    await user.click(card("Box").getByRole("button", { name: "Re-discover" }));
    expect(discoverModels).toHaveBeenCalledWith({ name: "Box" });
    expect(await row("qwen3:4b").findByLabelText("Include qwen3:4b")).not.toBeChecked();
    expect(card("Box").getByText(/Found 1 new model/)).toBeInTheDocument();

    const context = row("llama3:8b").getByLabelText("llama3:8b context length");
    await user.clear(context);
    await user.type(context, "16384");
    await user.click(card("Box").getByLabelText("Also use models the server lists that aren't in this list (unpriced)"));
    await user.click(card("Box").getByRole("button", { name: "Save models" }));

    await waitFor(() =>
      expect(updateProviderModels).toHaveBeenCalledWith({
        name: "Box",
        models: { chat: { llama3: { providerModelId: "llama3:8b", costPerMillionInputTokens: 0, maxContextLength: 16384 } }, embedding: {} },
        addServerModels: true,
      }),
    );
    expect(connectProvider).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("provider-model-editor")).not.toBeInTheDocument());
    expect(await card("Box").findByText(/Models saved/)).toBeInTheDocument();
  });
});

describe("provider grouping", () => {
  it("puts OpenAI, Anthropic and Google first, in that order, and leaves the rest in place", async () => {
    const { groupTemplates, templateMatches } = await import("./AIProvidersView.tsx");
    const named = (name: string): Template => ({ ...groqTemplate, name });
    const grouped = groupTemplates([named("Groq"), named("Google"), named("Anthropic"), named("Llama"), named("OpenAI")]);
    expect(grouped.recommended.map(template => template.name)).toEqual(["OpenAI", "Anthropic", "Google"]);
    expect(grouped.more.map(template => template.name)).toEqual(["Groq", "Llama"]);
    expect(templateMatches(groqTemplate, "FAST")).toBe(true);
    expect(templateMatches(groqTemplate, "claude")).toBe(false);
    expect(templateMatches(groqTemplate, "  ")).toBe(true);
  });
});
