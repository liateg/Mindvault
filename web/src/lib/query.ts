import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 500;
        return status >= 500 && failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export const queryKeys = {
  session: ["session"] as const,
  projects: ["projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  decisions: (projectId: string) =>
    ["projects", projectId, "decisions"] as const,
  members: (projectId: string) => ["projects", projectId, "members"] as const,
  invitations: (projectId: string) =>
    ["projects", projectId, "invitations"] as const,
  notifications: ["notifications"] as const,
  notificationCount: ["notifications", "unread-count"] as const,
};
