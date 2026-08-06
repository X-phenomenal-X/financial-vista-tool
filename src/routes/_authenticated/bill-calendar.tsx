import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Plus, WalletCards } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { totalCash } from "@/lib/coach";
import { money } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/bill-calendar")({
  head: () => ({ meta: [{ title: "Bill calendar — Wealthpilot" }] }),
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

function BillCalendarPage() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const queryClient = useQueryClient();
  const db = supabase as any;
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", due: "", cadence: "monthly", category: "Bills", autopay: false });

  const billsQuery = useQuery({
    queryKey: ["bill-calendar", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("recurring_transactions")
        .select("id,name,amount,next_due_date,cadence,category,autopay,is_active,kind")
        .in("kind", ["bill", "debt_payment", "expense"])
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((b: any) => ({ ...b, amount: Number(b.amount) })) as Bill[];
    },
  });

  const activeBills = (billsQuery.data ?? []).filter((b) => b.is_active);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthBills = activeBills.filter((b) => {
    const d = new Date(`${b.next_due_date}T12:00:00`);
    return d >= monthStart && d <= monthEnd;
  });
  const totalDue = monthBills.reduce((sum, b) => sum + b.amount, 0);
  const currentCash = totalCash(ctx);

  const timeline = useMemo(() => {
    let running = currentCash;
    return activeBills.slice(0, 12).map((bill) => {
      running -= bill.amount;
      return { ...bill, projectedBalance: running };
    });
  }, [activeBills, currentCash]);

  async function addBill(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !form.name || !form.amount || !form.due) return;
    setSaving(true);
    const { error } = await db.from("recurring_transactions").insert({
      user_id: user.id,
      name: form.name.trim(),
      kind: "bill",
      amount: Number(form.amount),
      cadence: form.cadence,
      next_due_date: form.due,
      category: form.category || null,
      autopay: form.autopay,
      source: "manual",
    });
    setSaving(false);
    if (!error) {
      setForm({ name: "", amount: "", due: "", cadence: "monthly", category: "Bills", autopay: false });
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["bill-calendar", user.id] });
    }
  }

  async function markPaid(bill: Bill) {
    if (!user?.id) return;
    const next = await db.rpc("next_recurring_date", {
      current_date_value: bill.next_due_date,
      cadence_value: bill.cadence,
      interval_days: null,
    });
    const nextDate = next.data ?? bill.next_due_date;
    await db.from("recurring_transaction_occurrences").upsert({
      user_id: user.id,
      recurring_transaction_id: bill.id,
      due_date: bill.next_due_date,
      expected_amount: bill.amount,
      actual_amount: bill.amount,
      status: "paid",
      completed_at: new Date().toISOString(),
    }, { onConflict: "recurring_transaction_id,due_date" });
    await db.from("recurring_transactions").update({ next_due_date: nextDate }).eq("id", bill.id);
    queryClient.invalidateQueries({ queryKey: ["bill-calendar", user.id] });
  }

  if (ctx.loading || billsQuery.isLoading) return <div className="pt-20 text-center text-muted-foreground">Loading bill calendar…</div>;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Cash-flow timeline</p>
          <h1 className="font-display text-3xl">Bill calendar</h1>
        </div>
        <Button size="sm" onClick={() => setShowAdd((v) => !v)}><Plus className="mr-1 h-4 w-4" /> Add bill</Button>
      </header>

      <section className="rounded-3xl bg-hero p-6 shadow-elevated">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bills this month</div>
        <div className="mt-2 font-display text-5xl tabular-nums">{money(totalDue)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-card/60 p-3"><div className="text-xs text-muted-foreground">Count</div><div className="mt-1 font-display text-xl">{monthBills.length}</div></div>
          <div className="rounded-xl bg-card/60 p-3"><div className="text-xs text-muted-foreground">Cash now</div><div className="mt-1 font-display text-xl">{money(currentCash)}</div></div>
          <div className="rounded-xl bg-card/60 p-3"><div className="text-xs text-muted-foreground">After bills</div><div className="mt-1 font-display text-xl">{money(currentCash - totalDue)}</div></div>
        </div>
      </section>

      {showAdd && (
        <form onSubmit={addBill} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Add recurring bill</h2>
          <div className="grid grid-cols-2 gap-3">
            <input className="col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Bill name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
            <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })}>
              <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
            </select>
            <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autopay} onChange={(e) => setForm({ ...form, autopay: e.target.checked })} /> Auto-pay</label>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save bill"}</Button>
        </form>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-accent" /><h2 className="font-semibold">Projected balance</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">Starts with your current cash and subtracts upcoming active bills.</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3"><span>Current cash</span><strong>{money(currentCash)}</strong></div>
          {timeline.map((bill) => (
            <div key={bill.id} className="rounded-xl border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3"><div><div className="font-medium">{bill.name}</div><div className="text-xs text-muted-foreground">{new Date(`${bill.next_due_date}T12:00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })} · {bill.autopay ? "Auto-pay" : bill.cadence}</div></div><div className="text-right"><div className="text-destructive">−{money(bill.amount)}</div><div className="text-xs text-muted-foreground">Balance {money(bill.projectedBalance)}</div></div></div>
              <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={() => markPaid(bill)}><CheckCircle2 className="mr-1 h-4 w-4" /> Mark paid</Button>
            </div>
          ))}
          {timeline.length === 0 && <div className="rounded-xl bg-secondary/30 p-6 text-center text-sm text-muted-foreground">No bills yet. Add your first recurring bill.</div>}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4"><CalendarDays className="h-5 w-5 text-accent" /><div className="mt-3 text-xs text-muted-foreground">Next 30 days</div><div className="font-display text-2xl">{activeBills.filter((b) => { const d = new Date(`${b.next_due_date}T12:00:00`); const diff = (d.getTime() - Date.now()) / 86400000; return diff >= 0 && diff <= 30; }).length}</div></div>
        <div className="rounded-2xl border border-border bg-card p-4"><CircleDollarSign className="h-5 w-5 text-warning" /><div className="mt-3 text-xs text-muted-foreground">Auto-pay bills</div><div className="font-display text-2xl">{activeBills.filter((b) => b.autopay).length}</div></div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground"><div className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><p>Payday markers and deeper forecasting will be connected to saved payday plans in the next iteration. This version establishes the live bill timeline and recurring-payment workflow.</p></div></section>
    </div>
  );
}
