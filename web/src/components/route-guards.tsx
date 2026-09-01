import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../lib/auth";
import { StatePanel } from "./ui";

export function ProtectedRoute() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <StatePanel loading title="Opening your workspace" />
      </main>
    );
  }

  if (!session.data?.user) {
    return (
      <Navigate
        replace
        to="/sign-in"
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const session = useSession();

  if (session.isPending) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <StatePanel loading title="Checking your session" />
      </main>
    );
  }

  return session.data?.user ? <Navigate replace to="/app" /> : <Outlet />;
}
