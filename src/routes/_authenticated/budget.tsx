import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  PiggyBank,
  RefreshCw,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { daysInMonthLeft, money, parseLocalDate } from "@/lib/format";
import { countsAsSpend, spendAmount } from "@/lib/coach";
import { useBudget, useTransactions } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({
    meta: [
      { title: "Budget — Wealthpilot" },
      {
        name: "description",
        content: "Your live monthly spending plan, category pace, and remaining room.",
      },
    ],
  }),
  component: BudgetPage,
});

type BudgetView = "spending" | "debt" | "savings" | "income" | "transfers";

type BudgetRow = {
  id: string;
  name: string;
  planned: number;
  actual: number;
  remaining: number;
  pct: number;
  kind: string;
};

function BudgetPage() {
  const { user } = useAuth();
  const budgetQuery = useBudget(user?.id);
  const transactionsQuery = useTransactions(user?.id);
  const [view, setView] = useState<BudgetView>("spending");
  const [showAll, setShowAll] = useState(false);

  const cats = budgetQuery.data ?? [];
  const tx = transactionsQuery.data ?? [];
  const daysLeft = daysInMonthLeft();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthName = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" }).format(
    now,
  );
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsedPct = Math.min(100, (now.getDate() / daysInMonth) * 100);

  // Bucket spending by category in a single pass.
  //
  // This previously scanned the whole transaction list once per category,
  // re-parsing every date each time — O(categories x transactions) on every
  // render, repeated whenever a tab or "show all" toggled. One pass and a
  // lookup gives the same numbers for a fraction of the work.
  const monthStartMs = monthStart.getTime();
  const rows: BudgetRow[] = useMemo(() => {
    const spentByCategory = new Map<string, number>();
    for (const transaction of tx) {
      if (!countsAsSpend(transaction)) continue;
      if (parseLocalDate(transaction.occurred_on).getTime() < monthStartMs) continue;
      const key = transaction.category ?? "";
      spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + spendAmount(transaction));
    }

    return cats.map((category) => {
      const actual = spentByCategory.get(category.name) ?? 0;
      const planned = Number(category.planned);
      return {
        ...category,
        planned,
        actual,
        remaining: planned - actual,
        pct: planned > 0 ? Math.min(100, (actual / planned) * 100) : 0,
      };
    });
  }, [cats, tx, monthStartMs]);

  // Card payments are tracked separately from spending on purpose.
  //
  // A purchase put on a card is already counted as an expense in its own
  // category the day it is charged. Counting the payment that later clears
  // that card as spending too would count the same money twice — $350 of
  // groceries plus a $500 card payment reported $850 spent when $500 left
  // the account. Paying a card moves cash against a liability; it is not new
  // spending, so it gets its own block with its own monthly target.
  const expenses = rows.filter((row) => row.kind === "expense");
  const debtPayments = rows.filter((row) => row.kind === "debt");
  const savings = rows.filter((row) => row.kind === "savings");
  const transfers = rows.filter((row) => row.kind === "transfer");
  const income = rows.filter((row) => row.kind === "income");
  const spent = expenses.reduce((sum, row) => sum + row.actual, 0);
  const plannedTotal = expenses.reduce((sum, row) => sum + row.planned, 0);
  const debtPaid = debtPayments.reduce((sum, row) => sum + row.actual, 0);
  const debtPlanned = debtPayments.reduce((sum, row) => sum + row.planned, 0);
  const remaining = plannedTotal - spent;
  const spentPct = plannedTotal > 0 ? (spent / plannedTotal) * 100 : 0;
  const dailyRoom = daysLeft > 0 ? Math.max(0, remaining) / daysLeft : Math.max(0, remaining);
  const overCount = expenses.filter((row) => row.planned > 0 && row.actual > row.planned).length;
  const paceDelta = spentPct - elapsedPct;
  const paceLabel =
    remaining < 0
      ? "Over plan"
      : paceDelta > 7
        ? "Watch pace"
        : spentPct > 0
          ? "On track"
          : "Ready";
  const paceTone =
    remaining < 0
      ? "border-destructive/25 bg-destructive/10 text-destructive"
      : paceDelta > 7
        ? "border-warning/25 bg-warning/10 text-warning"
        : "border-success/25 bg-success/10 text-success";

  if (!user || budgetQuery.isLoading || transactionsQuery.isLoading) return <BudgetSkeleton />;

  if (budgetQuery.error || transactionsQuery.error) {
    return (
      <BudgetError
        onRetry={() => {
          void Promise.all([budgetQuery.refetch(), transactionsQuery.refetch()]);
        }}
      />
    );
  }

  if (cats.length === 0) return <BudgetEmptyState />;

  const groups: Record<BudgetView, BudgetRow[]> = {
    spending: expenses,
    debt: debtPayments,
    savings,
    income,
    transfers,
  };
  const activeRows = groups[view];
  const visibleRows = showAll ? activeRows : activeRows.slice(0, 5);
  const topCategory = [...expenses].sort((a, b) => b.actual - a.actual)[0];

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="pt-1">
        <div className="eyebrow">Monthly plan · {monthName}</div>
        <h1 className="mt-2 font-display text-[2.25rem] leading-none tracking-[-0.035em] sm:text-5xl">
          Budget with breathing room.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          See what is already spoken for, where spending is moving fastest, and what remains safe
          for the rest of the month.
        </p>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-60 w-60 rounded-full bg-accent/12 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
              <WalletCards className="h-3.5 w-3.5 text-accent" /> Spending room
            </div>
            <div
              className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold ${paceTone}`}
            >
              {paceLabel}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(15rem,0.8fr)] lg:items-end">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {remaining >= 0 ? "Left this month" : "Over monthly plan"}
              </div>
              <div
                className={`numeric-display mt-1 font-display text-[3.35rem] leading-none sm:text-7xl ${remaining < 0 ? "text-destructive" : "text-foreground"}`}
              >
                {money(Math.abs(remaining))}
              </div>
              <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                {remaining >= 0
                  ? `${money(dailyRoom)} per day across the ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining, if you want to stay inside the plan.`
                  : `Spending has moved ${money(Math.abs(remaining))} past the monthly expense plan. Review the fastest-moving categories below.`}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/[0.08] bg-black/10 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(spentPct)}% used</span>
                <span>{Math.round(elapsedPct)}% of month</span>
              </div>
              <Progress
                value={Math.min(100, spentPct)}
                className={`mt-3 h-2.5 ${remaining < 0 ? "[&>*]:bg-destructive" : paceDelta > 7 ? "[&>*]:bg-warning" : "[&>*]:bg-accent"}`}
              />
              <div className="mt-3 flex items-center gap-2 text-xs leading-5 text-muted-foreground">
                {remaining >= 0 && paceDelta <= 7 ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <AlertTriangle
                    className={`h-4 w-4 shrink-0 ${remaining < 0 ? "text-destructive" : "text-warning"}`}
                  />
                )}
                {overCount > 0
                  ? `${overCount} categor${overCount === 1 ? "y is" : "ies are"} over plan.`
                  : "No expense category is over plan."}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2.5">
            <Metric label="Planned" value={money(plannedTotal)} />
            <Metric label="Spent" value={money(spent)} />
            <Metric
              label="Daily room"
              value={money(dailyRoom)}
              tone={remaining < 0 ? "text-destructive" : "text-accent"}
            />
          </div>
        </div>
      </section>

      {debtPayments.length > 0 && (
        <section className="rounded-[1.6rem] border border-white/[0.08] bg-card/70 p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow">Card payments</div>
              <div className="numeric-display mt-2 font-display text-3xl leading-none">
                {money(debtPaid)}
                <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
                  of {money(debtPlanned)} planned
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {debtPlanned > 0
                ? `${Math.round((debtPaid / debtPlanned) * 100)}% of target`
                : "No target set"}
            </div>
          </div>

          <Progress
            value={debtPlanned > 0 ? Math.min(100, (debtPaid / debtPlanned) * 100) : 0}
            className="mt-4 h-2.5 [&>*]:bg-primary"
          />

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Kept out of the spending total above. A purchase on a card is already counted as an
            expense when you charge it, so counting the payment that clears the card as spending too
            would count the same money twice.
          </p>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Plan detail</div>
            <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">
              Where the month is going
            </h2>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/activity">
              Activity <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="scrollbar-none -mx-1 mt-4 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {(
            [
              ["spending", "Spending", expenses.length],
              ["debt", "Card payments", debtPayments.length],
              ["savings", "Savings", savings.length],
              ["income", "Income", income.length],
              ["transfers", "Transfers", transfers.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setView(key);
                setShowAll(false);
              }}
              className={`min-h-11 shrink-0 snap-start rounded-full border px-4 text-xs font-semibold transition active:scale-[0.98] ${
                view === key
                  ? "border-primary/35 bg-primary/15 text-foreground shadow-card"
                  : "border-border/80 bg-card/55 text-muted-foreground hover:bg-card"
              }`}
              aria-pressed={view === key}
            >
              {label} <span className="ml-1 opacity-60">{count}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2.5">
          {visibleRows.map((row) => (
            <BudgetCategoryCard key={row.id} row={row} muted={view === "transfers"} />
          ))}
          {activeRows.length === 0 && (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-card/35 p-6 text-center text-sm text-muted-foreground">
              No {view} categories are in this plan yet.
            </div>
          )}
        </div>

        {activeRows.length > 5 && (
          <Button
            type="button"
            variant="ghost"
            className="mt-2 w-full rounded-2xl"
            onClick={() => setShowAll((value) => !value)}
            aria-expanded={showAll}
          >
            {showAll ? "Show fewer" : `Show all ${activeRows.length}`}
            <ChevronDown
              className={`transition-transform duration-200 ${showAll ? "rotate-180" : ""}`}
            />
          </Button>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-[1.65rem] border border-border bg-card p-5 shadow-card">
          <Sparkles className="h-5 w-5 text-primary-glow" />
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Spending signal
          </div>
          <h3 className="mt-1 font-display text-2xl">
            {topCategory && topCategory.actual > 0 ? topCategory.name : "Your month is still quiet"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {topCategory && topCategory.actual > 0
              ? `${money(topCategory.actual)} is your highest tracked category this month${topCategory.planned > 0 ? `, using ${Math.round((topCategory.actual / topCategory.planned) * 100)}% of its plan` : ""}.`
              : "Transactions will surface your fastest-moving category here as the month develops."}
          </p>
        </div>

        <Link
          to="/goals"
          className="group rounded-[1.65rem] border border-border bg-gradient-to-br from-primary/12 via-card to-accent/[0.06] p-5 shadow-card transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-primary/30"
        >
          <PiggyBank className="h-5 w-5 text-accent" />
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Put the surplus to work
          </div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h3 className="font-display text-2xl">Move a goal forward</h3>
            <ArrowRight className="mb-1 h-5 w-5 text-accent transition-transform group-hover:translate-x-1" />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            See which active milestone is closest and keep leftover room intentional.
          </p>
        </Link>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/10 p-3.5 backdrop-blur-xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={`numeric-display mt-1.5 truncate font-display text-lg sm:text-xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function BudgetCategoryCard({ row, muted }: { row: BudgetRow; muted?: boolean }) {
  const over = row.planned > 0 && row.actual > row.planned;
  const complete = row.planned > 0 && row.pct >= 100 && !over;
  return (
    <div
      className={`group rounded-[1.35rem] border border-border bg-card/82 p-4 shadow-card transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-white/[0.14] ${muted ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${over ? "bg-destructive" : complete ? "bg-success" : "bg-primary"}`}
            />
            <div className="truncate text-sm font-semibold">{row.name}</div>
          </div>
          <div
            className={`mt-1.5 pl-4 text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}
          >
            {row.planned === 0
              ? row.actual > 0
                ? `${money(row.actual)} tracked · no plan set`
                : "No amount planned"
              : over
                ? `${money(-row.remaining)} over plan`
                : `${money(row.remaining)} remaining`}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="numeric-display font-display text-xl">{money(row.actual)}</div>
          <div className="text-[10px] text-muted-foreground">of {money(row.planned)}</div>
        </div>
      </div>
      {row.planned > 0 && (
        <div className="mt-3 pl-4">
          <Progress
            value={row.pct}
            className={`h-1.5 ${over ? "[&>*]:bg-destructive" : complete ? "[&>*]:bg-success" : ""}`}
          />
        </div>
      )}
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="space-y-7 pb-10" aria-busy="true" aria-label="Loading budget">
      <div className="space-y-3 pt-1">
        <div className="skeleton-shimmer h-3 w-36 rounded-full bg-muted" />
        <div className="skeleton-shimmer h-10 w-72 max-w-[80vw] rounded-xl bg-muted" />
        <div className="skeleton-shimmer h-4 w-full max-w-lg rounded bg-muted" />
      </div>
      <div className="skeleton-shimmer h-80 rounded-[2rem] bg-card" />
      <div className="grid gap-3">
        <div className="skeleton-shimmer h-20 rounded-[1.35rem] bg-card" />
        <div className="skeleton-shimmer h-20 rounded-[1.35rem] bg-card" />
        <div className="skeleton-shimmer h-20 rounded-[1.35rem] bg-card" />
      </div>
    </div>
  );
}

function BudgetError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-destructive/20 bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle />
        </div>
        <div className="eyebrow mt-5 text-destructive">Budget data interrupted</div>
        <h1 className="mt-2 font-display text-3xl">Your plan did not refresh.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Wealthpilot could not load your categories or activity. Your saved budget has not been
          changed.
        </p>
        <Button type="button" onClick={onRetry} className="mt-5 rounded-2xl">
          <RefreshCw /> Try again
        </Button>
      </div>
    </div>
  );
}

function BudgetEmptyState() {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary-glow">
          <CircleDollarSign />
        </div>
        <div className="eyebrow mt-5">Monthly plan</div>
        <h1 className="mt-2 font-display text-3xl">Give every dollar a lane.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Your budget categories will appear here once your Wealthpilot plan has been set up.
        </p>
        <Button asChild variant="outline" className="mt-5 rounded-2xl">
          <Link to="/activity">
            Review activity <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
