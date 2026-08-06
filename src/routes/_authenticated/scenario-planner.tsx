import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Car,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Eye,
  EyeOff,
  Gauge,
  Laptop,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/_authenticated/scenario-planner")({
  head: () => ({
    meta: [
      { title: "Scenario Planner — Wealthpilot" },
      {
        name: "description",
        content:
          "Compare baseline, expected, better, and stress outcomes for purchases, extra income, debt payments, and surprise costs.",
      },
    ],
  }),
  component: ScenarioPlannerPage,
});

type ScenarioType = "purchase" | "income" | "debt" | "expense";
type ForecastStatus = "Safe" | "Tight" | "Risk";
type AccountRow = { kind: string; balance: number | string };
type RecurringRow = {
  amount: number | string;
  kind: string;
  next_due_date: string;
  is_active: boolean;
};

type ScenarioOption = {
  type: ScenarioType;
  title: string;
  description: string;
  defaultLabel: string;
  defaultAmount: number;
  icon: LucideIcon;
};

type Projection = {
  projected: number;
  lowest: number;
  safeToSpend: number;
  status: ForecastStatus;
};

const CASH_KINDS = new Set(["chequing", "savings", "money_master", "cash"]);
const BUFFER = 500;
const plannerDb = supabase as unknown as SupabaseClient;

const scenarioOptions: ScenarioOption[] = [
  {
    type: "purchase",
    title: "Purchase",
    description: "Can I afford it?",
    defaultLabel: "New device",
    defaultAmount: 800,
    icon: Laptop,
  },
  {
    type: "income",
    title: "Extra income",
    description: "Overtime or bonus",
    defaultLabel: "Overtime income",
    defaultAmount: 700,
    icon: TrendingUp,
  },
  {
    type: "debt",
    title: "Debt payment",
    description: "Pay extra today",
    defaultLabel: "Extra debt payment",
    defaultAmount: 500,
    icon: CreditCard,
  },
  {
    type: "expense",
    title: "Surprise cost",
    description: "Test an emergency",
    defaultLabel: "Unexpected car repair",
    defaultAmount: 1000,
    icon: Car,
  },
];

