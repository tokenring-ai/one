import { afterEach, describe, expect, it } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import MarketplaceFacets from "./MarketplaceFacets.tsx";
import MarketplaceStorefront from "./MarketplaceStorefront.tsx";
import { getMarketplaceFilters, resetMarketplaceFilters, updateMarketplaceFilters } from "./marketplaceFilters.ts";
import { ALL_CATEGORIES, type MarketplaceEntry } from "./marketplaceItems.ts";

function entry(name: string, category: string, tags: string[]): MarketplaceEntry {
  return {
    kind: "agent",
    id: `agent/${category}/${name}`,
    installAs: name,
    displayName: name,
    description: `${name} description`,
    category,
    author: "tester",
    tags,
    version: "1.0.0",
    updatedAt: "2026-01-01",
    icon: "",
    requiresPlugins: [],
  };
}

afterEach(() => {
  resetMarketplaceFilters();
});

describe("MarketplaceFacets", () => {
  const tags = Array.from({ length: 14 }, (_, index) => ({ value: `tag-${index}`, count: 14 - index }));

  it("keeps an active tag outside the top list visible and clearable", () => {
    const changes: Array<string | null> = [];
    render(
      <MarketplaceFacets
        total={5}
        categories={[{ value: "coding", count: 5 }]}
        tags={tags}
        category={ALL_CATEGORIES}
        tag="tag-13"
        onCategoryChange={() => {}}
        onTagChange={next => changes.push(next)}
        maxTags={12}
      />,
    );
    const active = screen.getByRole("button", { name: /tag-13/ });
    expect(active).toHaveAttribute("aria-current", "true");
    fireEvent.click(active);
    expect(changes).toEqual([null]);
    // The rest of the long tail stays hidden.
    expect(screen.queryByRole("button", { name: /tag-12/ })).toBeNull();
  });

  it("shows an active tag or category that no item carries any more", () => {
    render(<MarketplaceFacets total={0} categories={[]} tags={[]} category="retired" tag="gone" onCategoryChange={() => {}} onTagChange={() => {}} />);
    expect(screen.getByRole("button", { name: /retired/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /gone/ })).toHaveAttribute("aria-current", "true");
  });
});

describe("MarketplaceStorefront empty filter results", () => {
  it("offers Clear filters, which resets the filters but keeps the sort", () => {
    const filterKey = "storefront-test";
    updateMarketplaceFilters(filterKey, { tag: "stale-tag", category: "coding", query: "zzz", sort: "recent" });
    render(
      <MarketplaceStorefront
        filterKey={filterKey}
        kinds={["agent"]}
        items={[entry("reviewer", "coding", ["review"])]}
        registryName="Community"
        unavailableMessage={null}
        isLoading={false}
        error={null}
        refreshing={false}
        installedById={new Map()}
        installingId={null}
        onRefresh={() => {}}
        onView={() => {}}
        onInstall={() => {}}
      />,
    );
    expect(screen.getByText("Nothing matches your filters.")).toBeTruthy();
    const rail = screen.getByRole("navigation", { name: "Marketplace filters" });
    expect(within(rail).getByRole("button", { name: /stale-tag/ })).toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    const filters = getMarketplaceFilters(filterKey);
    expect(filters).toMatchObject({ tag: null, category: ALL_CATEGORIES, query: "", sort: "recent" });
    expect(screen.queryByText("Nothing matches your filters.")).toBeNull();
  });
});

describe("MarketplaceStorefront registry states and installs", () => {
  function renderStorefront(overrides: Partial<React.ComponentProps<typeof MarketplaceStorefront>> = {}) {
    const props: React.ComponentProps<typeof MarketplaceStorefront> = {
      filterKey: "storefront-states",
      kinds: ["agent"],
      items: [entry("reviewer", "coding", []), entry("planner", "coding", [])],
      registryName: "Community",
      unavailableMessage: null,
      isLoading: false,
      error: null,
      refreshing: false,
      installedById: new Map(),
      installingId: null,
      onRefresh: () => {},
      onView: () => {},
      onInstall: () => {},
      ...overrides,
    };
    return render(
      <MemoryRouter>
        <MarketplaceStorefront {...props} />
      </MemoryRouter>,
    );
  }

  it("offers Retry for an unreachable registry (plain message from older hosts)", () => {
    renderStorefront({ unavailableMessage: "Couldn't reach the registry." });
    expect(screen.getByText("Marketplace unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("explains a disabled registry with a Configuration link and no Retry", () => {
    renderStorefront({ unavailableMessage: { reason: "disabled", message: "The marketplace is turned off." } });
    expect(screen.getByText("Marketplace turned off")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open Configuration" })).toHaveAttribute("href", "/configuration");
  });

  it("disables every Install while one is in flight and links Installed to the item", () => {
    renderStorefront({
      items: [entry("reviewer", "coding", []), entry("planner", "coding", []), entry("fixer", "coding", [])],
      installingId: "agent/coding/reviewer",
      installedById: new Map([["agent/coding/fixer", { kind: "agent", name: "fixer" }]]),
    });
    expect(screen.getByRole("button", { name: "Install reviewer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Install planner" })).toBeDisabled();
    expect(screen.getByTestId("installed-badge")).toHaveAttribute("href", "/agents/fixer");
    expect(screen.getByTestId("marketplace-kind-descriptions").textContent).toContain("assistants");
  });
});
