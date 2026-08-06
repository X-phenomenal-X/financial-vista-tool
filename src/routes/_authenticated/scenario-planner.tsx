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
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/scenario-planner")({
  head: () => ({
    meta: [
      { title: "Scenario Planner — Wealthpilot" },
      { name: "description", content: "Test purchases, overtime income, extra debt payments, and unexpected expenses against your live 30-day cash-flow forecast." },
    ],
  }),
  component: ScenarioPlannerPage,
});

type ScenarioType = "purchase" | "income" | "debt" | "expense";
type AccountRow = { kind: string; balance: number | string };
type RecurringRow = { amount: number | string; kind: string; next_due_date: string; is_active: boolean };

type ScenarioOption = {
  type: ScenarioType;
  title: string;
  description: string;
  defaultLabel: string;
  defaultAmount: number;
  icon: LucideIcon;
};

const CASH_KINDS = new Set(["chequing", "savings", "money_master", "cash"]);
const BUFFER = 500;

const scenarioOptions: ScenarioOption[] = [
  { type: "purchase", title: "Purchase", description: "Can I afford it?", defaultLabel: "New device", defaultAmount: 800, icon: Laptop },
  { type: "income", title: "Extra income", description: "Overtime or bonus", defaultLabel: "Overtime income", defaultAmount: 700, icon: TrendingUp },
  { type: "debt", title: "Debt payment", description: "Pay extra today", defaultLabel: "Extra debt payment", defaultAmount: 500, icon: CreditCard },
  { type: "expense", title: "Surprise cost", description: "Test an emergency", defaultLabel: "Unexpected car repair", defaultAmount: 1000, icon: Car },
];

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function ScenarioPlannerPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ScenarioType>("purchase");
  const [amount, setAmount] = useState(500);
  const [label, setLabel] = useState("Optional purchase");
  const [daysFromNow, setDaysFromNow] = useState(0);
  const [balancesHidden, setBalancesHidden] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [accountResult, recurringResult] = await Promise.all([
        supabase.from("accounts").select("kind,balance").eq("user_id", user.id),
        supabase.from("recurring_transactions").select("amount,kind,next_due_date,is_active").eq("user_id", user.id).eq("is_active", true),
      ]);
      if (!cancelled) {
        setAccounts((accountResult.data ?? []) as AccountRow[]);
        setRecurring((recurringResult.data ?? []) as RecurringRow[]);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const result = useMemo(() => {
    const currentCash = accounts.filter((account) => CASH_KINDS.has(account.kind)).reduce((sum, account) => sum + Number(account.balance || 0), 0);
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

    let baselineRunning = currentCash;
    let baselineLowest = currentCash;
    for (const event of baselineEvents) {
      baselineRunning += event.amount * event.direction;
      baselineLowest = Math.min(baselineLowest, baselineRunning);
    }

    const scenarioDirection = type === "income" ? 1 : -1;
    const scenarioEvents = [...baselineEvents, { date: scenarioDate, amount, direction: scenarioDirection }]
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = currentCash;
    let lowest = currentCash;
    for (const event of scenarioEvents) {
      running += event.amount * event.direction;
      lowest = Math.min(lowest, running);
    }

    const projected = running;
    const baseline = baselineRunning;
    const delta = projected - baseline;
    const safeToSpend = Math.max(0, lowest - BUFFER);
    const status = lowest < 0 ? "Risk" : lowest < BUFFER ? "Tight" : "Safe";
    const scoreChange = status === "Risk" ? -8 : status === "Tight" ? -4 : type === "income" ? 3 : type === "debt" ? 2 : 0;
    const bufferAfter = lowest - BUFFER;
    const baselineStatus = baselineLowest < 0 ? "Risk" : baselineLowest < BUFFER ? "Tight" : "Safe";

    return {
      currentCash,
      projected,
      baseline,
      lowest,
      baselineLowest,
      delta,
      safeToSpend,
      status,
      baselineStatus,
      scoreChange,
      scenarioDate,
      bufferAfter,
    };
  }, [accounts, recurring, type, amount, daysFromNow]);

  const selectedOption = scenarioOptions.find((option) => option.type === type) ?? scenarioOptions[0];
  const quickAmounts = type === "income" ? [250, 500, 750, 1000] : [100, 300, 500, 1000];
  const showMoney = (value: number) => balancesHidden ? "••••" : money(value);

  const statusClass = result.status === "Safe"
    ? "border-success/30 bg-success/15 text-success"
    : result.status === "Tight"
      ? "border-warning/30 bg-warning/15 text-warning"
      : "border-destructive/30 bg-destructive/15 text-destructive";

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
  }

  if (loading) {
    return (
      <div className="space-y-5 pb-8">
        <div className="h-14 animate-pulse rounded-2xl bg-secondary/60" />
        <div className="grid grid-cols-2 gap-3"><div className="h-28 animate-pulse rounded-3xl bg-secondary/50" /><div className="h-28 animate-pulse rounded-3xl bg-secondary/50" /><div className="h-28 animate-pulse rounded-3xl bg-secondary/50" /><div className="h-28 animate-pulse rounded-3xl bg-secondary/50" /></div>
        <div className="h-80 animate-pulse rounded-[30px] bg-secondary/60" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <header className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-grad shadow-card"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Decision lab</p>
          <h1 className="font-display text-2xl">Scenario Planner</h1>
        </div>
        <button type="button" onClick={() => setBalancesHidden((value) => !value)} className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:border-accent/40 hover:text-foreground active:scale-95" aria-label={balancesHidden ? "Show balances" : "Hide balances"}>
          {balancesHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </header>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">What if</p><h2 className="mt-1 font-display text-xl">Choose a decision</h2></div>
          <button type="button" onClick={resetScenario} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground active:scale-95"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {scenarioOptions.map((option) => {
            const Icon = option.icon;
            const selected = option.type === type;
            return (
              <button key={option.type} type="button" onClick={() => chooseScenario(option)} className={`group relative overflow-hidden rounded-3xl border p-4 text-left transition duration-300 active:scale-[0.98] ${selected ? "border-accent bg-accent/10 shadow-md" : "border-border bg-card hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-sm"}`}>
                {selected && <div className="absolute inset-x-0 top-0 h-0.5 bg-violet-grad" />}
                <div className={`grid h-10 w-10 place-items-center rounded-2xl transition ${selected ? "bg-accent text-accent-foreground" : "bg-secondary text-accent group-hover:scale-105"}`}><Icon className="h-4 w-4" /></div>
                <div className="mt-3 text-sm font-semibold">{option.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{option.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-3 border-b border-border p-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/10 text-accent"><selectedOption.icon className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><h2 className="font-semibold">Build your scenario</h2><p className="mt-0.5 text-xs text-muted-foreground">Changes update instantly and never edit your real records.</p></div>
          <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-medium capitalize text-muted-foreground">{type}</span>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <Label className="text-xs">Scenario name</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} className="mt-1 h-12 rounded-2xl bg-secondary/30" />
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div><Label className="text-xs">Amount</Label><div className="mt-1 font-display text-3xl tabular-nums">{showMoney(amount)}</div></div>
              <div className={`rounded-2xl px-3 py-2 text-xs font-medium ${type === "income" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{type === "income" ? "Adds cash" : "Uses cash"}</div>
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
                <button key={quickAmount} type="button" onClick={() => setAmount(quickAmount)} className={`rounded-xl px-2 py-2 text-xs font-medium transition active:scale-95 ${amount === quickAmount ? "bg-foreground text-background" : "border border-border bg-secondary/25 text-muted-foreground hover:text-foreground"}`}>{money(quickAmount)}</button>
              ))}
            </div>
            <div className="mt-3"><Input type="number" min={0} step="50" value={amount} onChange={(event) => setAmount(Math.max(0, Number(event.target.value)))} className="h-11 rounded-2xl" /></div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3"><Label className="text-xs">When does it happen?</Label><span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-medium text-muted-foreground">{daysFromNow === 0 ? "Today" : daysFromNow === 1 ? "Tomorrow" : `In ${daysFromNow} days`}</span></div>
            <input type="range" min={0} max={30} step={1} value={daysFromNow} onChange={(event) => setDaysFromNow(Number(event.target.value))} className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-accent" aria-label="Days from today" />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>Today</span><span>15 days</span><span>30 days</span></div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary/30 px-4 py-3 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4 text-accent" /> Scheduled for {result.scenarioDate.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}</div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-violet-grad p-5 text-primary-foreground shadow-elevated">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-black/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div><div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] opacity-75"><Zap className="h-3.5 w-3.5" /> 30-day result</div><div className="mt-2 font-display text-5xl tabular-nums">{showMoney(result.projected)}</div><div className="mt-2 text-sm opacity-75">After {label || "this scenario"}</div></div>
            <div className={`rounded-2xl border px-3 py-2 text-center backdrop-blur-xl ${statusClass}`}><div className="text-[9px] uppercase tracking-[0.18em]">Status</div><div className="mt-0.5 font-semibold">{result.status}</div></div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            <HeroMetric label="Baseline" value={showMoney(result.baseline)} />
            <HeroMetric label="Lowest" value={showMoney(result.lowest)} />
            <HeroMetric label="Safe spend" value={showMoney(result.safeToSpend)} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-accent" /><h2 className="font-semibold">Before vs after</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">Your saved 30-day forecast compared with this test.</p>
        <div className="mt-5 space-y-4">
          <ComparisonRow label="Baseline forecast" value={result.baseline} max={Math.max(result.currentCash, result.baseline, result.projected, 1)} hidden={balancesHidden} tone="muted" />
          <ComparisonRow label="With scenario" value={result.projected} max={Math.max(result.currentCash, result.baseline, result.projected, 1)} hidden={balancesHidden} tone={result.status === "Safe" ? "success" : result.status === "Tight" ? "warning" : "danger"} />
        </div>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-secondary/35 px-4 py-3">
          <div><div className="text-xs text-muted-foreground">Scenario impact</div><div className={`mt-1 font-semibold tabular-nums ${result.delta >= 0 ? "text-success" : "text-destructive"}`}>{result.delta >= 0 ? "+" : ""}{showMoney(result.delta)}</div></div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="text-right"><div className="text-xs text-muted-foreground">Health preview</div><div className={`mt-1 font-semibold ${result.scoreChange >= 0 ? "text-success" : "text-warning"}`}>{result.scoreChange >= 0 ? "+" : ""}{result.scoreChange} points</div></div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MetricCard icon={type === "income" ? ArrowUpRight : ArrowDownRight} label="Cash impact" value={`${result.delta >= 0 ? "+" : ""}${showMoney(result.delta)}`} tone={result.delta >= 0 ? "success" : "destructive"} />
        <MetricCard icon={ShieldCheck} label="Buffer after" value={showMoney(result.bufferAfter)} tone={result.bufferAfter >= 0 ? "success" : "warning"} />
      </section>

      <section className={`rounded-3xl border p-5 ${result.status === "Safe" ? "border-success/20 bg-success/5" : result.status === "Tight" ? "border-warning/20 bg-warning/5" : "border-destructive/20 bg-destructive/5"}`}>
        <div className="flex items-start gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${result.status === "Safe" ? "bg-success/15 text-success" : result.status === "Tight" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>
            {result.status === "Safe" ? <WalletCards className="h-4.5 w-4.5" /> : <AlertTriangle className="h-4.5 w-4.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Wealthpilot recommendation</p>
            <h2 className="mt-1 font-semibold">{result.status === "Safe" ? "This decision fits the forecast" : result.status === "Tight" ? "Possible, but the timing is tight" : "This decision creates a cash-flow risk"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {result.status === "Risk"
                ? `${label || "This scenario"} would push your forecast below zero. Delay it, reduce the amount, or add income first.`
                : result.status === "Tight"
                  ? `${label || "This scenario"} keeps you above zero but below the $500 buffer. Waiting until after more income would be safer.`
                  : type === "income"
                    ? `${label || "This income"} strengthens your forecast. Protect the $500 buffer, then consider your highest-interest debt.`
                    : type === "debt"
                      ? `${label || "This payment"} fits the 30-day forecast and improves your debt position while preserving the buffer.`
                      : `${label || "This decision"} fits within the current 30-day forecast while keeping the $500 buffer intact.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/cash-flow" className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-2 text-xs font-medium shadow-sm transition hover:scale-105 active:scale-95">Cash flow <ChevronRight className="h-3.5 w-3.5" /></Link>
              <Link to="/simulator" className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-2 text-xs font-medium shadow-sm transition hover:scale-105 active:scale-95">Debt simulator <ChevronRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link to="/payday" className="group rounded-3xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-sm active:scale-[0.98]"><CircleDollarSign className="h-5 w-5 text-accent" /><div className="mt-3 text-sm font-semibold">Plan the money</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Give income a job before spending it.</div><ChevronRight className="mt-3 h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-accent" /></Link>
        <Link to="/debts" className="group rounded-3xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-sm active:scale-[0.98]"><CreditCard className="h-5 w-5 text-accent" /><div className="mt-3 text-sm font-semibold">Review debts</div><div className="mt-1 text-xs leading-5 text-muted-foreground">See where extra payments matter most.</div><ChevronRight className="mt-3 h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-accent" /></Link>
      </section>

      <p className="text-center text-[10px] leading-4 text-muted-foreground">This is a read-only estimate based on saved balances and recurring transactions. It does not change your records.</p>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xl"><div className="text-[10px] opacity-65">{label}</div><div className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</div></div>;
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "success" | "destructive" | "warning" }) {
  const toneClass = tone === "success" ? "bg-success/10 text-success" : tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning";
  return <div className="rounded-3xl border border-border bg-card p-4 shadow-sm"><div className={`grid h-10 w-10 place-items-center rounded-2xl ${toneClass}`}><Icon className="h-4 w-4" /></div><div className="mt-3 text-xs text-muted-foreground">{label}</div><div className="mt-0.5 truncate font-display text-2xl tabular-nums">{value}</div></div>;
}

function ComparisonRow({ label, value, max, hidden, tone }: { label: string; value: number; max: number; hidden: boolean; tone: "muted" | "success" | "warning" | "danger" }) {
  const width = Math.max(4, Math.min(100, (Math.max(0, value) / max) * 100));
  const barClass = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-destructive" : "bg-muted-foreground/40";
  return <div><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{hidden ? "••••" : money(value)}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full transition-all duration-700 ${barClass}`} style={{ width: `${width}%` }} /></div></div>;
}
