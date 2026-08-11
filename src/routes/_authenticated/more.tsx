import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Calculator,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Lightbulb,
  LogOut,
  PieChart,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  WandSparkles,
} from "lucide-react";
import { signOutCompletely } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({
    meta: [
      { title: "Explore — Wealthpilot" },
      { name: "description", content: "Explore Wealthpilot tools, insights, planning, automation, and account settings." },
    ],
  }),
  component: MorePage,
});

type Item = {
  to: string;
  label: string;
  description: string;
  icon: typeof Sparkles;
  group: "Plan" | "Track" | "Automate" | "Account";
  featured?: boolean;
};

const items: Item[] = [
  { to: "/monthly-review", label: "Monthly review", description: "Close the month with a guided financial check-in.", icon: ClipboardCheck, group: "Plan", featured: true },
  { to: "/scenario-planner", label: "Scenario planner", description: "Test purchases, overtime, and unexpected costs.", icon: Sparkles, group: "Plan", featured: true },
  { to: "/cash-flow", label: "Cash flow forecast", description: "See the next 30 days before money moves.", icon: TrendingUp, group: "Plan", featured: true },
  { to: "/insights", label: "Smart insights", description: "Actionable signals from your live financial data.", icon: Lightbulb, group: "Plan" },
  { to: "/financial-health", label: "Financial health", description: "Understand what is helping or hurting your score.", icon: Activity, group: "Track" },
  { to: "/net-worth", label: "Net worth", description: "Track assets, debts, and long-term momentum.", icon: PieChart, group: "Track" },
  { to: "/subscriptions", label: "Subscriptions", description: "See recurring services and annualized cost.", icon: RefreshCw, group: "Track" },
  { to: "/bill-calendar", label: "Bill calendar", description: "Stay ahead of due dates and recurring payments.", icon: CalendarClock, group: "Track" },
  { to: "/payday", label: "Payday planner", description: "Give each paycheque a job before spending starts.", icon: CalendarDays, group: "Track" },
  { to: "/simulator", label: "Debt payoff", description: "Compare avalanche and snowball strategies.", icon: Calculator, group: "Track" },
  { to: "/debts", label: "Debts", description: "Manage balances, APRs, and minimum payments.", icon: CreditCard, group: "Track" },
  { to: "/goals", label: "Goals", description: "Track progress toward savings milestones.", icon: Target, group: "Track" },
  { to: "/notifications", label: "Notification center", description: "Review proactive alerts and upcoming actions.", icon: Bell, group: "Automate" },
  { to: "/automations", label: "Automations", description: "Control reminders and recurring workflows.", icon: WandSparkles, group: "Automate" },
  { to: "/uploads", label: "Statement uploads", description: "Bring statements into your financial workspace.", icon: Upload, group: "Automate" },
  { to: "/settings", label: "Settings", description: "Manage preferences, profile, and app behaviour.", icon: Settings, group: "Account" },
];

function MorePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<"All" | Item["group"]>("All");

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesGroup = activeGroup === "All" || item.group === activeGroup;
      const matchesSearch = !search || `${item.label} ${item.description}`.toLowerCase().includes(search);
      return matchesGroup && matchesSearch;
    });
  }, [activeGroup, query]);

  const featured = items.filter((item) => item.featured);
  const groups: Array<"All" | Item["group"]> = ["All", "Plan", "Track", "Automate", "Account"];

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-violet-grad p-5 text-primary-foreground shadow-card">
        <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] opacity-70">Wealthpilot workspace</p>
              <h1 className="mt-1 font-display text-3xl">Explore</h1>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 opacity-80">Everything you need to plan, track, automate, and improve your financial life.</p>
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/15 bg-black/10 px-4 py-3 backdrop-blur-xl">
            <Search className="h-4 w-4 opacity-70" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools and features"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/55"
            />
          </div>
        </div>
      </section>

      {!query && activeGroup === "All" && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Recommended</p>
              <h2 className="mt-1 font-display text-xl">Your power tools</h2>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent">Interactive</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {featured.map(({ to, label, description, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent transition duration-300 group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-accent" />
                </div>
                <h3 className="mt-4 font-medium">{label}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition active:scale-95 ${
                activeGroup === group ? "bg-foreground text-background shadow-md" : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {filtered.length ? filtered.map(({ to, label, description, icon: Icon }, index) => (
            <Link
              key={to}
              to={to}
              className={`group flex items-center gap-3 px-4 py-4 transition duration-200 hover:bg-secondary/45 active:bg-secondary/70 ${index ? "border-t border-border" : ""}`}
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-accent transition group-hover:scale-105 group-hover:bg-accent/15">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{label}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{description}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-accent" />
            </Link>
          )) : (
            <div className="px-6 py-12 text-center">
              <Search className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No tools found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try another search or category.</p>
            </div>
          )}
        </div>
      </section>

      <button
        onClick={async () => {
          await signOutCompletely();
          navigate({ to: "/auth" });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm font-medium text-destructive transition hover:bg-destructive/10 active:scale-[0.99]"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
