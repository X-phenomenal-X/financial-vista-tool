import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  CalendarClock,
  Copy,
  Gauge,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TrendingDown,
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
import { useAuth } from "@/hooks/use-auth";
import { useDebts } from "@/lib/queries";
import { cardDebts, minimumsTotal, simulate } from "@/lib/payoff";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({
    meta: [
      { title: "Debt Payoff Simulator — Money Map" },
      {
        name: "description",
        content: "Compare avalanche and snowball debt payoff plans using your live balances and interest rates.",
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
  const { data: debts = [], isLoading } = useDebts(user?.id);
  const [monthlyPayment, setMonthlyPayment] = useState(1800);
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [lumpSums, setLumpSums] = useState<LumpSum[]>([]);
  const [scenarioName, setScenarioName] = useState("My payoff plan");
  const [saved, setSaved] = useState<SavedScenario[]>([]);

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
      month: avalanche.months[index]?.month ?? snowball.months[index]?.month ?? `Month ${index + 1}`,
      Avalanche: Math.round(avalanche.months[index]?.totalBalance ?? 0),
      Snowball: Math.round(snowball.months[index]?.totalBalance ?? 0),
    }));
  }, [avalanche, snowball]);

  function addLumpSum() {
    setLumpSums((items) => [
      ...items,
      { id: crypto.randomUUID(), monthIndex: 0, amount: 500 },
    ]);
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
  }

  function loadScenario(item: SavedScenario) {
    setScenarioName(item.name);
    setMonthlyPayment(item.monthlyPayment);
    setStrategy(item.strategy);
    setLumpSums(item.lumpSums);
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

  if (isLoading) {
    return <div className="pt-20 text-center text-sm text-muted-foreground">Loading your debts…</div>;
  }

  if (!activeCards.length) {
    return (
      <div className="space-y-4 pb-8">
        <h1 className="font-display text-2xl">Debt payoff simulator</h1>
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <TrendingDown className="mx-auto h-8 w-8 text-success" />
          <p className="mt-3 text-sm">No active high-interest balances found.</p>
          <p className="mt-1 text-xs text-muted-foreground">Your car loan stays separate from this simulator.</p>
        </div>
      </div>
    );
  }

  const paymentTooLow = monthlyPayment < minimums;
  const firstProjectedMonth = selected.months[Math.min(2, Math.max(0, selected.months.length - 1))];

  return (
    <div className="space-y-5 pb-8">
      <header>
        <h1 className="font-display text-2xl">Debt payoff simulator</h1>
        <p className="text-xs text-muted-foreground">
          Compare strategies without changing any real balance. Your car loan remains on its normal schedule.
        </p>
      </header>

      <section className="rounded-3xl bg-hero p-5 shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Recommended plan</div>
            <div className="mt-1 flex items-center gap-2 font-display text-3xl">
              Avalanche <Sparkles className="h-5 w-5 text-accent" />
            </div>
          </div>
          <div className="rounded-2xl bg-success/15 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wider text-success">Interest saved</div>
            <div className="font-semibold tabular-nums text-success">{money(interestSaved)}</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Avalanche sends extra money to the highest APR first. With your current balances, it is the lowest-cost option.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Plan controls</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Monthly debt payment</Label>
            <Input
              type="number"
              min={0}
              step="50"
              value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(Math.max(0, Number(e.target.value)))}
            />
            <div className="mt-1 text-[11px] text-muted-foreground">
              Combined minimums: {money(minimums)}
            </div>
          </div>
          <div>
            <Label className="text-xs">View strategy</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["avalanche", "snowball"] as Strategy[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setStrategy(item)}
                  className={`rounded-xl border px-3 py-2 text-sm capitalize transition ${
                    strategy === item
                      ? "border-accent bg-accent/15 text-foreground"
                      : "border-border bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
        {paymentTooLow && (
          <p className="mt-3 rounded-xl bg-destructive/15 px-3 py-2 text-xs text-destructive">
            This payment is below your combined minimums. Increase it by at least {money(minimums - monthlyPayment)}.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Overtime or bonus payments</h2>
            <p className="text-xs text-muted-foreground">Test lump sums without changing your live data.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={addLumpSum}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {lumpSums.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <div>
                <Label className="sr-only">Month</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={item.monthIndex}
                  onChange={(e) =>
                    setLumpSums((rows) =>
                      rows.map((row) =>
                        row.id === item.id ? { ...row, monthIndex: Number(e.target.value) } : row,
                      ),
                    )
                  }
                >
                  {Array.from({ length: 24 }, (_, index) => (
                    <option key={index} value={index}>Month {index + 1}</option>
                  ))}
                </select>
              </div>
              <Input
                aria-label="Lump sum amount"
                type="number"
                min={0}
                step="50"
                value={item.amount}
                onChange={(e) =>
                  setLumpSums((rows) =>
                    rows.map((row) =>
                      row.id === item.id ? { ...row, amount: Math.max(0, Number(e.target.value)) } : row,
                    ),
                  )
                }
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove lump sum"
                onClick={() => setLumpSums((rows) => rows.filter((row) => row.id !== item.id))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {!lumpSums.length && (
            <p className="rounded-xl bg-secondary/40 px-3 py-3 text-xs text-muted-foreground">
              No extra payments added. The projection uses only your monthly amount.
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={CalendarClock} label="Debt-free" value={selected.debtFreeMonth ?? "Not projected"} />
        <Metric icon={Gauge} label="Months" value={String(selected.months.length)} />
        <Metric icon={TrendingDown} label="Interest" value={money(selected.totalInterest)} />
        <Metric icon={ArrowDown} label="Starting debt" value={money(activeCards.reduce((sum, d) => sum + Number(d.balance) + Number(d.pending || 0), 0))} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Avalanche vs snowball</h2>
            <p className="text-xs text-muted-foreground">Projected remaining high-interest debt.</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Avalanche: {avalanche.debtFreeMonth ?? "—"}</div>
            <div>Snowball: {snowball.debtFreeMonth ?? "—"}</div>
          </div>
        </div>
        <div className="mt-4 h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={28} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Line type="monotone" dataKey="Avalanche" stroke="currentColor" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Snowball" stroke="currentColor" strokeOpacity={0.35} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{strategy === "avalanche" ? "Avalanche" : "Snowball"} payoff order</h2>
        <div className="mt-3 space-y-2">
          {selected.order.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{item.name}</div>
                <div className="text-xs text-muted-foreground">{item.apr.toFixed(2)}% APR · starts at {money(item.balance)}</div>
              </div>
              <div className="text-right text-xs">
                <div className="text-muted-foreground">Cleared</div>
                <div>{item.clearedMonth ?? "Not projected"}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Projected utilization after three months</h2>
        <div className="mt-3 space-y-3">
          {activeCards.filter((d) => Number(d.credit_limit || 0) > 0).map((debt) => {
            const current = (Number(debt.balance) + Number(debt.pending || 0)) / Number(debt.credit_limit);
            const futureBalance = firstProjectedMonth?.balances.find((row) => row.debtId === debt.id)?.balance ?? 0;
            const future = futureBalance / Number(debt.credit_limit);
            return (
              <div key={debt.id}>
                <div className="flex justify-between text-xs">
                  <span>{debt.name}</span>
                  <span className={future > 0.8 ? "text-warning" : "text-success"}>
                    {(current * 100).toFixed(0)}% → {(future * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, future * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <Label className="text-xs">Scenario name</Label>
            <Input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
          </div>
          <Button className="self-end bg-violet-grad" onClick={saveScenario}>
            <Save className="mr-2 h-4 w-4" /> Save scenario
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Saved scenarios stay on this device and never change live balances.</p>

        {!!saved.length && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {saved.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl bg-secondary/40 p-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => loadScenario(item)}>
                  <div className="truncate text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {money(item.monthlyPayment)}/month · {item.strategy} · {item.lumpSums.length} extra payment{item.lumpSums.length === 1 ? "" : "s"}
                  </div>
                </button>
                <Button size="icon" variant="ghost" aria-label="Duplicate scenario" onClick={() => duplicateScenario(item)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Delete scenario" onClick={() => persist(saved.filter((row) => row.id !== item.id))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">First 12 projected months</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 text-right font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Interest</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {selected.months.slice(0, 12).map((month) => (
                <tr key={month.month}>
                  <td className="px-4 py-3">{month.month}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(month.paid.reduce((sum, item) => sum + item.amount, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{money(month.interest)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(month.totalBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <Icon className="h-4 w-4 text-accent" />
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
