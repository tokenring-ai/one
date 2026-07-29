import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setItems = mock(async (_args: { updates: { category: string; key: string; value: string }[] }) => ({
  success: true,
  message: "ok",
}));
const deleteItems = mock(async (_args: { updates: { category: string; key: string }[] }) => ({
  success: true,
  message: "ok",
}));
const getItem = mock(async (_args: { category: string; key: string }) => ({
  found: true,
  value: "super-secret",
}));
const mutateVault = mock(async () => undefined);

let vaultData: Record<string, string[]> = {
  env: ["API_KEY", "DATABASE_URL"],
  token: ["github"],
};

void mock.module("../../rpc.ts", () => ({
  useVaultKeys: () => ({
    data: vaultData,
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: mutateVault,
  }),
  vaultRPCClient: {
    setItems,
    deleteItems,
    getItem,
  },
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: {
    success: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    warning: mock(() => {}),
  },
}));

const { default: VaultApp } = await import("./VaultApp.tsx");

describe("VaultApp", () => {
  beforeEach(() => {
    setItems.mockClear();
    deleteItems.mockClear();
    getItem.mockClear();
    mutateVault.mockClear();
    vaultData = {
      env: ["API_KEY", "DATABASE_URL"],
      token: ["github"],
    };
  });

  it("lists secrets from the vault stream", () => {
    render(<VaultApp />);
    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(screen.getByText("API_KEY")).toBeInTheDocument();
    expect(screen.getByText("DATABASE_URL")).toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
    // Category label appears in both tab bar and section heading
    expect(screen.getAllByText("Environment Variables").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Stored Auth Tokens").length).toBeGreaterThanOrEqual(1);
  });

  it("filters keys by search", async () => {
    const user = userEvent.setup();
    render(<VaultApp />);
    await user.type(screen.getByLabelText("Search vault keys"), "api");
    expect(screen.getByText("API_KEY")).toBeInTheDocument();
    expect(screen.queryByText("DATABASE_URL")).not.toBeInTheDocument();
    expect(screen.queryByText("github")).not.toBeInTheDocument();
  });

  it("reveals a secret value via getItem", async () => {
    const user = userEvent.setup();
    render(<VaultApp />);

    const row = screen.getByText("API_KEY").closest("div.flex.flex-col") ?? screen.getByText("API_KEY").parentElement!.parentElement!;
    const showBtn = within(row as HTMLElement).getByTitle("Show value");
    await user.click(showBtn);

    await waitFor(() => {
      expect(getItem).toHaveBeenCalledWith({ category: "env", key: "API_KEY" });
    });
    await waitFor(() => {
      expect(screen.getByText("super-secret")).toBeInTheDocument();
    });
  });

  it("adds a new key via setItems", async () => {
    const user = userEvent.setup();
    render(<VaultApp />);

    const addButtons = screen.getAllByText("Add new key");
    await user.click(addButtons[0]!);

    await user.type(screen.getByPlaceholderText("Key name"), "NEW_KEY");
    await user.type(screen.getByPlaceholderText("Value"), "new-value");
    await user.click(screen.getByTitle("Save"));

    await waitFor(() => {
      expect(setItems).toHaveBeenCalledWith({
        updates: [{ category: "env", key: "NEW_KEY", value: "new-value" }],
      });
    });
    expect(mutateVault).toHaveBeenCalled();
  });

  it("deletes a key after confirmation", async () => {
    const user = userEvent.setup();
    render(<VaultApp />);

    const row = screen.getByText("API_KEY").closest("div.flex.flex-col") ?? screen.getByText("API_KEY").parentElement!.parentElement!;
    await user.click(within(row as HTMLElement).getByTitle("Delete key"));
    await user.click(within(row as HTMLElement).getByText("Yes"));

    await waitFor(() => {
      expect(deleteItems).toHaveBeenCalledWith({
        updates: [{ category: "env", key: "API_KEY" }],
      });
    });
    expect(mutateVault).toHaveBeenCalled();
  });

  it("opens bulk import and imports KEY=value pairs", async () => {
    const user = userEvent.setup();
    render(<VaultApp />);

    const importButtons = screen.getAllByText("Import");
    await user.click(importButtons[0]!);

    expect(screen.getByText("Bulk Import")).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(/API_KEY=abc123/);
    await user.clear(textarea);
    await user.type(textarea, "FOO=bar\nBAZ=qux");

    expect(screen.getByText("2 keys detected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Import 2 keys/i }));

    await waitFor(() => {
      expect(setItems).toHaveBeenCalledWith({
        updates: [
          { category: "env", key: "FOO", value: "bar" },
          { category: "env", key: "BAZ", value: "qux" },
        ],
      });
    });
  });

  it("shows dynamic categories from vault data", () => {
    vaultData = {
      env: ["X"],
      custom: ["my-secret"],
    };
    render(<VaultApp />);
    expect(screen.getAllByText("custom").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("my-secret")).toBeInTheDocument();
  });
});