function money(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function classify(lowest: number): ForecastStatus {
  if (lowest < 0) return "Risk";
  if (lowest < BUFFER) return "Tight";
  return "Safe";
}

function ScenarioPlannerPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [type, setType] = useState<ScenarioType>("purchase");
  const [amount, setAmount] = useState(500);
  const [label, setLabel] = useState("Optional purchase");
  const [daysFromNow, setDaysFromNow] = useState(0);
  const [sensitivity, setSensitivity] = useState(25);
  const [balancesHidden, setBalancesHidden] = useState(false);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      const [accountResult, recurringResult] = await Promise.all([
        plannerDb.from("accounts").select("kind,balance").eq("user_id", userId),
        plannerDb
          .from("recurring_transactions")
          .select("amount,kind,next_due_date,is_active")
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

      if (cancelled) return;
      if (accountResult.error || recurringResult.error) {
        setLoadError(
          accountResult.error?.message ||
            recurringResult.error?.message ||
            "We couldn't load the planning sources.",
        );
        setLoading(false);
        return;
      }

      setAccounts((accountResult.data ?? []) as AccountRow[]);
      setRecurring((recurringResult.data ?? []) as RecurringRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, reloadToken]);

  const result = useMemo(() => {
    const currentCash = accounts
      .filter((account) => CASH_KINDS.has(account.kind))
      .reduce((sum, account) => sum + Number(account.balance || 0), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    const scenarioDate = new Date(today);
    scenarioDate.setDate(scenarioDate.getDate() + Math.min(30, Math.max(0, daysFromNow)));

    const baselineEvents = recurring
      .filter((item) => {
        const due = new Date(`${item.next_due_date}T00:00:00`);
        return due >= today && due <= end;
      })
      .map((item) => ({
        date: new Date(`${item.next_due_date}T00:00:00`),
        amount: Number(item.amount || 0),
        direction: item.kind === "income" ? 1 : -1,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    function project(scenarioAmount?: number): Projection {
      const scenarioEvents =
        scenarioAmount === undefined
          ? baselineEvents
          : [
              ...baselineEvents,
              {
                date: scenarioDate,
                amount: scenarioAmount,
                direction: type === "income" ? 1 : -1,
              },
            ].sort((a, b) => a.date.getTime() - b.date.getTime());

      let running = currentCash;
      let lowest = currentCash;
      for (const event of scenarioEvents) {
        running += event.amount * event.direction;
        lowest = Math.min(lowest, running);
      }
      return {
        projected: running,
        lowest,
        safeToSpend: Math.max(0, lowest - BUFFER),
        status: classify(lowest),
      };
    }

    const spread = sensitivity / 100;
    const betterAmount =
      type === "income" ? amount * (1 + spread) : amount * Math.max(0, 1 - spread);
    const stressAmount =
      type === "income" ? amount * Math.max(0, 1 - spread) : amount * (1 + spread);
    const baseline = project();
    const plan = project(amount);
    const better = project(betterAmount);
    const stress = project(stressAmount);
    const delta = plan.projected - baseline.projected;
    const scoreChange =
      plan.status === "Risk"
        ? -8
        : plan.status === "Tight"
          ? -4
          : type === "income"
            ? 3
            : type === "debt"
              ? 2
              : 0;

    return {
      currentCash,
      baseline,
      plan,
      better,
      stress,
      betterAmount,
      stressAmount,
      delta,
      scoreChange,
      scenarioDate,
      bufferAfter: plan.lowest - BUFFER,
    };
  }, [accounts, recurring, type, amount, daysFromNow, sensitivity]);

  const selectedOption =
    scenarioOptions.find((option) => option.type === type) ?? scenarioOptions[0];
  const SelectedIcon = selectedOption.icon;
  const quickAmounts = type === "income" ? [250, 500, 750, 1000] : [100, 300, 500, 1000];
  const showMoney = (value: number) => (balancesHidden ? "••••" : money(value));
  const tone = outcomeTone(result.plan.status);

  function chooseScenario(option: ScenarioOption) {
    setType(option.type);
    setLabel(option.defaultLabel);
    setAmount(option.defaultAmount);
  }

  function resetScenario() {
    setType("purchase");
    setLabel("Optional purchase");
    setAmount(500);
    setDaysFromNow(0);
    setSensitivity(25);
  }

  if (!user || loading) return <ScenarioSkeleton />;

  if (loadError) {
    return (
      <ScenarioError message={loadError} onRetry={() => setReloadToken((value) => value + 1)} />
    );
  }

  const noCashAccounts = accounts.filter((account) => CASH_KINDS.has(account.kind)).length === 0;

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Decision lab · read only</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">
            Know the range before you decide.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Test one money decision against your live 30-day baseline, then pressure-test the
            amount.
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
              <div className="eyebrow">Planner needs a starting balance</div>
              <h2 className="mt-1 font-display text-2xl">Add a cash account first</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A chequing, savings, Money Master, or cash balance gives the planner a real starting
                point for every scenario.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <div className="eyebrow">What changes?</div>
                <h2 className="mt-1 font-display text-2xl">Choose a decision</h2>
              </div>
              <button
                type="button"
                onClick={resetScenario}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {scenarioOptions.map((option) => {
                const Icon = option.icon;
                const selected = option.type === type;
                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => chooseScenario(option)}
                    aria-pressed={selected}
                    className={`group relative overflow-hidden rounded-[1.45rem] border p-4 text-left transition duration-300 active:scale-[0.98] ${
                      selected
                        ? "border-accent/55 bg-accent/[0.09] shadow-card"
                        : "border-border bg-card hover:-translate-y-0.5 hover:border-accent/30"
                    }`}
                  >
                    {selected && (
                      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
                    )}
                    <div
                      className={`grid h-10 w-10 place-items-center rounded-2xl transition ${
                        selected
                          ? "bg-accent text-accent-foreground"
                          : "bg-secondary text-accent group-hover:scale-105"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-3 text-sm font-semibold">{option.title}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.8rem] border border-border bg-card shadow-card">
            <div className="relative flex items-center gap-3 border-b border-border p-5 sm:p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                <SelectedIcon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="eyebrow">Build the plan</div>
                <h2 className="mt-0.5 font-semibold">{selectedOption.title}</h2>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-medium text-muted-foreground">
                Never saved
              </span>
            </div>

            <div className="relative space-y-6 p-5 sm:p-6">
              <div>
                <Label className="text-xs">Scenario name</Label>
                <Input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="mt-1 h-12 rounded-2xl bg-secondary/30"
                />
              </div>

              <div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <div className="numeric-display mt-1 font-display text-4xl">
                      {showMoney(amount)}
                    </div>
                  </div>
                  <div
                    className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
                      type === "income"
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {type === "income" ? "Adds cash" : "Uses cash"}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5000}
                  step={50}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-accent"
                  aria-label="Scenario amount"
                />
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {quickAmounts.map((quickAmount) => (
                    <button
                      key={quickAmount}
                      type="button"
                      onClick={() => setAmount(quickAmount)}
                      className={`rounded-xl px-1.5 py-2 text-[11px] font-semibold transition active:scale-95 ${
                        amount === quickAmount
                          ? "bg-foreground text-background"
                          : "border border-border bg-secondary/25 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {money(quickAmount)}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={0}
                  step="50"
                  value={amount}
                  onChange={(event) => setAmount(Math.max(0, Number(event.target.value)))}
                  className="mt-3 h-11 rounded-2xl"
                  aria-label="Exact scenario amount"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs">When does it happen?</Label>
                  <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-medium text-muted-foreground">
                    {daysFromNow === 0
                      ? "Today"
                      : daysFromNow === 1
                        ? "Tomorrow"
                        : `In ${daysFromNow} days`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={daysFromNow}
                  onChange={(event) => setDaysFromNow(Number(event.target.value))}
                  className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-accent"
                  aria-label="Days from today"
                />
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>Today</span>
                  <span>15 days</span>
                  <span>30 days</span>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
                  <CalendarDays className="h-4 w-4 text-accent" />
                  {result.scenarioDate.toLocaleDateString("en-CA", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-border bg-secondary/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold">Sensitivity band</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Pressure-test the amount if reality lands above or below your estimate.
                    </div>
                  </div>
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-accent">
                    ±{sensitivity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={sensitivity}
                  onChange={(event) => setSensitivity(Number(event.target.value))}
                  className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-accent"
                  aria-label="Scenario sensitivity percentage"
                />
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>Exact</span>
                  <span>±25%</span>
                  <span>±50%</span>
                </div>
              </div>
            </div>
          </section>

          <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
            <div className="pointer-events-none absolute -bottom-24 -left-14 h-52 w-52 rounded-full bg-accent/[0.08] blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Zap className="h-3.5 w-3.5 text-primary-glow" /> Expected result
                  </div>
                  <div className="numeric-display mt-4 truncate font-display text-[3.35rem] leading-none sm:text-7xl">
                    {showMoney(result.plan.projected)}
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    After {label.trim() || "this scenario"} · {showMoney(result.delta)} vs baseline
                  </div>
                </div>
                <div className={`rounded-2xl border px-3 py-2 text-center ${tone.panel}`}>
                  <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                    Plan
                  </div>
                  <div className={`mt-0.5 font-semibold ${tone.text}`}>{result.plan.status}</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2.5">
                <HeroMetric label="Baseline" value={showMoney(result.baseline.projected)} />
                <HeroMetric label="Low point" value={showMoney(result.plan.lowest)} />
                <HeroMetric label="Buffer after" value={showMoney(result.bufferAfter)} />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="eyebrow">Outcome range</div>
                <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">
                  Don&apos;t trust one number
                </h2>
              </div>
              <span className="text-right text-[10px] text-muted-foreground">
                ±{sensitivity}% on this decision
              </span>
            </div>
            <div className="scrollbar-none -mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible">
              <OutcomeCard
                label="Baseline"
                detail="No new decision"
                projection={result.baseline}
                amount={null}
                hidden={balancesHidden}
                emphasis="muted"
              />
              <OutcomeCard
                label="Better"
                detail={type === "income" ? "More income" : "Lower cost"}
                projection={result.better}
                amount={result.betterAmount}
                hidden={balancesHidden}
                emphasis="success"
              />
              <OutcomeCard
                label="Your plan"
                detail="Exact amount"
                projection={result.plan}
                amount={amount}
                hidden={balancesHidden}
                emphasis="primary"
              />
              <OutcomeCard
                label="Stress"
                detail={type === "income" ? "Less income" : "Higher cost"}
                projection={result.stress}
                amount={result.stressAmount}
                hidden={balancesHidden}
                emphasis="warning"
              />
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-accent" />
              <h2 className="font-semibold">Baseline vs your plan</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              The same 30-day schedule, with only this one decision changed.
            </p>
            <div className="mt-5 space-y-4">
              <ComparisonRow
                label="Baseline forecast"
                value={result.baseline.projected}
                max={Math.max(
                  result.currentCash,
                  result.baseline.projected,
                  result.plan.projected,
                  1,
                )}
                hidden={balancesHidden}
                tone="muted"
              />
              <ComparisonRow
                label="With your plan"
                value={result.plan.projected}
                max={Math.max(
                  result.currentCash,
                  result.baseline.projected,
                  result.plan.projected,
                  1,
                )}
                hidden={balancesHidden}
                tone={
                  result.plan.status === "Safe"
                    ? "success"
                    : result.plan.status === "Tight"
                      ? "warning"
                      : "danger"
                }
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric
                icon={type === "income" ? ArrowUpRight : ArrowDownRight}
                label="Cash impact"
                value={`${result.delta >= 0 ? "+" : ""}${showMoney(result.delta)}`}
                tone={result.delta >= 0 ? "success" : "danger"}
              />
              <MiniMetric
                icon={ShieldCheck}
                label="Health preview"
                value={`${result.scoreChange >= 0 ? "+" : ""}${result.scoreChange} pts`}
                tone={result.scoreChange >= 0 ? "success" : "warning"}
              />
            </div>
          </section>

          <DecisionSignal
            type={type}
            label={label}
            plan={result.plan}
            stress={result.stress}
            sensitivity={sensitivity}
          />

          <section>
            <div className="eyebrow">Next move</div>
            <div className="scrollbar-none -mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
              <ActionCard
                to="/cash-flow"
                icon={WalletCards}
                title="Check the baseline"
                body="See which scheduled event creates the low point."
              />
              <ActionCard
                to="/payday"
                icon={CircleDollarSign}
                title="Plan the money"
                body="Give the next income a job before it arrives."
              />
              <ActionCard
                to="/debts"
                icon={CreditCard}
                title="Review debt"
                body="See where an extra payment has the most impact."
              />
            </div>
          </section>
        </>
      )}

      <p className="text-center text-[10px] leading-4 text-muted-foreground">
        Scenarios are read-only estimates. Wealthpilot does not save or change balances, bills, or
        transactions from this planner.
      </p>
    </div>
  );
}

function ScenarioSkeleton() {
  return (
    <div className="space-y-6 pb-10" aria-label="Loading scenario planner">
      <div className="h-24 animate-pulse rounded-3xl bg-secondary/45" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-3xl bg-secondary/45" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-[1.8rem] bg-secondary/55" />
      <div className="h-72 animate-pulse rounded-[2rem] bg-secondary/55" />
    </div>
  );
}

function ScenarioError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="pb-10 pt-4">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-destructive/25 bg-destructive/[0.06] p-6 text-center shadow-card sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/12 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="eyebrow mt-5">Scenario data unavailable</div>
        <h1 className="mt-2 font-display text-3xl">
          We stopped before showing a misleading result.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Your saved records were not changed. Retry the live sources before using this planner for
          a money decision.
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

function OutcomeCard({
  label,
  detail,
  projection,
  amount,
  hidden,
  emphasis,
}: {
  label: string;
  detail: string;
  projection: Projection;
  amount: number | null;
  hidden: boolean;
  emphasis: "muted" | "success" | "primary" | "warning";
}) {
  const accent =
    emphasis === "success"
      ? "border-success/25 bg-success/[0.05]"
      : emphasis === "primary"
        ? "border-primary/35 bg-primary/[0.08]"
        : emphasis === "warning"
          ? "border-warning/25 bg-warning/[0.05]"
          : "border-border bg-card";
  const status = outcomeTone(projection.status);
  return (
    <article
      className={`min-w-[13.5rem] snap-start rounded-[1.5rem] border p-4 shadow-card sm:min-w-0 ${accent}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${status.badge}`}>
          {projection.status}
        </span>
      </div>
      <div className="numeric-display mt-5 truncate font-display text-2xl">
        {hidden ? "••••" : money(projection.projected)}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        30-day cash{amount === null ? "" : ` · ${hidden ? "••••" : money(amount)} assumption`}
      </div>
    </article>
  );
}

function ComparisonRow({
  label,
  value,
  max,
  hidden,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  hidden: boolean;
  tone: "muted" | "success" | "warning" | "danger";
}) {
  const width = Math.max(4, Math.min(100, (Math.max(0, value) / max) * 100));
  const barClass =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "danger"
          ? "bg-destructive"
          : "bg-muted-foreground/40";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{hidden ? "••••" : money(value)}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "danger"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/10 text-warning";
  return (
    <div className="rounded-2xl bg-secondary/25 p-3">
      <div className={`grid h-8 w-8 place-items-center rounded-xl ${toneClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function DecisionSignal({
  type,
  label,
  plan,
  stress,
  sensitivity,
}: {
  type: ScenarioType;
  label: string;
  plan: Projection;
  stress: Projection;
  sensitivity: number;
}) {
  const resilient = plan.status === "Safe" && stress.status === "Safe";
  const tone = outcomeTone(plan.status);
  const Icon = plan.status === "Safe" ? ShieldCheck : AlertTriangle;
  const title = resilient
    ? "This decision holds up under pressure"
    : plan.status === "Safe"
      ? "The plan fits, but the stress case needs attention"
      : plan.status === "Tight"
        ? "The expected case gets too close to the buffer"
        : "The expected case creates a cash-flow risk";
  const subject = label.trim() || "This decision";
  const body = resilient
    ? `${subject} keeps the $500 buffer protected even when the amount moves by ${sensitivity}%.`
    : plan.status === "Safe"
      ? `${subject} works at the expected amount, but a ${sensitivity}% miss can weaken the buffer. Keep more room or delay until after incoming cash.`
      : plan.status === "Tight"
        ? `${subject} stays above zero but leaves less than the $500 buffer. Reduce the amount or move the timing before committing.`
        : type === "income"
          ? `${subject} is not enough to close the projected gap. Add more confirmed income or reduce scheduled outflow first.`
          : `${subject} pushes the 30-day path below zero. Reduce it, delay it, or add confirmed income first.`;

  return (
    <section className={`rounded-[1.8rem] border p-5 sm:p-6 ${tone.section}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Wealthpilot recommendation</div>
          <h2 className="mt-1 font-display text-2xl">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          <Link
            to="/cash-flow"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-semibold shadow-sm transition hover:scale-105 active:scale-95"
          >
            Inspect the baseline <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ActionCard({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: "/cash-flow" | "/payday" | "/debts";
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group min-w-[15.5rem] snap-start rounded-[1.5rem] border border-border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:border-accent/30 active:scale-[0.98] sm:min-w-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-accent" />
      </div>
      <div className="mt-4 text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{body}</div>
    </Link>
  );
}

function outcomeTone(status: ForecastStatus) {
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
