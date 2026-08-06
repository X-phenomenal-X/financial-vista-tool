import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/_authenticated/cash-flow")({
  head: () => ({
    meta: [
      { title: "Cash Flow Forecast — Wealthpilot" },
      {
        name: "description",
        content:
          "See where your cash is heading, the low point ahead, and the decisions that can change the next 30 days.",
      },
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
type ForecastStatus = "Safe" | "Tight" | "Risk";

const CASH_KINDS = new Set(["chequing", "savings", "money_master", "cash"]);
const BUFFER = 500;
const forecastDb = supabase as unknown as SupabaseClient;

function money(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateFromIso(value: string) {
  return new Date(`${value}T00:00:00`);
}

function CashFlowForecastPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [range, setRange] = useState<Range>(30);
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [balancesHidden, setBalancesHidden] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      const [accountsResult, recurringResult] = await Promise.all([
        forecastDb.from("accounts").select("id,name,kind,balance").eq("user_id", userId),
        forecastDb
          .from("recurring_transactions")
          .select("id,name,amount,kind,next_due_date,is_active")
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

      if (cancelled) return;
      if (accountsResult.error || recurringResult.error) {
        setLoadError(
          accountsResult.error?.message ||
            recurringResult.error?.message ||
            "We couldn't load the forecast sources.",
        );
        setLoading(false);
        return;
      }

      setAccounts((accountsResult.data ?? []) as AccountRow[]);
      setRecurring((recurringResult.data ?? []) as RecurringRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, reloadToken]);

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
        const due = dateFromIso(item.next_due_date);
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

    const incoming = events
      .filter((event) => event.direction === "in")
      .reduce((sum, event) => sum + event.amount, 0);
    const outgoing = events
      .filter((event) => event.direction === "out")
      .reduce((sum, event) => sum + event.amount, 0);
    const lowestEvent = events.reduce<ForecastEvent | null>((lowest, event) => {
      if (!lowest || event.projectedBalance < lowest.projectedBalance) return event;
      return lowest;
    }, null);
    const lowest = Math.min(currentCash, lowestEvent?.projectedBalance ?? currentCash);
    const projectedCash = currentCash + incoming - outgoing;
    const status: ForecastStatus = lowest < 0 ? "Risk" : lowest < BUFFER ? "Tight" : "Safe";
    const safeToSpend = Math.max(0, lowest - BUFFER);
    const netMovement = incoming - outgoing;
    const incomingCount = events.filter((event) => event.direction === "in").length;
    const outgoingCount = events.length - incomingCount;
    const coverage = outgoing > 0 ? incoming / outgoing : incoming > 0 ? 2 : 1;
    const lowPointDate = lowest < currentCash ? (lowestEvent?.date ?? null) : null;
    const daysToLow = lowPointDate
      ? Math.max(0, Math.ceil((dateFromIso(lowPointDate).getTime() - today.getTime()) / 86400000))
      : null;

    return {
      currentCash,
      projectedCash,
      incoming,
      outgoing,
      incomingCount,
      outgoingCount,
      lowest,
      lowPointDate,
      daysToLow,
      events,
      status,
      safeToSpend,
      netMovement,
      coverage,
    };
  }, [accounts, recurring, range]);

  const visibleEvents = data.events.filter(
    (event) => direction === "all" || event.direction === direction,
  );
  const chartPoints = [
    { id: "today", label: "Today", balance: data.currentCash, date: null as string | null },
    ...data.events.map((event) => ({
      id: event.id,
      label: event.name,
      balance: event.projectedBalance,
      date: event.date,
    })),
  ];
  const chartMax = Math.max(...chartPoints.map((point) => point.balance), BUFFER, 1);
  const chartMin = Math.min(...chartPoints.map((point) => point.balance), 0);
  const chartSpan = Math.max(1, chartMax - chartMin);
  const showMoney = (value: number) => (balancesHidden ? "••••" : money(value));
  const statusTone = forecastTone(data.status);

  if (!user || loading) return <ForecastSkeleton />;

  if (loadError) {
    return (
      <ForecastError message={loadError} onRetry={() => setReloadToken((value) => value + 1)} />
    );
  }

  const noCashAccounts = accounts.filter((account) => CASH_KINDS.has(account.kind)).length === 0;

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Forward view · next {range} days</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">
            See the month before it happens.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Live cash, scheduled money in and money out, and the low point that matters most.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setBalancesHidden((value) => !value)}
          aria-label={balancesHidden ? "Show balances" : "Hide balances"}
          aria-pressed={balancesHidden}
          className="mt-1 shrink-0 rounded-2xl"
        >
          {balancesHidden ? <EyeOff /> : <Eye />}
        </Button>
      </header>

      {noCashAccounts ? (
        <section className="rounded-[1.8rem] border border-warning/25 bg-warning/[0.06] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-warning/12 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="eyebrow">Forecast needs a starting point</div>
              <h2 className="mt-1 font-display text-2xl">Add a cash account first</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Wealthpilot can see your recurring schedule, but it needs a chequing, savings, Money
                Master, or cash balance to produce a useful runway.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
            <div className="pointer-events-none absolute -bottom-28 -left-16 h-60 w-60 rounded-full bg-accent/[0.08] blur-3xl" />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)] lg:items-end">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
                  <Sparkles className="h-3.5 w-3.5 text-primary-glow" /> Projected cash
                </div>
                <div className="numeric-display mt-5 truncate font-display text-[3.35rem] leading-none sm:text-7xl">
                  {showMoney(data.projectedCash)}
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  {data.netMovement >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-warning" />
                  )}
                  {balancesHidden
                    ? "Net movement hidden"
                    : `${data.netMovement >= 0 ? "+" : ""}${money(data.netMovement)} through scheduled activity`}
                </div>
              </div>

              <div className="rounded-[1.55rem] border border-white/[0.09] bg-black/10 p-4 backdrop-blur-xl sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Forecast signal
                    </div>
                    <div
                      className={`mt-1 flex items-center gap-2 font-display text-2xl ${statusTone.text}`}
                    >
                      {data.status === "Safe" ? (
                        <ShieldCheck className="h-5 w-5" />
                      ) : (
                        <Activity className="h-5 w-5" />
                      )}
                      {data.status}
                    </div>
                  </div>
                  <div className={`rounded-2xl border px-3 py-2 text-right ${statusTone.panel}`}>
                    <div className={`numeric-display text-lg font-semibold ${statusTone.text}`}>
                      {data.daysToLow === null ? "Now" : `${data.daysToLow}d`}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      to low point
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex gap-2 rounded-2xl border border-white/[0.08] bg-black/10 p-1">
                  {([7, 14, 30] as Range[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setRange(item)}
                      className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition active:scale-95 ${
                        range === item
                          ? "bg-foreground text-background shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item} days
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative mt-6 grid grid-cols-3 gap-2.5">
              <HeroMetric label="Cash now" value={showMoney(data.currentCash)} />
              <HeroMetric label="Low point" value={showMoney(data.lowest)} />
              <HeroMetric label="Safe spend" value={showMoney(data.safeToSpend)} />
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="eyebrow">Money movement</div>
                <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">
                  What changes the outcome
                </h2>
              </div>
            </div>
            <div className="scrollbar-none -mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
              <MovementCard
                icon={ArrowUpRight}
                label="Scheduled in"
                value={showMoney(data.incoming)}
                detail={`${data.incomingCount} deposit${data.incomingCount === 1 ? "" : "s"}`}
                tone="success"
              />
              <MovementCard
                icon={ArrowDownRight}
                label="Scheduled out"
                value={showMoney(data.outgoing)}
                detail={`${data.outgoingCount} payment${data.outgoingCount === 1 ? "" : "s"}`}
                tone="danger"
              />
              <MovementCard
                icon={TrendingUp}
                label="Income coverage"
                value={`${Math.round(data.coverage * 100)}%`}
                detail={
                  data.coverage >= 1
                    ? "Scheduled inflow covers outflow"
                    : "Outflow is heavier than inflow"
                }
                tone={data.coverage >= 1 ? "success" : "warning"}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.8rem] border border-border bg-card shadow-card">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5 sm:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  <h2 className="font-semibold">Balance path</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each bar is your cash after a scheduled event.
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone.badge}`}
              >
                {data.status}
              </span>
            </div>
            <div className="p-5 sm:p-6">
              <div className="scrollbar-none flex h-40 items-end gap-2 overflow-x-auto pb-2">
                {chartPoints.map((point, index) => {
                  const height = Math.max(12, ((point.balance - chartMin) / chartSpan) * 100);
                  const belowBuffer = point.balance < BUFFER;
                  const last = index === chartPoints.length - 1;
                  return (
                    <div
                      key={point.id}
                      className="flex min-w-11 flex-1 flex-col items-center justify-end gap-2"
                    >
                      <div className="max-w-16 truncate text-[9px] tabular-nums text-muted-foreground">
                        {balancesHidden ? "••" : money(point.balance)}
                      </div>
                      <div className="flex h-24 w-full items-end rounded-xl bg-secondary/35 p-1">
                        <div
                          className={`w-full rounded-lg transition-all duration-700 ${
                            belowBuffer ? "bg-warning/75" : last ? "bg-violet-grad" : "bg-accent/55"
                          }`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="max-w-14 truncate text-[9px] text-muted-foreground">
                        {point.date
                          ? dateFromIso(point.date).toLocaleDateString("en-CA", {
                              month: "short",
                              day: "numeric",
                            })
                          : "Today"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl bg-secondary/35 px-4 py-3 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-accent" /> $500 safety buffer
                  </div>
                  <div
                    className={
                      data.lowest >= BUFFER
                        ? "font-medium text-success"
                        : "font-medium text-warning"
                    }
                  >
                    {data.lowest >= BUFFER ? "Protected" : "Needs attention"}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-secondary/35 px-4 py-3 text-xs">
                  <div className="text-muted-foreground">Projected low</div>
                  <div className="font-medium">
                    {data.lowPointDate
                      ? dateFromIso(data.lowPointDate).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                        })
                      : "Today"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <ForecastSignal
            status={data.status}
            safeToSpend={data.safeToSpend}
            lowPointDate={data.lowPointDate}
          />

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="eyebrow">Scheduled activity</div>
                <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">Forecast timeline</h2>
              </div>
              <Link to="/bill-calendar" className="text-xs font-medium text-accent">
                Bill calendar
              </Link>
            </div>

            <div className="scrollbar-none mb-3 flex gap-2 overflow-x-auto pb-1">
              {(["all", "in", "out"] as DirectionFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDirection(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition active:scale-95 ${
                    direction === item
                      ? "bg-foreground text-background"
                      : "border border-border bg-card text-muted-foreground"
                  }`}
                >
                  {item === "all" ? "All activity" : item === "in" ? "Income" : "Payments"}
                </button>
              ))}
            </div>

            {visibleEvents.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-border bg-card/60 p-8 text-center">
                <WalletCards className="mx-auto h-7 w-7 text-muted-foreground" />
                <div className="mt-3 text-sm font-medium">No scheduled activity here</div>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                  {direction === "all"
                    ? "Add bills, subscriptions, or recurring income to make this forecast more complete."
                    : `There are no ${direction === "in" ? "income" : "payment"} events in this window.`}
                </p>
                {direction === "all" && (
                  <Link
                    to="/bill-calendar"
                    className="mt-4 inline-flex items-center gap-1 rounded-full bg-accent/10 px-4 py-2 text-xs font-medium text-accent"
                  >
                    Add recurring items <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleEvents.map((event) => {
                  const expanded = expandedEvent === event.id;
                  const days = Math.max(
                    0,
                    Math.ceil(
                      (dateFromIso(event.date).getTime() - new Date().setHours(0, 0, 0, 0)) /
                        86400000,
                    ),
                  );
                  return (
                    <article
                      key={event.id}
                      className="overflow-hidden rounded-[1.45rem] border border-border bg-card shadow-card transition hover:border-accent/25"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedEvent(expanded ? null : event.id)}
                        className="relative flex w-full items-center gap-3 p-4 text-left active:bg-secondary/35"
                      >
                        <div
                          className={
                            event.direction === "in"
                              ? "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-success/10 text-success"
                              : "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive"
                          }
                        >
                          {event.direction === "in" ? (
                            <ArrowUpRight className="h-4.5 w-4.5" />
                          ) : (
                            <ArrowDownRight className="h-4.5 w-4.5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{event.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {dateFromIso(event.date).toLocaleDateString("en-CA", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            · {days === 0 ? "Today" : `${days}d away`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={
                              event.direction === "in"
                                ? "text-sm font-semibold text-success"
                                : "text-sm font-semibold text-destructive"
                            }
                          >
                            {event.direction === "in" ? "+" : "−"}
                            {balancesHidden ? "••••" : money(event.amount)}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {showMoney(event.projectedBalance)} after
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition ${
                            expanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {expanded && (
                        <div className="relative border-t border-border bg-secondary/20 px-4 py-3">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-2xl bg-card p-3">
                              <div className="text-muted-foreground">Balance after</div>
                              <div className="mt-1 font-semibold tabular-nums">
                                {showMoney(event.projectedBalance)}
                              </div>
                            </div>
                            <div className="rounded-2xl bg-card p-3">
                              <div className="text-muted-foreground">Buffer status</div>
                              <div
                                className={`mt-1 font-semibold ${
                                  event.projectedBalance >= BUFFER ? "text-success" : "text-warning"
                                }`}
                              >
                                {event.projectedBalance >= BUFFER ? "Protected" : "Below $500"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <Link
            to="/scenario-planner"
            className="group relative flex items-center gap-3 overflow-hidden rounded-[1.65rem] border border-accent/20 bg-gradient-to-r from-accent/10 via-card to-primary/[0.08] p-4 shadow-card transition hover:border-accent/40 active:scale-[0.99] sm:p-5"
          >
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="eyebrow">Change the outcome</div>
              <div className="mt-1 text-sm font-semibold">
                Test a decision before the money moves
              </div>
              <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
                Compare your baseline with a purchase, extra income, debt payment, or surprise cost.
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-accent transition group-hover:translate-x-1" />
          </Link>
        </>
      )}

      <p className="text-center text-[10px] leading-4 text-muted-foreground">
        Forecasts are read-only estimates from saved balances and recurring items. Actual cash can
        differ when transactions or dates change.
      </p>
    </div>
  );
}

function ForecastSkeleton() {
  return (
    <div className="space-y-6 pb-10" aria-label="Loading cash-flow forecast">
      <div className="h-24 animate-pulse rounded-3xl bg-secondary/45" />
      <div className="h-80 animate-pulse rounded-[2rem] bg-secondary/55" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="h-32 animate-pulse rounded-3xl bg-secondary/45" />
        <div className="h-32 animate-pulse rounded-3xl bg-secondary/45" />
        <div className="hidden h-32 animate-pulse rounded-3xl bg-secondary/45 sm:block" />
      </div>
      <div className="h-72 animate-pulse rounded-[1.8rem] bg-secondary/45" />
    </div>
  );
}

function ForecastError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="pb-10 pt-4">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-destructive/25 bg-destructive/[0.06] p-6 text-center shadow-card sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/12 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="eyebrow mt-5">Live forecast unavailable</div>
        <h1 className="mt-2 font-display text-3xl">
          We couldn&apos;t build a trustworthy forecast.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Wealthpilot stopped instead of showing incomplete balances or scheduled activity. Your
          saved records were not changed.
        </p>
        <Button type="button" onClick={onRetry} className="mt-5 rounded-2xl">
          <RefreshCw className="h-4 w-4" /> Retry live data
        </Button>
        <details className="mt-5 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer text-center">Technical detail</summary>
          <p className="mt-2 break-words rounded-2xl bg-background/40 p-3">{message}</p>
        </details>
      </section>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.09] bg-black/10 p-3 text-center backdrop-blur-xl">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="numeric-display mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function MovementCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "danger"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/10 text-warning";
  return (
    <article className="min-w-[15.5rem] snap-start rounded-[1.55rem] border border-border bg-card p-4 shadow-card sm:min-w-0">
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${toneClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-4 text-xs text-muted-foreground">{label}</div>
      <div className="numeric-display mt-1 truncate font-display text-2xl">{value}</div>
      <div className="mt-1 text-[10px] leading-4 text-muted-foreground">{detail}</div>
    </article>
  );
}

function ForecastSignal({
  status,
  safeToSpend,
  lowPointDate,
}: {
  status: "Safe" | "Tight" | "Risk";
  safeToSpend: number;
  lowPointDate: string | null;
}) {
  const tone = forecastTone(status);
  const Icon = status === "Safe" ? ShieldCheck : AlertTriangle;
  const lowDate = lowPointDate
    ? dateFromIso(lowPointDate).toLocaleDateString("en-CA", { month: "long", day: "numeric" })
    : "today";
  const title =
    status === "Safe"
      ? "Your buffer stays protected"
      : status === "Tight"
        ? "Protect the low point before optional spending"
        : "The current schedule creates a cash gap";
  const body =
    status === "Safe"
      ? `Your current schedule leaves about ${money(safeToSpend)} of room above the $500 buffer at the lowest point.`
      : status === "Tight"
        ? `Cash gets closest to your $500 buffer around ${lowDate}. Test optional spending in Scenario Planner before committing.`
        : `The forecast falls below zero around ${lowDate}. Prioritize timing, incoming cash, or delaying optional payments before adding new spending.`;

  return (
    <section className={`rounded-[1.8rem] border p-5 sm:p-6 ${tone.section}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Wealthpilot next move</div>
          <h2 className="mt-1 font-display text-2xl">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          <Link
            to="/scenario-planner"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-semibold shadow-sm transition hover:scale-105 active:scale-95"
          >
            Test the outcome <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function forecastTone(status: ForecastStatus) {
  if (status === "Safe") {
    return {
      text: "text-success",
      panel: "border-success/20 bg-success/[0.08]",
      badge: "border-success/20 bg-success/[0.08] text-success",
      section: "border-success/20 bg-success/[0.05]",
      icon: "bg-success/15 text-success",
    };
  }
  if (status === "Tight") {
    return {
      text: "text-warning",
      panel: "border-warning/20 bg-warning/[0.08]",
      badge: "border-warning/20 bg-warning/[0.08] text-warning",
      section: "border-warning/20 bg-warning/[0.05]",
      icon: "bg-warning/15 text-warning",
    };
  }
  return {
    text: "text-destructive",
    panel: "border-destructive/20 bg-destructive/[0.08]",
    badge: "border-destructive/20 bg-destructive/[0.08] text-destructive",
    section: "border-destructive/20 bg-destructive/[0.05]",
    icon: "bg-destructive/15 text-destructive",
  };
}
