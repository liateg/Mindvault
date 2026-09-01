import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_ASSISTANT_REPLY, PREVIEW_USER_PROMPT } from "../components/assistant-chrome";
import { LandingPage } from "./landing";

const sessionState = vi.hoisted(() => ({
  value: {
    data: null as null | { user: { id: string; name: string; email: string } },
    isPending: false,
  },
}));

vi.mock("../lib/auth", () => ({
  useSession: () => sessionState.value,
}));

afterEach(() => {
  cleanup();
});

function renderLanding() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <LandingPage /> },
      { path: "/sign-in", element: <p>Sign in to Mindvault</p> },
      { path: "/sign-up", element: <p>Start your workspace</p> },
    ],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

describe("landing page", () => {
  it("keeps Mindvault branding and auth routes", () => {
    sessionState.value = { data: null, isPending: false };
    const { container } = renderLanding();

    expect(screen.getByRole("heading", { name: /shared decisions/i })).toBeInTheDocument();
    expect(screen.queryByText(/lumix/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByPlaceholderText("Ask about a decision, press '/' for prompt")).toBeInTheDocument();
    expect(screen.getByText(PREVIEW_ASSISTANT_REPLY)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Context" })).toBeInTheDocument();
    expect(container.querySelector(".assistant-badge")).not.toBeNull();
    expect(screen.getByText(PREVIEW_USER_PROMPT)).toHaveClass("is-end");
    expect(container.querySelector(".assistant-bubble.is-assistant")).toHaveClass("is-start");
  });

  it("keeps Home, Features, and Workflow hash links only", () => {
    sessionState.value = { data: null, isPending: false };
    renderLanding();

    expect(screen.getAllByRole("link", { name: "Home" })[0]).toHaveAttribute("href", "#home");
    expect(screen.getAllByRole("link", { name: "Features" })[0]).toHaveAttribute("href", "#features");
    expect(screen.getAllByRole("link", { name: "Workflow" })[0]).toHaveAttribute("href", "#workflow");
    expect(screen.queryByRole("link", { name: "Pricing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Testimonial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Docs" })).not.toBeInTheDocument();
  });

  it("renders how-it-works cards without central graphics", () => {
    sessionState.value = { data: null, isPending: false };
    const { container } = renderLanding();

    expect(screen.getByText("How it works")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /mindvault/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connect the team" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Capture decisions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ask with approved context" })).toBeInTheDocument();
    expect(container.querySelectorAll("#features img")).toHaveLength(0);
    expect(container.querySelector(".how-card.is-featured")).not.toBeNull();
  });

  it("sends the command bar toward sign-up when signed out", () => {
    sessionState.value = { data: null, isPending: false };
    renderLanding();

    fireEvent.submit(screen.getByLabelText("Ask Mindvault").closest("form")!);
    expect(screen.getByText("Start your workspace")).toBeInTheDocument();
  });
});
