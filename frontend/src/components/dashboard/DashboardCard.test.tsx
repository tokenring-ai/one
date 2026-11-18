import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardCard from "./DashboardCard.tsx";

/** The text of every element `aria-describedby` points at, as a screen reader would join it. */
function description(element: HTMLElement): string {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent ?? "")
    .join(" ");
}

function renderCard(badge?: string) {
  return render(
    <MemoryRouter>
      <DashboardCard
        dashboard={{
          id: "email",
          path: "/email",
          label: "Email",
          description: "Read and send mail",
          icon: <svg />,
          gradient: "from-sky-500 to-sky-600",
          ...(badge ? { badge } : {}),
        }}
      />
    </MemoryRouter>,
  );
}

describe("DashboardCard", () => {
  it("is a plain button named by its label and described by its description and badge", () => {
    renderCard("3");
    const button = screen.getByRole("button", { name: "Email" });
    expect(button).toHaveAttribute("type", "button");
    expect(description(button)).toBe("Read and send mail 3");
  });

  it("describes a card without a badge by its description alone", () => {
    renderCard();
    expect(description(screen.getByRole("button", { name: "Email" }))).toBe("Read and send mail");
  });
});
