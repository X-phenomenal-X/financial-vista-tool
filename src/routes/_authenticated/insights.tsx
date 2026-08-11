import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Lightbulb,
  PiggyBank,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { money, parseLocalDate } from "@/lib/format";
import { totalCash, highInterestDebt, utilization, spendAmount, CASH_BUFFER } from "@/lib/coach";
import { supabase } from "@/integrations/supabase/client";

const recurringDb = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Smart Insights — Wealthpilot" },
      {
        name: "description",
        content:
          "Prioritized, explainable financial insights generated from live Wealthpilot data.",
      },
    ],
  }),
  component: InsightsPage,
});

type InsightTone = "danger" | "warning" | "positive" | "info";
type Insight = {
  id: string;
  title: string;
  body: string;
  action: string;
  to: string;
  tone: InsightTone;
  icon: typeof Lightbulb;
  priority: number;
};
type InsightFilter = "priority" | "all" | "positive";

function useRecurring(userId?: string) {
  return useQuery({
    queryKey: ["recurring-insights", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await recurringDb
        .from("recurring_transactions")
        .select("id,name,kind,amount,cadence,next_due_date,is_active")
        .eq("is_active", true)
        .order("next_due_date");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function monthlyEquivalent(amount: number, cadence: string) {
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "semimonthly":
      return amount * 2;
    case "quarterly":
      return amount / 3;
    case "semiannual":
      return amount / 6;
    case "annual":
      return amount / 12;
    default:
      return amount;
  }
}

function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function maskMoney(body: string, hidden: boolean) {
  if (!hidden) return body;
  return body.replace(/\$[\d,.]+/g, "••••••");
}

function InsightsPage() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const recurring = useRecurring(user?.id);
  const [filter, setFilter] = useState<InsightFilter>("priority");
  const [hideDetails, setHideDetails] = useState(false);

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    const cash = totalCash(ctx);
    const cards = ctx.debts.filter(
      (debt) => debt.kind === "credit_card" && debt.status !== "cleared",
    );
    const recurringRows = recurring.data ?? [];
    const bills = recurringRows.filter((item) => item.kind === "bill");
    const subscriptions = recurringRows.filter((item) => item.kind === "subscription");

    out.push(
      cash < CASH_BUFFER
        ? {
            id: "cash-buffer-low",
            title: "Your cash buffer is below target",
            body: `You have ${money(cash)} across cash accounts. Your protected buffer is ${money(CASH_BUFFER)}, leaving a gap of ${money(CASH_BUFFER - cash)}.`,
            action: "Open payday planner",
            to: "/payday",
            tone: "danger",
            icon: ShieldAlert,
            priority: 100,
          }
        : {
            id: "cash-buffer-safe",
            title: "Your cash buffer is protected",
            body: `${money(cash)} is available across cash accounts, which is ${money(cash - CASH_BUFFER)} above your protected buffer.`,
            action: "Review financial health",
            to: "/financial-health",
            tone: "positive",
            icon: PiggyBank,
            priority: 20,
          },
    );

    cards.forEach((card) => {
      const used = utilization(card);
      if (used >= 0.8)
        out.push({
          id: `util-${card.id}`,
          title: `${card.name} utilization is high`,
          body: `${(used * 100).toFixed(0)}% of the available limit is in use. Paying it down can improve flexibility and reduce risk.`,
          action: "Review debts",
          to: "/debts",
          tone: used >= 1 ? "danger" : "warning",
          icon: CreditCard,
          priority: used >= 1 ? 95 : 80,
        });
    });

    if (highInterestDebt(ctx) > 0) {
      const target = [...ctx.debts]
        .filter((debt) => debt.status !== "cleared" && debt.kind !== "car_loan")
        .sort((a, b) => Number(b.apr) - Number(a.apr))[0];
      if (target)
        out.push({
          id: "debt-priority",
          title: `${target.name} is your highest-cost debt`,
          body: `It carries ${Number(target.apr).toFixed(2)}% APR. Extra payments here should save more interest than paying lower-rate balances first.`,
          action: "Open payoff simulator",
          to: "/simulator",
          tone: "warning",
          icon: TrendingDown,
          priority: 75,
        });
    }

    const monthlySubscriptions = subscriptions.reduce(
      (sum, item) => sum + monthlyEquivalent(Number(item.amount), item.cadence),
      0,
    );
    if (subscriptions.length)
      out.push({
        id: "subscription-total",
        title: `${subscriptions.length} active subscription${subscriptions.length === 1 ? "" : "s"}`,
        body: `They cost about ${money(monthlySubscriptions)} per month, or ${money(monthlySubscriptions * 12)} per year.`,
        action: "Review subscriptions",
        to: "/subscriptions",
        tone: monthlySubscriptions >= 150 ? "warning" : "info",
        icon: RefreshCw,
        priority: monthlySubscriptions >= 150 ? 70 : 35,
      });

    const dueSoon = [...bills, ...subscriptions]
      .map((item) => ({ ...item, days: daysUntil(item.next_due_date) }))
      .filter((item) => item.days >= 0 && item.days <= 7)
      .sort((a, b) => a.days - b.days);
    if (dueSoon.length) {
      const total = dueSoon.reduce((sum, item) => sum + Number(item.amount), 0);
      out.push({
        id: "upcoming-recurring",
        title: `${dueSoon.length} recurring payment${dueSoon.length === 1 ? " is" : "s are"} due this week`,
        body: `${money(total)} is scheduled over the next seven days. The closest is ${dueSoon[0].name}${dueSoon[0].days === 0 ? " today" : ` in ${dueSoon[0].days} day${dueSoon[0].days === 1 ? "" : "s"}`}.`,
        action: "Open bill calendar",
        to: "/bill-calendar",
        tone: total > cash - CASH_BUFFER ? "danger" : "warning",
        icon: CalendarClock,
        priority: total > cash - CASH_BUFFER ? 90 : 65,
      });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    // Both sides are pure expenses. Including card payments in the plan but
    // not the actuals made the pace always read under plan, and including
    // them in both would double-count purchases already logged as expenses.
    const currentExpenses = ctx.transactions
      .filter(
        (transaction) =>
          transaction.type === "expense" && parseLocalDate(transaction.occurred_on) >= monthStart,
      )
      .reduce((sum, item) => sum + spendAmount(item), 0);
    const plannedExpenses = ctx.budget
      .filter((item) => item.kind === "expense")
      .reduce((sum, item) => sum + Number(item.planned), 0);
    if (plannedExpenses > 0) {
      const pace = currentExpenses / plannedExpenses;
      out.push({
        id: "monthly-spending",
        title: pace > 1 ? "Monthly spending is above plan" : "Monthly spending is within plan",
        body: `${money(currentExpenses)} has been logged against ${money(plannedExpenses)} planned for the month.`,
        action: "Review budget",
        to: "/budget",
        tone: pace > 1 ? "warning" : "positive",
        icon: pace > 1 ? TrendingUp : TrendingDown,
        priority: pace > 1 ? 78 : 25,
      });
    }

    return out.sort((a, b) => b.priority - a.priority);
  }, [ctx, recurring.data]);

  if (!user || ctx.loading || recurring.isLoading) return <InsightsSkeleton />;

  if (ctx.error || recurring.error) {
    return (
      <InsightsError
        onRetry={() => {
          void Promise.all([ctx.refetch(), recurring.refetch()]);
        }}
      />
    );
  }

  const attentionInsights = insights.filter(
    (item) => item.tone === "danger" || item.tone === "warning",
  );
  const positiveInsights = insights.filter((item) => item.tone === "positive");
  const urgentCount = attentionInsights.length;
  const topInsight = attentionInsights[0] ?? insights[0];
  const visibleInsights =
    filter === "priority" ? attentionInsights : filter === "positive" ? positiveInsights : insights;

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Wealthpilot intelligence · Live signals</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">
            Know what deserves your attention now.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Explainable observations from your accounts, debts, spending, bills, and
            subscriptions—ranked by urgency.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setHideDetails((value) => !value)}
          aria-label={hideDetails ? "Show financial details" : "Hide financial details"}
          aria-pressed={hideDetails}
          className="mt-1 shrink-0 rounded-2xl"
        >
          {hideDetails ? <EyeOff /> : <Eye />}
        </Button>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl transition-transform duration-700 motion-safe:group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/13 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative">
          <div className="flex items-start gap-3 text-accent">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-accent/15 bg-accent/10">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em]">Signal check</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {urgentCount
                  ? `${urgentCount} signal${urgentCount === 1 ? "" : "s"} worth attention right now.`
                  : "No warning signals are active right now."}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            <InsightMetric label="Attention" value={String(urgentCount)} tone="warning" />
            <InsightMetric label="Healthy" value={String(positiveInsights.length)} tone="success" />
            <InsightMetric label="Total signals" value={String(insights.length)} />
          </div>
        </div>
      </section>

      {topInsight && (
        <section className="relative overflow-hidden rounded-[1.75rem] border border-accent/20 bg-accent/[0.07] p-5 shadow-card sm:p-6">
          <div className="absolute -right-12 -top-16 h-36 w-36 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              <Target className="h-4 w-4" /> {urgentCount ? "Top priority" : "Best current signal"}
            </div>
            <div className="mt-3 flex items-start gap-3">
              <InsightIcon insight={topInsight} featured />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">{topInsight.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {maskMoney(topInsight.body, hideDetails)}
                </p>
                <Link
                  to={topInsight.to}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
                >
                  {topInsight.action} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 px-1">
          <div className="eyebrow">Signal feed</div>
          <div className="mt-2 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl">Your money, explained</h2>
            <Link
              to="/financial-health"
              className="hidden items-center gap-1 text-xs font-semibold text-accent sm:inline-flex"
            >
              Health score <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterButton
            active={filter === "priority"}
            onClick={() => setFilter("priority")}
            label="Needs attention"
            count={attentionInsights.length}
          />
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All signals"
            count={insights.length}
          />
          <FilterButton
            active={filter === "positive"}
            onClick={() => setFilter("positive")}
            label="Healthy"
            count={positiveInsights.length}
          />
        </div>

        <div className="space-y-3">
          {visibleInsights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} hideDetails={hideDetails} />
          ))}

          {!visibleInsights.length && (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-card p-8 text-center shadow-card">
              <CheckCircle2 className="mx-auto h-7 w-7 text-success" />
              <div className="mt-3 text-sm font-semibold">
                {filter === "priority"
                  ? "Nothing needs attention right now"
                  : "No signals here yet"}
              </div>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                {filter === "priority"
                  ? "Your current live data is not generating any warning or danger signals."
                  : "Add more financial activity to give Wealthpilot more useful signals to explain."}
              </p>
              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="mt-3 text-xs font-semibold text-accent"
                >
                  Show all signals
                </button>
              )}
            </div>
          )}
        </div>

        <Link
          to="/financial-health"
          className="mt-3 inline-flex items-center gap-1.5 px-1 text-sm font-semibold text-accent sm:hidden"
        >
          Review financial health <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <p className="px-2 text-center text-[10px] leading-4 text-muted-foreground">
        Insights are deterministic calculations from saved Wealthpilot data. They are not a credit
        score or a financial-product recommendation.
      </p>
    </div>
  );
}

function InsightMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "success";
}) {
  const valueClass =
    tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/10 px-3 py-3 backdrop-blur-sm sm:px-4">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
        active
          ? "border-accent/25 bg-accent/12 text-accent"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label} <span className="ml-1 opacity-70">{count}</span>
    </button>
  );
}

function InsightCard({ insight, hideDetails }: { insight: Insight; hideDetails: boolean }) {
  const toneClass =
    insight.tone === "danger"
      ? "border-destructive/25 bg-destructive/[0.07]"
      : insight.tone === "warning"
        ? "border-warning/20 bg-warning/[0.06]"
        : insight.tone === "positive"
          ? "border-success/15 bg-success/[0.05]"
          : "border-border bg-card";

  return (
    <article
      className={`rounded-[1.5rem] border p-4 shadow-card transition-[border-color,transform,box-shadow] duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-elevated sm:p-5 ${toneClass}`}
    >
      <div className="flex items-start gap-3">
        <InsightIcon insight={insight} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold leading-5">{insight.title}</h3>
            <SignalChip tone={insight.tone} />
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {maskMoney(insight.body, hideDetails)}
          </p>
          <Link
            to={insight.to}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent"
          >
            {insight.action} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function InsightIcon({ insight, featured = false }: { insight: Insight; featured?: boolean }) {
  const Icon = insight.icon;
  const iconClass =
    insight.tone === "danger"
      ? "text-destructive"
      : insight.tone === "warning"
        ? "text-warning"
        : insight.tone === "positive"
          ? "text-success"
          : "text-accent";
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-background/55 ${
        featured ? "h-11 w-11" : "h-10 w-10"
      }`}
    >
      <Icon className={`${featured ? "h-5 w-5" : "h-4.5 w-4.5"} ${iconClass}`} />
    </div>
  );
}

function SignalChip({ tone }: { tone: InsightTone }) {
  const label =
    tone === "danger"
      ? "Urgent"
      : tone === "warning"
        ? "Watch"
        : tone === "positive"
          ? "Healthy"
          : "FYI";
  const className =
    tone === "danger"
      ? "border-destructive/20 bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "border-warning/20 bg-warning/10 text-warning"
        : tone === "positive"
          ? "border-success/20 bg-success/10 text-success"
          : "border-border bg-secondary text-muted-foreground";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${className}`}
    >
      {label}
    </span>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-7 pb-10" aria-busy="true" aria-label="Reading financial insights">
      <div className="space-y-3 pt-1">
        <div className="h-3 w-44 animate-pulse rounded-full bg-muted" />
        <div className="h-10 w-4/5 animate-pulse rounded-2xl bg-muted sm:w-2/3" />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-48 animate-pulse rounded-[2rem] border border-border bg-card" />
      <div className="h-44 animate-pulse rounded-[1.75rem] border border-border bg-card" />
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-[1.5rem] border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}

function InsightsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center pb-10">
      <div className="w-full rounded-[2rem] border border-destructive/25 bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <TriangleAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-3xl">Your latest insights could not be refreshed.</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          One or more live sources did not load. Wealthpilot will not turn partial data into a money
          recommendation.
        </p>
        <Button type="button" onClick={onRetry} className="mt-5 rounded-xl">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
