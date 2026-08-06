import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Calculator,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Home,
  ListOrdered,
  LogOut,
  Menu as MenuIcon,
  PieChart,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { QuickAddDialog } from "./quick-add-dialog";

const TABS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/activity", label: "Activity", icon: ListOrdered },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/assistant", label: "Copilot", icon: Sparkles },
  { to: "/more", label: "Explore", icon: MenuIcon },
] as const;

const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: TABS.slice(0, 4),
  },
  {
    label: "Plan",
    items: [
      { to: "/payday", label: "Payday Planner", icon: CalendarDays },
      { to: "/simulator", label: "Payoff Simulator", icon: Calculator },
      { to: "/debts", label: "Debt Control", icon: CreditCard },
      { to: "/goals", label: "Goals", icon: Target },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/automations", label: "Automations", icon: Bell },
      { to: "/uploads", label: "Statement Uploads", icon: Upload },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

const ALL_NAV = NAV_SECTIONS.flatMap((section) => section.items);

export function AppShell() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const active = (to: string) => path === to || (to !== "/dashboard" && path.startsWith(to));
  const currentPage = ALL_NAV.find((item) => active(item.to))?.label ?? "Wealthpilot";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <div className="app-ambient app-ambient-one" aria-hidden="true" />
      <div className="app-ambient app-ambient-two" aria-hidden="true" />

      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-[18rem] overflow-hidden border-r border-white/[0.07] px-4 py-5 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />

        <Link to="/dashboard" className="group relative flex items-center gap-3 rounded-2xl px-2 py-2">
          <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-violet-grad shadow-elevated ring-1 ring-white/15 transition duration-300 group-hover:scale-105">
            <span className="font-display text-xl font-semibold text-primary-foreground">W</span>
            <span className="absolute inset-x-2 bottom-1 h-px bg-white/45" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-xl leading-none">Wealthpilot</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_10px_var(--success)]" />
              Private finance OS
            </div>
          </div>
        </Link>

        <div className="relative mt-6 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <nav className="space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                  {section.label}
                </div>
                <div className="space-y-1">
                  {section.items.map(({ to, label, icon: Icon }) => {
                    const selected = active(to);
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={cn(
                          "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-sm transition duration-200 active:scale-[0.98]",
                          selected
                            ? "bg-white/[0.08] text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                            : "text-sidebar-foreground/62 hover:bg-white/[0.045] hover:text-sidebar-foreground",
                        )}
                      >
                        {selected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />}
                        <span
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-xl transition duration-200",
                            selected ? "bg-accent/12 text-accent" : "bg-white/[0.035] text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 transition duration-200",
                            selected ? "translate-x-0 text-accent" : "-translate-x-1 text-transparent group-hover:translate-x-0 group-hover:text-muted-foreground",
                          )}
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="relative mt-4 space-y-3">
          <button
            onClick={() => setOpen(true)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/14 to-accent/8 p-3 text-left transition duration-200 hover:border-primary/35 hover:from-primary/20 active:scale-[0.98]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-grad text-primary-foreground shadow-card transition group-hover:scale-105">
              <Plus className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Quick add</span>
              <span className="block text-[11px] text-muted-foreground">Transaction or balance update</span>
            </span>
            <CircleDollarSign className="h-4 w-4 text-accent" />
          </button>

          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1">Your workspace is private and secured.</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 rounded-xl text-muted-foreground hover:bg-destructive/8 hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <header className="mobile-app-header fixed inset-x-0 top-0 z-30 flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-violet-grad shadow-card ring-1 ring-white/15">
            <span className="font-display text-base font-semibold text-primary-foreground">W</span>
          </div>
          <div>
            <div className="font-display text-base leading-none">Wealthpilot</div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{currentPage}</div>
          </div>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-accent shadow-card backdrop-blur-xl transition active:scale-90"
          aria-label="Quick add"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <main className="relative pb-32 pt-20 lg:ml-[18rem] lg:pb-10 lg:pt-0">
        <div className="app-page mx-auto w-full max-w-5xl px-4 safe-top sm:px-6 lg:px-10 lg:pt-8">
          <div key={path} className="page-transition">
            <Outlet />
          </div>
        </div>
      </main>

      <button
        aria-label="Quick add transaction"
        onClick={() => setOpen(true)}
        className="quick-add-fab fixed bottom-[6.6rem] right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-violet-grad text-primary-foreground shadow-elevated ring-1 ring-white/15 transition duration-200 hover:scale-105 active:scale-90 lg:bottom-8 lg:right-8"
      >
        <Plus className="h-6 w-6" />
        <span className="absolute inset-0 -z-10 rounded-full bg-primary/35 blur-xl" />
      </button>

      <nav className="mobile-dock fixed inset-x-3 bottom-3 z-30 rounded-[26px] border border-white/[0.09] bg-card/82 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.45rem)] pt-2 shadow-elevated backdrop-blur-2xl lg:hidden">
        <ul className="mx-auto flex max-w-xl items-stretch justify-around">
          {TABS.map(({ to, label, icon: Icon }) => {
            const selected = active(to);
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className={cn(
                    "group relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-medium transition duration-200 active:scale-90",
                    selected ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {selected && <span className="absolute inset-x-2 inset-y-0 rounded-2xl bg-white/[0.055] ring-1 ring-white/[0.055]" />}
                  <span className={cn("relative grid h-7 w-7 place-items-center rounded-xl transition", selected && "text-accent")}>
                    <Icon className="h-[19px] w-[19px]" />
                    {selected && <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />}
                  </span>
                  <span className="relative">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <QuickAddDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
