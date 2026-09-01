import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app";
import { api } from "../lib/api";

const sessionState = vi.hoisted(() => ({
  value: {
    data: null as null | {
      user: { id: string; name: string; email: string };
    },
    isPending: false,
  },
}));

vi.mock("../lib/auth", () => ({
  useSession: () => sessionState.value,
  signOut: vi.fn(),
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
}));

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

describe("route guards", () => {
  beforeEach(() => {
    sessionState.value = { data: null, isPending: false };
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === "/api/projects") return [];
      if (path === "/api/notifications") return [];
      if (path === "/api/notifications/unread-count") return { count: 0 };
      throw new Error(`Unexpected path ${path}`);
    });
  });

  it("redirects anonymous users away from protected routes", async () => {
    render(<App initialEntries={["/app"]} />);

    expect(await screen.findByText("Sign in to Mindvault")).toBeInTheDocument();
  });

  it("renders the app shell for authenticated users", async () => {
    sessionState.value = {
      data: {
        user: { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" },
      },
      isPending: false,
    };

    render(<App initialEntries={["/app"]} />);

    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("redirects authenticated users away from auth routes", async () => {
    sessionState.value = {
      data: {
        user: { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" },
      },
      isPending: false,
    };

    render(<App initialEntries={["/sign-in"]} />);

    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
  });
});
