import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarRange, Gauge, Sparkles, WalletCards } from "lucide-react";
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

const CASH_KINDS = new Set(["chequing", "savings", "money_master", "cash"]);
const BUFFER = 500;

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
    const currentCash = accounts.filter((a) => CASH_KINDS.has(a.kind)).reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    const scenarioDate = new Date(today);
    scenarioDate.setDate(scenarioDate.getDate() + Math.min(30, Math.max(0, daysFromNow)));

    const events = recurring
      .filter((item) => {
        const due = new Date(`${item.next_due_date}T00:00:00`);
        return due >= today && due <= end;
      })
      .map((item) => ({
        date: new Date(`${item.next_due_date}T00:00:00`),
        amount: Number(item.amount || 0),
        direction: item.kind === "income" ? 1 : -1,
      }));

    events.push({ date: scenarioDate, amount, direction: type === "income" ? 1 : -1 });
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = currentCash;
    let lowest = currentCash;
    for (const event of events) {
      running += event.amount * event.direction;
      lowest = Math.min(lowest, running);
    }

    const baseline = events.reduce((sum, event) => sum + (event === events.find((e) => e.date === scenarioDate && e.amount === amount) ? 0 : event.amount * event.direction), currentCash);
    const projected = running;
    const delta = projected - baseline;
    const safeToSpend = Math.max(0, lowest - BUFFER);
    const status = lowest < 0 ? "Risk" : lowest < BUFFER ? "Tight" : "Safe";
    const scoreChange = status === "Risk" ? -8 : status === "Tight" ? -4 : type === "income" ? 3 : 0;

    return { currentCash, projected, baseline, lowest, delta, safeToSpend, status, scoreChange, scenarioDate };
  }, [accounts, recurring, type, amount, daysFromNow]);

  const presets: { type: ScenarioType; label: string; amount: number }[] = [
    { type: "purchase", label: "New device", amount: 800 },
    { type: "income", label: "Overtime income", amount: 700 },
    { type: "debt", label: "Extra debt payment", amount: 500 },
    { type: "expense", label: "Unexpected car repair", amount: 1000 },
  ];

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-grad shadow-card"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
        <div>
          <h1 className="font-display text-2xl">Scenario Planner</h1>
          <p className="text-sm text-muted-foreground">Test a decision before it changes your real finances.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2">
        {presets.map((preset) => (
          <button key={preset.label} onClick={() => { setType(preset.type); setLabel(preset.label); setAmount(preset.amount); }} className="rounded-2xl border border-border bg-card p-3 text-left transition hover:border-accent/40">
            <div className="text-xs text-muted-foreground">{preset.type}</div>
            <div className="mt-1 text-sm font-medium">{preset.label}</div>
            <div className="mt-1 text-xs text-accent">{money(preset.amount)}</div>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Build your scenario</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Scenario type</Label>
            <select value={type} onChange={(e) => setType(e.target.value as ScenarioType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="purchase">Optional purchase</option><option value="income">Extra income</option><option value="debt">Extra debt payment</option><option value="expense">Unexpected expense</option>
            </select>
          </div>
          <div><Label className="text-xs">Name</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div><Label className="text-xs">Amount</Label><Input type="number" min={0} step="50" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} /></div>
          <div><Label className="text-xs">Days from today</Label><Input type="number" min={0} max={30} value={daysFromNow} onChange={(e) => setDaysFromNow(Math.min(30, Math.max(0, Number(e.target.value))))} /></div>
        </div>
      </section>

      <section className="rounded-3xl bg-violet-grad p-5 text-primary-foreground shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-xs uppercase tracking-[0.16em] opacity-75">30-day result</div><div className="mt-1 font-display text-4xl">{loading ? "—" : money(result.projected)}</div></div>
          <div className="rounded-2xl bg-white/10 px-3 py-2 text-center"><div className="text-[10px] uppercase opacity-70">Status</div><div className="font-semibold">{result.status}</div></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3"><div className="opacity-70">Lowest balance</div><div className="mt-1 font-semibold">{money(result.lowest)}</div></div>
          <div className="rounded-2xl bg-white/10 p-3"><div className="opacity-70">Safe to spend</div><div className="mt-1 font-semibold">{money(result.safeToSpend)}</div></div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">{type === "income" ? <ArrowUpRight className="h-5 w-5 text-success" /> : <ArrowDownRight className="h-5 w-5 text-destructive" />}<div className="mt-2 text-xs text-muted-foreground">Scenario impact</div><div className="font-display text-xl">{result.delta >= 0 ? "+" : ""}{money(result.delta)}</div></div>
        <div className="rounded-2xl border border-border bg-card p-4"><Gauge className="h-5 w-5 text-accent" /><div className="mt-2 text-xs text-muted-foreground">Health score preview</div><div className="font-display text-xl">{result.scoreChange >= 0 ? "+" : ""}{result.scoreChange}</div></div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">{result.status === "Safe" ? <WalletCards className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}<h2 className="font-medium">Recommendation</h2></div>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.status === "Risk" ? `${label} would push your forecast below zero. Delay it, reduce the amount, or add income first.` : result.status === "Tight" ? `${label} keeps you above zero but below the $500 buffer. Waiting until after more income would be safer.` : type === "income" ? `${label} strengthens your 30-day forecast. Direct part of it toward your highest-interest debt while protecting the $500 buffer.` : `${label} fits within the current 30-day forecast while keeping the $500 buffer intact.`}
        </p>
        <div className="mt-3 flex gap-3 text-xs"><Link to="/cash-flow" className="text-accent">Open cash-flow forecast</Link><Link to="/simulator" className="text-accent">Open debt simulator</Link></div>
      </section>

      <p className="text-center text-[10px] text-muted-foreground">This is a read-only estimate based on saved balances and recurring transactions. It does not change your records.</p>
    </div>
  );
}
