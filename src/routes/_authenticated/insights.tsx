import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, CalendarClock, CreditCard, Lightbulb, PiggyBank, RefreshCw, ShieldAlert, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { money } from "@/lib/format";
import { totalCash, highInterestDebt, utilization, CASH_BUFFER } from "@/lib/coach";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Smart Insights — Wealthpilot" },
      { name: "description", content: "Explainable financial insights generated from your live Wealthpilot data." },
    ],
  }),
  component: InsightsPage,
});

type InsightTone = "danger" | "warning" | "positive" | "info";
type Insight = { id: string; title: string; body: string; action: string; to: string; tone: InsightTone; icon: typeof Lightbulb; priority: number };

function useRecurring(userId?: string) {
  return useQuery({
    queryKey: ["recurring-insights", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
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
    case "weekly": return amount * 52 / 12;
    case "biweekly": return amount * 26 / 12;
    case "semimonthly": return amount * 2;
    case "quarterly": return amount / 3;
    case "semiannual": return amount / 6;
    case "annual": return amount / 12;
    default: return amount;
  }
}

function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function InsightsPage() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const recurring = useRecurring(user?.id);

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    const cash = totalCash(ctx);
    const cards = ctx.debts.filter((debt) => debt.kind === "credit_card" && debt.status !== "cleared");
    const recurringRows = recurring.data ?? [];
    const bills = recurringRows.filter((item) => item.kind === "bill");
    const subscriptions = recurringRows.filter((item) => item.kind === "subscription");

    out.push(cash < CASH_BUFFER ? {
      id: "cash-buffer-low", title: "Your cash buffer is below target",
      body: `You have ${money(cash)} across cash accounts. Your protected buffer is ${money(CASH_BUFFER)}, leaving a gap of ${money(CASH_BUFFER - cash)}.`,
      action: "Open payday planner", to: "/payday", tone: "danger", icon: ShieldAlert, priority: 100,
    } : {
      id: "cash-buffer-safe", title: "Your cash buffer is protected",
      body: `${money(cash)} is available across cash accounts, which is ${money(cash - CASH_BUFFER)} above your protected buffer.`,
      action: "Review financial health", to: "/financial-health", tone: "positive", icon: PiggyBank, priority: 20,
    });

    cards.forEach((card) => {
      const used = utilization(card);
      if (used >= 0.8) out.push({
        id: `util-${card.id}`, title: `${card.name} utilization is high`,
        body: `${(used * 100).toFixed(0)}% of the available limit is in use. Paying it down can improve flexibility and reduce risk.`,
        action: "Review debts", to: "/debts", tone: used >= 1 ? "danger" : "warning", icon: CreditCard, priority: used >= 1 ? 95 : 80,
      });
    });

    if (highInterestDebt(ctx) > 0) {
      const target = [...ctx.debts].filter((debt) => debt.status !== "cleared" && debt.kind !== "car_loan").sort((a, b) => Number(b.apr) - Number(a.apr))[0];
      if (target) out.push({
        id: "debt-priority", title: `${target.name} is your highest-cost debt`,
        body: `It carries ${Number(target.apr).toFixed(2)}% APR. Extra payments here should save more interest than paying lower-rate balances first.`,
        action: "Open payoff simulator", to: "/simulator", tone: "warning", icon: TrendingDown, priority: 75,
      });
    }

    const monthlySubscriptions = subscriptions.reduce((sum, item) => sum + monthlyEquivalent(Number(item.amount), item.cadence), 0);
    if (subscriptions.length) out.push({
      id: "subscription-total", title: `${subscriptions.length} active subscription${subscriptions.length === 1 ? "" : "s"}`,
      body: `They cost about ${money(monthlySubscriptions)} per month, or ${money(monthlySubscriptions * 12)} per year.`,
      action: "Review subscriptions", to: "/subscriptions", tone: monthlySubscriptions >= 150 ? "warning" : "info", icon: RefreshCw, priority: monthlySubscriptions >= 150 ? 70 : 35,
    });

    const dueSoon = [...bills, ...subscriptions]
      .map((item) => ({ ...item, days: daysUntil(item.next_due_date) }))
      .filter((item) => item.days >= 0 && item.days <= 7)
      .sort((a, b) => a.days - b.days);
    if (dueSoon.length) {
      const total = dueSoon.reduce((sum, item) => sum + Number(item.amount), 0);
      out.push({
        id: "upcoming-recurring", title: `${dueSoon.length} recurring payment${dueSoon.length === 1 ? " is" : "s are"} due this week`,
        body: `${money(total)} is scheduled over the next seven days. The closest is ${dueSoon[0].name}${dueSoon[0].days === 0 ? " today" : ` in ${dueSoon[0].days} day${dueSoon[0].days === 1 ? "" : "s"}`}.`,
        action: "Open bill calendar", to: "/bill-calendar", tone: total > cash - CASH_BUFFER ? "danger" : "warning", icon: CalendarClock, priority: total > cash - CASH_BUFFER ? 90 : 65,
      });
    }

    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const currentExpenses = ctx.transactions.filter((transaction) => transaction.type === "expense" && new Date(transaction.occurred_on) >= monthStart).reduce((sum, item) => sum + Number(item.amount), 0);
    const plannedExpenses = ctx.budget.filter((item) => item.kind !== "income" && item.kind !== "transfer").reduce((sum, item) => sum + Number(item.planned), 0);
    if (plannedExpenses > 0) {
      const pace = currentExpenses / plannedExpenses;
      out.push({
        id: "monthly-spending", title: pace > 1 ? "Monthly spending is above plan" : "Monthly spending is within plan",
        body: `${money(currentExpenses)} has been logged against ${money(plannedExpenses)} planned for the month.`,
        action: "Review budget", to: "/budget", tone: pace > 1 ? "warning" : "positive", icon: pace > 1 ? TrendingUp : TrendingDown, priority: pace > 1 ? 78 : 25,
      });
    }

    return out.sort((a, b) => b.priority - a.priority);
  }, [ctx, recurring.data]);

  const urgentCount = insights.filter((item) => item.tone === "danger" || item.tone === "warning").length;

  return <div className="space-y-5 pb-8">
    <header className="rounded-3xl bg-violet-grad p-5 text-primary-foreground shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary-foreground/70"><Sparkles className="h-4 w-4" /> Wealthpilot intelligence</div>
          <h1 className="mt-2 font-display text-2xl">Smart Insights</h1>
          <p className="mt-1 max-w-md text-sm text-primary-foreground/80">Clear, explainable observations from your live accounts, debts, budget, bills, and subscriptions.</p>
        </div>
        <div className="rounded-full bg-white/15 px-3 py-1 text-xs">{urgentCount} need attention</div>
      </div>
    </header>

    {(ctx.loading || recurring.isLoading) && <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Reading your latest financial data…</div>}

    {!ctx.loading && !recurring.isLoading && <section className="space-y-3">
      {insights.map((insight) => {
        const Icon = insight.icon;
        const toneClass = insight.tone === "danger" ? "border-destructive/40 bg-destructive/10" : insight.tone === "warning" ? "border-warning/40 bg-warning/10" : insight.tone === "positive" ? "border-success/30 bg-success/10" : "border-border bg-card";
        const iconClass = insight.tone === "danger" ? "text-destructive" : insight.tone === "warning" ? "text-warning" : insight.tone === "positive" ? "text-success" : "text-accent";
        return <article key={insight.id} className={`rounded-2xl border p-4 ${toneClass}`}>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background/70"><Icon className={`h-5 w-5 ${iconClass}`} /></div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">{insight.title}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.body}</p>
              <Link to={insight.to} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent">{insight.action} <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </article>;
      })}
      {!insights.length && <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><Lightbulb className="mx-auto h-6 w-6 text-accent" /><div className="mt-2 text-sm font-medium">No insights yet</div><p className="mt-1 text-xs text-muted-foreground">Add accounts, debts, transactions, bills, or subscriptions to generate useful observations.</p></div>}
    </section>}

    <p className="text-center text-[10px] leading-4 text-muted-foreground">Insights are deterministic calculations from saved app data. They are not a credit score or financial-product recommendation.</p>
  </div>;
}
