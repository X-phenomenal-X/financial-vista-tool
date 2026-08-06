import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Copy,
  Gauge,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  WalletCards,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { money } from "@/lib/format";
import { cardDebts, minimumsTotal, simulate } from "@/lib/payoff";
import { useDebts } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({
    meta: [
      { title: "Debt Payoff Lab — Wealthpilot" },
      {
        name: "description",
        content:
          "Compare avalanche and snowball debt payoff plans using your live balances and interest rates.",
      },
    ],
  }),
  component: SimulatorPage,
});

type Strategy = "avalanche" | "snowball";

interface LumpSum {
  id: string;
  monthIndex: number;
  amount: number;
}

interface SavedScenario {
  id: string;
  name: string;
  monthlyPayment: number;
  strategy: Strategy;
  lumpSums: LumpSum[];
  savedAt: string;
}

function SimulatorPage() {
  const { user } = useAuth();
  const debtQuery = useDebts(user?.id);
  const debts = useMemo(() => debtQuery.data ?? [], [debtQuery.data]);
  const [monthlyPayment, setMonthlyPayment] = useState(1800);
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [lumpSums, setLumpSums] = useState<LumpSum[]>([]);
  const [scenarioName, setScenarioName] = useState("My payoff plan");
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [showExtras, setShowExtras] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const storageKey = `money-map-simulations:${user?.id ?? "guest"}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setSaved(raw ? (JSON.parse(raw) as SavedScenario[]) : []);
    } catch {
      setSaved([]);
    }
  }, [storageKey]);

  function persist(next: SavedScenario[]) {
    setSaved(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  const activeCards = useMemo(() => cardDebts(debts), [debts]);
  const minimums = useMemo(() => minimumsTotal(debts), [debts]);
  const avalanche = useMemo(
    () => simulate(debts, monthlyPayment, "avalanche", lumpSums),
    [debts, monthlyPayment, lumpSums],
  );
  const snowball = useMemo(
    () => simulate(debts, monthlyPayment, "snowball", lumpSums),
    [debts, monthlyPayment, lumpSums],
  );
  const selected = strategy === "avalanche" ? avalanche : snowball;
  const interestSaved = Math.max(0, snowball.totalInterest - avalanche.totalInterest);

  const chartData = useMemo(() => {
    const count = Math.max(avalanche.months.length, snowball.months.length);
    return Array.from({ length: count }, (_, index) => ({
      month:
        avalanche.months[index]?.month ?? snowball.months[index]?.month ?? `Month ${index + 1}`,
      Avalanche: Math.round(avalanche.months[index]?.totalBalance ?? 0),
      Snowball: Math.round(snowball.months[index]?.totalBalance ?? 0),
    }));
  }, [avalanche, snowball]);

  function addLumpSum() {
    setShowExtras(true);
    setLumpSums((items) => [...items, { id: crypto.randomUUID(), monthIndex: 0, amount: 500 }]);
  }

  function saveScenario() {
    const item: SavedScenario = {
      id: crypto.randomUUID(),
      name: scenarioName.trim() || "Payoff plan",
      monthlyPayment,
      strategy,
      lumpSums,
      savedAt: new Date().toISOString(),
    };
    persist([item, ...saved]);
    setShowSaved(true);
    toast.success("Payoff scenario saved on this device");
  }

  function loadScenario(item: SavedScenario) {
    setScenarioName(item.name);
    setMonthlyPayment(item.monthlyPayment);
    setStrategy(item.strategy);
    setLumpSums(item.lumpSums);
    if (item.lumpSums.length) setShowExtras(true);
    toast.success(`${item.name} loaded`);
  }

  function duplicateScenario(item: SavedScenario) {
    persist([
      {
        ...item,
        id: crypto.randomUUID(),
        name: `${item.name} copy`,
        savedAt: new Date().toISOString(),
      },
      ...saved,
    ]);
  }

  if (!user || debtQuery.isLoading) return <PayoffSkeleton />;

  if (debtQuery.error) {
    return <PayoffError onRetry={() => void debtQuery.refetch()} />;
  }

  if (!activeCards.length) return <PayoffEmptyState />;

  const paymentTooLow = monthlyPayment < minimums;
  const startingDebt = activeCards.reduce(
    (sum, debt) => sum + Number(debt.balance) + Number(debt.pending || 0),
    0,
  );
  const firstProjectedMonth = selected.months[Math.min(2, Math.max(0, selected.months.length - 1))];
  const projectedBalance = firstProjectedMonth?.totalBalance ?? startingDebt;
  const projectedReduction = Math.max(0, startingDebt - projectedBalance);
  const projectedPct = startingDebt > 0 ? (projectedReduction / startingDebt) * 100 : 0;
  const avalancheMonths = avalanche.debtFreeMonth ? avalanche.months.length : null;
  const snowballMonths = snowball.debtFreeMonth ? snowball.months.length : null;
  const monthDifference =
    avalancheMonths !== null && snowballMonths !== null ? snowballMonths - avalancheMonths : null;
  const firstTarget = selected.order[0];

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="pt-1">
        <Link
          to="/debts"
          className="inline-flex min-h-10 items-center gap-2 rounded-full text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Debt control
        </Link>
        <div className="eyebrow mt-2">Payoff lab · live balances</div>
        <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">
          Turn debt into a finish line.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Change the payment, compare strategies, and test extra cash without touching a single
          saved balance.
        </p>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-60 w-60 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)] lg:items-end">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> {strategy} projection
            </div>
            <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Projected debt-free
            </div>
            <div className="mt-1 font-display text-[3.15rem] leading-none tracking-[-0.035em] sm:text-6xl">
              {selected.debtFreeMonth ?? "Needs more cash"}
            </div>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              {selected.debtFreeMonth
                ? `${money(monthlyPayment)} per month across ${activeCards.length} high-interest balance${activeCards.length === 1 ? "" : "s"}${lumpSums.length ? ` plus ${lumpSums.length} extra payment${lumpSums.length === 1 ? "" : "s"}` : ""}.`
                : `The current ${money(monthlyPayment)} plan is not enough to produce a payoff inside the projection window.`}
            </p>
          </div>

          <div className="rounded-[1.55rem] border border-white/[0.09] bg-black/10 p-5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  First target
                </div>
                <div className="mt-1 truncate font-display text-2xl">
                  {firstTarget?.name ?? "—"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {firstTarget ? `${firstTarget.apr.toFixed(2)}% APR` : "No target available"}
                </div>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-accent/15 bg-accent/[0.08] text-accent">
                <Zap className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">3-month projected reduction</span>
                <span className="numeric-display font-semibold text-success">
                  {money(projectedReduction)}
                </span>
              </div>
              <Progress value={Math.min(100, projectedPct)} className="mt-2 h-2 [&>*]:bg-accent" />
              <div className="mt-2 text-[10px] text-muted-foreground">
                {projectedPct.toFixed(1)}% of simulated high-interest debt
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Metric icon={CalendarClock} label="Months" value={String(selected.months.length)} />
          <Metric icon={TrendingDown} label="Interest" value={money(selected.totalInterest)} />
          <Metric icon={WalletCards} label="Starting debt" value={money(startingDebt)} />
          <Metric icon={Gauge} label="Minimums" value={money(minimums)} />
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Plan controls</div>
            <h2 className="mt-1 font-display text-2xl">Set the monthly pace</h2>
          </div>
          <div className="hidden rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-[10px] font-semibold text-success sm:block">
            No live data changes
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <Label
              htmlFor="monthly-payment"
              className="text-xs font-semibold text-muted-foreground"
            >
              Monthly debt payment
            </Label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="monthly-payment"
                type="number"
                min={0}
                step="50"
                value={monthlyPayment}
                onChange={(event) => setMonthlyPayment(Math.max(0, Number(event.target.value)))}
                className="h-14 rounded-2xl pl-8 font-mono text-lg"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>Combined high-interest minimums</span>
              <span className="numeric-display font-semibold text-foreground">
                {money(minimums)}
              </span>
            </div>

            <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
              {[250, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setMonthlyPayment((value) => value + amount)}
                  className="min-h-10 shrink-0 rounded-full border border-border bg-secondary/45 px-3.5 text-xs font-semibold text-muted-foreground transition active:scale-[0.98] hover:border-primary/30 hover:text-foreground"
                >
                  +{money(amount)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMonthlyPayment(1800)}
                className="min-h-10 shrink-0 rounded-full border border-border bg-secondary/45 px-3.5 text-xs font-semibold text-muted-foreground transition active:scale-[0.98] hover:border-primary/30 hover:text-foreground"
              >
                Reset {money(1800)}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Payoff strategy</Label>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <StrategyCard
                label="Avalanche"
                description="Highest APR first"
                active={strategy === "avalanche"}
                debtFree={avalanche.debtFreeMonth}
                interest={avalanche.totalInterest}
                onClick={() => setStrategy("avalanche")}
              />
              <StrategyCard
                label="Snowball"
                description="Smallest balance first"
                active={strategy === "snowball"}
                debtFree={snowball.debtFreeMonth}
                interest={snowball.totalInterest}
                onClick={() => setStrategy("snowball")}
              />
            </div>
          </div>
        </div>

        {paymentTooLow && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-xs leading-5 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This payment is below your combined high-interest minimums. Increase it by at least{" "}
              {money(minimums - monthlyPayment)} before relying on this projection.
            </span>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.65rem] border border-border bg-gradient-to-br from-primary/12 via-card to-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Lowest interest</div>
              <h2 className="mt-1 font-display text-2xl">Avalanche advantage</h2>
            </div>
            <ShieldCheck className="h-5 w-5 text-accent" />
          </div>
          <div className="numeric-display mt-5 font-display text-3xl text-success">
            {money(interestSaved)}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            projected interest saved versus snowball at the same monthly payment
          </p>
        </div>

        <div className="rounded-[1.65rem] border border-border bg-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Timing</div>
              <h2 className="mt-1 font-display text-2xl">Strategy finish gap</h2>
            </div>
            <CalendarClock className="h-5 w-5 text-primary-glow" />
          </div>
          <div className="numeric-display mt-5 font-display text-3xl">
            {monthDifference === null ? "—" : `${Math.abs(monthDifference)} mo`}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {monthDifference === null
              ? "Increase the monthly payment to compare complete payoff timelines."
              : monthDifference === 0
                ? "Both strategies finish in the same projected month."
                : monthDifference > 0
                  ? "Avalanche finishes sooner at this payment level."
                  : "Snowball finishes sooner at this payment level."}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.8rem] border border-border bg-card shadow-card">
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
          <div>
            <div className="eyebrow">Payoff trajectory</div>
            <h2 className="mt-1 font-display text-2xl">Avalanche vs snowball</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Projected remaining high-interest debt using the same payment inputs.
            </p>
          </div>
          <div className="hidden text-right text-[11px] text-muted-foreground sm:block">
            <div>Avalanche · {avalanche.debtFreeMonth ?? "not projected"}</div>
            <div>Snowball · {snowball.debtFreeMonth ?? "not projected"}</div>
          </div>
        </div>
        <div className="h-[17rem] w-full px-1 pb-4 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 7"
                stroke="var(--color-border)"
                opacity={0.55}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={42}
                tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
              />
              <Tooltip
                formatter={(value) => money(Number(value))}
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-popover)",
                  color: "var(--color-popover-foreground)",
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--color-muted-foreground)" }}
              />
              <Line
                type="monotone"
                dataKey="Avalanche"
                stroke="var(--color-accent)"
                strokeWidth={2.7}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-accent)", strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="Snowball"
                stroke="var(--color-primary-glow)"
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-primary-glow)", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-5 border-t border-border/60 px-5 py-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-5 rounded-full bg-accent" /> Avalanche
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-5 rounded-full bg-primary-glow" /> Snowball
          </span>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Attack order</div>
            <h2 className="mt-1 font-display text-2xl">
              {strategy === "avalanche" ? "Highest APR first" : "Small wins first"}
            </h2>
          </div>
          <div className="text-xs capitalize text-muted-foreground">{strategy}</div>
        </div>
        <div className="mt-4 space-y-2.5">
          {selected.order.map((item, index) => (
            <div
              key={item.id}
              className="group flex items-center gap-3 rounded-[1.35rem] border border-border bg-card/82 p-4 shadow-card transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-white/[0.14]"
            >
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-semibold ${index === 0 ? "bg-accent/12 text-accent" : "bg-secondary text-muted-foreground"}`}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{item.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.apr.toFixed(2)}% APR · starts at {money(item.balance)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cleared
                </div>
                <div className="mt-0.5 text-xs font-semibold">{item.clearedMonth ?? "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.65rem] border border-border bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Credit pressure</div>
            <h2 className="mt-1 font-display text-2xl">Three-month utilization preview</h2>
          </div>
          <TrendingDown className="h-5 w-5 text-success" />
        </div>
        <div className="mt-5 space-y-4">
          {activeCards
            .filter((debt) => Number(debt.credit_limit || 0) > 0)
            .map((debt) => {
              const current =
                (Number(debt.balance) + Number(debt.pending || 0)) / Number(debt.credit_limit);
              const futureBalance =
                firstProjectedMonth?.balances.find((row) => row.debtId === debt.id)?.balance ?? 0;
              const future = futureBalance / Number(debt.credit_limit);
              return (
                <div key={debt.id}>
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="truncate font-semibold">{debt.name}</span>
                    <span
                      className={
                        future > 0.8 ? "font-semibold text-warning" : "font-semibold text-success"
                      }
                    >
                      {(current * 100).toFixed(0)}% → {(future * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, future * 100)}
                    className={`mt-2 h-1.5 ${future > 0.8 ? "[&>*]:bg-warning" : "[&>*]:bg-accent"}`}
                  />
                </div>
              );
            })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.65rem] border border-border bg-card shadow-card">
        <button
          type="button"
          onClick={() => setShowExtras((value) => !value)}
          aria-expanded={showExtras}
          className="flex min-h-16 w-full items-center justify-between gap-4 p-5 text-left"
        >
          <div>
            <div className="eyebrow">Optional accelerators</div>
            <h2 className="mt-1 font-display text-2xl">Bonus or overtime payments</h2>
            {!showExtras && (
              <p className="mt-1 text-xs text-muted-foreground">
                {lumpSums.length
                  ? `${lumpSums.length} extra payment${lumpSums.length === 1 ? "" : "s"} active`
                  : "Add one-off cash only when you want to model it."}
              </p>
            )}
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${showExtras ? "rotate-180" : ""}`}
          />
        </button>

        {showExtras && (
          <div className="border-t border-border/60 p-5 pt-4">
            <div className="space-y-2.5">
              {lumpSums.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
                >
                  <div>
                    <Label className="sr-only">Month</Label>
                    <select
                      className="h-11 w-full rounded-xl border border-input bg-background/70 px-3 text-sm"
                      value={item.monthIndex}
                      onChange={(event) =>
                        setLumpSums((rows) =>
                          rows.map((row) =>
                            row.id === item.id
                              ? { ...row, monthIndex: Number(event.target.value) }
                              : row,
                          ),
                        )
                      }
                    >
                      {Array.from({ length: 24 }, (_, index) => (
                        <option key={index} value={index}>
                          Month {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    aria-label="Lump sum amount"
                    type="number"
                    min={0}
                    step="50"
                    value={item.amount}
                    onChange={(event) =>
                      setLumpSums((rows) =>
                        rows.map((row) =>
                          row.id === item.id
                            ? { ...row, amount: Math.max(0, Number(event.target.value)) }
                            : row,
                        ),
                      )
                    }
                    className="h-11 rounded-xl"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove lump sum"
                    className="h-11 w-11 rounded-xl"
                    onClick={() => setLumpSums((rows) => rows.filter((row) => row.id !== item.id))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {!lumpSums.length && (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/25 px-4 py-4 text-xs leading-5 text-muted-foreground">
                  No one-off payments in this scenario. The projection is using your monthly amount
                  only.
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 rounded-2xl"
              onClick={addLumpSum}
            >
              <Plus /> Add extra payment
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-[1.65rem] border border-border bg-card p-5 shadow-card">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <Label htmlFor="scenario-name" className="text-xs font-semibold text-muted-foreground">
              Scenario name
            </Label>
            <Input
              id="scenario-name"
              value={scenarioName}
              onChange={(event) => setScenarioName(event.target.value)}
              className="mt-2 h-12 rounded-2xl"
            />
          </div>
          <Button type="button" className="h-12 rounded-2xl" onClick={saveScenario}>
            <Save /> Save scenario
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
          Saved scenarios stay on this device and never change live balances.
        </div>

        {!!saved.length && (
          <div className="mt-4 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => setShowSaved((value) => !value)}
              aria-expanded={showSaved}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-semibold"
            >
              <span>
                Saved scenarios <span className="ml-1 text-muted-foreground">{saved.length}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showSaved ? "rotate-180" : ""}`}
              />
            </button>
            {showSaved && (
              <div className="mt-2 space-y-2">
                {saved.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-2xl bg-secondary/35 p-3"
                  >
                    <button className="min-w-0 flex-1 text-left" onClick={() => loadScenario(item)}>
                      <div className="truncate text-sm font-semibold">{item.name}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {money(item.monthlyPayment)}/month · {item.strategy} ·{" "}
                        {item.lumpSums.length} extra
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Duplicate scenario"
                      className="rounded-xl"
                      onClick={() => duplicateScenario(item)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Delete scenario"
                      className="rounded-xl"
                      onClick={() => persist(saved.filter((row) => row.id !== item.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[1.65rem] border border-border bg-card shadow-card">
        <button
          type="button"
          onClick={() => setShowSchedule((value) => !value)}
          aria-expanded={showSchedule}
          className="flex min-h-16 w-full items-center justify-between gap-4 p-5 text-left"
        >
          <div>
            <div className="eyebrow">Projection detail</div>
            <h2 className="mt-1 font-display text-2xl">First 12 projected months</h2>
            {!showSchedule && (
              <p className="mt-1 text-xs text-muted-foreground">
                Open the month-by-month payment schedule.
              </p>
            )}
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${showSchedule ? "rotate-180" : ""}`}
          />
        </button>

        {showSchedule && (
          <div className="overflow-x-auto border-t border-border/60">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-secondary/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Month</th>
                  <th className="px-4 py-3 text-right font-semibold">Payment</th>
                  <th className="px-4 py-3 text-right font-semibold">Interest</th>
                  <th className="px-5 py-3 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {selected.months.slice(0, 12).map((month) => (
                  <tr key={month.month}>
                    <td className="px-5 py-3.5 font-semibold">{month.month}</td>
                    <td className="numeric-display px-4 py-3.5 text-right">
                      {money(month.paid.reduce((sum, item) => sum + item.amount, 0))}
                    </td>
                    <td className="numeric-display px-4 py-3.5 text-right text-muted-foreground">
                      {money(month.interest)}
                    </td>
                    <td className="numeric-display px-5 py-3.5 text-right">
                      {money(month.totalBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-start gap-2 rounded-2xl border border-border bg-card/45 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        This lab is a deterministic what-if projection. It does not schedule payments, modify
        balances, or write scenarios to Supabase.
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/10 p-3.5 backdrop-blur-xl">
      <Icon className="h-4 w-4 text-accent" />
      <div className="mt-2 truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground sm:text-[10px]">
        {label}
      </div>
      <div className="numeric-display mt-1 truncate font-display text-lg sm:text-xl">{value}</div>
    </div>
  );
}

function StrategyCard({
  label,
  description,
  active,
  debtFree,
  interest,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  debtFree: string | null;
  interest: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[7.5rem] rounded-[1.35rem] border p-3.5 text-left transition active:scale-[0.99] ${
        active
          ? "border-primary/40 bg-primary/12 shadow-card"
          : "border-border bg-secondary/25 hover:border-white/[0.14]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{label}</div>
        {active && <CheckCircle2 className="h-4 w-4 text-accent" />}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{description}</div>
      <div className="mt-3 text-xs font-semibold">{debtFree ?? "Not projected"}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{money(interest)} interest</div>
    </button>
  );
}

function PayoffSkeleton() {
  return (
    <div className="space-y-7 pb-10" aria-busy="true" aria-label="Loading payoff lab">
      <div className="space-y-3 pt-1">
        <div className="skeleton-shimmer h-3 w-28 rounded-full bg-muted" />
        <div className="skeleton-shimmer h-10 w-72 max-w-[80vw] rounded-xl bg-muted" />
        <div className="skeleton-shimmer h-4 w-full max-w-lg rounded bg-muted" />
      </div>
      <div className="skeleton-shimmer h-[23rem] rounded-[2rem] bg-card" />
      <div className="skeleton-shimmer h-72 rounded-[1.8rem] bg-card" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton-shimmer h-40 rounded-[1.65rem] bg-card" />
        <div className="skeleton-shimmer h-40 rounded-[1.65rem] bg-card" />
      </div>
      <div className="skeleton-shimmer h-80 rounded-[1.8rem] bg-card" />
    </div>
  );
}

function PayoffError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-destructive/20 bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle />
        </div>
        <div className="eyebrow mt-5 text-destructive">Payoff data interrupted</div>
        <h1 className="mt-2 font-display text-3xl">The lab could not refresh.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Wealthpilot could not load the balances required for a projection. Your saved debt data
          has not been changed.
        </p>
        <Button type="button" onClick={onRetry} className="mt-5 rounded-2xl">
          <RefreshCw /> Try again
        </Button>
      </div>
    </div>
  );
}

function PayoffEmptyState() {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
          <TrendingDown />
        </div>
        <div className="eyebrow mt-5">Payoff lab</div>
        <h1 className="mt-2 font-display text-3xl">No high-interest balances to model.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          The simulator covers active card and BNPL balances. Car loans remain on their normal
          schedule in Debt Control.
        </p>
        <Button asChild variant="outline" className="mt-5 rounded-2xl">
          <Link to="/debts">
            <ArrowLeft /> Back to Debt Control
          </Link>
        </Button>
      </div>
    </div>
  );
}
