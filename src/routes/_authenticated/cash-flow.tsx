import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cash-flow")({
  head: () => ({
    meta: [
      { title: "Cash Flow Forecast — Wealthpilot" },
      { name: "description", content: "A premium 30-day forecast using your live balances and recurring transactions." },
    ],
  }),
  component: CashFlowForecastPage,
});

type RecurringRow = {
  id: string;
  name: string;
  amount: number | string;
  kind: "income" | "expense" | "transfer" | "debt_payment" | "subscription" | "bill";
  next_due_date: string;
  is_active: boolean;
};

type AccountRow = {
  id: string;
  name: string;
  kind: string;
  balance: number | string;
};

type ForecastEvent = {
  id: string;
  name: string;
  date: string;
  amount: number;
  direction: "in" | "out";
  projectedBalance: number;
};

type Range = 7 | 14 | 30;
type DirectionFilter = "all" | "in" | "out";

const CASH_KINDS = new Set(["chequing", "savings", "money_master", "cash"]);
const BUFFER = 500;

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function CashFlowForecastPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>(30);
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [balancesHidden, setBalancesHidden] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [accountsResult, recurringResult] = await Promise.all([
        supabase.from("accounts").select("id,name,kind,balance").eq("user_id", user.id),
        supabase
          .from("recurring_transactions")
          .select("id,name,amount,kind,next_due_date,is_active")
          .eq("user_id", user.id)
          .eq("is_active", true),
      ]);

      if (!cancelled) {
        setAccounts((accountsResult.data ?? []) as AccountRow[]);
        setRecurring((recurringResult.data ?? []) as RecurringRow[]);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const data = useMemo(() => {
    const currentCash = accounts
      .filter((account) => CASH_KINDS.has(account.kind))
      .reduce((sum, account) => sum + Number(account.balance || 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + range);

    const sourceEvents = recurring
      .filter((item) => {
        const due = new Date(`${item.next_due_date}T00:00:00`);
        return due >= today && due <= end;
      })
      .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));

    let running = currentCash;
    const events: ForecastEvent[] = sourceEvents.map((item) => {
      const eventDirection = item.kind === "income" ? "in" : "out";
      const amount = Number(item.amount || 0);
      running += eventDirection === "in" ? amount : -amount;
      return {
        id: item.id,
        name: item.name,
        date: item.next_due_date,
        amount,
        direction: eventDirection,
        projectedBalance: running,
      };
    });

    const incoming = events.filter((event) => event.direction === "in").reduce((sum, event) => sum + event.amount, 0);
    const outgoing = events.filter((event) => event.direction === "out").reduce((sum, event) => sum + event.amount, 0);
    const lowest = events.reduce((min, event) => Math.min(min, event.projectedBalance), currentCash);
    const projectedCash = currentCash + incoming - outgoing;
    const status = lowest < 0 ? "Risk" : lowest < BUFFER ? "Tight" : "Safe";
    const safeToSpend = Math.max(0, lowest - BUFFER);
    const netMovement = incoming - outgoing;

    return {
      currentCash,
      projectedCash,
      incoming,
      outgoing,
      lowest,
      events,
      status,
      safeToSpend,
      netMovement,
    };
  }, [accounts, recurring, range]);

  const visibleEvents = data.events.filter((event) => direction === "all" || event.direction === direction);
  const chartPoints = [{ id: "today", label: "Today", balance: data.currentCash }, ...data.events.map((event) => ({ id: event.id, label: event.name, balance: event.projectedBalance }))];
  const chartMax = Math.max(...chartPoints.map((point) => point.balance), BUFFER, 1);
  const chartMin = Math.min(...chartPoints.map((point) => point.balance), 0);
  const chartSpan = Math.max(1, chartMax - chartMin);

  const showMoney = (value: number) => balancesHidden ? "••••" : money(value);
  const statusClass = data.status === "Safe"
    ? "border-success/30 bg-success/15 text-success"
    : data.status === "Tight"
      ? "border-warning/30 bg-warning/15 text-warning"
      : "border-destructive/30 bg-destructive/15 text-destructive";

  if (loading) {
    return (
      <div className="space-y-5 pb-8">
        <div className="h-14 animate-pulse rounded-2xl bg-secondary/60" />
        <div className="h-64 animate-pulse rounded-[30px] bg-secondary/60" />
        <div className="grid grid-cols-2 gap-3"><div className="h-28 animate-pulse rounded-3xl bg-secondary/50" /><div className="h-28 animate-pulse rounded-3xl bg-secondary/50" /></div>
        <div className="h-72 animate-pulse rounded-3xl bg-secondary/50" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <header className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-grad shadow-card">
          <CalendarRange className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Live forecast</p>
          <h1 className="font-display text-2xl">Cash Flow</h1>
        </div>
        <button
          type="button"
          onClick={() => setBalancesHidden((value) => !value)}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:border-accent/40 hover:text-foreground active:scale-95"
          aria-label={balancesHidden ? "Show balances" : "Hide balances"}
        >
          {balancesHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </header>

      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-violet-grad p-5 text-primary-foreground shadow-elevated">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-black/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] opacity-75">
                <Sparkles className="h-3.5 w-3.5" /> Projected in {range} days
              </div>
              <div className="mt-2 font-display text-5xl tabular-nums">{showMoney(data.projectedCash)}</div>
              <div className="mt-2 flex items-center gap-2 text-sm opacity-80">
                {data.netMovement >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {balancesHidden ? "Net movement hidden" : `${data.netMovement >= 0 ? "+" : ""}${money(data.netMovement)} net movement`}
              </div>
            </div>
            <div className={`rounded-2xl border px-3 py-2 text-center backdrop-blur-xl ${statusClass}`}>
              <div className="text-[9px] uppercase tracking-[0.18em]">Forecast</div>
              <div className="mt-0.5 font-semibold">{data.status}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            <HeroMetric label="Cash now" value={showMoney(data.currentCash)} />
            <HeroMetric label="Lowest" value={showMoney(data.lowest)} />
            <HeroMetric label="Safe spend" value={showMoney(data.safeToSpend)} />
          </div>

          <div className="mt-5 flex gap-2 rounded-2xl border border-white/15 bg-black/10 p-1 backdrop-blur-xl">
            {([7, 14, 30] as Range[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition active:scale-95 ${range === item ? "bg-white text-violet-950 shadow" : "text-white/70 hover:text-white"}`}
              >
                {item} days
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <SummaryCard icon={ArrowUpRight} label="Incoming" value={showMoney(data.incoming)} detail={`${data.events.filter((event) => event.direction === "in").length} deposits`} tone="success" />
        <SummaryCard icon={ArrowDownRight} label="Outgoing" value={showMoney(data.outgoing)} detail={`${data.events.filter((event) => event.direction === "out").length} payments`} tone="destructive" />
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-accent" /><h2 className="font-semibold">Balance path</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">How each scheduled event changes your available cash.</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass}`}>{data.status}</span>
        </div>
        <div className="p-5">
          <div className="flex h-36 items-end gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chartPoints.map((point, index) => {
              const height = Math.max(12, ((point.balance - chartMin) / chartSpan) * 100);
              const belowBuffer = point.balance < BUFFER;
              return (
                <div key={point.id} className="flex min-w-10 flex-1 flex-col items-center justify-end gap-2">
                  <div className="text-[9px] tabular-nums text-muted-foreground">{balancesHidden ? "••" : money(point.balance)}</div>
                  <div className="flex h-24 w-full items-end rounded-xl bg-secondary/35 p-1">
                    <div
                      className={`w-full rounded-lg transition-all duration-700 ${belowBuffer ? "bg-warning/70" : index === chartPoints.length - 1 ? "bg-violet-grad" : "bg-accent/55"}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <div className="max-w-14 truncate text-[9px] text-muted-foreground">{index === 0 ? "Today" : new Date(`${data.events[index - 1]?.date}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-secondary/35 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="h-4 w-4 text-accent" /> $500 safety buffer</div>
            <div className={data.lowest >= BUFFER ? "font-medium text-success" : "font-medium text-warning"}>{data.lowest >= BUFFER ? "Protected" : "Needs attention"}</div>
          </div>
        </div>
      </section>

      <section className={`rounded-3xl border p-5 ${data.status === "Safe" ? "border-success/20 bg-success/5" : data.status === "Tight" ? "border-warning/20 bg-warning/5" : "border-destructive/20 bg-destructive/5"}`}>
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${data.status === "Safe" ? "bg-success/15 text-success" : data.status === "Tight" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>
            {data.status === "Safe" ? <ShieldCheck className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Wealthpilot signal</p>
            <h2 className="mt-1 font-semibold">{data.status === "Safe" ? "Your buffer stays protected" : data.status === "Tight" ? "Your buffer gets thin" : "Your forecast drops below zero"}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {data.status === "Risk"
                ? "Review upcoming bills or move the timing of optional payments before the projected low point."
                : data.status === "Tight"
                  ? "Avoid optional spending until the next income event restores your safety buffer."
                  : `You can spend up to ${money(data.safeToSpend)} while keeping the $500 buffer intact, based on saved activity.`}
            </p>
          </div>
          <Link to="/scenario-planner" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card shadow-sm transition hover:scale-105 active:scale-95" aria-label="Open scenario planner"><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Scheduled activity</p>
            <h2 className="mt-1 font-display text-xl">Forecast timeline</h2>
          </div>
          <Link to="/bill-calendar" className="text-xs font-medium text-accent">Bill calendar</Link>
        </div>

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["all", "in", "out"] as DirectionFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDirection(item)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition active:scale-95 ${direction === item ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground"}`}
            >
              {item === "all" ? "All activity" : item === "in" ? "Income" : "Payments"}
            </button>
          ))}
        </div>

        {visibleEvents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
            <WalletCards className="mx-auto h-7 w-7 text-muted-foreground" />
            <div className="mt-3 text-sm font-medium">No scheduled activity</div>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Add bills, subscriptions, or recurring income to build a richer forecast.</p>
            <Link to="/bill-calendar" className="mt-4 inline-flex items-center gap-1 rounded-full bg-accent/10 px-4 py-2 text-xs font-medium text-accent">Add recurring items <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleEvents.map((event, index) => {
              const expanded = expandedEvent === event.id;
              const days = Math.ceil((new Date(`${event.date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
              return (
                <article key={event.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:border-accent/25">
                  <button type="button" onClick={() => setExpandedEvent(expanded ? null : event.id)} className="flex w-full items-center gap-3 p-4 text-left active:bg-secondary/35">
                    <div className={event.direction === "in" ? "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-success/10 text-success" : "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive"}>
                      {event.direction === "in" ? <ArrowUpRight className="h-4.5 w-4.5" /> : <ArrowDownRight className="h-4.5 w-4.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><div className="truncate text-sm font-medium">{event.name}</div>{index === 0 && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-medium text-accent">Next</span>}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{new Date(`${event.date}T00:00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })} · {days === 0 ? "Today" : `${days}d away`}</div>
                    </div>
                    <div className="text-right">
                      <div className={event.direction === "in" ? "text-sm font-semibold text-success" : "text-sm font-semibold text-destructive"}>{event.direction === "in" ? "+" : "−"}{balancesHidden ? "••••" : money(event.amount)}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{showMoney(event.projectedBalance)}</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <div className="border-t border-border bg-secondary/20 px-4 py-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-2xl bg-card p-3"><div className="text-muted-foreground">Balance after</div><div className="mt-1 font-semibold tabular-nums">{showMoney(event.projectedBalance)}</div></div>
                        <div className="rounded-2xl bg-card p-3"><div className="text-muted-foreground">Buffer status</div><div className={`mt-1 font-semibold ${event.projectedBalance >= BUFFER ? "text-success" : "text-warning"}`}>{event.projectedBalance >= BUFFER ? "Protected" : "Below $500"}</div></div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Link to="/scenario-planner" className="group flex items-center gap-3 rounded-3xl border border-accent/20 bg-gradient-to-r from-accent/10 to-transparent p-4 transition hover:border-accent/40 active:scale-[0.99]">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-sm"><Zap className="h-4.5 w-4.5" /></div>
        <div className="min-w-0 flex-1"><div className="text-sm font-semibold">Test a decision</div><div className="mt-0.5 text-xs text-muted-foreground">See how a purchase, overtime, or surprise expense changes this forecast.</div></div>
        <ChevronRight className="h-4 w-4 text-accent transition group-hover:translate-x-1" />
      </Link>

      <p className="text-center text-[10px] leading-4 text-muted-foreground">Forecasts use saved app data only. Actual balances may differ when transactions are missing or dates change.</p>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xl"><div className="text-[10px] opacity-65">{label}</div><div className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</div></div>;
}

function SummaryCard({ icon: Icon, label, value, detail, tone }: { icon: typeof ArrowUpRight; label: string; value: string; detail: string; tone: "success" | "destructive" }) {
  return (
    <div className="group rounded-3xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${tone === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}><Icon className="h-4 w-4" /></div>
      <div className="mt-3 text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-display text-2xl tabular-nums">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}
