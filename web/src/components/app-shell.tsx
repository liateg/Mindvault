import {
  Bell,
  Brain,
  BrainCircuit,
  ChevronDown,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { clsx } from "clsx";
import { BrandLink } from "./brand";
import { FloatingAssistant } from "./floating-assistant";
import { Button } from "./ui";
import { signOut, useSession } from "../lib/auth";
import { useProjects, useUnreadCount } from "../lib/resources";

const generalNavigation = [
  { label: "Projects", to: "/app", icon: LayoutDashboard, end: true },
  { label: "Inbox", to: "/app/inbox", icon: Inbox },
];

const projectNavigation = [
  { label: "Overview", path: "", icon: FolderKanban },
  { label: "Decisions", path: "/decisions", icon: BrainCircuit },
  { label: "Team", path: "/team", icon: Users },
  { label: "Assistant", path: "/assistant", icon: Brain },
  { label: "Settings", path: "/settings", icon: Settings },
];

function Brand() {
  return <BrandLink className="px-1" to="/app" />;
}

function SidebarItem({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof Inbox;
  end?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      end={end}
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition",
          isActive
            ? "ember-edge bg-orange-950/25 text-ink"
            : "text-muted hover:bg-white/[0.04] hover:text-ink",
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  );
}

function ProjectSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { projectId } = useParams();
  const projects = useProjects();
  const [open, setOpen] = useState(false);
  const current = projects.data?.find((project) => project.id === projectId);

  return (
    <div className="relative mt-7">
      <Button
        className="w-full justify-between"
        variant="secondary"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{current?.title ?? "Select a project"}</span>
        <ChevronDown className="size-4 text-muted" />
      </Button>
      {open ? (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-line bg-panel p-1 shadow-glow">
          {(projects.data ?? []).length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">No projects yet</p>
          ) : (
            projects.data?.map((project) => (
              <Link
                className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                key={project.id}
                to={`/app/projects/${project.id}`}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              >
                {project.title}
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { projectId } = useParams();
  return (
    <aside className="flex h-full flex-col border-r border-line bg-[rgb(8_8_8/0.88)] p-4 backdrop-blur-xl">
      <Brand />
      <ProjectSwitcher onNavigate={onNavigate} />
      <p className="mb-2 mt-7 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-subtle">
        Workspace
      </p>
      <nav className="space-y-1">
        {generalNavigation.map((item) => (
          <SidebarItem {...item} key={item.to} onNavigate={onNavigate} />
        ))}
      </nav>
      {projectId && (
        <>
          <p className="mb-2 mt-7 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-subtle">
            Project
          </p>
          <nav className="space-y-1">
            {projectNavigation.map((item) => (
              <SidebarItem
                key={item.path}
                label={item.label}
                icon={item.icon}
                to={`/app/projects/${projectId}${item.path}`}
                end={!item.path}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        </>
      )}
      <div className="mt-auto rounded-xl border border-line bg-white/[0.03] p-3 text-xs text-muted">
        <span className="mb-2 inline-flex items-center gap-1.5 text-orange-300">
          <Brain className="size-3.5" /> AI ready
        </span>
        <p>Approved project decisions provide assistant context.</p>
      </div>
    </aside>
  );
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const session = useSession();
  const unread = useUnreadCount();
  const navigate = useNavigate();
  const unreadCount = unread.data?.count ?? 0;

  useEffect(() => {
    function close(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  async function onSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="app-shell grid min-h-screen lg:grid-cols-[16rem_1fr]">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar />
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-[min(18rem,85vw)]">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
            <Button
              aria-label="Close navigation"
              className="absolute right-3 top-3"
              size="icon"
              variant="ghost"
              onClick={() => setDrawerOpen(false)}
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>
      )}
      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-[rgb(8_8_8/0.78)] px-4 backdrop-blur-xl sm:px-6">
          <Button
            aria-label="Open navigation"
            className="lg:hidden"
            size="icon"
            variant="ghost"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <label className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              aria-label="Search workspace"
              className="h-9 w-full rounded-lg border border-line bg-black/20 pl-9 pr-3 text-sm placeholder:text-subtle focus:border-ember focus:outline-none"
              placeholder="Search workspace..."
              type="search"
            />
          </label>
          <div className="ml-auto flex items-center gap-1">
            <Link className="relative" to="/app/inbox">
              <Button aria-label="Notifications" size="icon" variant="ghost">
                <Bell className="size-4" />
              </Button>
              {unreadCount > 0 ? (
                <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-ember px-1 text-[0.65rem] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <div className="relative ml-2 border-l border-line pl-3" ref={menuRef}>
              <button
                className="hidden text-left sm:block"
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <p className="max-w-40 truncate text-sm font-medium">{session.data?.user.name}</p>
                <p className="max-w-40 truncate text-xs text-muted">{session.data?.user.email}</p>
              </button>
              <Button
                aria-label="Account menu"
                className="sm:hidden"
                size="icon"
                variant="ghost"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <LogOut className="size-4" />
              </Button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-line bg-panel p-1">
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                    type="button"
                    onClick={() => void onSignOut()}
                  >
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="noise min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <FloatingAssistant />
    </div>
  );
}
