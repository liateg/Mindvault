import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantChrome, PREVIEW_ASSISTANT_REPLY, PREVIEW_USER_PROMPT } from "./assistant-chrome";

afterEach(() => {
  cleanup();
});

const chromeProps = {
  prompt: "",
  onPromptChange: vi.fn(),
  onSubmit: vi.fn(),
  submitAriaLabel: "Get started",
};

describe("assistant chrome", () => {
  it("shows a compact mock conversation in preview mode", () => {
    const { container } = render(<AssistantChrome mode="preview" {...chromeProps} />);

    expect(screen.getByPlaceholderText("Ask about a decision, press '/' for prompt")).toBeInTheDocument();
    expect(screen.getByText(PREVIEW_USER_PROMPT)).toBeInTheDocument();
    expect(screen.getByText(PREVIEW_ASSISTANT_REPLY)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Context" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".assistant-pill").length).toBeGreaterThan(0);
    expect(container.querySelector(".assistant-badge")).not.toBeNull();
    expect(container.querySelector(".assistant-frame")).toHaveClass("has-thread");
    expect(container.querySelector(".assistant-bubble.is-user")).toHaveClass("is-end");
    expect(container.querySelector(".assistant-bubble.is-assistant")).toHaveClass("is-start");
  });

  it("hides the brain badge on live page and panel surfaces", () => {
    const { container, rerender } = render(
      <AssistantChrome mode="live" variant="page" {...chromeProps} submitAriaLabel="Ask assistant" />,
    );

    expect(container.querySelector(".assistant-badge")).toBeNull();
    expect(container.querySelector(".assistant-command")).not.toHaveClass("has-badge");

    rerender(
      <AssistantChrome mode="live" variant="panel" {...chromeProps} submitAriaLabel="Ask assistant" />,
    );

    expect(container.querySelector(".assistant-badge")).toBeNull();
    expect(container.querySelector(".assistant-command")).not.toHaveClass("has-badge");
  });

  it("aligns live user messages right and assistant answers left", () => {
    const { container } = render(
      <AssistantChrome
        mode="live"
        variant="page"
        {...chromeProps}
        submitAriaLabel="Ask assistant"
        submittedPrompt="What did we approve?"
        answer="The team approved"
        status="complete"
      />,
    );

    expect(container.querySelector(".assistant-bubble.is-user")).toHaveClass("is-end");
    expect(container.querySelector(".assistant-bubble.is-assistant")).toHaveClass("is-start");
  });

  it("keeps history scrollable without a visible scrollbar", () => {
    const { container } = render(<AssistantChrome mode="preview" {...chromeProps} />);
    const history = container.querySelector(".assistant-history");

    expect(history).not.toBeNull();
    expect(history).toHaveClass("hide-scrollbar");
  });

  it("shows a quiet empty state without fake history", () => {
    const { container } = render(
      <AssistantChrome mode="live" variant="page" {...chromeProps} submitAriaLabel="Ask assistant" />,
    );

    expect(screen.getByText(/ask about an approved decision to start/i)).toBeInTheDocument();
    expect(screen.queryByText(PREVIEW_USER_PROMPT)).not.toBeInTheDocument();
    expect(screen.queryByText(PREVIEW_ASSISTANT_REPLY)).not.toBeInTheDocument();
    expect(container.querySelectorAll(".assistant-pill")).toHaveLength(0);
    expect(container.querySelector(".assistant-frame")).toHaveClass("is-empty");
    expect(container.querySelector(".assistant-history")).toHaveClass("is-empty");
    expect(container.querySelector(".assistant-frame")).not.toHaveClass("has-thread");
  });

  it("pins a live thread into the scrolling history slot above the command bar", () => {
    const { container } = render(
      <AssistantChrome
        mode="live"
        variant="page"
        {...chromeProps}
        submitAriaLabel="Ask assistant"
        submittedPrompt="What did we approve?"
        answer="The team approved"
        status="complete"
      />,
    );

    const frame = container.querySelector(".assistant-frame");
    const history = container.querySelector(".assistant-history");
    const command = container.querySelector(".assistant-command");

    expect(frame).toHaveClass("has-thread");
    expect(frame).not.toHaveClass("is-empty");
    expect(history).not.toHaveClass("is-empty");
    expect(history).toHaveClass("hide-scrollbar");
    expect(command).not.toBeNull();
    expect(history?.compareDocumentPosition(command!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("grows the latest assistant bubble while streaming", () => {
    render(
      <AssistantChrome
        mode="live"
        variant="page"
        {...chromeProps}
        submitAriaLabel="Ask assistant"
        submittedPrompt="What did we approve?"
        answer="The team approved"
        status="streaming"
      />,
    );

    expect(screen.getByText("What did we approve?")).toBeInTheDocument();
    expect(screen.getByText("The team approved")).toBeInTheDocument();
    expect(screen.queryByText(/ask about an approved decision to start/i)).not.toBeInTheDocument();
  });

  it("renders assistant markdown instead of raw marks", () => {
    const { container } = render(
      <AssistantChrome
        mode="live"
        variant="page"
        {...chromeProps}
        submitAriaLabel="Ask assistant"
        submittedPrompt="What did we approve?"
        answer={
          "## Why Postgres\n\nWe chose **Postgres** because:\n\n- durable\n- queryable\n\n<script>alert(1)</script>"
        }
        status="complete"
      />,
    );

    expect(container.querySelector("h2")?.textContent).toBe("Why Postgres");
    expect(screen.getByText("Postgres").tagName).toBe("STRONG");
    expect(container.querySelectorAll(".assistant-md li")).toHaveLength(2);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).not.toContain("**Postgres**");
    expect(container.querySelector(".assistant-bubble.is-user")).toHaveClass("is-end");
    expect(container.querySelector(".assistant-bubble.is-assistant")).toHaveClass("is-start");
  });

  it("keeps user prompts as plain text", () => {
    render(
      <AssistantChrome
        mode="live"
        variant="page"
        {...chromeProps}
        submitAriaLabel="Ask assistant"
        submittedPrompt="Use **bold** in the user bubble"
        answer="Approved."
        status="complete"
      />,
    );

    expect(screen.getByText("Use **bold** in the user bubble")).toBeInTheDocument();
    expect(screen.getByText("Use **bold** in the user bubble").querySelector("strong")).toBeNull();
  });

  it("collapses older turns into pills and keeps the latest readable", () => {
    const { container } = render(
      <AssistantChrome
        mode="live"
        variant="page"
        {...chromeProps}
        submitAriaLabel="Ask assistant"
        history={[
          { prompt: "Why Redis?", answer: "Redis is a cache, not the system of record." },
        ]}
        submittedPrompt="What did we approve?"
        answer="The team approved a single Postgres source of truth."
        status="complete"
      />,
    );

    expect(screen.getByText("What did we approve?")).toBeInTheDocument();
    expect(screen.getByText("The team approved a single Postgres source of truth.")).toBeInTheDocument();
    expect(screen.queryByText("Why Redis?")).not.toBeInTheDocument();
    expect(screen.queryByText(/Redis is a cache/)).not.toBeInTheDocument();
    expect(container.querySelectorAll(".assistant-pill").length).toBeGreaterThan(0);
  });

  it("lets the context toggle stay visual without submitting", () => {
    const onSubmit = vi.fn();
    const onGroundedChange = vi.fn();
    render(
      <AssistantChrome
        mode="preview"
        prompt=""
        onPromptChange={vi.fn()}
        onSubmit={onSubmit}
        onGroundedChange={onGroundedChange}
        submitAriaLabel="Get started"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Context" }));
    expect(onGroundedChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
