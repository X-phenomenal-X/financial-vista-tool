import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, ListOrdered, PieChart, Sparkles, Menu as MenuIcon, Plus, CreditCard, CalendarDays, Target, Bell, Upload, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { QuickAddDialog } from "./quick-add-dialog";

const TABS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/activity", label: "Activity", icon: ListOrdered },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/assistant", label: "Assistant", icon: Sparkles },
  { to: "/more", label: "More", icon: MenuIcon },
] as const;

const SIDE = [
  ...TABS.slice(0, 4),
  { to: "/payday", label: "Payday Planner", icon: CalendarDays },
  { to: "/debts", label: "Debts", icon: CreditCard },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/automations", label: "Automations", icon: Bell },
  { to: "/uploads", label: "Statement Uploads", icon: Upload },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const active = (to: string) => path === to || (to !== "/dashboard" && path.startsWith(to));
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-sidebar px-4 py-6 lg:block">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-grad shadow-card">
            <span className="font-display text-lg font-semibold text-primary-foreground">M</span>
          </div>
          <div>
            <div className="font-display text-lg leading-none">Money Map</div>
            <div className="text-xs text-muted-foreground">private</div>
          </div>
        </div>
        <nav className="space-y-1">
          {SIDE.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active(to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}>
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-4 bottom-6">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="pb-28 lg:ml-64 lg:pb-8">
        <div className="mx-auto max-w-3xl px-4 pt-6 safe-top lg:px-8">
          <Outlet />
        </div>
      </main>

      {/* Floating quick add */}
      <button
        aria-label="Quick add transaction"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-violet-grad text-primary-foreground shadow-elevated transition active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-xl safe-bottom lg:hidden">
        <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2 pt-2">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link to={to} className={cn("flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] transition-colors", active(to) ? "text-foreground" : "text-muted-foreground")}>
                <Icon className={cn("h-5 w-5", active(to) && "text-accent")} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <QuickAddDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}