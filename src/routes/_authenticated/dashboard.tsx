import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Eye,
  EyeOff,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  WalletCards,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { dateShort, daysUntil, greetingFor, money } from "@/lib/format";
import {
  CASH_BUFFER,
  CC_TARGET,
  availableAboveBuffer,
  carLoanBalance,
  highInterestDebt,
  netWorth,
  paydayPlan,
  priorityOrder,
  todayAction,
  totalCash,
  totalRetirement,
  urgentActions,
  utilization,
} from "@/lib/coach";
import { financialHealth } from "@/lib/financial-health";
import { AnimatedMoney, AnimatedNumber } from "@/components/ui/animated-number";
import { PayoffOutlookCard } from "@/components/payoff-outlook-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Center — Wealthpilot" },
      {
        name: "description",
        content:
          "Your live financial command center with cash, debt, goals, bills, and next actions.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const [showPlan, setShowPlan] = useState(false);
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);

  if (ctx.loading) return <DashboardSkeleton />;
  if (ctx.error) return <DashboardError onRetry={() => void ctx.refetch()} />;

  const hasFinancialData =
    ctx.accounts.length > 0 ||
    ctx.debts.length > 0 ||
    ctx.budget.length > 0 ||
    ctx.transactions.length > 0 ||
    ctx.goals.length > 0;

  if (!hasFinancialData) return <DashboardEmptyState />;

  const cash = totalCash(ctx);
  const hi = highInterestDebt(ctx);
  const retirement = totalRetirement(ctx);
  const currentNetWorth = netWorth(ctx);
  const above = availableAboveBuffer(ctx);
  const urgent = urgentActions(ctx);
  const health = financialHealth(ctx);
  const prio = priorityOrder(ctx)
    .filter((debt) => debt.kind !== "car_loan")
    .slice(0, 2);
  const upcomingReminders = ctx.reminders.filter((reminder) => !reminder.completed).slice(0, 3);
  const topGoal = [...ctx.goals].sort(
    (a, b) =>
      Number(b.current_amount || 0) / Math.max(1, Number(b.target_amount || 1)) -
      Number(a.current_amount || 0) / Math.max(1, Number(a.target_amount || 1)),
  )[0];
  const topGoalProgress = topGoal
    ? Math.min(
        100,
        Math.round(
          (Number(topGoal.current_amount || 0) / Math.max(1, Number(topGoal.target_amount || 1))) *
            100,
        ),
      )
    : 0;
  const assetTotal = ctx.accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const liabilityTotal = ctx.debts.reduce(
    (sum, debt) => sum + Number(debt.balance || 0) + Number(debt.pending || 0),
    0,
  );
  const compositionTotal = Math.max(1, Math.max(0, assetTotal) + Math.max(0, liabilityTotal));
  const assetShare = Math.round((Math.max(0, assetTotal) / compositionTotal) * 100);
  const displayMoney = (value: number) => (hideBalances ? "••••••" : money(value));
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const bufferProtected = cash >= CASH_BUFFER;

  const quickActions = [
    {
      to: "/bill-calendar",
      label: "Bills",
      caption: "See what is due",
      icon: CalendarClock,
      tone: "text-accent",
    },
    {
      to: "/scenario-planner",
      label: "Scenario",
      caption: "Test a decision",
      icon: Gauge,
      tone: "text-primary-glow",
    },
    {
      to: "/net-worth",
      label: "Net worth",
      caption: "Track your position",
      icon: WalletCards,
      tone: "text-success",
    },
    {
      to: "/goals",
      label: "Goals",
      caption: "Move a milestone",
      icon: Target,
      tone: "text-warning",
    },
  ] as const;

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Command center · {dateLabel}</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">
            {greetingFor("Abhay")}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Your live position, the signal that matters, and the next move worth making.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setHideBalances((value) => !value)}
          aria-label={hideBalances ? "Show balances" : "Hide balances"}
          aria-pressed={hideBalances}
          className="mt-1 shrink-0 rounded-2xl"
        >
          {hideBalances ? <EyeOff /> : <Eye />}
        </Button>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/18 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-60 w-60 rounded-full bg-primary/16 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
              <Zap className="h-3.5 w-3.5 text-accent" /> Cash above buffer
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold ${
                bufferProtected
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-warning/20 bg-warning/10 text-warning"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${bufferProtected ? "bg-success" : "bg-warning"}`}
              />
              {bufferProtected ? "Buffer protected" : "Build your buffer"}
            </div>
          </div>

          <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)] lg:items-end lg:gap-8">
            <div className="min-w-0">
              <AnimatedMoney
                value={above}
                hidden={hideBalances}
                className="numeric-display block truncate font-display text-[3.35rem] leading-none text-foreground sm:text-7xl"
              />
              <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                After protecting your {displayMoney(CASH_BUFFER)} cash buffer. Confirm upcoming
                obligations before treating this as spendable cash.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 lg:mt-0">
              <Button asChild size="lg" className="rounded-2xl">
                <Link to="/payday">
                  Plan next pay <ArrowRight className="ml-1" />
                </Link>
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="rounded-2xl"
                onClick={() => setShowPlan((value) => !value)}
                aria-expanded={showPlan}
              >
                Quick plan
                <ChevronDown
                  className={`ml-1 transition-transform duration-200 ${showPlan ? "rotate-180" : ""}`}
                />
              </Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: "Cash", value: cash, tone: "text-foreground", icon: CircleDollarSign },
              {
                label: "Card debt",
                value: hi,
                tone: hi > 0 ? "text-destructive" : "text-success",
                icon: TrendingDown,
              },
              {
                label: "Net worth",
                value: currentNetWorth,
                tone: currentNetWorth >= 0 ? "text-success" : "text-warning",
                icon: TrendingUp,
              },
              { label: "Retirement", value: retirement, tone: "text-accent", icon: ShieldCheck },
            ].map(({ label, value, tone, icon: Icon }) => (
              <div
                key={label}
                className="group/metric min-w-0 rounded-2xl border border-white/[0.08] bg-black/10 p-3.5 backdrop-blur-xl transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-white/[0.14] motion-safe:hover:bg-white/[0.055]"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{label}</span>
                  <Icon className="h-3.5 w-3.5 opacity-65 transition group-hover/metric:opacity-100" />
                </div>
                <AnimatedMoney
                  value={value}
                  hidden={hideBalances}
                  className={`numeric-display mt-2 block truncate font-display text-xl sm:text-2xl ${tone}`}
                />
              </div>
            ))}
          </div>

          {showPlan && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 rounded-2xl border border-white/[0.09] bg-black/15 p-4 backdrop-blur-xl duration-300">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Recommended split
                </div>
                <Link
                  to="/payday"
                  className="text-xs font-semibold text-accent hover:text-accent/80"
                >
                  Open planner
                </Link>
              </div>
              <div className="mt-2 divide-y divide-white/[0.07]">
                {paydayPlan(ctx).map((line, index) => (
                  <div
                    key={index}
                    className="py-2.5 text-xs leading-5 text-muted-foreground sm:text-sm"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <PayoffOutlookCard debts={ctx.debts} basePayment={CC_TARGET} hidden={hideBalances} />

      <section aria-labelledby="today-heading">
        <SectionHeading
          eyebrow="Today"
          title="What deserves your attention"
          description="One recommendation first, everything else second."
          id="today-heading"
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/[0.12] via-card to-card p-5 shadow-card sm:p-6">
            <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-accent/12 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-accent/15 bg-accent/12 text-accent shadow-[0_0_28px_-16px_var(--accent)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="eyebrow !text-accent">Wealthpilot signal</div>
                <h2 className="mt-1.5 font-display text-2xl leading-tight">
                  Your smartest next move
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{todayAction(ctx)}</p>
                <Link
                  to="/assistant"
                  className="ui-button mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/15 bg-accent/10 px-3.5 text-sm font-semibold text-accent hover:bg-accent/15"
                >
                  Ask Copilot <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </article>

          <article
            className={`rounded-3xl border p-5 shadow-card sm:p-6 ${
              urgent.length
                ? "border-warning/18 bg-gradient-to-br from-warning/[0.08] to-card"
                : "border-success/18 bg-gradient-to-br from-success/[0.08] to-card"
            }`}
          >
            <div className="flex h-full flex-col">
              <div
                className={`grid h-10 w-10 place-items-center rounded-2xl ${urgent.length ? "bg-warning/12 text-warning" : "bg-success/12 text-success"}`}
              >
                {urgent.length ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </div>
              <div className="mt-4 text-sm font-semibold">
                {urgent.length
                  ? `${urgent.length} item${urgent.length === 1 ? "" : "s"} need attention`
                  : "You are clear today"}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {urgent.length
                  ? urgent[0].text
                  : "No urgent debt, utilization, or near-due payment flag is active."}
              </p>
              {urgent.length > 0 && (
                <Link
                  to="/debts"
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-warning"
                >
                  Review pressure points <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </article>
        </div>
      </section>

      <section
        className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]"
        aria-label="Financial health and quick actions"
      >
        <article className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-card p-5 shadow-card sm:p-6">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/8 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  <ShieldCheck className="h-4 w-4" /> Financial health
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <AnimatedNumber
                    value={health.score}
                    className="font-display text-5xl leading-none"
                  />
                  <span className="pb-1 text-sm text-muted-foreground">/ 100 · {health.label}</span>
                </div>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  {health.nextBestAction}
                </p>
              </div>
              <div
                className="relative grid h-[5.5rem] w-[5.5rem] shrink-0 place-items-center rounded-full p-[6px] shadow-[0_0_36px_-20px_var(--accent)] sm:h-24 sm:w-24"
                style={{
                  background: `conic-gradient(var(--accent) ${health.score * 3.6}deg, var(--secondary) 0deg)`,
                }}
                role="img"
                aria-label={`Financial health score ${health.score} out of 100`}
              >
                <div className="grid h-full w-full place-items-center rounded-full border border-white/[0.06] bg-card/95">
                  <span className="font-mono text-base font-semibold text-accent">
                    {health.score}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-700 ease-out"
                style={{ width: `${health.score}%` }}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowHealthDetails((value) => !value)}
              aria-expanded={showHealthDetails}
              className="mt-4 flex min-h-11 w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3.5 text-left text-xs font-semibold text-muted-foreground transition hover:border-white/[0.1] hover:bg-white/[0.045] hover:text-foreground active:scale-[0.99]"
            >
              See what shapes your score
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${showHealthDetails ? "rotate-180" : ""}`}
              />
            </button>

            {showHealthDetails && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-1 space-y-2 duration-300">
                {health.factors.map((factor) => {
                  const percent = Math.round((factor.score / factor.max) * 100);
                  return (
                    <div
                      key={factor.label}
                      className="rounded-2xl border border-white/[0.055] bg-white/[0.022] p-3.5"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium">{factor.label}</span>
                        <span
                          className={
                            factor.tone === "good"
                              ? "text-success"
                              : factor.tone === "watch"
                                ? "text-warning"
                                : "text-destructive"
                          }
                        >
                          {factor.score}/{factor.max}
                        </span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${factor.tone === "good" ? "bg-success" : factor.tone === "watch" ? "bg-warning" : "bg-destructive"}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <Link
                  to="/financial-health"
                  className="inline-flex min-h-10 items-center gap-1 px-1 text-xs font-semibold text-accent"
                >
                  Full score breakdown <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-white/[0.08] bg-card p-5 shadow-card sm:p-6">
          <div className="eyebrow">Position map</div>
          <h2 className="mt-1.5 font-display text-2xl">Assets vs. liabilities</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            A quick read on what you own versus what you owe.
          </p>
          <div className="mt-6 overflow-hidden rounded-full bg-secondary p-1">
            <div className="flex h-3 overflow-hidden rounded-full">
              <div
                className="bg-gradient-to-r from-success to-accent transition-[width] duration-700 ease-out"
                style={{ width: `${assetShare}%` }}
                aria-hidden="true"
              />
              <div
                className="flex-1 bg-gradient-to-r from-warning/75 to-destructive/80"
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-success/[0.055] p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Assets
              </div>
              <div className="numeric-display mt-2 truncate font-display text-xl">
                {displayMoney(assetTotal)}
              </div>
            </div>
            <div className="rounded-2xl bg-destructive/[0.055] p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Liabilities
              </div>
              <div className="numeric-display mt-2 truncate font-display text-xl">
                {displayMoney(liabilityTotal)}
              </div>
            </div>
          </div>
          <Link
            to="/net-worth"
            className="mt-4 inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-accent"
          >
            Open net worth <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </article>
      </section>

      <section aria-labelledby="quick-actions-heading">
        <SectionHeading
          eyebrow="Navigate"
          title="Move quickly"
          description="Swipe on mobile or jump straight into a decision tool."
          id="quick-actions-heading"
        />
        <div className="-mx-4 mt-4 grid snap-x snap-mandatory grid-flow-col auto-cols-[76%] gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid-flow-row sm:grid-cols-4 sm:auto-cols-auto sm:overflow-visible sm:px-0">
          {quickActions.map(({ to, label, caption, icon: Icon, tone }) => (
            <Link
              key={to}
              to={to}
              className="group snap-start rounded-3xl border border-white/[0.075] bg-card p-4 shadow-card transition duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:border-accent/25 motion-safe:hover:shadow-elevated active:scale-[0.98]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.055] bg-secondary/65">
                  <Icon className={`h-5 w-5 ${tone}`} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent" />
              </div>
              <div className="mt-5 text-sm font-semibold">{label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{caption}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2" aria-label="Goals and debt priorities">
        {topGoal ? (
          <article className="rounded-3xl border border-white/[0.08] bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="eyebrow">Closest goal</div>
                <h2 className="mt-1.5 truncate text-base font-semibold">{topGoal.name}</h2>
              </div>
              <div className="font-display text-3xl text-accent">{topGoalProgress}%</div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-700 ease-out"
                style={{ width: `${topGoalProgress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{displayMoney(Number(topGoal.current_amount))} saved</span>
              <span>{displayMoney(Number(topGoal.target_amount))} target</span>
            </div>
            <Link
              to="/goals"
              className="mt-4 inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-accent"
            >
              View goal <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </article>
        ) : (
          <article className="rounded-3xl border border-dashed border-white/[0.09] bg-card/65 p-5 shadow-card sm:p-6">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/10 text-accent">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="mt-4 text-sm font-semibold">Give your surplus a destination</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Add a goal to turn future savings into visible progress here.
            </p>
            <Link
              to="/goals"
              className="mt-4 inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-accent"
            >
              Create a goal <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </article>
        )}

        <article className="rounded-3xl border border-white/[0.08] bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Debt focus</div>
              <h2 className="mt-1.5 text-base font-semibold">Priority balances</h2>
            </div>
            <Link to="/debts" className="text-xs font-semibold text-accent">
              View all
            </Link>
          </div>

          {prio.length > 0 ? (
            <div className="mt-4 space-y-2.5">
              {prio.map((debt) => {
                const used = utilization(debt);
                const balance = Number(debt.balance) + Number(debt.pending || 0);
                return (
                  <Link
                    to="/debts"
                    key={debt.id}
                    className="group block rounded-2xl border border-white/[0.055] bg-white/[0.025] p-3.5 transition hover:border-accent/20 hover:bg-white/[0.04] active:scale-[0.99]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="truncate text-sm font-medium">{debt.name}</div>
                      <div className="numeric-display shrink-0 font-display text-lg">
                        {displayMoney(balance)}
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{Number(debt.apr).toFixed(2)}% APR</span>
                      {debt.credit_limit && (
                        <span
                          className={
                            used >= 1 ? "text-destructive" : used >= 0.8 ? "text-warning" : ""
                          }
                        >
                          {Math.round(used * 100)}% used
                        </span>
                      )}
                      {debt.due_date && (
                        <span>
                          Due {dateShort(debt.due_date)} · {daysUntil(debt.due_date)}d
                        </span>
                      )}
                      {debt.status === "past_due" && (
                        <span className="font-semibold text-destructive">Past due</span>
                      )}
                    </div>
                    {debt.credit_limit && (
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${used >= 1 ? "bg-destructive" : used >= 0.8 ? "bg-warning" : "bg-accent"}`}
                          style={{ width: `${Math.min(100, used * 100)}%` }}
                        />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-success/[0.055] p-4 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div>
                <span className="font-medium">No priority high-interest balance.</span>
                <div className="mt-1 text-xs text-muted-foreground">
                  Your debt focus area is clear based on current data.
                </div>
              </div>
            </div>
          )}
        </article>
      </section>

      <section
        className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]"
        aria-label="Upcoming items and long-term position"
      >
        <article className="rounded-3xl border border-white/[0.08] bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Ahead</div>
              <h2 className="mt-1.5 text-base font-semibold">Upcoming</h2>
            </div>
            <Link to="/automations" className="text-xs font-semibold text-accent">
              Automations
            </Link>
          </div>
          {upcomingReminders.length > 0 ? (
            <div className="mt-4 divide-y divide-white/[0.06]">
              {upcomingReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex min-h-14 items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{reminder.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(reminder.due_at).toLocaleDateString("en-CA", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full border border-white/[0.06] bg-secondary/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {reminder.recurrence}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white/[0.025] p-4 text-xs leading-5 text-muted-foreground">
              Nothing is scheduled here yet. Add a reminder when a money task should come back to
              you automatically.
            </div>
          )}
        </article>

        <article className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-card to-primary/[0.055] p-5 shadow-card sm:p-6">
          <div className="pointer-events-none absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-accent" /> Long-term position
            </div>
            <div className="mt-3">
              <AnimatedMoney
                value={currentNetWorth}
                hidden={hideBalances}
                className="numeric-display font-display text-4xl"
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Cash and tracked assets minus every debt, including car loan{" "}
              {displayMoney(carLoanBalance(ctx))}.
            </p>
            <Link
              to="/net-worth"
              className="mt-4 inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-accent"
            >
              See full position <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h2 id={id} className="mt-1.5 font-display text-2xl leading-tight sm:text-3xl">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-10 pt-1" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <div className="shimmer h-3 w-36 rounded-full bg-secondary/70" />
        <div className="shimmer h-10 w-64 rounded-2xl bg-secondary/65" />
        <div className="shimmer h-4 w-80 max-w-full rounded-full bg-secondary/45" />
      </div>
      <div className="shimmer h-[25rem] rounded-[2rem] border border-white/[0.05] bg-secondary/55 sm:h-80" />
      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="shimmer h-52 rounded-3xl bg-secondary/45" />
        <div className="shimmer h-52 rounded-3xl bg-secondary/40" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="shimmer h-60 rounded-3xl bg-secondary/40" />
        <div className="shimmer h-60 rounded-3xl bg-secondary/35" />
      </div>
      <span className="sr-only">Loading your Wealthpilot command center.</span>
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[62vh] items-center justify-center py-12">
      <section className="ui-card w-full max-w-lg rounded-[2rem] border border-destructive/15 bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="eyebrow mt-5">Live data interrupted</div>
        <h1 className="mt-2 font-display text-3xl">Your dashboard did not refresh</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Wealthpilot could not load one or more financial data sources. Your saved data has not
          been changed.
        </p>
        <Button type="button" size="lg" onClick={onRetry} className="mt-6 rounded-2xl">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </section>
    </div>
  );
}

function DashboardEmptyState() {
  return (
    <div className="space-y-6 pb-10 pt-1">
      <header>
        <div className="eyebrow">Command center</div>
        <h1 className="mt-2 font-display text-4xl leading-none">Welcome to Wealthpilot.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add your first financial signal and this page will turn into your live money map.
        </p>
      </header>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.1] bg-hero p-6 shadow-elevated sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/16 blur-3xl" />
        <div className="relative max-w-xl">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.07] text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-5 font-display text-3xl">Build your financial command center</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Start with accounts and balances, or import a statement. Wealthpilot will use the same
            live data to shape cash, debt, goals, and Financial Health here.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="rounded-2xl">
              <Link to="/settings">
                Add financial data <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl">
              <Link to="/uploads">
                <Upload /> Import statement
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
