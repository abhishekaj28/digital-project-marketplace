import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Files,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  MessageSquare,
} from "lucide-react";
import { getAdminSession, adminLogout } from "@/lib/data";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/domains", label: "Domains", icon: FolderKanban },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<{ email: string; name: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const s = getAdminSession();
    if (!s) {
      navigate({ to: "/unauthorized" });
      return;
    }
    setSession(s);
  }, [navigate]);

  if (!session) return null;

  const SidebarContent = (
    <>
      <div className="px-6 py-6 border-b border-sidebar-border">
        <Link to="/" className="font-serif text-xl italic text-primary">
          ProjectHub
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
          Admin Console
        </div>
      </div>
      <nav className="px-3 py-4 flex-1 space-y-1">
        {NAV.map((n) => {
          const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to as any}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <div className="px-3 py-2 mb-2">
          <div className="text-sm font-medium truncate">{session.name}</div>
          <div className="text-xs text-muted-foreground truncate">{session.email}</div>
        </div>
        <button
          onClick={() => {
            adminLogout();
            navigate({ to: "/admin/login" });
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        {SidebarContent}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween" }}
              className="w-64 h-full flex flex-col bg-sidebar border-r border-sidebar-border"
              onClick={(e) => e.stopPropagation()}
            >
              {SidebarContent}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden grid size-9 place-items-center rounded-md ring-1 ring-border"
            >
              <Menu className="size-4" />
            </button>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Admin
              </div>
              <div className="font-serif text-lg leading-none">{title}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-semibold">
              {session.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
