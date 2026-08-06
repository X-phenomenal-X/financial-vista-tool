import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Eye,
  EyeOff,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { totalCash } from "@/lib/coach";
import { money } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/bill-calendar")({
  head: () => ({
    meta: [
      { title: "Bill calendar — Wealthpilot" },
      {
        name: "description",
        content: "See upcoming bills, payment readiness, and projected cash before money leaves your accounts.",
      },
    ],
  }),
  component: BillCalendarPage,
});

type Bill = {
  id: string;
  name: string;
  amount: number;
  next_due_date: string;
  cadence: string;
  category: string | null;
  autopay: boolean;
  is_active: boolean;
  kind: string;
};

type Horizon = 7 | 30 | 365;

function daysUntilDate(date: string) {
  return Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86400000);
}

function dueLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

function BillCalendarPage() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const queryClient = useQueryClient();
  const db = supabase as any;
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showAmounts, setShowAmounts] = useState(true);
  const [horizon, setHorizon] = useState<Horizon>(30);
  const [form, setForm] = useState({ name: "", amount: "", due: "", cadence: "monthly", category: "Bills", autopay: false });

  const billsQuery = useQuery({
    queryKey: ["bill-calendar", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("recurring_transactions")
        .select("id,name,amount,next_due_date,cadence,category,autopay,is_active,kind")
        .eq("user_id", user!.id)
        .in("kind", ["bill", "debt_payment", "expense"])
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((bill: any) => ({ ...bill, amount: Number(bill.amount) })) as Bill[];
    },
  });

  const activeBills = (billsQuery.data ?? []).filter((bill) => bill.is_active);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthBills = activeBills.filter((bill) => {
    const date = new Date(`${bill.next_due_date}T12:00:00`);
    return date >= monthStart && date <= monthEnd;
  });
  const totalDue = monthBills.reduce((sum, bill) => sum + bill.amount, 0);
  const currentCash = totalCash(ctx);

  const timeline = useMemo(() => {
    let running = currentCash;
    return activeBills.slice(0, 24).map((bill) => {
      running -= bill.amount;
      return { ...bill, projectedBalance: running, daysAway: daysUntilDate(bill.next_due_date) };
    });
  }, [activeBills, currentCash]);

  const visibleTimeline = useMemo(() => timeline.filter((bill) => bill.daysAway <= horizon), [horizon, timeline]);
  const horizonTotal = visibleTimeline.reduce((sum, bill) => sum + bill.amount, 0);
  const projectedAfterHorizon = currentCash - horizonTotal;
  const lowestProjected = visibleTimeline.reduce((lowest, bill) => Math.min(lowest, bill.projectedBalance), currentCash);
  const overdueCount = activeBills.filter((bill) => daysUntilDate(bill.next_due_date) < 0).length;
  const dueThisWeek = activeBills.filter((bill) => {
    const days = daysUntilDate(bill.next_due_date);
    return days >= 0 && days <= 7;
  }).length;
  const nextBill = activeBills.find((bill) => daysUntilDate(bill.next_due_date) >= 0);
  const manualThisWeek = activeBills.filter((bill) => {
    const days = daysUntilDate(bill.next_due_date);
    return !bill.autopay && days >= 0 && days <= 7;
  }).length;
  const autopayTotal = monthBills
    .filter((bill) => bill.autopay)
    .reduce((sum, bill) => sum + bill.amount, 0);
  const coverage = totalDue > 0 ? currentCash / totalDue : currentCash > 0 ? Infinity : 0;
  const coveragePercent = totalDue > 0 ? Math.min(100, Math.max(0, (currentCash / totalDue) * 100)) : 100;
  const risk = lowestProjected < 0 ? "risk" : lowestProjected < 500 ? "tight" : "safe";

  function displayMoney(value: number) {
    return showAmounts ? money(value) : "••••••";
  }

  async function addBill(event: React.FormEvent) {
    event.preventDefault();
    if (!user?.id || !form.name.trim() || !form.amount || !form.due) {
      toast.error("Enter a bill name, amount, and due date.");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid bill amount.");
      return;
    }
    setSaving(true);
    const { error } = await db.from("recurring_transactions").insert({
      user_id: user.id,
      name: form.name.trim(),
      kind: "bill",
      amount,
      cadence: form.cadence,
      next_due_date: form.due,
      category: form.category || null,
      autopay: form.autopay,
      source: "manual",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bill added");
    setForm({ name: "", amount: "", due: "", cadence: "monthly", category: "Bills", autopay: false });
    setShowAdd(false);
    queryClient.invalidateQueries({ queryKey: ["bill-calendar", user.id] });
  }

  async function markPaid(bill: Bill) {
    if (!user?.id || payingId) return;
    setPayingId(bill.id);
    try {
      const next = await db.rpc("next_recurring_date", {
        current_date_value: bill.next_due_date,
        cadence_value: bill.cadence,
        interval_days: null,
      });
      if (next.error) throw next.error;
      const nextDate = next.data ?? bill.next_due_date;
      const occurrence = await db.from("recurring_transaction_occurrences").upsert({
        user_id: user.id,
        recurring_transaction_id: bill.id,
        due_date: bill.next_due_date,
        expected_amount: bill.amount,
        actual_amount: bill.amount,
        status: "paid",
        completed_at: new Date().toISOString(),
      }, { onConflict: "recurring_transaction_id,due_date" });
      if (occurrence.error) throw occurrence.error;
      const update = await db.from("recurring_transactions").update({ next_due_date: nextDate }).eq("id", bill.id);
      if (update.error) throw update.error;
      toast.success(`${bill.name} marked paid`);
      queryClient.invalidateQueries({ queryKey: ["bill-calendar", user.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark this bill paid.");
    } finally {
      setPayingId(null);
    }
  }

  if (ctx.loading || billsQuery.isLoading) {
    return (
      <div className="space-y-5 pb-8">
        <div className="h-12 animate-pulse rounded-2xl bg-secondary/60" />
        <div className="h-72 animate-pulse rounded-[2rem] bg-secondary/50" />
        <div className="h-16 animate-pulse rounded-2xl bg-secondary/40" />
        <div className="space-y-3"><div className="h-36 animate-pulse rounded-3xl bg-secondary/40" /><div className="h-36 animate-pulse rounded-3xl bg-secondary/40" /></div>
      </div>
    );
  }

  if (ctx.error || billsQuery.error) {
    return (
      <div className="mx-auto flex min-h-[62vh] max-w-lg items-center justify-center py-10">
        <div className="w-full rounded-[2rem] border border-destructive/20 bg-card p-6 text-center shadow-elevated sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="h-6 w-6" /></div>
          <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive">Live bills interrupted</div>
          <h1 className="mt-2 font-display text-3xl">Your timeline did not refresh</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Wealthpilot could not load the financial sources used for bill readiness. Your saved records have not been changed.</p>
          <Button className="mt-6 w-full rounded-2xl sm:w-auto" onClick={() => { void ctx.refetch(); void billsQuery.refetch(); }}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Payment readiness · {new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric" }).format(new Date())}</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">Bills, under control.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Know what leaves next, what needs your attention, and how much cash remains after it does.</p>
        </div>
        <Button size="icon" className="mt-1 shrink-0 rounded-2xl bg-violet-grad shadow-card" onClick={() => setShowAdd((value) => !value)} aria-label={showAdd ? "Close add bill form" : "Add bill"}>
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"><Sparkles className="h-4 w-4 text-accent" />Committed this month</div>
            <button onClick={() => setShowAmounts((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-background/40 text-muted-foreground backdrop-blur transition hover:text-foreground active:scale-95" aria-label={showAmounts ? "Hide balances" : "Show balances"}>{showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <div className="mt-4 font-display text-5xl tabular-nums tracking-tight">{displayMoney(totalDue)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span>{monthBills.length} scheduled payments</span><span>·</span><span>{dueThisWeek} due this week</span>{nextBill && <><span>·</span><span>Next: {nextBill.name}</span></>}</div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/5 bg-background/35 p-3 backdrop-blur"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash now</div><div className="mt-1 truncate font-display text-xl">{displayMoney(currentCash)}</div></div>
            <div className="rounded-2xl border border-white/5 bg-background/35 p-3 backdrop-blur"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">After month</div><div className={`mt-1 truncate font-display text-xl ${currentCash - totalDue < 0 ? "text-destructive" : ""}`}>{displayMoney(currentCash - totalDue)}</div></div>
            <div className="rounded-2xl border border-white/5 bg-background/35 p-3 backdrop-blur"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue</div><div className={`mt-1 font-display text-xl ${overdueCount > 0 ? "text-destructive" : ""}`}>{overdueCount}</div></div>
          </div>

          <div className={`mt-4 flex items-center gap-3 rounded-2xl border p-3 text-sm ${risk === "risk" ? "border-destructive/30 bg-destructive/10 text-destructive" : risk === "tight" ? "border-warning/30 bg-warning/10 text-warning" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"}`}>
            {risk === "safe" ? <ShieldCheck className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
            <div><span className="font-semibold capitalize">{risk}</span><span className="text-current/80"> · {risk === "safe" ? "Your selected timeline stays above the safety zone." : risk === "tight" ? "Your projected balance gets close to the safety buffer." : "Upcoming bills may push the projected balance below zero."}</span></div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>Monthly bill coverage</span><span>{Number.isFinite(coverage) ? `${coverage.toFixed(1)}×` : "Fully covered"}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className={`h-full rounded-full transition-all duration-700 ${coverage >= 1 ? "bg-success" : coverage >= 0.75 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${coveragePercent}%` }} /></div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className={`rounded-3xl border p-4 ${overdueCount > 0 ? "border-destructive/25 bg-destructive/8" : "border-border bg-card"}`}><div className="flex items-center justify-between"><AlertTriangle className={`h-5 w-5 ${overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}`} /><span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Attention</span></div><div className="mt-4 font-display text-2xl">{overdueCount || "Clear"}</div><p className="mt-1 text-xs text-muted-foreground">{overdueCount ? `${overdueCount} overdue payment${overdueCount === 1 ? "" : "s"}` : "No overdue bills"}</p></div>
        <div className={`rounded-3xl border p-4 ${manualThisWeek > 0 ? "border-warning/25 bg-warning/8" : "border-border bg-card"}`}><div className="flex items-center justify-between"><Clock3 className="h-5 w-5 text-warning" /><span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Manual</span></div><div className="mt-4 font-display text-2xl">{manualThisWeek}</div><p className="mt-1 text-xs text-muted-foreground">Need action within 7 days</p></div>
        <div className="rounded-3xl border border-border bg-card p-4"><div className="flex items-center justify-between"><ShieldCheck className="h-5 w-5 text-success" /><span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Auto-pay</span></div><div className="mt-4 font-display text-2xl">{displayMoney(autopayTotal)}</div><p className="mt-1 text-xs text-muted-foreground">Scheduled this month</p></div>
      </section>

      {showAdd && (
        <form onSubmit={addBill} className="overflow-hidden rounded-3xl border border-accent/25 bg-card shadow-elevated">
          <div className="border-b border-border bg-gradient-to-r from-accent/10 to-transparent px-5 py-4"><div className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-accent" /><h2 className="font-semibold">Add a recurring bill</h2></div><p className="mt-1 text-xs text-muted-foreground">It will immediately appear in your projected-balance timeline.</p></div>
          <div className="grid grid-cols-2 gap-3 p-5">
            <input className="col-span-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent/50" placeholder="Bill name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <input className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent/50" type="number" min="0" step="0.01" placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            <input className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent/50" type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} />
            <select className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none" value={form.cadence} onChange={(event) => setForm({ ...form, cadence: event.target.value })}><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select>
            <input className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-accent/50" placeholder="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            <label className="col-span-2 flex items-center justify-between rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm sm:col-span-1"><span><span className="block font-medium">Auto-pay</span><span className="text-xs text-muted-foreground">Payment runs automatically</span></span><input className="h-4 w-4" type="checkbox" checked={form.autopay} onChange={(event) => setForm({ ...form, autopay: event.target.checked })} /></label>
          </div>
          <div className="border-t border-border p-4"><Button className="w-full rounded-2xl bg-violet-grad" type="submit" disabled={saving}>{saving ? "Saving…" : "Save bill"}</Button></div>
        </form>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">Payment timeline</h2><p className="text-xs text-muted-foreground">Choose how far ahead to project your balance.</p></div>
          <Link to="/cash-flow" className="flex items-center gap-1 text-xs text-accent">Full forecast <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>

        <div className="grid grid-cols-3 rounded-2xl border border-border bg-card p-1">
          {([7, 30, 365] as Horizon[]).map((value) => (
            <button key={value} onClick={() => setHorizon(value)} className={`rounded-xl px-3 py-2 text-xs transition ${horizon === value ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground"}`}>{value === 365 ? "All saved" : `${value} days`}</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border bg-card p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Payments</div><div className="mt-1 font-display text-2xl">{visibleTimeline.length}</div></div>
          <div className="rounded-2xl border border-border bg-card p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total due</div><div className="mt-1 truncate font-display text-xl">{displayMoney(horizonTotal)}</div></div>
          <div className="rounded-2xl border border-border bg-card p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Projected</div><div className={`mt-1 truncate font-display text-xl ${projectedAfterHorizon < 0 ? "text-destructive" : ""}`}>{displayMoney(projectedAfterHorizon)}</div></div>
        </div>

        {visibleTimeline.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary"><CalendarDays className="h-6 w-6 text-accent" /></div>
            <h3 className="mt-4 font-semibold">No payments in this window</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">Expand the timeline or add your first recurring bill.</p>
            <Button className="mt-5 rounded-2xl" variant="secondary" onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" />Add bill</Button>
          </div>
        ) : (
          <div className="relative space-y-3 before:absolute before:bottom-8 before:left-[1.7rem] before:top-8 before:w-px before:bg-border">
            <div className="relative flex items-center justify-between rounded-3xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3"><div className="relative z-10 grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground"><WalletCards className="h-4 w-4" /></div><div><div className="font-semibold">Current cash</div><div className="text-xs text-muted-foreground">Starting point</div></div></div><div className="font-display text-xl">{displayMoney(currentCash)}</div>
            </div>

            {visibleTimeline.map((bill, index) => {
              const overdue = bill.daysAway < 0;
              const urgent = bill.daysAway >= 0 && bill.daysAway <= 3;
              const negative = bill.projectedBalance < 0;
              return (
                <article key={bill.id} className={`relative overflow-hidden rounded-3xl border bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated ${overdue ? "border-destructive/35" : urgent ? "border-warning/35" : "border-border"}`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${overdue ? "bg-destructive/15 text-destructive" : urgent ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"}`}>{index + 1}</div>
                        <div className="min-w-0"><div className="truncate font-semibold">{bill.name}</div><div className="mt-1 flex flex-wrap gap-1.5 text-[10px]"><span className={`rounded-full px-2 py-1 ${overdue ? "bg-destructive/10 text-destructive" : urgent ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"}`}>{dueLabel(bill.daysAway)}</span><span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{bill.autopay ? "Auto-pay" : bill.cadence}</span>{bill.category && <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{bill.category}</span>}</div></div>
                      </div>
                      <div className="shrink-0 text-right"><div className="font-display text-xl text-destructive">−{displayMoney(bill.amount)}</div><div className={`mt-1 text-xs ${negative ? "font-medium text-destructive" : "text-muted-foreground"}`}>Balance {displayMoney(bill.projectedBalance)}</div></div>
                    </div>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full transition-all duration-700 ${negative ? "bg-destructive" : bill.projectedBalance < 500 ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.max(6, Math.min(100, currentCash > 0 ? (Math.max(0, bill.projectedBalance) / currentCash) * 100 : 0))}%` }} /></div>
                    <Button className="mt-4 w-full rounded-2xl transition active:scale-[0.99]" size="sm" variant={overdue ? "default" : "secondary"} disabled={payingId === bill.id} onClick={() => markPaid(bill)}><CheckCircle2 className="mr-2 h-4 w-4" />{payingId === bill.id ? "Updating…" : "Mark paid"}</Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-border bg-card p-5 transition hover:border-accent/30"><CalendarDays className="h-5 w-5 text-accent" /><div className="mt-4 text-xs text-muted-foreground">Next 30 days</div><div className="font-display text-3xl">{activeBills.filter((bill) => { const days = daysUntilDate(bill.next_due_date); return days >= 0 && days <= 30; }).length}</div></div>
        <div className="rounded-3xl border border-border bg-card p-5 transition hover:border-accent/30"><CircleDollarSign className="h-5 w-5 text-warning" /><div className="mt-4 text-xs text-muted-foreground">Auto-pay bills</div><div className="font-display text-3xl">{activeBills.filter((bill) => bill.autopay).length}</div></div>
      </section>

      <Link to="/subscriptions" className="group flex items-center justify-between rounded-3xl border border-border bg-card p-5 transition hover:border-accent/35 active:scale-[0.99]">
        <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/10 text-accent"><TrendingDown className="h-5 w-5" /></div><div><div className="font-semibold">Trim recurring spend</div><div className="mt-1 text-xs text-muted-foreground">Review subscription cost and renewal concentration.</div></div></div><ArrowRight className="h-5 w-5 text-accent transition-transform group-hover:translate-x-0.5" />
      </Link>

      <section className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground"><div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><div><div className="font-medium text-foreground">Built for payment readiness</div><p className="mt-1">The timeline starts with current cash, subtracts each saved recurring payment, and highlights when the balance enters a tight or risky zone.</p></div></div></section>
    </div>
  );
}
