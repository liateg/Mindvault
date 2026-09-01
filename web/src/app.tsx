import { QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createBrowserRouter,
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { ProtectedRoute, PublicOnlyRoute } from "./components/route-guards";
import { ToastProvider } from "./components/toasts";
import { queryClient } from "./lib/query";
import { AssistantPage } from "./pages/assistant";
import { AuthPage } from "./pages/auth";
import { DecisionsPage } from "./pages/decisions";
import { InboxPage } from "./pages/inbox";
import { LandingPage } from "./pages/landing";
import { NotFoundPage } from "./pages/not-found";
import { ProjectOverviewPage } from "./pages/overview";
import { ProjectsPage } from "./pages/projects";
import { SettingsPage } from "./pages/settings";
import { TeamPage } from "./pages/team";

export const routes: RouteObject[] = [
  { path: "/", element: <LandingPage /> },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/sign-in", element: <AuthPage mode="sign-in" /> },
      { path: "/sign-up", element: <AuthPage mode="sign-up" /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/app",
        element: <AppShell />,
        children: [
          { index: true, element: <ProjectsPage /> },
          { path: "inbox", element: <InboxPage /> },
          {
            path: "projects/:projectId",
            children: [
              { index: true, element: <ProjectOverviewPage /> },
              { path: "decisions", element: <DecisionsPage /> },
              { path: "team", element: <TeamPage /> },
              { path: "assistant", element: <AssistantPage /> },
              { path: "settings", element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];

export function App({
  initialEntries,
}: {
  initialEntries?: string[];
}) {
  const router = useMemo(
    () =>
      initialEntries
        ? createMemoryRouter(routes, { initialEntries })
        : createBrowserRouter(routes),
    [initialEntries],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
