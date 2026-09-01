import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/toasts";
import { api, ApiError } from "../lib/api";
import type { Decision, NotificationItem } from "../lib/types";
import { DecisionDetail } from "../pages/decisions";
import { InboxPage } from "../pages/inbox";
import { ProjectsPage } from "../pages/projects";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

function renderWithProviders(ui: ReactElement, path = "/app") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: "*", element: ui }], {
    initialEntries: [path],
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const decision: Decision = {
  id: "decision-1",
  projectId: "project-1",
  title: "Use Postgres",
  proposalContent: "Keep a single source of truth.",
  status: "proposed",
  proposerUserId: "user-1",
  reviewerUserId: null,
  reviewedAt: null,
  llmReasoningSummary: "Shared memory needs durable storage.",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("empty and error states", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it("shows a project empty state", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
  });

  it("shows a project load error", async () => {
    vi.mocked(api.get).mockRejectedValue(
      new ApiError(500, "Internal server error"),
    );
    renderWithProviders(<ProjectsPage />);
    expect(await screen.findByText("Unable to load projects")).toBeInTheDocument();
  });
});

describe("permission-gated decision actions", () => {
  it("hides review actions from read-only members", () => {
    render(
      <DecisionDetail
        canReview={false}
        canWrite={false}
        decision={decision}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onReview={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Review actions require triage or higher/),
    ).toBeInTheDocument();
  });

  it("shows review and write actions when permitted", () => {
    const onReview = vi.fn();
    render(
      <DecisionDetail
        canReview
        canWrite
        decision={decision}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onReview={onReview}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onReview).toHaveBeenCalledWith("approved");
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});

describe("invitation inbox", () => {
  it("requires accept or decline before membership for pending invites", async () => {
    const invitation: NotificationItem = {
      id: "notification-1",
      type: "project_invitation",
      invitationId: "invitation-1",
      projectId: "project-1",
      payload: {
        projectTitle: "Atlas",
        inviterName: "Ada",
        requestedRole: "write",
      },
      invitationStatus: "pending",
      invitationExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      readAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === "/api/notifications") return [invitation];
      if (path === "/api/notifications/unread-count") return { count: 1 };
      return [];
    });
    vi.mocked(api.post).mockResolvedValue({ id: "invitation-1", status: "accepted" });

    renderWithProviders(<InboxPage />, "/app/inbox");

    expect(await screen.findByText(/Ada invited you to Atlas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await screen.findByText("Invitation accepted");
    expect(api.post).toHaveBeenCalledWith("/api/invitations/invitation-1/accept");
  });
});
